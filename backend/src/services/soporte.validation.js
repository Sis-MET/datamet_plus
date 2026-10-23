/**
 * Validación del módulo Soporte técnico: filtros de la lista, cambios de un
 * informe, emisión y fotos. Los valores de cada campo se validan después,
 * contra el tipo real de la columna (ver `coercer` en soporte.informes.js).
 */
const { z } = require('zod');
const { CLAVES_TIPO } = require('./soporte.tipos');

const MAX_FOTO_BYTES = 4 * 1024 * 1024;
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
/** Fotos vigentes por informe: dos hojas de registro fotográfico. */
const MAX_FOTOS = 12;
/** Campos que se pueden cambiar en un solo guardado. */
const MAX_CAMPOS = 600;
const CAMPO = /^[a-z][a-z0-9_]{0,79}$/;
const CODIGO = /^[A-Za-z0-9][A-Za-z0-9_.\-/ ]{2,99}$/;

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const text = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').trim();

const optionalText = (max) => z.preprocess(
  value => (value === null || value === undefined ? '' : value),
  z.union([z.string(), z.number()])
    .transform(value => text(value))
    .pipe(z.string().max(max, `Máximo ${max} caracteres.`)),
).transform(value => value || null);

/** Motivo de una corrección: obligatorio solo en informes emitidos. */
const motivo = optionalText(500).refine(
  value => value === null || value.length >= 10,
  'El motivo debe tener al menos 10 caracteres.',
);

const version = z.preprocess(
  value => (value === undefined || value === '' ? null : value),
  z.union([z.null(), z.coerce.number().int().min(1)], { error: 'Versión inválida.' }),
);

const fecha = z.iso.date({ error: 'Fecha inválida.' });

/** Código Métrica del equipo ("0058-11-001"); se compara en mayúsculas. */
const COD_METRICA = /^[A-Z0-9][A-Z0-9_.\-/ ]{1,49}$/;
const codMetrica = z.string({ error: 'Falta el equipo.' })
  .transform(value => text(value).toUpperCase())
  .pipe(z.string().regex(COD_METRICA, 'Código Métrica inválido.'));

const ACCIONES_SEGUIMIENTO = ['CONTACTO', 'COORDINACION', 'REPROGRAMACION', 'DESCARTE', 'REACTIVACION'];
const FRECUENCIAS_AVISO = ['UNICA', 'SEMANAL', 'DIARIA', 'NINGUNA'];
const email = z.string({ error: 'Falta el correo.' }).trim().toLowerCase().max(150).pipe(z.email('Correo no válido.'));

