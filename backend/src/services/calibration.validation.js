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

// Texto obligatorio sin espacios de no separación en los extremos.
const requiredText = (max, message) => z.string({ error: message })
  .transform(value => value.replace(/\u00a0/g, ' ').trim())
  .pipe(z.string().min(1, message).max(max, `Máximo ${max} caracteres.`));

const equipoDatos = z.object({
  // Los códigos existentes están en mayúsculas (F1-202, M1-1-05XX).
  codigo: requiredText(30, 'Escribe el código del equipo.').transform(value => value.toUpperCase()),
  instrumento: requiredText(30, 'Indica el instrumento.'),
  planta: requiredText(50, 'Indica la planta.'),
  observaciones: optionalText(200),
});

const certificado = z.object({
  numero: requiredText(100, 'Escribe el número del certificado.'),
  fecha: date,
  periodoDias: z.number().int().min(1, 'La vigencia debe ser de al menos un día.').max(3650, 'La vigencia no puede superar 10 años.'),
  ente: requiredText(50, 'Indica el ente calibrador.'),
  observaciones: optionalText(300),
});

const serie = z.string().regex(/^(CAL|VER|ACT)-\d{1,9}$/);
const eventoClave = z.object({ serie, fechaProgramada: date });

const schemas = {
  equipoDatos,
  equipoAlta: equipoDatos.extend({ certificado: certificado.nullable().default(null) }),
  certificado,
  // Corregir el vigente deja su versión anterior en el historial con el motivo.
  certificadoCorreccion: certificado.extend({
    motivo: requiredText(300, 'Escribe el motivo de la corrección.'),
  }),
  certificadoRevision: z.object({ observaciones: optionalText(300) }),
  anulacion: z.object({ motivo: requiredText(300, 'Escribe el motivo de la anulación.') }),
  estadoEquipo: z.object({
    activo: z.boolean(),
    motivo: optionalText(300),
  }).refine(data => data.activo || data.motivo, 'Escribe el motivo de la baja.'),
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
  evento: eventoClave.extend({
    estado: z.enum(ESTADOS),
    fechaReprogramada: date.nullable().default(null),
    fechaRealizada: date.nullable().default(null),
    resultado: z.enum(['CONFORME', 'NO_CONFORME']).nullable().default(null),
    observaciones: optionalText(500),
    // Hoja o archivo donde quedaron los datos de la verificación (7.5.1).
    registroRef: optionalText(150),
    // Obligatorio al cambiar una fecha que ya figuraba como realizada (7.5.2).
    motivo: optionalText(300),
  })
    .refine(data => data.estado !== 'REALIZADO' || data.fechaRealizada, 'Indica la fecha en que se realizó.')
    .refine(
      data => data.estado !== 'REALIZADO' || !data.serie.startsWith('VER-') || data.resultado,
      'Indica el resultado de la verificación.'
    )
    .refine(
      data => data.estado !== 'REALIZADO' || !data.serie.startsWith('VER-') || data.registroRef,
      'Indica la hoja o el archivo donde quedaron los datos de la verificación.'
    ),
  eventoClave,
  eventoRestablecer: eventoClave.extend({ motivo: optionalText(300) }),
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

  // Versiones de ServiceMET (NB/ISO/IEC 17025, 7.11.2).
  servicemetVersion: z.object({
    version: z.string({ error: 'Escribe la versión con su build, por ejemplo 6.4.1+19.' })
      .trim()
      .regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,6}$/, 'Escribe la versión con su build, como figura en pubspec.yaml: 6.4.1+19.'),
    fecha: date,
    commit: z.string().trim().regex(/^[0-9a-f]{7,40}$/i, 'El commit son de 7 a 40 caracteres hexadecimales.')
      .nullish().or(z.literal('')).transform(value => (value ? value.toLowerCase() : null)),
    clase: z.enum(['A', 'B', 'C'], { error: 'Elige la clase del cambio.' }),
    resumen: requiredText(1000, 'Resume qué cambia en esta versión.'),
    nuevo: z.array(requiredText(1000, 'Una línea de «Nuevo» está vacía.')).max(40).default([]),
    corregido: z.array(requiredText(1000, 'Una línea de «Corregido» está vacía.')).max(40).default([]),
    impacto: optionalText(2000),
  }).refine(data => data.nuevo.length + data.corregido.length > 0, 'Indica al menos un cambio nuevo o una corrección.'),
  servicemetValidacion: z.object({
    validacion: requiredText(2000, 'Describe cómo se validó: pruebas automáticas, casos funcionales y resultado.'),
    resultado: z.enum(['CONFORME', 'NO_CONFORME']),
    registro: optionalText(60),
  }),
  servicemetDecision: z.object({
    decision: z.enum(['APROBAR', 'RECHAZAR']),
    observaciones: optionalText(500),
  }).refine(data => data.decision === 'APROBAR' || data.observaciones, 'Escribe por qué no se aprueba.'),
  servicemetPuesta: z.object({
    fecha: date,
    dispositivos: optionalText(500),
    observaciones: optionalText(500),
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
