const calibrationService = require('../services/calibration.service');
const equipmentService = require('../services/calibration.equipment');
const complianceService = require('../services/calibration.compliance');
const { parse } = require('../services/calibration.validation');
const { recordFailure } = require('../services/system.failures');

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
    // Tabla o columna ausente: falta aplicar una migración del módulo.
    if (/Invalid (object|column) name '(dbo\.CAL_|registro_ref|revisado_|revision_obs|corregido_)/i.test(error.message || '')) {
      recordFailure({ origen: 'SERVIDOR', error: Object.assign(error, { statusCode: 503 }), req });
      return res.status(503).json({
        success: false,
        message: 'Faltan migraciones del módulo de calibración en la base de datos. Ejecuta "pnpm migrate" en backend.',
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

  // Gestión de los equipos de DATA_EQUIPOS_CAL.
  getEquipoHistorial: handle(req => equipmentService.getEquipoHistorial(readId(req.params.id), req.user)),
  createEquipo: handle(req => equipmentService.createEquipo(parse('equipoAlta', req.body), req.user)),
  updateEquipoDatos: handle(req => equipmentService.updateEquipoDatos(
    readId(req.params.id),
    parse('equipoDatos', req.body),
    req.user
  )),
  registrarCertificado: handle(req => equipmentService.registrarCertificado(
    readId(req.params.id),
    parse('certificado', req.body),
    req.user
  )),
  corregirCertificado: handle(req => equipmentService.corregirCertificado(
    readId(req.params.id),
    parse('certificadoCorreccion', req.body),
    req.user
  )),
  revisarCertificado: handle(req => equipmentService.revisarCertificado(
    readId(req.params.id),
    parse('certificadoRevision', req.body),
    req.user
  )),
  anularCertificado: handle(req => equipmentService.anularCertificado(
    readId(req.params.id),
    parse('anulacion', req.body),
    req.user
  )),
  cambiarEstadoEquipo: handle(req => equipmentService.cambiarEstado(
    readId(req.params.id),
    parse('estadoEquipo', req.body),
    req.user
  )),

  createActividad: handle(req => calibrationService.createActividad(parse('actividad', req.body), req.user)),
  updateActividad: handle(req => calibrationService.updateActividad(
    readId(req.params.id),
    parse('actividad', req.body),
    req.user
  )),
  deleteActividad: handle(req => calibrationService.deleteActividad(readId(req.params.id), req.user)),
  getActividadHistorial: handle(req => calibrationService.getActividadHistorial(readId(req.params.id))),

  saveEvento: handle(req => calibrationService.saveEvento(parse('evento', req.body), req.user)),
  resetEvento: handle(req => calibrationService.resetEvento(parse('eventoRestablecer', req.body), req.user)),
  revisarEvento: handle(req => calibrationService.revisarEvento(parse('eventoClave', req.body), req.user)),
  getEventoHistorial: handle(req => calibrationService.getEventoHistorial(parse('eventoClave', req.query))),

  getAlertSettings: handle(() => calibrationService.getAlertSettings()),
  updateAjustes: handle(req => calibrationService.updateAjustes(parse('ajustes', req.body), req.user)),
  createContacto: handle(req => calibrationService.createContacto(parse('contacto', req.body))),
  updateContacto: handle(req => calibrationService.updateContacto(readId(req.params.id), parse('contacto', req.body))),
  deleteContacto: handle(req => calibrationService.deleteContacto(readId(req.params.id))),
  sendTestEmail: handle(req => calibrationService.sendTestEmail(parse('prueba', req.body).email)),
  runAlerts: handle(() => calibrationService.runAlerts()),

  // Cumplimiento NB/ISO/IEC 17025 (7.5, 7.11 y 8.4), evaluado con los datos actuales.
  getCompliance: handle(req => complianceService.getCompliance({ version: String(req.query.version || '').slice(0, 20) || null })),
};
