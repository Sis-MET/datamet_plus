/**
 * Validación de Comercial (fase 1): filtros de facturas, pagos y cobranza,
 * alta y anulación de facturas y pagos, y ficha de facturación del cliente.
 */
const { z } = require('zod');
const { ESTADOS, httpError } = require('./comercial.domain');

const TIPOS = ['SERVICIO', 'VENTA'];
const AREAS = ['ST', 'CAL', 'VENT'];
const MEDIOS = ['DEPOSITO', 'TRANSFERENCIA', 'EFECTIVO', 'QR', 'CHEQUE', 'OTRO'];
const REGIONALES = ['LPZ', 'SCZ'];
const TIPOS_REFERENCIA = ['COTIZACION', 'COTIZACION_CAL', 'COTIZACION_CAL_VENTA', 'NOTA_SALIDA', 'RIM', 'OTST', 'BITRIX'];
const ROLES = ['RESPONSABLE', 'COTIZO', 'COTIZO_CAL', 'EJECUTO_ST', 'APOYO_ST', 'EJECUTO_CAL', 'APOYO_CAL'];
const MAX_MONTO = 999999999999.99;

const text = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').trim();

const optionalText = (max) => z.preprocess(
  value => (value === null || value === undefined ? '' : value),
  z.union([z.string(), z.number()])
    .transform(value => text(value))
    .pipe(z.string().max(max, `Máximo ${max} caracteres.`)),
).transform(value => value || null);

const requiredText = (max, message, min = 1) => z.preprocess(
  value => (value === null || value === undefined ? '' : value),
  z.union([z.string(), z.number()], { error: message })
    .transform(value => text(value))
    .pipe(z.string().min(min, message).max(max, `Máximo ${max} caracteres.`)),
);

const date = z.iso.date({ error: 'Fecha inválida.' });

const vacioANull = (schema) => z.preprocess(value => (value === '' ? undefined : value), schema.optional());

const pagina = (fallback, max) => z.preprocess(
  value => (value === undefined || value === '' ? fallback : Number(value)),
  z.number().int().min(1).max(max),
);

/**
 * Monto en bolivianos con hasta dos decimales; acepta «1.234,50», «2.400»
 * (punto de miles, sin coma) y «1234.5».
 */
const monto = (etiqueta, { min = 0.01 } = {}) => z.preprocess(
  (value) => {
    if (typeof value === 'number') return value;
    const limpio = text(value).replace(/\s/g, '');
    if (!limpio) return undefined;
    const miles = /^-?\d{1,3}(\.\d{3})+$/.test(limpio);
    const normal = limpio.includes(',') || miles ? limpio.replace(/\./g, '').replace(',', '.') : limpio;
    return Number(normal);
  },
  z.number({ error: `${etiqueta}: escribe un monto.` })
    .refine(Number.isFinite, `${etiqueta}: monto inválido.`)
    .refine(value => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, `${etiqueta}: máximo dos decimales.`)
    .refine(value => value >= min, min > 0 ? `${etiqueta} debe ser mayor que cero.` : `${etiqueta} no puede ser negativo.`)
    .refine(value => value <= MAX_MONTO, `${etiqueta}: monto demasiado grande.`),
);

const entero = (etiqueta, { min = 0, max = 2147483647 } = {}) => z.preprocess(
  value => (value === '' || value === undefined || value === null ? undefined : Number(value)),
  z.number({ error: `${etiqueta}: número inválido.` })
    .int(`${etiqueta}: número entero.`)
    .min(min, `${etiqueta}: mínimo ${min}.`)
    .max(max, `${etiqueta}: máximo ${max}.`),
);

const opcional = (schema) => z.preprocess(value => (value === '' || value === undefined ? null : value), schema.nullable());

const filtrosBase = {
  q: vacioANull(z.string().trim().max(80)),
  cliente: vacioANull(z.string().trim().max(30)),
  desde: vacioANull(date),
  hasta: vacioANull(date),
  page: pagina(1, 10000),
  pageSize: pagina(25, 100),
};

const rango = (data) => !data.desde || !data.hasta || data.desde <= data.hasta;
const MENSAJE_RANGO = '«Desde» no puede ser posterior a «Hasta».';

