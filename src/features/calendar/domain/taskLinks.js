// Una "ficha" puede ocupar varias filas del cronograma: la persona principal,
// las personas adicionales y el vehículo. Todas comparten grupo_id. Las filas
// creadas antes de la migración 003 no lo tienen y se reconocen por texto y
// horario (todas las filas de una ficha se crean con el mismo tramo, y así dos
// fichas iguales de mañana y tarde no se confunden).
import { isSameDay } from 'date-fns';
import { timeToMinutes } from '../utils/calendarTime';

const normalizeText = (value) => String(value || '').trim().toLowerCase();

/**
 * UUID v4. `crypto.randomUUID` solo existe en contextos seguros (https o
 * localhost); en la red interna por http se arma con getRandomValues.
 */
export function createGroupId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const hasSameLegacyIdentity = (task, source) => (
  normalizeText(task.tipoTarea || task.morning) === normalizeText(source.tipoTarea || source.morning) &&
  normalizeText(task.cotizacion) === normalizeText(source.cotizacion) &&
  normalizeText(task.descripcion) === normalizeText(source.descripcion) &&
  normalizeText(task.cliente) === normalizeText(source.cliente) &&
  normalizeText(task.planta) === normalizeText(source.planta) &&
  normalizeText(task.horaInicio) === normalizeText(source.horaInicio) &&
  normalizeText(task.horaFin) === normalizeText(source.horaFin)
);

/** ¿`task` pertenece a la misma ficha que `source`? No compara fechas. */
export function isLinkedTask(task, source) {
  if (!task || !source) return false;
  if (source.grupoId) return task.grupoId === source.grupoId;
  return !task.grupoId && hasSameLegacyIdentity(task, source);
}

/** Las demás filas de la ficha de `source` en `date` (sin incluir a `source`). */
export function findLinkedTasks(tasks, source, date) {
  if (!source) return [];
  return tasks.filter(task => (
    isSameDay(task.fecha, date) &&
    String(task.rowId) !== String(source.rowId) &&
    isLinkedTask(task, source)
  ));
}

export const hasTaskContent = (task) => Boolean(
  normalizeText(task?.tipoTarea || task?.morning || task?.afternoon || task?.descripcion)
);

/** Solapamiento de horario; sin horas se asume el día completo. Los bordes contiguos no chocan. */
export function hasTimeOverlap(a, b) {
  const aStart = timeToMinutes(a.horaInicio || '00:00');
  const aEnd = timeToMinutes(a.horaFin || '23:59');
  const bStart = timeToMinutes(b.horaInicio || '00:00');
  const bEnd = timeToMinutes(b.horaFin || '23:59');
  return aStart < bEnd && aEnd > bStart;
}

/** Contrato completo de una fila existente, para reescribirla sin perder campos. */
export const taskToPayload = (task, overrides = {}) => ({
  rowId: task.rowId ?? null,
  tipo_tarea: task.tipoTarea || task.morning,
  morning: task.morning,
  cotizacion: task.cotizacion,
  descripcion: task.descripcion,
  cliente: task.cliente,
  cod_cliente: task.cod_cliente,
  planta: task.planta,
  plantaDir: task.plantaDir,
  plantaLocalidad: task.plantaLocalidad,
  colorAM: task.colorAM,
  estadoAM: task.estadoAM,
  horaInicio: task.horaInicio,
  horaFin: task.horaFin,
  grupo_id: task.grupoId || null,
  lastModified: task.timestampUpdated || null,
  ...overrides,
});

export const clearPayload = (rowId) => ({ rowId, tipo_tarea: '', morning: '' });
