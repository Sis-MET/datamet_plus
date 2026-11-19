/**
 * Sincronización automática de la copia de Bitrix24 (Comercial, fase 2):
 * cada BITRIX_SYNC_MINUTOS (15 por omisión), solo si hay webhook y
 * BITRIX_SYNC_ENABLED no es false. Sin la migración 035 espera en silencio.
 */
const bitrix = require('./comercial.bitrix');
const { recordFailure } = require('./system.failures');

let timer = null;
let avisoTablas = false;

const tick = async () => {
  try {
    await bitrix.sincronizar({ por: 'automática' });
  } catch (error) {
    if (error.statusCode === 503 && /migración 03[56]/.test(error.message)) {
      if (!avisoTablas) {
        console.warn(`Sincronización con Bitrix24 en espera: ${error.message}`);
        avisoTablas = true;
      }
      return;
    }
    console.error('Sincronización con Bitrix24:', error.message);
    recordFailure({ origen: 'TAREA', error, mensaje: `Sincronización con Bitrix24: ${error.message}` });
  }
};

const startComercialBitrixScheduler = () => {
  if (timer) return;
  const config = bitrix.config();
  if (!config.configurado) {
    if (config.error) console.warn(`Bitrix24 (Comercial): ${config.error}`);
    return;
  }
  if (!config.sincronizar) {
    console.log('Sincronización automática con Bitrix24 desactivada (BITRIX_SYNC_ENABLED=false).');
    return;
  }
  timer = setInterval(tick, config.minutos * 60 * 1000);
  timer.unref();
  setTimeout(tick, 60 * 1000).unref();
  console.log(`Sincronización con Bitrix24 cada ${config.minutos} min.`);
};

const stopComercialBitrixScheduler = () => {
  clearInterval(timer);
  timer = null;
};

module.exports = { startComercialBitrixScheduler, stopComercialBitrixScheduler };
