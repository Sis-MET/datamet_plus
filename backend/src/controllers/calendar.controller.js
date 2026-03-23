const calendarService = require('../services/calendar.service');

/**
 * @route GET /api/calendar/schedule?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Retorna las tareas del cronograma en el rango dado.
 */
const getSchedule = async (req, res, next) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Los parámetros "start" y "end" son requeridos (formato YYYY-MM-DD)',
      });
    }

    // Validar formato
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start) || !dateRegex.test(end)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de fecha inválido. Use YYYY-MM-DD',
      });
    }

    const tasks = await calendarService.getSchedule(start, end);

    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
};

/**
 * @route GET /api/calendar/tecnicos
 * Retorna todos los usuarios/técnicos para las filas del Gantt.
 */
const getTecnicos = async (req, res, next) => {
  try {
    const tecnicos = await calendarService.getTecnicos();
    res.status(200).json({ success: true, data: tecnicos });
  } catch (error) {
    next(error);
  }
};

/**
 * @route POST /api/calendar/cronograma
 * Construye o actualiza una celda en el cronograma (solo Admin)
 */
const upsertScheduleCell = async (req, res, next) => {
  try {
    const data = req.body;
    
    // Básica validación de requeridos
    if (!data.date || !data.resource) {
      return res.status(400).json({ success: false, message: 'La fecha y el recurso son requeridos' });
    }

    const updatedRow = await calendarService.upsertScheduleCell(data);
    res.status(200).json({ success: true, data: updatedRow });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ success: false, message: error.message });
    }
    if (error.message.includes('ya está reservado')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  getSchedule,
  getTecnicos,
  upsertScheduleCell
};
