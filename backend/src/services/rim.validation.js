/**
 * Validación del módulo Registros RIM: filtros del historial, anulación,
 * cierre de talonarios y alta de un RIM desde el formulario web.
 */
const { z } = require('zod');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Código del RIM numerado: RIM-AA-NNNN ("RIM-26-0042"). */
const RIM_CODE = /^RIM-(\d{2})-(\d{4,5})$/;

const MAX_FIRMA_BYTES = 1024 * 1024;
const MAX_FOTO_BYTES = 3 * 1024 * 1024;
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

const AREAS = ['calibracion', 'soporte', 'directo'];
const ORIGENES = ['servicemet', 'datametplus'];
const ESTADOS_COMPONENTE = ['present', 'missing', 'na'];
const ESTADOS_GENERALES = ['excellent', 'good', 'fair', 'poor', 'critical'];
const NIVELES_SUCIEDAD = ['clean', 'light', 'moderate', 'heavy'];
const MOTIVOS_CIERRE = ['telefono_perdido', 'reinstalacion', 'otro'];

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

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

/** Fecha «2026-10-19» del calendario (hora de Bolivia). */
const date = z.iso.date({ error: 'Fecha inválida.' });

/** `RIM-26-0042` para la gestión 2026 y el número 42. */
const rimCodigo = (gestion, numero) =>
  `RIM-${String(gestion % 100).padStart(2, '0')}-${String(numero).padStart(4, '0')}`;

/** Gestión y número de un código RIM-AA-NNNN; null si es otro formato. */
const leerCodigo = (codigo) => {
  const match = RIM_CODE.exec(String(codigo ?? '').trim().toUpperCase());
  if (!match) return null;
  const numero = Number(match[2]);
  return numero >= 1 ? { gestion: 2000 + Number(match[1]), numero } : null;
};

/** PNG o foto enviada como data URL; devuelve el contenido en bytes. */
const dataUrl = ({ tipos, maxBytes, etiqueta }) => z.string({ error: `Falta ${etiqueta}.` })
  .transform((value, ctx) => {
    const match = /^data:([a-z/]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value.trim());
    if (!match || !tipos.includes(match[1])) {
      ctx.addIssue({ code: 'custom', message: `${etiqueta} no tiene un formato válido.` });
      return z.NEVER;
    }
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > maxBytes) {
      ctx.addIssue({ code: 'custom', message: `${etiqueta} supera el tamaño permitido.` });
      return z.NEVER;
    }
    return { tipo: match[1], bytes };
  });

const firma = (etiqueta) => dataUrl({ tipos: ['image/png'], maxBytes: MAX_FIRMA_BYTES, etiqueta })
  .refine(value => value.bytes.subarray(0, PNG.length).equals(PNG), `${etiqueta} debe ser una imagen PNG.`)
  .transform(value => value.bytes);

const pagina = (fallback, max) => z.preprocess(
  value => (value === undefined || value === '' ? fallback : Number(value)),
  z.number().int().min(1).max(max),
);

const vacioANull = (schema) => z.preprocess(value => (value === '' ? undefined : value), schema.optional());

