/**
 * Cronograma de calibración: punto de entrada del servicio. Reúne lo de
 * calibration.lecturas, .plan, .programas, .actividades, .eventos, .ajustes y
 * .envios para el controlador y la revisión diaria de alertas.
 */
const { getAjustes, getPersonal } = require('./calibration.lecturas');
const { getAlertSummary, getCalibrationPermissions, getPlan, previewDates } = require('./calibration.plan');
const { updateEquipoConfig, updateEquiposMasivo } = require('./calibration.programas');
const { createActividad, deleteActividad, getActividadHistorial, updateActividad } = require('./calibration.actividades');
const { getEventoHistorial, resetEvento, revisarEvento, saveEvento } = require('./calibration.eventos');
const { createContacto, deleteContacto, getAlertSettings, updateAjustes, updateContacto } = require('./calibration.ajustes');
const { claimDailyRun, runAlerts, sendTestEmail } = require('./calibration.envios');

module.exports = {
  getCalibrationPermissions,
  getPlan,
  getAlertSummary,
  getPersonal,
  previewDates,
  updateEquipoConfig,
  updateEquiposMasivo,
  createActividad,
  updateActividad,
  deleteActividad,
  getActividadHistorial,
  saveEvento,
  resetEvento,
  revisarEvento,
  getEventoHistorial,
  getAjustes,
  updateAjustes,
  getAlertSettings,
  createContacto,
  updateContacto,
  deleteContacto,
  claimDailyRun,
  runAlerts,
  sendTestEmail,
};
