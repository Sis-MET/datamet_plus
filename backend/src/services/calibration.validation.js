const { z } = require('zod');
const { ESTADOS, FRECUENCIAS_ALERTA } = require('./calibration.schedule');

const id = z.number().int().positive();
const date = z.iso.date();
const optionalText = (max) => z.string().trim().max(max).nullish().transform(value => value || null);
// null = hereda los valores generales de CAL_AJUSTES.
const alerta = {
  alertaDias: z.number().int().min(0).max(365).nullable().default(null),
  alertaFrecuencia: z.enum(FRECUENCIAS_ALERTA).nullable().default(null),
  alertaCorreo: z.boolean().nullable().default(null),
};
const verificacion = z.object({
  activo: z.boolean(),
  frecuenciaMeses: z.number().int().min(1).max(60),
  fechaInicio: date.nullable().default(null),
});

const schemas = {
  equipoConfig: z.object({
    calibracion: z.object({
      activo: z.boolean().default(true),
      responsableId: id.nullable().default(null),
      ...alerta,
    }),
    verificacion: verificacion.extend({
      responsableId: id.nullable().default(null),
      ...alerta,
    }),
  }),
  equiposMasivo: z.object({
    equipoIds: z.array(id).min(1).max(500)
      .refine(ids => new Set(ids).size === ids.length, 'Hay equipos repetidos.'),
    verificacion: verificacion.optional(),
    responsableId: id.nullable().optional(),
    alerta: z.object(alerta).optional(),
  }).refine(
    data => data.verificacion || data.responsableId !== undefined || data.alerta,
    'Elige al menos un cambio para aplicar.'
  ),
  actividad: z.object({
    titulo: z.string().trim().min(1, 'El título es obligatorio.').max(150),
    categoria: optionalText(60),
    descripcion: optionalText(500),
    frecuenciaMeses: z.number().int().min(0).max(120),
    fechaInicio: date,
    responsableId: id.nullable().default(null),
    ...alerta,
  }),
  evento: z.object({
    serie: z.string().regex(/^(CAL|VER|ACT)-\d{1,9}$/),
    fechaProgramada: date,
    estado: z.enum(ESTADOS),
    fechaReprogramada: date.nullable().default(null),
    fechaRealizada: date.nullable().default(null),
    resultado: z.enum(['CONFORME', 'NO_CONFORME']).nullable().default(null),
    observaciones: optionalText(500),
  }).refine(
    data => data.estado !== 'REALIZADO' || data.fechaRealizada,
    'Indica la fecha en que se realizó.'
  ),
  eventoClave: z.object({
    serie: z.string().regex(/^(CAL|VER|ACT)-\d{1,9}$/),
    fechaProgramada: date,
  }),
  ajustes: z.object({
    alertaDias: z.number().int().min(0).max(365),
    alertaFrecuencia: z.enum(FRECUENCIAS_ALERTA),
    alertaCorreo: z.boolean(),
    horaEnvio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:mm.'),
  }),
  contacto: z.object({
    usuarioId: id.nullable().default(null),
    nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(100),
    email: z.string().trim().toLowerCase().max(150).pipe(z.email('Correo no válido.')),
    recibeTodas: z.boolean().default(false),
    activo: z.boolean().default(true),
  }),
  vistaPrevia: z.object({
    tipo: z.enum(['VERIFICACION', 'ACTIVIDAD']),
    equipoId: id.optional(),
    frecuenciaMeses: z.number().int().min(0).max(120),
    fechaInicio: date.nullable().default(null),
  }),
  prueba: z.object({
    email: z.string().trim().toLowerCase().max(150).pipe(z.email('Correo no válido.')),
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
