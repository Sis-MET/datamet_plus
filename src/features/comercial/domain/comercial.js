/**
 * Comercial en la aplicación: etiquetas, formato de montos y fechas, filtros
 * de las listas y armado de lo que se envía al servidor. El servidor vuelve a
 * validar todo (las líneas suman el monto, el saldo alcanza, etc.).
 */

export const PAGE_SIZE = 25;

export const ESTADOS_FACTURA = {
  pendiente: { label: 'Pendiente', tone: 'warning' },
  parcial: { label: 'Pago parcial', tone: 'info' },
  pagada: { label: 'Pagada', tone: 'success' },
  anulada: { label: 'Anulada', tone: 'muted' },
};

export const ESTADOS_ORDEN = ['pendiente', 'parcial', 'pagada', 'anulada'];

export const AREAS = {
  ST: 'Soporte técnico',
  CAL: 'Calibración',
  VENT: 'Ventas',
};

export const AREAS_CORTAS = { ST: 'ST', CAL: 'CAL', VENT: 'VENT' };

export const TIPOS = { SERVICIO: 'Servicio', VENTA: 'Venta' };

export const MEDIOS = {
  DEPOSITO: 'Depósito',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
  EFECTIVO: 'Efectivo',
  CHEQUE: 'Cheque',
  OTRO: 'Otro',
};

export const REGIONALES = { LPZ: 'La Paz', SCZ: 'Santa Cruz' };

export const ROLES = {
  RESPONSABLE: 'Responsable comercial',
  COTIZO: 'Elaboró la cotización',
  COTIZO_CAL: 'Elaboró la cotización de calibración',
  EJECUTO_ST: 'Ejecutó (Soporte técnico)',
  APOYO_ST: 'Apoyo (Soporte técnico)',
  EJECUTO_CAL: 'Ejecutó (Calibración)',
  APOYO_CAL: 'Apoyo (Calibración)',
};

export const REFERENCIAS = {
  COTIZACION: 'Cotización',
  COTIZACION_CAL: 'Cotización de calibración',
  COTIZACION_CAL_VENTA: 'Cotización de calibración con venta',
  NOTA_SALIDA: 'Nota de salida',
  RIM: 'RIM',
  OTST: 'OTST',
  BITRIX: 'Negociación de Bitrix24',
};

export const ORIGENES = { MANUAL: 'Registrada en DataMET+', EXCEL: 'Importada del Excel', SIN: 'Sistema de facturación' };

export const REGLAS = {
  NETO: 'Neto de impuestos (× 0,84)',
  LOGISTICA: 'Logística (× 0,80)',
  PRODUCTO: 'Neto menos costo de almacén',
  TERCERO: 'Neto menos costo del tercero',
};

export const TRAMO_TONO = { al_dia: 'success', d30: 'info', d60: 'warning', d90: 'warning', mas90: 'danger' };

export const ACCIONES_HISTORIAL = {
  REGISTRO: 'Registro',
  IMPORTACION: 'Importación',
  ANULACION: 'Anulación',
  ACTUALIZACION: 'Actualización',
};

const NUMERO = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ENTERO = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 });

/** «Bs 1.234,50». */
export const bs = (valor) => (valor === null || valor === undefined || Number.isNaN(Number(valor)) ? '—' : `Bs ${NUMERO.format(Number(valor))}`);

/** «Bs 5,80 M» o «Bs 784 mil» para los totales grandes. */
export const bsCorto = (valor) => {
  const n = Number(valor) || 0;
  if (Math.abs(n) >= 1000000) return `Bs ${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 }).format(n / 1000000)} M`;
  if (Math.abs(n) >= 10000) return `Bs ${ENTERO.format(Math.round(n / 1000))} mil`;
  return bs(n);
};

/** «2026-11-18» → «18/11/2026». */
export const fecha = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');

