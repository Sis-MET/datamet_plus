const calibrationService = require('../services/calibration.service');
const { parse } = require('../services/calibration.validation');

const readId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error('Identificador inválido.'), { statusCode: 400 });
  }
  return id;
};

/** Envuelve cada acción: responde { success, data } y traduce errores conocidos. */
const handle = (action) => async (req, res, next) => {
  try {
    const data = await action(req);
    res.status(200).json({ success: true, data });
  } catch (error) {
    if ([400, 403, 404, 409, 503].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (/Invalid object name 'dbo\.CAL_/i.test(error.message || '')) {
      return res.status(503).json({
        success: false,
        message: 'El módulo de calibración aún no está instalado en la base de datos. Aplica la migración 004 con "pnpm migrate" en backend.',
      });
    }
    return next(error);
  }
};

module.exports = {
  getPlan: handle(req => calibrationService.getPlan({ anio: req.query.anio, user: req.user })),
  getAlertSummary: handle(() => calibrationService.getAlertSummary()),
  getPersonal: handle(() => calibrationService.getPersonal()),
  previewDates: handle(req => calibrationService.previewDates(parse('vistaPrevia', req.body))),

  updateEquipo: handle(req => calibrationService.updateEquipoConfig(
    readId(req.params.id),
    parse('equipoConfig', req.body),
    req.user
  )),
  updateEquipos: handle(req => calibrationService.updateEquiposMasivo(parse('equiposMasivo', req.body), req.user)),

  createActividad: handle(req => calibrationService.createActividad(parse('actividad', req.body), req.user)),
  updateActividad: handle(req => calibrationService.updateActividad(
    readId(req.params.id),
    parse('actividad', req.body),
    req.user
  )),
  deleteActividad: handle(req => calibrationService.deleteActividad(readId(req.params.id), req.user)),

  saveEvento: handle(req => calibrationService.saveEvento(parse('evento', req.body), req.user)),
  resetEvento: handle(req => calibrationService.deleteEvento(parse('eventoClave', req.query))),

  getAlertSettings: handle(() => calibrationService.getAlertSettings()),
  updateAjustes: handle(req => calibrationService.updateAjustes(parse('ajustes', req.body), req.user)),
  createContacto: handle(req => calibrationService.createContacto(parse('contacto', req.body))),
  updateContacto: handle(req => calibrationService.updateContacto(readId(req.params.id), parse('contacto', req.body))),
  deleteContacto: handle(req => calibrationService.deleteContacto(readId(req.params.id))),
  sendTestEmail: handle(req => calibrationService.sendTestEmail(parse('prueba', req.body).email)),
  runAlerts: handle(() => calibrationService.runAlerts()),
};