const linea = z.object({
  categoriaId: entero('Categoría', { min: 1 }),
  monto: monto('Monto de la línea'),
  cantidad: opcional(entero('Cantidad', { max: 100000 })).optional().default(null),
  regional: opcional(z.enum(REGIONALES, { error: 'Regional inválida.' })).optional().default(null),
  costo: opcional(monto('Costo', { min: 0 })).optional().default(null),
  notaSalida: optionalText(60).optional().default(null),
});

const referencia = z.object({
  tipo: z.enum(TIPOS_REFERENCIA, { error: 'Tipo de referencia inválido.' }),
  valor: requiredText(80, 'Falta el número de la referencia.'),
});

const persona = z.object({
  rol: z.enum(ROLES, { error: 'Rol inválido.' }),
  usuarioId: opcional(entero('Usuario', { min: 1 })).optional().default(null),
  nombre: requiredText(120, 'Falta el nombre de la persona.', 3),
  porcentaje: opcional(z.preprocess(value => Number(value), z.number({ error: 'Porcentaje inválido.' })
    .gt(0, 'El porcentaje debe ser mayor que cero.').max(100, 'El porcentaje no puede superar 100 %.'))).optional().default(null),
});

const motivo = requiredText(300, 'Escribe el motivo (al menos 10 caracteres).', 10);

const schemas = {
  filtrosFacturas: z.object({
    ...filtrosBase,
    estado: vacioANull(z.enum(ESTADOS, { error: 'Estado inválido.' })),
    tipo: vacioANull(z.enum(TIPOS, { error: 'Tipo de factura inválido.' })),
    area: vacioANull(z.enum(AREAS, { error: 'Área inválida.' })),
  }).refine(rango, MENSAJE_RANGO),

  filtrosPagos: z.object({
    ...filtrosBase,
    estado: vacioANull(z.enum(['vigente', 'anulado', 'sin_aplicar'], { error: 'Estado inválido.' })),
  }).refine(rango, MENSAJE_RANGO),

  factura: z.object({
    numero: entero('Número de factura', { min: 1 }),
    fechaEmision: date,
    tipo: opcional(z.enum(TIPOS, { error: 'Tipo de factura inválido.' })).optional().default(null),
    clienteCodigo: optionalText(20),
    razonSocial: requiredText(255, 'Falta la razón social de la factura.', 2),
    nit: optionalText(20),
    monto: monto('Monto de la factura'),
    observacion: optionalText(1000),
    lineas: z.array(linea).min(1, 'La factura necesita al menos una línea.').max(60),
    referencias: z.array(referencia).max(20).optional().default([]),
    personas: z.array(persona).max(20).optional().default([]),
  }),

  anulacion: z.object({ motivo }),

  pago: z.object({
    fecha: date,
    monto: monto('Monto del pago'),
    medio: z.enum(MEDIOS, { error: 'Elige cómo se pagó.' }),
    clienteCodigo: optionalText(20),
    referencia: optionalText(120),
    verificacion: optionalText(120),
    observacion: optionalText(1000),
    aplicaciones: z.array(z.object({
      facturaId: entero('Factura', { min: 1 }),
      monto: monto('Monto aplicado'),
    })).max(100).optional().default([]),
  }),

  cliente: z.object({
    plazoDias: opcional(entero('Plazo de crédito', { min: 0, max: 365 })),
    correos: z.array(z.email({ error: 'Hay un correo con formato inválido.' })).max(10).optional().default([]),
    recepcion: optionalText(200),
    observacion: optionalText(500),
  }),

  busqueda: z.object({ q: vacioANull(z.string().trim().max(80)) }),

  gestion: z.object({ gestion: entero('Gestión', { min: 2020, max: 2099 }) }),

  filtrosBitrix: z.object({
    q: vacioANull(z.string().trim().max(80)),
    situacion: vacioANull(z.enum(['por_facturar', 'sin_registrar', 'etapa_desactualizada', 'con_factura', 'sin_factura'], { error: 'Situación inválida.' })),
    embudo: vacioANull(entero('Embudo', { min: 0, max: 100000 })),
    page: pagina(1, 10000),
    pageSize: pagina(25, 100),
  }),

  sincronizacion: z.object({ completa: z.boolean().optional().default(false) }),

  equivalencia: z.object({ usuarioId: opcional(entero('Persona', { min: 1 })).optional().default(null) }),
};

const parse = (name, data) => {
  const result = schemas[name].safeParse(data ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw httpError(400, issue?.message || 'Datos inválidos.');
};

module.exports = { AREAS, MEDIOS, REGIONALES, ROLES, TIPOS, TIPOS_REFERENCIA, parse };