const schemas = {
  filtros: z.object({
    q: vacioANull(z.string().trim().max(80)),
    cliente: vacioANull(z.string().trim().max(30)),
    planta: vacioANull(z.string().trim().max(30)),
    desde: vacioANull(date),
    hasta: vacioANull(date),
    area: vacioANull(z.enum(AREAS)),
    origen: vacioANull(z.enum(ORIGENES)),
    estado: vacioANull(z.enum(['vigente', 'anulado'])),
    page: pagina(1, 10000),
    pageSize: pagina(25, 100),
  }).refine(data => !data.desde || !data.hasta || data.desde <= data.hasta,
    '«Desde» no puede ser posterior a «Hasta».'),

  anulacion: z.object({
    motivo: requiredText(1000, 'Escribe el motivo de la anulación (al menos 10 caracteres).', 10),
    reemplazadoPor: optionalText(60)
      .refine(value => !value || leerCodigo(value), 'El código del RIM que lo reemplaza debe ser como RIM-26-0042.')
      .transform(value => (value ? value.toUpperCase() : null)),
  }),

  cierreTalonario: z.object({
    motivo: z.enum(MOTIVOS_CIERRE, { error: 'Elige el motivo del cierre.' }),
    detalle: optionalText(500),
    ultimoUsado: z.preprocess(
      value => (value === '' || value === null || value === undefined ? null : Number(value)),
      z.number().int().positive().nullable(),
    ),
  }).refine(data => data.motivo !== 'otro' || (data.detalle && data.detalle.length >= 5),
    'Explica el motivo del cierre.'),

  registroWeb: z.object({
    uuid: z.string().regex(UUID, 'Identificador del RIM inválido.').transform(value => value.toLowerCase()),
    cliente: z.object({
      codigo: optionalText(30),
      nombre: requiredText(255, 'Falta la empresa.'),
      razonSocial: requiredText(255, 'Falta la razón social.'),
      nit: requiredText(30, 'Falta el NIT.'),
      direccion: optionalText(255),
      ciudad: optionalText(120),
    }),
    planta: z.object({
      codigo: optionalText(30),
      nombre: optionalText(255),
      direccion: optionalText(255),
      departamento: optionalText(120),
    }).default({}),
    instrumento: z.object({
      codMetrica: optionalText(80),
      tipo: requiredText(120, 'Falta el tipo de instrumento.'),
      marca: requiredText(120, 'Falta la marca.'),
      modelo: requiredText(120, 'Falta el modelo.'),
      serie: requiredText(120, 'Falta el número de serie.'),
      capacidad: requiredText(120, 'Falta la capacidad máxima.'),
      division: requiredText(120, 'Falta la resolución.'),
      unidad: optionalText(20),
      ubicacion: requiredText(255, 'Falta el área de trabajo.'),
      observaciones: optionalText(2000),
    }),
    contacto: z.object({
      nombre: requiredText(150, 'Falta el nombre del contacto.', 3),
      cargo: requiredText(100, 'Falta el cargo del contacto.'),
      telefono: requiredText(30, 'Falta el teléfono del contacto.'),
      correo: requiredText(150, 'Falta el correo del contacto.')
        .pipe(z.email('El correo del contacto no es válido.')),
    }),
    motivo: requiredText(2000, 'Describe el motivo de la recepción.', 5),
    inventario: z.object({
      items: z.record(z.string().regex(KEY), z.enum(ESTADOS_COMPONENTE)).default({})
        .refine(items => Object.keys(items).length <= 60, 'Demasiados componentes.'),
      cantidades: z.record(z.string().regex(KEY), z.string().regex(/^\d{0,10}$/, 'Cantidad inválida.')).default({}),
      otros: z.array(z.object({
        nombre: requiredText(80, 'Falta el nombre del componente.'),
        estado: z.enum(ESTADOS_COMPONENTE),
      })).max(30).default([]),
    }).default({ items: {}, cantidades: {}, otros: [] }),
    obsInventario: optionalText(1000),
    estadoGeneral: z.enum(ESTADOS_GENERALES, { error: 'Elige el estado general.' }),
    danos: z.record(z.string().regex(KEY), z.array(z.string().regex(KEY)).max(30)).default({})
      .refine(danos => Object.keys(danos).length <= 30, 'Demasiados tipos de daño.')
      .transform(danos => Object.fromEntries(
        Object.entries(danos).map(([tipo, lugares]) => [tipo, [...new Set(lugares)]]),
      )),
    descripcionDanos: optionalText(2000),
    nivelSuciedad: z.enum(NIVELES_SUCIEDAD, { error: 'Elige el nivel de suciedad.' }),
    pruebas: z.boolean({ error: 'Indica si se realizaron pruebas de funcionamiento.' }),
    descripcionPruebas: optionalText(2000),
    representanteMetrica: requiredText(150, 'Falta el representante de Métrica.'),
    lugarRecepcion: requiredText(255, 'Falta el lugar de recepción.'),
    tecnicoAsignado: optionalText(150),
    firmaCliente: firma('La firma del cliente'),
    firmaRepresentante: firma('La firma del representante de Métrica'),
    fotos: z.array(z.object({
      nombre: optionalText(255),
      contenido: dataUrl({ tipos: TIPOS_FOTO, maxBytes: MAX_FOTO_BYTES, etiqueta: 'La foto' }),
    })).max(5, 'Máximo 5 fotos.').default([]),
    appVersion: optionalText(30),
  }).transform(data => ({
    ...data,
    descripcionPruebas: data.pruebas ? data.descripcionPruebas : null,
  })),
};

/** Valida y normaliza; ante un error responde 400 con el primer mensaje. */
const parse = (name, data) => {
  const result = schemas[name].safeParse(data ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw httpError(400, issue?.message || 'Datos inválidos.');
};

module.exports = {
  AREAS,
  MOTIVOS_CIERRE,
  ORIGENES,
  leerCodigo,
  parse,
  rimCodigo,
};
