/**
 * Reglas de Comercial (fase 1) sin base de datos: montos en centavos, estado
 * y saldo de una factura, vencimiento y mora, antigüedad de la deuda, margen
 * por regla de la categoría y los planes que validan una factura o un pago
 * antes de escribirlos. Lo usan comercial.service.js y el importador.
 */

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

/** Factor del monto sin impuestos (IVA 13 % e IT 3 %), como el Excel. */
const FACTOR_NETO = 0.84;
/** Factor de la logística: el Excel resta un 20 % fijo. */
const FACTOR_LOGISTICA = 0.80;
/** Crédito fiscal del costo de un tercero (IBMETRO, compras): el Excel usa × 0,87. */
const FACTOR_COSTO_TERCERO = 0.87;

/** Tramos de antigüedad del saldo, en días desde el vencimiento. */
const TRAMOS = Object.freeze([
  { id: 'al_dia', label: 'Sin vencer', hasta: 0 },
  { id: 'd30', label: '1 a 30 días', hasta: 30 },
  { id: 'd60', label: '31 a 60 días', hasta: 60 },
  { id: 'd90', label: '61 a 90 días', hasta: 90 },
  { id: 'mas90', label: 'Más de 90 días', hasta: Infinity },
]);

const ESTADOS = Object.freeze(['pendiente', 'parcial', 'pagada', 'anulada']);

/** Centavos enteros de un monto en bolivianos (evita sumar con coma flotante). */
const centavos = (monto) => Math.round(Number(monto) * 100);
const bolivianos = (cents) => Math.round(cents) / 100;

/** Fecha del calendario de Bolivia (UTC−4) en formato 2026-11-19. */
const hoyLaPaz = (now = new Date()) => new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

const DIA_MS = 24 * 60 * 60 * 1000;
const aFecha = (iso) => new Date(`${iso}T00:00:00Z`);
const sumarDias = (iso, dias) => new Date(aFecha(iso).getTime() + dias * DIA_MS).toISOString().slice(0, 10);
const diasEntre = (desde, hasta) => Math.round((aFecha(hasta) - aFecha(desde)) / DIA_MS);

/** Gestión de una fecha de emisión: el número de factura es único por gestión. */
const gestionDe = (fecha) => Number(String(fecha).slice(0, 4));

/** Vence a los `plazo` días de la emisión; sin plazo conocido, el mismo día (como el Excel). */
const vencimiento = (fechaEmision, plazoDias) => sumarDias(fechaEmision, Math.max(0, Number(plazoDias) || 0));

/** Estado de cobro: anulada, pagada, parcial (pagó algo) o pendiente. */
const estadoFactura = ({ estado, monto, pagado }) => {
  if (estado === 'ANULADA') return 'anulada';
  const total = centavos(monto);
  const cobrado = centavos(pagado || 0);
  if (cobrado >= total) return 'pagada';
  return cobrado > 0 ? 'parcial' : 'pendiente';
};

const tramoDe = (diasMora) => TRAMOS.find(tramo => diasMora <= tramo.hasta).id;

/**
 * Situación de cobro de una factura a una fecha: saldo, vencimiento, días
 * desde la emisión, días de mora (desde el vencimiento) y tramo.
 */
const cobroDe = ({ estado, monto, pagado, fechaEmision, plazoDias }, hoy) => {
  const situacion = estadoFactura({ estado, monto, pagado });
  const saldo = situacion === 'anulada' ? 0 : Math.max(0, bolivianos(centavos(monto) - centavos(pagado || 0)));
  const vence = vencimiento(fechaEmision, plazoDias);
  const diasMora = saldo > 0 ? Math.max(0, diasEntre(vence, hoy)) : 0;
  return {
    estado: situacion,
    saldo,
    vence,
    diasEmision: Math.max(0, diasEntre(fechaEmision, hoy)),
    diasMora,
    tramo: saldo > 0 ? tramoDe(diasMora) : null,
  };
};

/**
 * Margen de una línea según la regla de su categoría, como las columnas de
 * utilidad del Excel. Sin costo en una regla que lo necesita, el margen es
 * null («por costear»): no se inventa un 84 %.
 */
const margenLinea = ({ regla, monto, costo }) => {
  const total = Number(monto);
  if (!(total > 0)) return { neto: 0, margen: null, porcentaje: null };
  const neto = total * FACTOR_NETO;
  if (regla === 'LOGISTICA') return { neto, margen: total * FACTOR_LOGISTICA, porcentaje: FACTOR_LOGISTICA * 100 };
  if (regla === 'NETO') return { neto, margen: neto, porcentaje: FACTOR_NETO * 100 };
  if (costo === null || costo === undefined || costo === '') return { neto, margen: null, porcentaje: null };
  const costoNeto = regla === 'TERCERO' ? Number(costo) * FACTOR_COSTO_TERCERO : Number(costo);
  const margen = neto - costoNeto;
  return { neto, margen, porcentaje: (margen / total) * 100 };
};

const redondear = (valor) => (valor === null ? null : Math.round(valor * 100) / 100);

/**
 * Valida una factura nueva contra el catálogo y devuelve las líneas listas
 * para escribir. Las líneas deben sumar el monto exacto (reemplaza la columna
 * «igual» del Excel) y usar categorías vigentes.
 */
