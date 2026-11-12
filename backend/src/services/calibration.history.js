/**
 * Historial de los registros de calibración (NB/ISO/IEC 17025, 7.5.2): cada
 * cambio guarda la versión anterior y la nueva completas, quién, cuándo y,
 * si corresponde, por qué. El detalle legible resume solo lo que cambió.
 */
const { sql } = require('../config/db');

const formatIso = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const isEmpty = (value) => value === null || value === undefined || value === '';

/**
 * Resumen legible de lo que cambió: «Planta: La Paz → Santa Cruz». `format`
 * traduce un valor para mostrarlo (fechas, estados, sí/no).
 */
const describeChanges = (before, after, labels, format = (_key, value) => value) => Object.entries(labels)
  .filter(([key]) => String(before?.[key] ?? '') !== String(after?.[key] ?? ''))
  .map(([key, label]) => {
    const show = (value) => (isEmpty(value) ? '—' : String(format(key, value)));
    return `${label}: ${show(before?.[key])} → ${show(after?.[key])}`;
  })
  .join('; ');

const snapshot = (value) => (value == null ? null : JSON.stringify(value));

const parseSnapshot = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

// ─── Fechas del plan (CAL_EVENTOS) ─────────────────────────────────────────

const ESTADO_LABELS = { PROGRAMADO: 'Programada', EN_PROCESO: 'En proceso', REALIZADO: 'Realizada', CANCELADO: 'Cancelada' };
const RESULTADO_LABELS = { CONFORME: 'Conforme', NO_CONFORME: 'No conforme' };

const EVENT_LABELS = {
  estado: 'Estado',
  fechaReprogramada: 'Reprogramada',
  fechaRealizada: 'Realizada el',
  resultado: 'Resultado',
  registroRef: 'Hoja de datos',
  observaciones: 'Observaciones',
};

const shorten = (text, max = 60) => (String(text).length > max ? `${String(text).slice(0, max - 1)}…` : text);

const formatEventValue = (key, value) => {
  if (key === 'estado') return ESTADO_LABELS[value] || value;
  if (key === 'resultado') return RESULTADO_LABELS[value] || value;
  if (key === 'fechaReprogramada' || key === 'fechaRealizada') return formatIso(value);
  if (key === 'observaciones') return `«${shorten(value)}»`;
  return value;
};

/** Lo que el personal registra de una fecha; una fecha sin guardar es «programada». */
const eventView = (row) => ({
  estado: row?.estado || 'PROGRAMADO',
  fechaReprogramada: row?.fechaReprogramada || null,
  fechaRealizada: row?.fechaRealizada || null,
  resultado: row?.resultado || null,
  registroRef: row?.registroRef || null,
  observaciones: row?.observaciones || null,
});

const describeEventChanges = (before, after) => describeChanges(eventView(before), eventView(after), EVENT_LABELS, formatEventValue);

const logEvento = (createRequest, { serie, tipo, equipoId, programaId, fechaProgramada, accion, detalle, antes, despues, motivo, usuario }) => createRequest()
  .input('serie', sql.VarChar(30), serie)
  .input('tipo', sql.VarChar(20), tipo)
  .input('equipo', sql.Int, equipoId ?? null)
  .input('programa', sql.Int, programaId ?? null)
  .input('fp', sql.Date, fechaProgramada)
  .input('accion', sql.VarChar(20), accion)
  .input('detalle', sql.NVarChar(400), detalle ? String(detalle).slice(0, 400) : null)
  .input('antes', sql.NVarChar(sql.MAX), snapshot(antes))
  .input('despues', sql.NVarChar(sql.MAX), snapshot(despues))
  .input('motivo', sql.NVarChar(300), motivo || null)
  .input('usuario', sql.NVarChar(50), usuario)
  .query(`
    INSERT INTO dbo.CAL_EVENTOS_HISTORIAL
      (serie, tipo, equipo_id, programa_id, fecha_programada, accion, detalle, antes, despues, motivo, usuario)
    VALUES (@serie, @tipo, @equipo, @programa, @fp, @accion, @detalle, @antes, @despues, @motivo, @usuario)
  `);

// ─── Configuración del plan (CAL_PROGRAMAS y CAL_AJUSTES) ──────────────────

