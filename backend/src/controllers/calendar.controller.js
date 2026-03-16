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
 * @route POST /api/calendar/schedule
 * Crea una nueva tarea (solo Admin)
 */
const createEvent = async (req, res, next) => {
  try {
    const data = req.body;
    
    // Básica validación de requeridos
    if (!data.Tecnico || !data.fecha_inicio || !data.fecha_fin || !data.tipo || !data.estado) {
      return res.status(400).json({ success: false, message: 'Campos requeridos faltantes' });
    }

    const newEvent = await calendarService.createEvent(data);
    res.status(201).json({ success: true, data: newEvent });
  } catch (error) {
    next(error);
  }
};

/**
 * @route PUT /api/calendar/schedule/:id
 * Actualiza una tarea existente (solo Admin)
 */
const updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updatedEvent = await calendarService.updateEvent(id, data);
    
    if (!updatedEvent) {
      return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
    }

    res.status(200).json({ success: true, data: updatedEvent });
  } catch (error) {
    next(error);
  }
};

/**
 * @route DELETE /api/calendar/schedule/:id
 * Elimina una tarea (solo Admin)
 */
const deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    await calendarService.deleteEvent(id);
    res.status(200).json({ success: true, message: 'Tarea eliminada' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSchedule,
  getTecnicos,
  createEvent,
  updateEvent,
  deleteEvent
};
