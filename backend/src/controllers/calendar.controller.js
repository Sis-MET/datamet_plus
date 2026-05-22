const calendarService = require('../services/calendar.service');
const scheduleService = require('../services/schedule.service');

const getSchedule = async (req, res, next) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Los parámetros "start" y "end" son requeridos (formato YYYY-MM-DD)',
      });
    }

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

    const updatedRow = await scheduleService.upsertScheduleCell(data);
    res.status(200).json({ success: true, data: updatedRow });
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({ success: false, message: error.message });
    }
    if (error.message && error.message.includes('ya está reservado')) {
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