const FRECUENCIA_AVISO = { UNICA: 'Una vez', SEMANAL: 'Semanal', DIARIA: 'Diaria', NINGUNA: 'Sin avisos' };

const PROGRAMA_LABELS = {
  activo: 'En el plan',
  titulo: 'Título',
  categoria: 'Categoría',
  descripcion: 'Descripción',
  frecuencia_meses: 'Frecuencia (meses)',
  fecha_inicio: 'Desde',
  responsable_nombre: 'Responsable',
  alerta_dias: 'Aviso (días antes)',
  alerta_frecuencia: 'Frecuencia del aviso',
  alerta_correo: 'Aviso por correo',
};

const AJUSTES_LABELS = {
  alerta_dias: 'Aviso general (días antes)',
  alerta_frecuencia: 'Frecuencia del aviso general',
  alerta_correo: 'Aviso general por correo',
  hora_envio: 'Hora de envío',
};

const formatPlanValue = (key, value) => {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (key === 'fecha_inicio') return formatIso(value);
  if (key === 'alerta_frecuencia') return FRECUENCIA_AVISO[value] || value;
  if (key === 'descripcion') return `«${shorten(value)}»`;
  return value;
};

const describePlanChanges = (before, after, labels = PROGRAMA_LABELS) => describeChanges(before, after, labels, formatPlanValue);

const logPlan = (createRequest, { entidad = 'PROGRAMA', programaId, tipo, equipoId, accion, detalle, antes, despues, usuario }) => createRequest()
  .input('entidad', sql.VarChar(10), entidad)
  .input('programa', sql.Int, programaId ?? null)
  .input('tipo', sql.VarChar(20), tipo ?? null)
  .input('equipo', sql.Int, equipoId ?? null)
  .input('accion', sql.VarChar(20), accion)
  .input('detalle', sql.NVarChar(400), detalle ? String(detalle).slice(0, 400) : null)
  .input('antes', sql.NVarChar(sql.MAX), snapshot(antes))
  .input('despues', sql.NVarChar(sql.MAX), snapshot(despues))
  .input('usuario', sql.NVarChar(50), usuario)
  .query(`
    INSERT INTO dbo.CAL_PLAN_HISTORIAL
      (entidad, programa_id, tipo, equipo_id, accion, detalle, antes, despues, usuario)
    VALUES (@entidad, @programa, @tipo, @equipo, @accion, @detalle, @antes, @despues, @usuario)
  `);

// ─── Revisión por un segundo usuario (7.5.1) ───────────────────────────────

const sameUser = (a, b) => Boolean(a && b) && String(a).trim().toUpperCase() === String(b).trim().toUpperCase();

/**
 * Quien revisa no puede ser quien registró o corrigió los datos. `reviewer`
 * trae sus identidades posibles (usuario e iniciales). Devuelve el autor con
 * el que coincide o null.
 */
const conflictingAuthor = (reviewer, authors) => (authors || [])
  .find(author => (reviewer || []).some(identity => sameUser(identity, author))) || null;

/** Instante de una fecha guardada en UTC («2026-11-06T13:26:01», con o sin Z). */
const instante = (en) => {
  const t = en ? Date.parse(`${String(en).replace(/Z$/, '')}Z`) : Number.NaN;
  return Number.isFinite(t) ? t : -Infinity;
};

/**
 * Quién hizo el último cambio de un registro entre sus autores, cada uno con
 * su fecha ([{ usuario, en }], en el orden en que ocurren los pasos); null si
 * no hay ninguno. Solo esa persona queda fuera de la revisión: quien registró
 * o completó antes puede revisar lo que agregó otro.
 */
const ultimoAutor = (autores) => {
  let ultimo = null;
  for (const autor of autores || []) {
    if (!autor?.usuario) continue;
    // Con la misma fecha gana el paso posterior de la lista.
    if (!ultimo || instante(autor.en) >= instante(ultimo.en)) ultimo = autor;
  }
  return ultimo?.usuario || null;
};

module.exports = {
  AJUSTES_LABELS,
  EVENT_LABELS,
  PROGRAMA_LABELS,
  conflictingAuthor,
  ultimoAutor,
  describeChanges,
  describeEventChanges,
  describePlanChanges,
  eventView,
  formatIso,
  logEvento,
  logPlan,
  parseSnapshot,
  snapshot,
};
