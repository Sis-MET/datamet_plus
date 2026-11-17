const calendarService = require('../services/calendar.service');
const scheduleService = require('../services/schedule.service');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Responde 400 y devuelve null si el rango no es válido. */
const readDateRange = (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    res.status(400).json({
      success: false,
      message: 'Los parámetros "start" y "end" son requeridos (formato YYYY-MM-DD)',
    });
    return null;
  }

  if (!DATE_REGEX.test(start) || !DATE_REGEX.test(end)) {
    res.status(400).json({
      success: false,
      message: 'Formato de fecha inválido. Use YYYY-MM-DD',
    });
    return null;
  }

  return { start, end };
};

const getSchedule = async (req, res, next) => {
  try {
    const range = readDateRange(req, res);
    if (!range) return;

    const tasks = await calendarService.getSchedule(range.start, range.end);

    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
};

/** Buscador del cronograma (Ctrl + K): tareas de cualquier fecha. */
const searchSchedule = async (req, res, next) => {
  try {
    const tasks = await calendarService.searchSchedule(req.query.q);
    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    if (error.statusCode === 400) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

const getScheduleVersion = async (req, res, next) => {
  try {
    const range = readDateRange(req, res);
    if (!range) return;

    const version = await calendarService.getScheduleVersion(range.start, range.end);
    res.status(200).json({ success: true, data: { version } });
  } catch (error) {
    next(error);
  }
};

const getTecnicos = async (req, res, next) => {
  try {
    const tecnicos = await calendarService.getTecnicos();
    res.status(200).json({ success: true, data: tecnicos });
  } catch (error) {
    next(error);
  }
};

const upsertScheduleCell = async (req, res, next) => {
  try {
    const data = req.body;

    if (!data.date || !data.resource) {
      return res.status(400).json({ success: false, message: 'La fecha y el recurso son requeridos' });
    }

    const updatedRow = await scheduleService.upsertScheduleCell(data, req.user);
    res.status(200).json({ success: true, data: updatedRow });
  } catch (error) {
    if (error.statusCode === 403 || error.statusCode === 409) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (error.message && error.message.includes('ya está reservado')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const upsertScheduleAssignments = async (req, res, next) => {
  try {
    const rows = await scheduleService.upsertScheduleAssignments(req.body, req.user);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    if ([400, 403, 409].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  getSchedule,
  getScheduleVersion,
  searchSchedule,
  getTecnicos,
  upsertScheduleCell,
  upsertScheduleAssignments,
};
