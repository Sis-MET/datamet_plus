import { timeToMinutes } from '../utils/calendarTime';
import { hasTaskContent, hasTimeOverlap } from './taskLinks';

export const PRESET_COLORS = [
  '#dadd12ff',
  '#1d2e8fff',
  '#424242ff',
  '#ce1515ff',
  '#621fceff',
  '#44bfefff',
];

export const ACTIVITY_OPTIONS = [
  'Servicio',
  'Visita',
  'Compensacion',
  'Permiso - Personal',
  'Permiso - Vacacion',
  'Otro',
];

export const NO_CLIENT_ACTIVITY_TYPES = new Set([
  'Compensacion',
  'Permiso - Personal',
  'Permiso - Vacacion',
  'Otro',
]);

export const QUOTE_ACTIVITY_TYPES = new Set(['Servicio']);

/**
 * Tipos de tarea que no son una salida a un servicio: no piden la cotización,
 * SECA u OTST del servicio asociado.
 */
export const NO_REFERENCE_ACTIVITY_TYPES = new Set([
  'Compensacion',
  'Permiso - Personal',
  'Permiso - Vacacion',
]);

export const requiresServiceReference = (activityType) => !NO_REFERENCE_ACTIVITY_TYPES.has(activityType);

/** Largo máximo de la referencia del servicio (la columna admite 100). */
export const REFERENCE_MAX_LENGTH = 60;

export const REFERENCE_LABELS = {
  COTIZACION: 'Cotización',
  SECA: 'SECA',
  OTST: 'OTST',
};

// Formatos de ServiceMET y del libro: OTST «26-0285-51-S01» (las antiguas
// «0000-S16-1-25»), SECA «0051-C01-26» o «0103-31-C05-26», cotización «123.COT456».
const REFERENCE_PATTERNS = [
  ['OTST', /\b\d{2}-\d{4}-\d{1,3}-S\d{2}\b/i],
  ['OTST', /\b\d{4}-S\d{2}-\d{1,3}-\d{2}\b/i],
  ['SECA', /\b\d{4}(?:-\d{1,3})?-C\d{2}-\d{2}\b/i],
  ['COTIZACION', /\b\d+\.COT\d+\b/i],
];
const REFERENCE_WORDS = [
  ['OTST', /\bOTST\b/i],
  ['SECA', /\bSECA\b/i],
  ['COTIZACION', /\bCOT(?:IZACI[OÓ]N)?\b/i],
];

/**
 * Qué referencia escribió el usuario: { tipo, codigo } con tipo COTIZACION,
 * SECA u OTST, o tipo null si no se reconoce (se guarda igual, como texto libre).
 */
export function recognizeServiceReference(value) {
  const text = String(value || '').trim();
  if (!text) return { tipo: null, codigo: '' };
  for (const [tipo, pattern] of REFERENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return { tipo, codigo: match[0].toUpperCase() };
  }
  for (const [tipo, pattern] of REFERENCE_WORDS) {
    if (pattern.test(text)) return { tipo, codigo: text.toUpperCase() };
  }
  return { tipo: null, codigo: text.toUpperCase() };
}

/** Etiqueta para mostrar una referencia guardada: «OTST», «SECA», «Cotización» o «Referencia». */
export const serviceReferenceLabel = (value) => REFERENCE_LABELS[recognizeServiceReference(value).tipo] || 'Referencia';

export const normalizeArea = (area = '') => String(area)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase();

export const getVehicleTaskLabel = (task) => (
  task.tipoTarea || task.morning || task.descripcion || 'Otra tarea'
).trim();

export const parseActivityValue = (value) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return { activityType: '', quoteCode: '' };

  const matchedOption = ACTIVITY_OPTIONS.find(
    option => normalizeArea(option) === normalizeArea(rawValue)
  );
  if (matchedOption) return { activityType: matchedOption, quoteCode: '' };

  const combinedMatch = rawValue.match(/^(.+?)\s*-\s*([0-9]+\.COT[0-9]+)$/i);
  if (!combinedMatch) return { activityType: '', quoteCode: '' };

  const matchedActivity = ACTIVITY_OPTIONS.find(
    option => normalizeArea(option) === normalizeArea(combinedMatch[1])
  );

  return matchedActivity
    ? { activityType: matchedActivity, quoteCode: combinedMatch[2].toUpperCase() }
    : { activityType: '', quoteCode: '' };
};

