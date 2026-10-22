const env = require('../config/env');
const { isMailConfigured } = require('./mailer.service');
const { timeLocal, todayLocal } = require('./calibration.schedule');
const proximos = require('./soporte.proximos');
const { recordFailure } = require('./system.failures');

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
let timer = null;
let warnedMissingTables = false;

/**
 * Revisión diaria de los próximos servicios de Soporte técnico: a partir de
 * la hora configurada envía los avisos del día. La reserva en
 * ST_AVISOS_AJUSTES.ultima_revision evita repetirla tras un reinicio o si
 * hubiera más de un proceso.
 */
const runScheduledAlerts = async (now = new Date()) => {
  if (!isMailConfigured()) return { omitido: 'correo-no-configurado' };
  const ajustes = await proximos.getAjustes();
  if (!ajustes.alertaCorreo || ajustes.alertaFrecuencia === 'NINGUNA') return { omitido: 'avisos-apagados' };
  const hoy = todayLocal(now);
  if (timeLocal(now) < ajustes.horaEnvio) return { omitido: 'antes-de-hora' };
  if (!(await proximos.claimDailyRun(hoy))) return { omitido: 'ya-revisado' };
  const resultado = await proximos.runAlerts({ hoy });
  console.log(`Avisos de soporte técnico ${hoy}: ${resultado.avisos} avisos a ${resultado.destinatarios} destinatarios, ${resultado.errores.length} errores.`);
  return resultado;
};

const tick = async () => {
  try {
    await runScheduledAlerts();
  } catch (error) {
    if (/Invalid object name 'dbo\.ST_/i.test(error.message)) {
      if (!warnedMissingTables) {
        console.warn('Avisos de soporte técnico en espera: aplica la migración 009.');
        warnedMissingTables = true;
      }
      return;
    }
    console.error('Error en los avisos de soporte técnico:', error.message);
    recordFailure({ origen: 'TAREA', error, mensaje: `Avisos de soporte técnico: ${error.message}` });
  }
};

const startSoporteScheduler = () => {
  if (timer) return;
  if (!env.soporte.alertsEnabled) {
    console.log('Avisos de soporte técnico por correo desactivados (ST_ALERTS_ENABLED=false).');
    return;
  }
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  timer.unref();
  setTimeout(tick, 45 * 1000).unref();
};

const stopSoporteScheduler = () => {
  clearInterval(timer);
  timer = null;
};

module.exports = { runScheduledAlerts, startSoporteScheduler, stopSoporteScheduler };
