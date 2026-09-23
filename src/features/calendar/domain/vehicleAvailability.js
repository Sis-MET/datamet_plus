// Disponibilidad de vehículos para un día concreto. Vive en domain/ porque es
// lógica pura: la agenda la usa para el resumen lateral y no toca la red.
import { timeToMinutes } from '../utils/calendarTime';
import { getVehicleTaskLabel, normalizeArea } from './taskFormDomain';

/** Jornada por defecto cuando el recurso no trae horario propio. */
export const DEFAULT_SHIFT_START = '08:30';
export const DEFAULT_SHIFT_END = '18:30';

const VEHICLE_AREA = 'VEHICULOS';

export const isVehicleResource = (resource) =>
  normalizeArea(resource?.area || '') === VEHICLE_AREA;

const toShiftTime = (value, fallback) => (
  typeof value === 'string' && value.trim() ? value.trim().substring(0, 5) : fallback
);

const hasContent = (task) => Boolean(
  String(task?.tipoTarea || task?.morning || task?.descripcion || '').trim()
);

/** Une los tramos ocupados que se solapan o se tocan, ya ordenados por inicio. */
const mergeBusyBlocks = (blocks) => blocks.reduce((merged, block) => {
  const previous = merged[merged.length - 1];
  if (previous && timeToMinutes(block.start) <= timeToMinutes(previous.end)) {
    if (timeToMinutes(block.end) > timeToMinutes(previous.end)) {
      previous.end = block.end;
      previous.label = getVehicleTaskLabel(block);
    }
    previous.count += 1;
    return merged;
  }
  merged.push({ ...block, count: 1 });
  return merged;
}, []);

/**
 * Estado de un vehículo en un día: `free` sin tareas, `busy` cuando la jornada
 * queda cubierta de punta a punta y `partial` cuando todavía hay huecos.
 */
export function getVehicleDayAvailability(vehicle, tasks = []) {
  const shiftStart = toShiftTime(vehicle?.hora_ingreso, DEFAULT_SHIFT_START);
  const shiftEnd = toShiftTime(vehicle?.hora_salida, DEFAULT_SHIFT_END);

  const busyBlocks = mergeBusyBlocks(
    tasks
      .filter(hasContent)
      .map(task => ({
        start: toShiftTime(task.horaInicio, shiftStart),
        end: toShiftTime(task.horaFin, shiftEnd),
        label: getVehicleTaskLabel(task),
      }))
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
  );

  if (busyBlocks.length === 0) {
    return {
      state: 'free',
      busyBlocks: [],
      freeWindows: [{ start: shiftStart, end: shiftEnd }],
      taskCount: 0,
      shiftStart,
      shiftEnd,
    };
  }

  // Huecos entre tramos ocupados, recortados a la jornada del vehículo.
  const freeWindows = [];
  let cursor = timeToMinutes(shiftStart);
  busyBlocks.forEach(block => {
    if (timeToMinutes(block.start) > cursor) {
      freeWindows.push({ start: minutesToTime(cursor), end: block.start });
    }
    cursor = Math.max(cursor, timeToMinutes(block.end));
  });
  if (cursor < timeToMinutes(shiftEnd)) {
    freeWindows.push({ start: minutesToTime(cursor), end: shiftEnd });
  }

  return {
    state: freeWindows.length === 0 ? 'busy' : 'partial',
    busyBlocks,
    freeWindows,
    taskCount: busyBlocks.reduce((total, block) => total + block.count, 0),
    shiftStart,
    shiftEnd,
  };
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

const STATE_ORDER = { free: 0, partial: 1, busy: 2 };

/**
 * Resumen ordenado para la agenda: primero los vehículos libres, porque la
 * pregunta que responde el panel es "qué auto puedo usar hoy".
 */
export function summarizeVehicleAvailability({ vehicles = [], getTasksForVehicle }) {
  const rows = vehicles
    .map(vehicle => ({
      vehicle,
      ...getVehicleDayAvailability(
        vehicle,
        typeof getTasksForVehicle === 'function' ? getTasksForVehicle(vehicle.id) || [] : []
      ),
    }))
    .sort((a, b) => (
      STATE_ORDER[a.state] - STATE_ORDER[b.state]
      || String(a.vehicle.nombre || '').localeCompare(String(b.vehicle.nombre || ''))
    ));

  return {
    rows,
    total: rows.length,
    freeCount: rows.filter(row => row.state === 'free').length,
    partialCount: rows.filter(row => row.state === 'partial').length,
    busyCount: rows.filter(row => row.state === 'busy').length,
  };
}