export const getPlantParts = (planta) => {
  const rawDir = String(planta?.dir || '').trim();
  let address = rawDir;
  let department = String(planta?.dep || planta?.localidad || '').trim();

  if (rawDir.includes('-')) {
    const parts = rawDir.split('-').map(part => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      if (!department) department = parts.at(-1);
      address = parts.slice(0, -1).join(' - ').trim();
    }
  }

  return { address, department };
};

export const getPlantOptionLabel = (planta, clienteLabel = '') => {
  const clientName = String(clienteLabel || '').trim();
  const department = getPlantParts(planta).department;
  return [clientName, department].filter(Boolean).join(' - ') || planta?.codigo_planta || '';
};

export const isPlantCode = (value) => /^\d+\s*-\s*\d+/i.test(String(value || '').trim());

export const getClientCodeFromPlantCode = (value) => String(value || '').trim().split('-')[0].trim();

/**
 * Primera tarea del vehículo que choca con el horario pedido. `ignoredRowIds`
 * son las filas de la misma ficha que se está editando: su propia reserva no
 * cuenta como conflicto.
 */
export const findVehicleConflict = ({ tasks = [], ignoredRowIds = [], start, end }) => {
  const ignored = new Set(ignoredRowIds.filter(Boolean).map(String));
  const requested = { horaInicio: start, horaFin: end };

  return tasks.find(task => (
    !ignored.has(String(task.rowId)) &&
    hasTaskContent(task) &&
    hasTimeOverlap(task, requested)
  )) || null;
};

export const validateTaskDraft = ({
  activityType,
  requiresPlantAssistance,
  cliente,
  color,
  descripcion,
  horaInicio,
  horaFin,
  overlaps,
  vehicleConflict,
}) => {
  if (!activityType) return 'Debe seleccionar un tipo de tarea.';
  if (requiresPlantAssistance && !cliente.trim()) return `Debe ingresar un cliente para ${activityType.toLowerCase()}.`;
  if (!color.trim()) return 'Debe seleccionar un color para la ficha.';
  if (!descripcion.trim()) return 'La descripción no puede ir vacía.';
  if (timeToMinutes(horaFin) <= timeToMinutes(horaInicio)) return 'La hora de fin debe ser posterior a la hora de inicio.';
  if (overlaps) return `El rango ${horaInicio}–${horaFin} se superpone con una tarea registrada. Elige un tramo libre.`;
  if (vehicleConflict) return 'El vehículo seleccionado ya no está disponible en este horario.';
  return null;
};

export const buildTaskPayload = ({
  event,
  activityType,
  requiresQuote,
  cotizacionCode,
  serviceReference = '',
  descripcion,
  color,
  estado,
  horaInicio,
  horaFin,
  cliente,
  codCliente,
  planta,
  additionalResources,
  selectedVehicle,
}) => ({
  rowId: event?.rowId || null,
  tipo_tarea: activityType,
  tipoTarea: activityType,
  // Sin el buscador de cotizaciones, la columna guarda la referencia del
  // servicio (cotización, SECA u OTST) que el usuario escribió.
  cotizacion: requiresQuote
    ? cotizacionCode.trim().toUpperCase()
    : requiresServiceReference(activityType)
      ? String(serviceReference || '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, REFERENCE_MAX_LENGTH)
      : '',
  morning: activityType,
  descripcion: descripcion.trim(),
  afternoon: '',
  colorAM: color,
  colorPM: color,
  estadoAM: estado,
  estadoPM: null,
  horaInicio,
  horaFin,
  cliente: cliente.trim(),
  cod_cliente: codCliente.trim(),
  planta,
  lastModified: event?.timestampUpdated || null,
  additionalResources,
  vehicleResource: selectedVehicle || null,
});
