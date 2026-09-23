const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const GROUP_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (value, maxLength, label = 'El campo') => {
  const normalized = String(value ?? '').trim();
  if (normalized.length > maxLength) {
    const error = new Error(`${label} supera el máximo de ${maxLength} caracteres.`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const toMinutes = (value) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return (hours * 60) + minutes;
};

const validateScheduleInput = (data) => {
  if (!data || !DATE_PATTERN.test(String(data.date || ''))) {
    const error = new Error('La fecha debe usar el formato YYYY-MM-DD.');
    error.statusCode = 400;
    throw error;
  }

  const resource = text(data.resource, 200, 'El recurso');
  if (!resource) {
    const error = new Error('El recurso es obligatorio.');
    error.statusCode = 400;
    throw error;
  }

  const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
  const horaInicio = text(payload.horaInicio, 5);
  const horaFin = text(payload.horaFin, 5);

  if ((horaInicio || horaFin) && (!TIME_PATTERN.test(horaInicio) || !TIME_PATTERN.test(horaFin))) {
    const error = new Error('El horario debe incluir inicio y fin en formato HH:mm.');
    error.statusCode = 400;
    throw error;
  }

  if (horaInicio && toMinutes(horaFin) <= toMinutes(horaInicio)) {
    const error = new Error('La hora de fin debe ser posterior a la hora de inicio.');
    error.statusCode = 400;
    throw error;
  }

  return {
    date: data.date,
    resource,
    payload: {
      ...payload,
      tipo_tarea: text(payload.tipo_tarea || payload.tipoTarea || payload.morning, 100, 'El tipo de tarea'),
      cotizacion: text(payload.cotizacion, 100, 'La cotización'),
      descripcion: text(payload.descripcion, 200, 'La descripción'),
      cliente: text(payload.cliente, 200, 'El cliente'),
      cod_cliente: text(payload.cod_cliente, 100, 'El código de cliente'),
      planta: text(payload.planta, 200, 'La planta'),
      colorAM: text(payload.colorAM || payload.color, 20, 'El color'),
      estadoAM: text(payload.estadoAM || payload.estado, 50, 'El estado'),
      autor: text(payload.autor, 200, 'El autor'),
      creado_en: text(payload.creado_en, 100, 'El origen'),
      grupo_id: GROUP_ID_PATTERN.test(String(payload.grupo_id || '')) ? String(payload.grupo_id).toLowerCase() : '',
      horaInicio,
      horaFin,
    },
  };
};

const validateScheduleBatch = (data) => {
  if (!data || !Array.isArray(data.assignments) || data.assignments.length === 0) {
    const error = new Error('Debe incluir al menos una asignación.');
    error.statusCode = 400;
    throw error;
  }
  if (data.assignments.length > 50) {
    const error = new Error('No se pueden guardar más de 50 asignaciones por operación.');
    error.statusCode = 400;
    throw error;
  }

  const seen = new Set();
  return data.assignments.map(assignment => {
    const normalized = validateScheduleInput({ ...assignment, date: assignment.date || data.date });
    // Una misma fila no puede tocarse dos veces, ni insertarse dos fichas nuevas
    // para el mismo recurso y día; sí se permite anular una fila y crear otra
    // en la misma operación (p. ej. al reprogramar).
    const key = `${normalized.date}|${normalized.resource}|${normalized.payload.rowId || 'nueva'}`;
    if (seen.has(key)) {
      const error = new Error(`El recurso ${normalized.resource} está repetido en la operación.`);
      error.statusCode = 400;
      throw error;
    }
    seen.add(key);
    return normalized;
  });
};

module.exports = {
  validateScheduleInput,
  validateScheduleBatch,
};