const planFactura = (factura, { categorias, existentes = [] }) => {
  const porId = new Map(categorias.map(categoria => [Number(categoria.id), categoria]));
  if (!factura.lineas.length) throw httpError(400, 'La factura necesita al menos una línea.');
  const lineas = factura.lineas.map((linea, index) => {
    const categoria = porId.get(Number(linea.categoriaId));
    if (!categoria) throw httpError(400, `La línea ${index + 1} usa una categoría que no existe.`);
    if (!categoria.vigente) throw httpError(400, `La categoría «${categoria.nombre}» ya no está vigente.`);
    return { ...linea, orden: index + 1, categoria };
  });
  const suma = lineas.reduce((total, linea) => total + centavos(linea.monto), 0);
  if (suma !== centavos(factura.monto)) {
    throw httpError(400, `Las líneas suman Bs ${formatoBs(bolivianos(suma))} y la factura es de Bs ${formatoBs(factura.monto)}: deben coincidir.`);
  }
  const gestion = gestionDe(factura.fechaEmision);
  if (existentes.some(item => Number(item.numero) === Number(factura.numero) && Number(item.gestion) === gestion)) {
    throw httpError(409, `La factura N.º ${factura.numero} de ${gestion} ya está registrada.`);
  }
  const porcentajes = factura.personas.filter(persona => persona.rol === 'RESPONSABLE' && persona.porcentaje != null);
  if (porcentajes.length) {
    const total = porcentajes.reduce((suma2, persona) => suma2 + Number(persona.porcentaje), 0);
    if (Math.abs(total - 100) > 0.01) throw httpError(400, 'Los porcentajes de los responsables deben sumar 100 %.');
  }
  return { gestion, lineas, tipo: factura.tipo || tipoPorLineas(lineas) };
};

/** Venta si alguna línea es de Ventas; si no, servicio (como la columna TIPO DE FACTURA). */
const tipoPorLineas = (lineas) => (lineas.some(linea => linea.categoria.area === 'VENT') ? 'VENTA' : 'SERVICIO');

/**
 * Valida un pago y sus aplicaciones contra las facturas (leídas con bloqueo
 * en la misma transacción). Lo aplicado no supera el pago ni el saldo de cada
 * factura; lo que sobra queda como saldo del pago (anticipo).
 */
const planPago = (pago, { facturas }) => {
  const porId = new Map(facturas.map(factura => [Number(factura.id), factura]));
  const vistas = new Set();
  let aplicado = 0;
  const aplicaciones = pago.aplicaciones.map((aplicacion) => {
    const id = Number(aplicacion.facturaId);
    if (vistas.has(id)) throw httpError(400, 'Una factura aparece dos veces en el pago.');
    vistas.add(id);
    const factura = porId.get(id);
    if (!factura) throw httpError(404, 'Una de las facturas del pago no existe.');
    if (factura.estado === 'ANULADA') throw httpError(409, `La factura N.º ${factura.numero} está anulada.`);
    const saldo = centavos(factura.monto) - centavos(factura.pagado || 0);
    const monto = centavos(aplicacion.monto);
    if (monto > saldo) {
      throw httpError(409, `A la factura N.º ${factura.numero} le quedan Bs ${formatoBs(bolivianos(Math.max(0, saldo)))} por cobrar.`);
    }
    aplicado += monto;
    return { facturaId: id, monto: bolivianos(monto) };
  });
  if (aplicado > centavos(pago.monto)) {
    throw httpError(400, `Se aplican Bs ${formatoBs(bolivianos(aplicado))} y el pago es de Bs ${formatoBs(pago.monto)}.`);
  }
  return { aplicaciones, sinAplicar: bolivianos(centavos(pago.monto) - aplicado) };
};

const formatoBs = (valor) => Number(valor).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Totales de la cobranza: por tramo, por cliente y lo cobrado sin aplicar. */
const resumenCobranza = (pendientes) => {
  const porTramo = Object.fromEntries(TRAMOS.map(tramo => [tramo.id, { facturas: 0, saldo: 0 }]));
  const porCliente = new Map();
  let total = 0;
  for (const factura of pendientes) {
    const tramo = porTramo[factura.tramo];
    tramo.facturas += 1;
    tramo.saldo += centavos(factura.saldo);
    total += centavos(factura.saldo);
    const clave = factura.clienteCodigo || `rs:${factura.razonSocial}`;
    const cliente = porCliente.get(clave) || {
      clienteCodigo: factura.clienteCodigo || null, razonSocial: factura.razonSocial, facturas: 0, saldo: 0, diasMoraMax: 0,
    };
    cliente.facturas += 1;
    cliente.saldo += centavos(factura.saldo);
    cliente.diasMoraMax = Math.max(cliente.diasMoraMax, factura.diasMora);
    porCliente.set(clave, cliente);
  }
  return {
    total: bolivianos(total),
    facturas: pendientes.length,
    tramos: TRAMOS.map(tramo => ({ id: tramo.id, label: tramo.label, facturas: porTramo[tramo.id].facturas, saldo: bolivianos(porTramo[tramo.id].saldo) })),
    clientes: [...porCliente.values()]
      .map(cliente => ({ ...cliente, saldo: bolivianos(cliente.saldo) }))
      .sort((a, b) => b.saldo - a.saldo),
  };
};

module.exports = {
  ESTADOS,
  FACTOR_COSTO_TERCERO,
  FACTOR_LOGISTICA,
  FACTOR_NETO,
  TRAMOS,
  bolivianos,
  centavos,
  cobroDe,
  diasEntre,
  estadoFactura,
  formatoBs,
  gestionDe,
  hoyLaPaz,
  httpError,
  margenLinea,
  planFactura,
  planPago,
  redondear,
  resumenCobranza,
  sumarDias,
  tipoPorLineas,
  tramoDe,
  vencimiento,
};