/** «2026-11-18T14:05:00» (hora UTC del servidor) → «18/11/2026 10:05» en Bolivia. */
export const fechaHora = (iso) => {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 19)}Z`);
  if (Number.isNaN(d.getTime())) return fecha(iso);
  const local = new Date(d.getTime() - 4 * 60 * 60 * 1000).toISOString();
  return `${fecha(local.slice(0, 10))} ${local.slice(11, 16)}`;
};

/** Hoy en Bolivia, «2026-11-19». */
export const hoyLaPaz = (now = new Date()) => new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Lee un monto escrito «1.234,50», «1234,5», «2.400» (miles) o «1234.5»; null
 * si no es un número. Sin coma, un punto seguido de grupos de tres cifras es
 * separador de miles, como se escribe en Bolivia.
 */
export const leerMonto = (texto) => {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  const limpio = String(texto ?? '').replace(/\s/g, '').replace(/^Bs\.?/i, '');
  if (!limpio) return null;
  const miles = /^-?\d{1,3}(\.\d{3})+$/.test(limpio);
  const normal = limpio.includes(',') || miles ? limpio.replace(/\./g, '').replace(',', '.') : limpio;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
};

export const centavos = (valor) => Math.round((Number(valor) || 0) * 100);

/** Suma de montos escritos, en bolivianos, sin errores de coma flotante. */
export const sumar = (valores) => valores.reduce((total, valor) => total + centavos(leerMonto(valor)), 0) / 100;

export const filtrosVacios = () => ({ q: '', estado: '', tipo: '', area: '', desde: '', hasta: '' });

export const hayFiltros = (filtros) => Object.values(filtros).some(Boolean);

export const filtrosAParams = (filtros, page, pageSize = PAGE_SIZE) => ({
  ...Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor !== '' && valor !== null && valor !== undefined)),
  page,
  pageSize,
});

/** Categorías del catálogo como opciones agrupadas por área. */
export const opcionesCategorias = (categorias) => (categorias || [])
  .filter(categoria => categoria.vigente)
  .map(categoria => ({ value: String(categoria.id), label: categoria.nombre, group: AREAS[categoria.area] }));

export const lineaVacia = () => ({ clave: Math.random().toString(36).slice(2), categoriaId: '', monto: '', cantidad: '', regional: '' });

/** Estado del cuadre: cuánto suman las líneas y si coincide con el monto. */
export const cuadre = (monto, lineas) => {
  const total = leerMonto(monto);
  const suma = sumar(lineas.map(linea => linea.monto));
  return { total, suma, cuadra: total !== null && total > 0 && centavos(total) === centavos(suma), diferencia: (centavos(total) - centavos(suma)) / 100 };
};

/** Lo que se envía para registrar una factura desde el formulario. */
export const facturaDesdeFormulario = (form, personal = []) => {
  const nombreDe = id => personal.find(persona => String(persona.id) === String(id))?.nombre || '';
  const responsables = [form.responsable1, form.responsable2].filter(Boolean);
  const personas = responsables.map(id => ({
    rol: 'RESPONSABLE', usuarioId: Number(id), nombre: nombreDe(id), porcentaje: responsables.length > 1 ? 50 : null,
  }));
  if (form.cotizo) personas.push({ rol: 'COTIZO', usuarioId: Number(form.cotizo), nombre: nombreDe(form.cotizo), porcentaje: null });
  const referencias = [
    ['COTIZACION', form.cotizacion],
    ['COTIZACION_CAL', form.cotizacionCal],
    ['NOTA_SALIDA', form.notaSalida],
  ].flatMap(([tipo, valor]) => String(valor || '').split(/[;,]/).map(v => v.trim().toUpperCase()).filter(Boolean).map(v => ({ tipo, valor: v })));
  return {
    numero: Number(form.numero),
    fechaEmision: form.fechaEmision,
    clienteCodigo: form.cliente?.codigo || null,
    razonSocial: form.razonSocial.trim(),
    nit: form.nit.trim() || null,
    monto: leerMonto(form.monto),
    observacion: form.observacion.trim() || null,
    lineas: form.lineas
      .filter(linea => linea.categoriaId || linea.monto)
      .map(linea => ({
        categoriaId: Number(linea.categoriaId),
        monto: leerMonto(linea.monto),
        cantidad: linea.cantidad === '' ? null : Number(linea.cantidad),
        regional: linea.regional || null,
      })),
    referencias,
    personas,
  };
};

/** Problemas a corregir antes de enviar la factura (el servidor revisa lo mismo). */
export const problemasFactura = (form) => {
  const problemas = {};
  if (!(Number(form.numero) > 0)) problemas.numero = 'Escribe el número de la factura.';
  if (!form.fechaEmision) problemas.fechaEmision = 'Elige la fecha de emisión.';
  if (form.razonSocial.trim().length < 2) problemas.razonSocial = 'Escribe la razón social tal como sale en la factura.';
  const monto = leerMonto(form.monto);
  if (!(monto > 0)) problemas.monto = 'Escribe el monto de la factura.';
  const lineas = form.lineas.filter(linea => linea.categoriaId || linea.monto);
  if (!lineas.length) problemas.lineas = 'Agrega al menos una línea.';
  else if (lineas.some(linea => !linea.categoriaId || !(leerMonto(linea.monto) > 0))) problemas.lineas = 'Cada línea necesita una categoría y un monto.';
  else if (!cuadre(form.monto, lineas).cuadra) problemas.lineas = 'Las líneas deben sumar el monto de la factura.';
  return problemas;
};

/** Reparte un pago entre facturas en orden, sin pasar el saldo de cada una. */
export const repartirPago = (monto, facturas) => {
  let resto = centavos(leerMonto(monto) || 0);
  return facturas.map((factura) => {
    const aplicado = Math.min(resto, centavos(factura.saldo));
    resto -= aplicado;
    return { facturaId: factura.id, monto: aplicado / 100 };
  });
};

export const iniciales = (nombre) => String(nombre || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