const schemas = {
  filtros: z.object({
    q: optionalText(120),
    tipo: z.preprocess(v => (v ? String(v).toUpperCase() : null), z.enum(CLAVES_TIPO).nullable()),
    estado: z.preprocess(v => (v ? String(v).toUpperCase() : null), z.enum(['PENDIENTE', 'BORRADOR', 'EMITIDO', 'EN_REVISION']).nullable()),
    cliente: optionalText(250),
    tecnico: optionalText(100),
    validacion: z.preprocess(v => (v ? String(v).toUpperCase() : null), z.enum(['BORRADOR', 'PENDIENTE', 'APROBADO', 'OBSERVADO']).nullable()),
    desde: z.preprocess(v => (v ? v : null), fecha.nullable()),
    hasta: z.preprocess(v => (v ? v : null), fecha.nullable()),
    // Lista agrupada por OTST o por técnico; `grupo` pide los informes de
    // uno de ellos ('' es el grupo sin dato).
    por: z.preprocess(v => (v ? String(v).toLowerCase() : null), z.enum(['otst', 'tecnico'], { error: 'Agrupación inválida.' }).nullable()),
    grupo: z.preprocess(v => (v === undefined || v === null ? undefined : text(v)), z.string().max(250).optional()),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(5).max(100).default(25),
  }).refine(f => !f.desde || !f.hasta || f.desde <= f.hasta, 'La fecha inicial es posterior a la final.')
    .refine(f => f.grupo === undefined || f.por, 'Indique la agrupación del grupo.'),

  // { version, cambios: { campo: valor }, motivo, ia: [campo] }
  cambios: z.object({
    version,
    motivo,
    // Campos cuyo texto se redactó con la sugerencia de Gemini.
    ia: z.array(z.string().regex(CAMPO, 'Campo inválido.')).max(50).default([]),
    cambios: z.record(
      z.string(),
      z.union([z.string().max(4000, 'Texto demasiado largo.'), z.number(), z.null()]),
    ).refine(value => Object.keys(value).length > 0, 'No hay cambios que guardar.')
      .refine(value => Object.keys(value).every(campo => CAMPO.test(campo)), 'Campo inválido.')
      .refine(value => Object.keys(value).length <= MAX_CAMPOS, 'Demasiados cambios en un solo guardado.'),
  }),

  emision: z.object({ version }),
  enviarValidacion: z.object({ version }),
  retirarValidacion: z.object({ version }),
  resolverValidacion: z.object({
    version,
    decision: z.enum(['APROBAR', 'OBSERVAR']),
    observacion: optionalText(500),
  }).refine(v => v.decision !== 'OBSERVAR' || (v.observacion && v.observacion.length >= 10),
    'Explique las correcciones necesarias (al menos 10 caracteres).'),

  // Reemisión: abrir una revisión exige el motivo (p. ej. el pedido del cliente).
  abrirRevision: z.object({
    version,
    motivo: motivo.refine(value => value !== null, 'Indique el motivo de la revisión.'),
  }),
  reemision: z.object({ version }),
  cancelarRevision: z.object({ version }),

  redaccion: z.object({
    tipo: z.preprocess(v => String(v ?? '').toUpperCase(), z.enum(CLAVES_TIPO, { error: 'Tipo de servicio inválido.' })),
    codigo: z.string().transform(text).pipe(z.string().regex(CODIGO, 'Código de registro inválido.')),
    version,
    campo: z.string().regex(CAMPO, 'Campo inválido.'),
    cambios: z.record(z.string().regex(CAMPO), z.union([z.string().max(4000), z.number(), z.null()]))
      .refine(v => Object.keys(v).length <= MAX_CAMPOS, 'Demasiados campos.').default({}),
    seccion: z.string({ error: 'Falta la sección.' }).transform(text).pipe(z.string().min(1).max(120)),
    texto: z.string({ error: 'Falta el texto.' }).transform(text)
      .pipe(z.string().min(3, 'Escriba primero el texto que quiere mejorar.').max(4000, 'El texto es demasiado largo (máximo 4000 caracteres).')),
  }),

  foto: z.object({
    motivo,
    nombre: optionalText(255),
    descripcion: optionalText(300),
    contenido: z.string({ error: 'Falta la foto.' }).transform((value, ctx) => {
      const match = /^data:([a-z/]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value.trim());
      if (!match || !TIPOS_FOTO.includes(match[1])) {
        ctx.addIssue({ code: 'custom', message: 'La foto debe ser JPG, PNG o WEBP.' });
        return z.NEVER;
      }
      const bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > MAX_FOTO_BYTES) {
        ctx.addIssue({ code: 'custom', message: 'La foto supera el tamaño permitido (4 MB).' });
        return z.NEVER;
      }
      return { tipo: match[1], bytes };
    }),
  }),

  fotoEdicion: z.object({ motivo, descripcion: optionalText(300) }),

  fotoQuitar: z.object({ motivo }),

  // Próximos servicios: año de la línea de tiempo.
  proximosPlan: z.object({
    anio: z.preprocess(
      v => (v === undefined || v === null || v === '' ? new Date().getFullYear() : v),
      z.coerce.number({ error: 'Año inválido.' }).int('Año inválido.').min(2000, 'Año inválido.').max(2100, 'Año inválido.'),
    ),
  }),

  // Una gestión del próximo servicio vigente del equipo. `ultimo` es la
  // última gestión que vio quien la registra (control de concurrencia).
  seguimiento: z.object({
    codMetrica,
    origenTipo: z.preprocess(v => String(v ?? '').toUpperCase(), z.enum(CLAVES_TIPO, { error: 'Tipo de servicio inválido.' })),
    origenCodigo: z.string({ error: 'Falta el servicio.' }).transform(text).pipe(z.string().regex(CODIGO, 'Código de registro inválido.')),
    accion: z.enum(ACCIONES_SEGUIMIENTO, { error: 'Acción de seguimiento desconocida.' }),
    fecha: z.preprocess(v => (v ? v : null), fecha.nullable()),
    nota: z.string({ error: 'Escriba la nota o el motivo.' }).transform(text)
      .pipe(z.string().min(10, 'La nota debe tener al menos 10 caracteres.').max(500, 'Máximo 500 caracteres.')),
    ultimo: z.preprocess(
      v => (v === undefined || v === '' ? null : v),
      z.union([z.null(), z.coerce.number().int().positive()], { error: 'Seguimiento inválido.' }),
    ),
  }),

  avisosAjustes: z.object({
    alertaDias: z.number({ error: 'Indique los días de anticipación.' }).int().min(0).max(365, 'Máximo 365 días.'),
    alertaFrecuencia: z.enum(FRECUENCIAS_AVISO, { error: 'Frecuencia inválida.' }),
    alertaCorreo: z.boolean(),
    horaEnvio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use el formato HH:mm.'),
  }),

  avisosContacto: z.object({
    usuarioId: z.number().int().positive().nullable().default(null),
    nombre: z.string({ error: 'El nombre es obligatorio.' }).transform(text).pipe(z.string().min(1, 'El nombre es obligatorio.').max(100)),
    email,
    activo: z.boolean().default(true),
  }),

  avisosPrueba: z.object({ email }),

  fotosOrden: z.object({
    motivo,
    ids: z.array(z.coerce.number().int().positive()).min(1).max(MAX_FOTOS * 4)
      .refine(ids => new Set(ids).size === ids.length, 'Hay fotos repetidas.'),
  }),
};

const parse = (name, data) => {
  const result = schemas[name].safeParse(data ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw httpError(400, issue?.message || 'Datos inválidos.');
};

/** Tipo y código del informe en la URL. */
const leerClave = (tipo, codigo) => {
  const clave = String(tipo ?? '').toUpperCase();
  if (!CLAVES_TIPO.includes(clave)) throw httpError(404, 'Tipo de servicio desconocido.');
  const cod = String(codigo ?? '').trim();
  if (!CODIGO.test(cod)) throw httpError(400, 'Código de registro inválido.');
  return { tipo: clave, codigo: cod };
};

/** Número de revisión en la URL (0 = emisión original). */
const leerRevision = (valor) => {
  const revision = Number(valor);
  if (!Number.isInteger(revision) || revision < 0 || revision > 999) throw httpError(400, 'Revisión inválida.');
  return revision;
};

/** Código Métrica del equipo en la URL. */
const leerEquipo = (valor) => {
  const result = codMetrica.safeParse(String(valor ?? ''));
  if (!result.success) throw httpError(400, 'Código Métrica inválido.');
  return result.data;
};

module.exports = { MAX_FOTOS, httpError, leerClave, leerEquipo, leerRevision, parse, text };
