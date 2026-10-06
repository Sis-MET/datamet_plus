const env = require('../config/env');
const { isMailConfigured } = require('./mailer.service');
const { timeLocal, todayLocal } = require('./calibration.schedule');
const calibrationService = require('./calibration.service');
const { recordFailure } = require('./system.failures');

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
let timer = null;
let warnedMissingTables = false;

/**
 * Revisión diaria: a partir de la hora configurada envía los avisos del día.
 * La reserva en CAL_AJUSTES.ultima_revision evita repetirla tras un reinicio
 * o si hubiera más de un proceso.
 */
const runScheduledAlerts = async (now = new Date()) => {
  if (!isMailConfigured()) return { omitido: 'correo-no-configurado' };
  const ajustes = await calibrationService.getAjustes();
  const hoy = todayLocal(now);
  if (timeLocal(now) < ajustes.horaEnvio) return { omitido: 'antes-de-hora' };
  if (!(await calibrationService.claimDailyRun(hoy))) return { omitido: 'ya-revisado' };
  const resultado = await calibrationService.runAlerts({ hoy });
  console.log(`Alertas de calibración ${hoy}: ${resultado.avisos} avisos a ${resultado.destinatarios} destinatarios, ${resultado.errores.length} errores.`);
  return resultado;
};

const tick = async () => {
  try {
    await runScheduledAlerts();
  } catch (error) {
    if (/Invalid object name 'dbo\.CAL_/i.test(error.message)) {
      if (!warnedMissingTables) {
        console.warn('Alertas de calibración en espera: aplica la migración 004 (pnpm migrate).');
        warnedMissingTables = true;
      }
      return;
    }
    console.error('Error en las alertas de calibración:', error.message);
    recordFailure({ origen: 'TAREA', error, mensaje: `Alertas de calibración: ${error.message}` });
  }
};

const startCalibrationScheduler = () => {
  if (timer) return;
  if (!env.calibration.alertsEnabled) {
    console.log('Alertas de calibración por correo desactivadas (CAL_ALERTS_ENABLED=false).');
    return;
  }
  if (!isMailConfigured()) {
    console.log('Alertas de calibración: sin SMTP configurado, solo se mostrarán en el cronograma.');
  }
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  timer.unref();
  setTimeout(tick, 30 * 1000).unref();
};

const stopCalibrationScheduler = () => {
  clearInterval(timer);
  timer = null;
};

module.exports = { runScheduledAlerts, startCalibrationScheduler, stopCalibrationScheduler };
