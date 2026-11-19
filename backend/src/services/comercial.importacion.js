/**
 * Plan de importación del libro «2026 FACTURACION metrica.xlsx» (hoja
 * FACTURAS 2026) a las tablas COM_*, sin base de datos: qué facturas, líneas,
 * referencias, personas y pagos se cargarían, qué filas se unen o corrigen y
 * por qué. Lo ejecuta scripts/comercial-importar-excel.js.
 *
 * Reglas (docs/comercial-analisis-facturacion.md, §4):
 *  - Las columnas se buscan por su encabezado (fila 3), no por su letra.
 *  - Una fila «ANULADO» es una factura anulada, sin líneas.
 *  - Dos filas con el mismo número, la misma fecha y la misma razón social son
 *    una factura repartida entre regionales (la 433): se unen.
 *  - Si un número se repite y la columna # dice otro número que no existe
 *    (la fila 152: # 149, N.º 144), se usa el de la columna #, con aviso.
 *  - Cada pago de las casillas PAGO 1 a 4 es un pago aplicado a su factura.
 */
const { fechaExcel } = require('../utils/xlsx');
const domain = require('./comercial.domain');

const HOJA = 'FACTURAS 2026';
const FILA_ENCABEZADO = 3;

// Los saltos de línea de los encabezados pasan a espacio antes de quitar lo que no es ASCII.
const normalizar = (s) => String(s ?? '')
  .replace(/\s+/g, ' ')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '')
  .toUpperCase().replace(/\s+/g, ' ').trim();

const texto = (v) => String(v ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

const numero = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
};

const monto2 = (v) => {
  const n = numero(v);
  return n === null ? null : Math.round(n * 100) / 100;
};

/** Valores que en el Excel significan «nada». */
const VACIOS = new Set(['', '-', '--', 'ANULADO', 'PENDIENTE', 'NO APLICA', 'N/A', 'NA', 'SOLO LOGISTICA', 'SIN COT', 'SIN COTIZACION']);
const vacio = (v) => {
  const n = normalizar(v);
  return VACIOS.has(n) || n.startsWith('SIN TEC') || n.startsWith('SIN NS') || n.startsWith('FALTA ');
};

