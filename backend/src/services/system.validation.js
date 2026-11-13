const { z } = require('zod');

const id = z.number().int().positive();
const date = z.iso.date();
const optionalText = (max) => z.string().trim().max(max, `Máximo ${max} caracteres.`).nullish().transform(value => value || null);
const requiredText = (max, message) => z.string({ error: message })
  .transform(value => value.replace(/\u00a0/g, ' ').trim())
  .pipe(z.string().min(1, message).max(max, `Máximo ${max} caracteres.`));

// Bolivia está en UTC-4 todo el año: «2026-10-06T08:30» → instante UTC.
const localDateTime = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Indica la fecha y la hora.')
  .transform(value => new Date(`${value}:00-04:00`).toISOString())
  .refine(value => new Date(value) <= new Date(), 'La falla no puede estar en el futuro.');

const schemas = {
  cambio: z.object({
    titulo: requiredText(150, 'Escribe el título del cambio.'),
    version: optionalText(20),
    tipo: z.enum(['MODULO', 'MEJORA', 'CORRECCION', 'SEGURIDAD', 'BASE_DATOS', 'CONFIGURACION']),
    modulos: optionalText(200),
    descripcion: requiredText(4000, 'Describe qué cambia y por qué.'),
    impacto: optionalText(1000),
    referencias: optionalText(1000),
    fechaCambio: date.nullable().default(null),
  }),
  validacionCambio: z.object({
    validacion: requiredText(2000, 'Describe cómo se validó: pruebas, datos usados y resultado.'),
    resultado: z.enum(['CONFORME', 'NO_CONFORME']),
  }),
  aprobacionCambio: z.object({
    decision: z.enum(['APROBAR', 'RECHAZAR']),
    observaciones: optionalText(500),
  }).refine(data => data.decision === 'APROBAR' || data.observaciones, 'Escribe por qué se rechaza.'),
  implementacionCambio: z.object({
    fecha: date,
    observaciones: optionalText(500),
  }),
  fallaManual: z.object({
    mensaje: requiredText(500, 'Describe la falla.'),
    ocurrida: localDateTime,
    impacto: optionalText(500),
    accionInmediata: optionalText(1000),
  }),
  atencionFalla: z.object({
    estado: z.enum(['ABIERTA', 'EN_CURSO', 'CERRADA', 'DESCARTADA']),
    impacto: optionalText(500),
    accionInmediata: optionalText(1000),
    causa: optionalText(1000),
    accionCorrectiva: optionalText(1000),
    cambioId: id.nullable().default(null),
  })
    .refine(data => data.estado !== 'CERRADA' || data.accionInmediata, 'Para cerrarla, registra la acción inmediata.')
    .refine(data => data.estado !== 'CERRADA' || data.accionCorrectiva, 'Para cerrarla, registra la acción correctiva.')
    .refine(data => data.estado !== 'DESCARTADA' || data.causa, 'Para descartarla, explica el motivo en «Causa».'),
  // Gestión de permisos: a una persona (usuarioId) o a un grupo (área y/o cargo).
  concesionPermiso: z.object({
    permiso: z.string().trim().min(1, 'Elige el permiso.').max(60),
    tipo: z.enum(['PERSONA', 'GRUPO'], { error: 'Elige si se concede a una persona o a un grupo.' }),
    usuarioId: id.nullish().transform(value => value ?? null),
    area: optionalText(60),
    cargo: optionalText(60),
    motivo: requiredText(300, 'Escribe por qué se concede el permiso.'),
  })
    .refine(data => data.tipo !== 'PERSONA' || data.usuarioId, 'Elige a la persona.')
    .refine(data => data.tipo !== 'GRUPO' || data.area || data.cargo, 'Elige un área, un cargo o los dos.'),
  revocacionPermiso: z.object({
    motivo: requiredText(300, 'Escribe por qué se revoca el permiso.'),
  }),
};

/** Valida y normaliza; ante un error responde 400 con el primer mensaje. */
const parse = (name, data) => {
  const result = schemas[name].safeParse(data ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const error = new Error(issue?.message || 'Datos inválidos.');
  error.statusCode = 400;
  throw error;
};

module.exports = { parse };