/** «JOSÉ MUÑOZ» → «José Muñoz». */
const titulo = (nombre) => texto(nombre).toLowerCase().replace(/(^|[\s(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

// Encabezados (normalizados) que usa el importador, fuera de las categorías.
const COL = {
  hash: '#',
  tipo: 'TIPO DE FACTURA',
  numero: 'NO FACTURA',
  fecha: 'FECHA EMISION',
  monto: 'MONTO BS.-',
  razon: 'RAZON SOCIAL',
  tipoPago: 'TIPO DE PAGO',
  pagos: [['PAGO 1 BS', 'FECHA PAGO 1'], ['PAGO2 BS', 'FECHA PAGO 2'], ['PAGO3 BS', 'FECHA PAGO 3'], ['PAGO4 BS', 'FECHA PAGO 4']],
  verificado: 'PAGO VERIFICADO',
  notaSalida: 'NOTA DE SALIDA',
  cotizacion: 'COTIZACION DE SERVICIO',
  cotizo: 'COTIZACION ELABORADA POR',
  cotizacionCal: 'COTIZACION CAL',
  cotizoCal: 'COTIZACION CAL ELABORADA POR',
  responsable: 'RESPONSABLE BITRIX',
  cotizacionCalVenta: 'COTIZACION DE CALIBRACION CON VENTA',
  cotizoCalVenta: 'COTIZACION DE CALIBRACION CON VENTA ELABORADA POR',
  ejecutoSt: 'RESPONSABLE EJECUCION ST',
  apoyoSt: ['PERSONAL APOYO ST 1', 'PERSONAL APOYO ST 2', 'PERSONAL APOYO ST 3', 'PERSONAL APOYO ST 4'],
  ejecutoCal: 'RESPONSABLE EJECUCION CAL',
  apoyoCal: ['PERSONAL APOYO CAL 1', 'PERSONAL APOYO CAL 2'],
  regCal: 'REG ATENDIO CAL',
  regMnt: 'REG ATENDIO MNT',
  regVent: 'REG ATENDIO VENT',
  regCotizo: 'REG COTIZO',
  obs: 'OBS',
  costoIbmetro: 'MONTO REAL COTIZADO IBMETRO (ST O VENT)',
  costoComprasSt: 'COMPRAS INTERNAS VENTAS COSTO ALMACEN ST',
  costoOtrasCompras: 'MONTO REAL OTRAS COMPRAS SOLICITADAS POR EL CLIENTE',
};

// Costo de almacén de cada producto (encabezado → código de categoría).
const COSTOS = {
  'COSTO TOTAL ALMACEN PESAS CLASE M BS': 'VENT-PESAS-M',
  'COSTO TOTAL ALMACEN PESAS CLASE F BS': 'VENT-PESAS-F',
  'COSTO TOTAL ALMACEN PESAS CLASE E BS': 'VENT-PESAS-E',
  'COSTO TOTAL ALMACEN OTROS COMPONENTES ACCESORIOS (PESAS) BS': 'VENT-PESAS-ACC',
  'COSTO TOTAL ALMACEN BLZ ANALITICA BS': 'VENT-LAB-ANALITICA',
  'COSTO TOTAL ALMACEN BLZ PRECISION BS': 'VENT-LAB-PRECISION',
  'COSTO TOTAL ALMACEN OTROS COMPONENTES (LABORATORIO) BS': 'VENT-LAB-ACC',
  'COSTO TOTAL ALMACEN BLZ MESA BS': 'VENT-IND-MESA',
  'COSTO TOTAL ALMACEN BLZ BANCO BS': 'VENT-IND-BANCO',
  'COSTO TOTAL ALMACEN BLZ PISO BS': 'VENT-IND-PISO',
  'COSTO TOTAL ALMACEN OTRO TIPO DE BLZ BS': 'VENT-IND-OTRA',
  'COSTO TOTAL ALMACEN TANQUES Y SILOS BS': 'VENT-IND-TANQUES',
  'COSTO TOTAL ALMACEN OTROS COMPONENTES ACCESORIOS (INDUSTRIAL) BS': 'VENT-IND-ACC',
  'COSTO TOTAL ALMACEN BASCULA DE CAMIONES Y COMPONENTES BS': 'VENT-BASCULA',
  'COSTO TOTAL ALMACEN SOFTWARE BS': 'VENT-SOFTWARE',
};

// Cantidad de equipos de cada servicio (encabezado → código de categoría).
const CANTIDADES = {
  'NRO BLZ CAL': 'CAL-BLZ',
  'NRO PSP CAL': 'CAL-PSP',
  'NRO BLZ DIAG (STIL)': 'ST-STIL-DIAG',
  'NRO BLZ AJUST METROLOG (STIL)': 'ST-STIL-AJML',
  'NRO BLZ MNT PREV (STIL)': 'ST-STIL-MPR',
  'NRO BLZ MNT CORR (STIL)': 'ST-STIL-MCR',
  'NRO BLZ INST MONT (STIL)': 'ST-STIL-INST',
  'NRO PSP MNT (STIL)': 'ST-STIL-PSP',
  'NRO BLZ DIAG (STAC)': 'ST-STAC-DIAG',
  'NRO BLZ AJUST METROLOG (STAC)': 'ST-STAC-AJML',
  'NRO BLZ MNT. PREV REG (STAC)': 'ST-STAC-MPR',
  'NRO BLZ MNT. PREV AVANZ (STAC)': 'ST-STAC-MPA',
  'NRO BLZ INST MONT (STAC)': 'ST-STAC-INST',
  'NRO BLZ VERIF INT (STAC)': 'ST-STAC-VINT',
  'NRO BLZ CAL VENT': 'VENT-APORTE-CAL-BLZ',
  'NRO PSP CAL VENT': 'VENT-APORTE-CAL-PSP',
  'NRO BLZ INST VENT': 'VENT-APORTE-INST-ST',
};

const MEDIOS = { DEPOSITO: 'DEPOSITO', TRANSFERENCIA: 'TRANSFERENCIA', EFECTIVO: 'EFECTIVO', QR: 'QR', CHEQUE: 'CHEQUE' };
const medioDe = (v) => MEDIOS[normalizar(v)] || 'OTRO';

const regionalDe = (v) => {
  const n = normalizar(v).slice(0, 3);
  return n === 'LPZ' || n === 'SCZ' ? n : null;
};

/** Códigos de cotización dentro de un texto («0114-C04-25 1 Y 0114-C05-25 1»). */
const COTIZACION = /\d{3,4}-(?:[CS]\d+-\d+(?:-\d{2})?(?: \d+)?|\d{3,4}-\d+-\d{2})/gi;
const cotizacionesDe = (v) => [...texto(v).toUpperCase().matchAll(COTIZACION)].map(m => m[0].trim());
const notasDe = (v) => [...texto(v).toUpperCase().matchAll(/NS-\d{3,5}-\d{4}/g)].map(m => m[0]);

/** «MARIO PEÑA - LUISA ROCA» → dos personas. */
const nombresDe = (v) => (vacio(v) ? [] : texto(v).split(/\s*-\s*/).map(texto).filter(nombre => nombre.length >= 3 && !vacio(nombre)));

/** Encabezados de la fila 3: nombre normalizado → letra de columna. */
const encabezados = (filas) => {
  const fila = filas.get(FILA_ENCABEZADO) || {};
  return new Map(Object.entries(fila).map(([col, valor]) => [normalizar(valor), col]));
};

/** Índice de clientes de DataMET por nombre normalizado (sin forma jurídica ni paréntesis). */
const claveCliente = (s) => normalizar(s)
  .replace(/\(.*?\)/g, ' ')
  .replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\b(S ?A|S ?R ?L|LTDA|SRL|SA|SAM|SAFI|R ?L|DE|LA|EL|Y|S ?C)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

const indiceClientes = (clientes) => {
  const porNombre = new Map();
  const porCodigo = new Map();
  for (const cliente of clientes) {
    const codigo = String(cliente.codigo).trim();
    porCodigo.set(codigo.replace(/^0+/, ''), cliente);
    for (const nombre of [cliente.razonSocial, cliente.nombre]) {
      const clave = claveCliente(nombre);
      if (!clave) continue;
      const lista = porNombre.get(clave) || [];
      if (!lista.includes(cliente)) lista.push(cliente);
      porNombre.set(clave, lista);
    }
  }
  return { porNombre, porCodigo };
};

const palabras = (s) => new Set(claveCliente(s).split(' ').filter(p => p.length >= 4));
const comparten = (a, b) => {
  const pa = palabras(a);
  const parentesis = normalizar(a).match(/\(([^)]*)\)/);
  if (parentesis) for (const p of palabras(parentesis[1])) pa.add(p);
  return [...palabras(b)].some(p => pa.has(p));
};

/**
 * Cliente de DataMET de una factura: por nombre exacto (normalizado) o por el
 * código de cliente dentro de la cotización si los nombres comparten una
 * palabra. Si no, null (la razón social queda tal como está en la factura).
 */
const clienteDe = (razonSocial, cotizaciones, indice) => {
  const exacto = indice.porNombre.get(claveCliente(razonSocial));
  if (exacto?.length === 1) return { cliente: exacto[0], por: 'nombre' };
  for (const cot of cotizaciones) {
    const codigo = cot.split('-')[0].replace(/^0+/, '');
    const candidato = indice.porCodigo.get(codigo);
    if (candidato && codigo !== '' && (comparten(razonSocial, candidato.razonSocial) || comparten(razonSocial, candidato.nombre))) {
      return { cliente: candidato, por: 'cotizacion' };
    }
  }
  return null;
};

/** Personal de DataMET por «NOMBRE APELLIDO» normalizado (solo si es único). */
const indicePersonal = (personal) => {
  const mapa = new Map();
  for (const persona of personal) {
    for (const clave of persona.claves) {
      const lista = mapa.get(clave) || [];
      lista.push(persona);
      mapa.set(clave, lista);
    }
  }
  return (nombre) => {
    const lista = mapa.get(normalizar(nombre).replace(/\(.*?\)/g, '').trim());
    return lista?.length === 1 ? lista[0] : null;
  };
};

/** Lee una fila de la hoja como factura del Excel (todavía sin unir ni validar). */
const leerFila = (fila, x, ctx) => {
  const v = (encabezado) => {
    const col = ctx.cols.get(encabezado);
    return col ? x[col] : undefined;
  };
  const razon = texto(v(COL.razon));
  const anulada = normalizar(razon) === 'ANULADO';
  const lineas = [];
  const porCodigo = new Map();
  for (const categoria of ctx.categorias) {
    const valor = monto2(x[categoria.col]);
    if (!valor) continue;
    const linea = { categoriaId: categoria.id, codigo: categoria.codigo, area: categoria.area, monto: valor, cantidad: null, regional: null, costo: null };
    lineas.push(linea);
    porCodigo.set(categoria.codigo, linea);
  }
  for (const [encabezado, codigo] of Object.entries(CANTIDADES)) {
    const n = numero(v(encabezado));
    if (n && porCodigo.has(codigo)) porCodigo.get(codigo).cantidad = Math.round(n);
  }
  for (const [encabezado, codigo] of Object.entries(COSTOS)) {
    const n = monto2(v(encabezado));
    if (n && porCodigo.has(codigo)) porCodigo.get(codigo).costo = n;
  }
  const asignarCosto = (encabezado, codigos) => {
    const n = monto2(v(encabezado));
    if (!n) return;
    const destino = codigos.map(c => porCodigo.get(c)).find(Boolean);
    if (destino) destino.costo = n;
  };
  asignarCosto(COL.costoIbmetro, ['ST-IBMETRO', 'VENT-IBMETRO']);
  asignarCosto(COL.costoComprasSt, ['ST-COMPRAS-VENTA']);
  asignarCosto(COL.costoOtrasCompras, ['ST-COMPRAS-CLIENTE', 'CAL-COMPRAS-CLIENTE', 'VENT-COMPRAS-CLIENTE']);
  const regional = { ST: regionalDe(v(COL.regMnt)), CAL: regionalDe(v(COL.regCal)), VENT: regionalDe(v(COL.regVent)) };
  const regionalCotizo = regionalDe(v(COL.regCotizo));
  for (const linea of lineas) linea.regional = regional[linea.area] || regionalCotizo;

  const referencias = [];
  const agregarRef = (tipo, valor) => {
    if (!referencias.some(r => r.valor === valor)) referencias.push({ tipo, valor });
  };
  for (const c of cotizacionesDe(v(COL.cotizacion))) agregarRef('COTIZACION', c);
  for (const c of cotizacionesDe(v(COL.cotizacionCal))) agregarRef('COTIZACION_CAL', c);
  for (const c of cotizacionesDe(v(COL.cotizacionCalVenta))) agregarRef('COTIZACION_CAL_VENTA', c);
  for (const n of notasDe(v(COL.notaSalida))) agregarRef('NOTA_SALIDA', n);

  const personas = [];
  const agregarPersona = (rol, nombre, porcentaje = null) => {
    const usuario = ctx.buscarPersona(nombre);
    const final = usuario ? usuario.nombre : titulo(nombre);
    if (personas.some(p => p.rol === rol && normalizar(p.nombre) === normalizar(final))) return;
    personas.push({ rol, usuarioId: usuario?.id ?? null, nombre: final.slice(0, 120), porcentaje });
  };
  // Dos o más responsables reparten en partes iguales; la última parte cierra el 100 %.
  const responsables = nombresDe(v(COL.responsable));
  const parte = responsables.length > 1 ? Math.floor(10000 / responsables.length) / 100 : null;
  responsables.forEach((nombre, i) => agregarPersona('RESPONSABLE', nombre, parte === null ? null
    : (i === responsables.length - 1 ? Math.round((100 - parte * (responsables.length - 1)) * 100) / 100 : parte)));
  for (const nombre of nombresDe(v(COL.cotizo))) agregarPersona('COTIZO', nombre);
  for (const nombre of [...nombresDe(v(COL.cotizoCal)), ...nombresDe(v(COL.cotizoCalVenta))]) agregarPersona('COTIZO_CAL', nombre);
  for (const nombre of nombresDe(v(COL.ejecutoSt))) agregarPersona('EJECUTO_ST', nombre);
  for (const col of COL.apoyoSt) for (const nombre of nombresDe(v(col))) agregarPersona('APOYO_ST', nombre);
  for (const nombre of nombresDe(v(COL.ejecutoCal))) agregarPersona('EJECUTO_CAL', nombre);
  for (const col of COL.apoyoCal) for (const nombre of nombresDe(v(col))) agregarPersona('APOYO_CAL', nombre);

  const fechaEmision = fechaExcel(v(COL.fecha));
  const verificacion = vacio(v(COL.verificado)) ? null : texto(v(COL.verificado)).slice(0, 120);
  // Un monto negativo en una casilla es una devolución (el cliente depositó de
  // más): se descuenta del pago anterior y queda anotada en él.
  const pagos = [];
  const devoluciones = [];
  for (const [i, [cMonto, cFecha]] of COL.pagos.entries()) {
    const valor = monto2(v(cMonto));
    if (!valor) continue;
    const fecha = fechaExcel(v(cFecha));
    if (valor > 0) {
      pagos.push({ casilla: i + 1, monto: valor, fecha, medio: medioDe(v(COL.tipoPago)), verificacion, observacion: null });
      continue;
    }
    const anterior = pagos[pagos.length - 1];
    if (!anterior || domain.centavos(anterior.monto) <= domain.centavos(-valor)) {
      devoluciones.push({ casilla: i + 1, monto: -valor });
      continue;
    }
    const nota = `Depósito de Bs ${domain.formatoBs(anterior.monto)}${anterior.fecha ? ` del ${anterior.fecha}` : ''}; devolución de Bs ${domain.formatoBs(-valor)}${fecha ? ` el ${fecha}` : ''}.`;
    anterior.monto = domain.bolivianos(domain.centavos(anterior.monto) + domain.centavos(valor));
    anterior.observacion = [anterior.observacion, nota].filter(Boolean).join(' ');
  }

  return {
    fila,
    hash: numero(v(COL.hash)),
    numero: numero(v(COL.numero)),
    tipo: normalizar(v(COL.tipo)) === 'VENTA' ? 'VENTA' : (normalizar(v(COL.tipo)) === 'SERVICIO' ? 'SERVICIO' : null),
    fechaEmision,
    monto: monto2(v(COL.monto)) ?? 0,
    razonSocial: razon,
    anulada,
    lineas,
    referencias,
    personas,
    pagos,
    devoluciones,
    observacion: vacio(v(COL.obs)) ? null : texto(v(COL.obs)),
    notas: [],
  };
};

/** Une las filas de una factura repartida entre regionales (misma fecha y razón social). */
const unir = (filas) => {
  const [primera, ...resto] = filas;
  const unida = {
    ...primera,
    monto: domain.bolivianos(filas.reduce((s, f) => s + domain.centavos(f.monto), 0)),
    lineas: filas.flatMap(f => f.lineas),
    referencias: [...primera.referencias],
    personas: [...primera.personas],
    pagos: filas.flatMap(f => f.pagos),
    devoluciones: filas.flatMap(f => f.devoluciones),
    observacion: [...new Set(filas.map(f => f.observacion).filter(Boolean))].join(' / ') || null,
    filas: filas.map(f => f.fila),
    notas: [`Unió las filas ${filas.map(f => f.fila).join(' y ')} del Excel: la factura estaba repartida entre regionales.`],
  };
  for (const otra of resto) {
    for (const r of otra.referencias) if (!unida.referencias.some(x => x.valor === r.valor)) unida.referencias.push(r);
    for (const p of otra.personas) if (!unida.personas.some(x => x.rol === p.rol && x.nombre === p.nombre)) unida.personas.push(p);
  }
  return unida;
};

/**
 * Plan completo: facturas listas para insertar (con su cliente, NIT, líneas,
 * referencias, personas y pagos), y avisos y errores por fila.
 */
const planImportacion = (filas, { categorias, clientes = [], personal = [], nits = new Map(), existentes = [] }) => {
  const cols = encabezados(filas);
  const faltan = [COL.numero, COL.fecha, COL.monto, COL.razon].filter(h => !cols.has(h));
  const cats = categorias.map(c => ({ ...c, col: cols.get(normalizar(c.excelEncabezado)) }));
  const sinColumna = cats.filter(c => !c.col).map(c => c.excelEncabezado);
  if (faltan.length || sinColumna.length) {
    throw new Error(`La hoja «${HOJA}» no tiene los encabezados esperados: ${[...faltan, ...sinColumna].join(', ')}.`);
  }
  const ctx = { cols, categorias: cats, buscarPersona: indicePersonal(personal) };
  const indice = indiceClientes(clientes);
  const avisos = [];
  const errores = [];

  const leidas = [];
  for (const [fila, x] of [...filas.entries()].sort((a, b) => a[0] - b[0])) {
    if (fila <= FILA_ENCABEZADO) continue;
    const col = cols.get(COL.numero);
    if (!col || numero(x[col]) === null) continue;
    leidas.push(leerFila(fila, x, ctx));
  }

  // Números repetidos: unir (misma fecha y razón social) o corregir con la columna #.
  const porNumero = new Map();
  for (const f of leidas) porNumero.set(f.numero, [...(porNumero.get(f.numero) || []), f]);
  const usados = new Set(leidas.map(f => f.numero));
  const facturas = [];
  for (const [num, grupo] of [...porNumero.entries()].sort((a, b) => a[0] - b[0])) {
    if (grupo.length === 1) {
      facturas.push({ ...grupo[0], filas: [grupo[0].fila] });
      continue;
    }
    const mismaFactura = grupo.every(f => f.fechaEmision === grupo[0].fechaEmision && claveCliente(f.razonSocial) === claveCliente(grupo[0].razonSocial));
    if (mismaFactura) {
      facturas.push(unir(grupo));
      avisos.push({ fila: grupo.map(f => f.fila).join(', '), numero: num, mensaje: `N.º ${num}: ${grupo.length} filas de la misma factura se unen en una.` });
      continue;
    }
    const quedan = [];
    for (const f of grupo) {
      if (f.hash && f.hash !== num && !usados.has(f.hash)) {
        usados.add(f.hash);
        facturas.push({ ...f, numero: f.hash, filas: [f.fila], notas: [`En el Excel decía N.º ${num}; la columna # dice ${f.hash} y ese número no estaba registrado.`] });
        avisos.push({ fila: f.fila, numero: f.hash, mensaje: `Fila ${f.fila}: N.º ${num} repetido; se registra como ${f.hash} (columna #).` });
      } else {
        quedan.push(f);
      }
    }
    if (quedan.length === 1) facturas.push({ ...quedan[0], filas: [quedan[0].fila] });
    else {
      for (const f of quedan) errores.push({ fila: f.fila, numero: num, mensaje: `N.º ${num} repetido con otra fecha o razón social; revisar a mano.` });
    }
  }

  const yaRegistradas = new Set(existentes.map(e => `${e.gestion}-${e.numero}`));
  const listas = [];
  let omitidas = 0;
  for (const f of facturas.sort((a, b) => a.numero - b.numero)) {
    const ref = `fila ${f.filas.join(', ')}`;
    if (!f.fechaEmision) {
      errores.push({ fila: f.filas.join(', '), numero: f.numero, mensaje: `N.º ${f.numero}: sin fecha de emisión.` });
      continue;
    }
    const gestion = domain.gestionDe(f.fechaEmision);
    if (yaRegistradas.has(`${gestion}-${f.numero}`)) {
      omitidas += 1;
      continue;
    }
    const cotizaciones = f.referencias.filter(r => r.tipo.startsWith('COTIZACION')).map(r => r.valor);
    const encontrado = f.anulada ? null : clienteDe(f.razonSocial, cotizaciones, indice);
    const cliente = encontrado?.cliente || null;
    const nit = cliente?.nit || nits.get(claveCliente(f.razonSocial)) || null;
    const notas = [...f.notas];
    if (!f.anulada) {
      if (f.lineas.some(l => l.monto < 0)) {
        errores.push({ fila: ref, numero: f.numero, mensaje: `N.º ${f.numero}: tiene montos negativos por categoría.` });
        continue;
      }
      const suma = f.lineas.reduce((s, l) => s + domain.centavos(l.monto), 0);
      if (suma !== domain.centavos(f.monto)) {
        errores.push({ fila: ref, numero: f.numero, mensaje: `N.º ${f.numero}: las categorías suman Bs ${domain.formatoBs(domain.bolivianos(suma))} y el monto es Bs ${domain.formatoBs(f.monto)}.` });
        continue;
      }
      if (f.devoluciones.length) {
        errores.push({ fila: ref, numero: f.numero, mensaje: `N.º ${f.numero}: una devolución (casilla ${f.devoluciones[0].casilla}) no tiene un pago anterior del que descontarse.` });
        continue;
      }
      const pagado = f.pagos.reduce((s, p) => s + domain.centavos(p.monto), 0);
      if (pagado > domain.centavos(f.monto)) {
        errores.push({ fila: ref, numero: f.numero, mensaje: `N.º ${f.numero}: los pagos superan el monto.` });
        continue;
      }
      for (const pago of f.pagos) {
        if (!pago.fecha) {
          pago.fecha = f.fechaEmision;
          avisos.push({ fila: ref, numero: f.numero, mensaje: `N.º ${f.numero}: el pago ${pago.casilla} no tiene fecha; se usa la de emisión.` });
        }
      }
    }
    const observacion = [f.observacion, ...notas].filter(Boolean).join(' · ').slice(0, 1000) || null;
    listas.push({
      filas: f.filas,
      origenRef: `${HOJA}, ${ref}`,
      anulada: f.anulada,
      factura: {
        numero: f.numero,
        fechaEmision: f.fechaEmision,
        tipo: f.tipo,
        clienteCodigo: cliente ? String(cliente.codigo).trim() : null,
        razonSocial: f.anulada ? '(anulada en el Excel)' : f.razonSocial.slice(0, 255),
        nit: nit ? String(nit).slice(0, 20) : null,
        monto: f.anulada ? 0 : f.monto,
        observacion,
        lineas: f.anulada ? [] : f.lineas.map(({ categoriaId, monto, cantidad, regional, costo }) => ({ categoriaId, monto, cantidad, regional, costo, notaSalida: null })),
        referencias: f.anulada ? [] : f.referencias,
        personas: f.anulada ? [] : f.personas,
      },
      pagos: f.anulada ? [] : f.pagos,
      clientePor: encontrado?.por || null,
    });
  }

  const vigentes = listas.filter(l => !l.anulada);
  return {
    hoja: HOJA,
    facturas: listas,
    avisos,
    errores,
    resumen: {
      filas: leidas.length,
      facturas: listas.length,
      anuladas: listas.length - vigentes.length,
      yaRegistradas: omitidas,
      conError: errores.length,
      monto: domain.bolivianos(vigentes.reduce((s, l) => s + domain.centavos(l.factura.monto), 0)),
      lineas: vigentes.reduce((s, l) => s + l.factura.lineas.length, 0),
      pagos: vigentes.reduce((s, l) => s + l.pagos.length, 0),
      cobrado: domain.bolivianos(vigentes.reduce((s, l) => s + l.pagos.reduce((t, p) => t + domain.centavos(p.monto), 0), 0)),
      conCliente: vigentes.filter(l => l.factura.clienteCodigo).length,
      clientePorCotizacion: vigentes.filter(l => l.clientePor === 'cotizacion').length,
      conNit: vigentes.filter(l => l.factura.nit).length,
      personas: vigentes.reduce((s, l) => s + l.factura.personas.length, 0),
      personasReconocidas: vigentes.reduce((s, l) => s + l.factura.personas.filter(p => p.usuarioId).length, 0),
      referencias: vigentes.reduce((s, l) => s + l.factura.referencias.length, 0),
    },
  };
};

module.exports = {
  HOJA,
  claveCliente,
  clienteDe,
  cotizacionesDe,
  indiceClientes,
  leerFila,
  nombresDe,
  normalizar,
  notasDe,
  planImportacion,
  titulo,
  vacio,
};
