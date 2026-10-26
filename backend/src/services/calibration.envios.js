/** Envío diario de las alertas por correo y registro de cada aviso. */
const { getPool, sql } = require('../config/db');
const env = require('../config/env');
const { activeAlerts, addDays, todayLocal } = require('./calibration.schedule');
const { buildDigests, renderDigestEmail } = require('./calibration.alerts');
const { isMailConfigured, sendMail } = require('./mailer.service');
const { httpError } = require('./calibration.db');
const { ALERT_HORIZON_DAYS, horizonOccurrences, loadPlanSources } = require('./calibration.plan');
const { getAlertHistory, getContactos } = require('./calibration.lecturas');

/** Reserva la revisión del día; solo un proceso la obtiene. */
const claimDailyRun = async (hoy) => {
  const result = await getPool().request()
    .input('hoy', sql.Date, hoy)
    .query(`
      UPDATE dbo.CAL_AJUSTES
      SET ultima_revision = @hoy
      WHERE id = 1 AND (ultima_revision IS NULL OR ultima_revision < @hoy)
    `);
  return result.rowsAffected[0] === 1;
};

const logEnvio = async ({ occurrence, email, motivo, estado, error, hoy }) => {
  await getPool().request()
    .input('serie', sql.VarChar(30), occurrence.serie)
    .input('fp', sql.Date, occurrence.fechaProgramada)
    .input('email', sql.NVarChar(150), email)
    .input('motivo', sql.VarChar(10), motivo)
    .input('estado', sql.VarChar(10), estado)
    .input('error', sql.NVarChar(400), error ? String(error).slice(0, 400) : null)
    .input('hoy', sql.Date, hoy)
    .query(`
      INSERT INTO dbo.CAL_ALERTAS_ENVIOS (serie, fecha_programada, email, motivo, estado, error, fecha_local)
      VALUES (@serie, @fp, @email, @motivo, @estado, @error, @hoy)
    `);
};

/** Envía el resumen del día a cada destinatario y registra cada aviso. */
const runAlerts = async ({ hoy = todayLocal() } = {}) => {
  if (!isMailConfigured()) {
    throw httpError(503, 'El correo no está configurado en el servidor. Define SMTP_HOST y SMTP_FROM en backend/.env.');
  }
  const [sources, contactos, history] = await Promise.all([
    loadPlanSources(),
    getContactos(),
    getAlertHistory(addDays(hoy, -ALERT_HORIZON_DAYS)),
  ]);
  const alerts = activeAlerts(horizonOccurrences(sources, hoy));
  const digests = buildDigests({ alerts, contactos, history, hoy });

  const summary = { destinatarios: 0, avisos: 0, errores: [] };
  for (const digest of digests) {
    const email = renderDigestEmail({
      nombre: digest.contacto.nombre,
      items: digest.items,
      appUrl: env.calibration.appUrl,
    });
    let failure = null;
    try {
      await sendMail({ to: digest.email, ...email });
      summary.destinatarios += 1;
      summary.avisos += digest.items.length;
    } catch (error) {
      failure = error.message || 'Error al enviar';
      summary.errores.push({ email: digest.email, error: failure });
    }
    for (const item of digest.items) {
      await logEnvio({
        occurrence: item.occurrence,
        email: digest.email,
        motivo: item.motivo,
        estado: failure ? 'ERROR' : 'ENVIADO',
        error: failure,
        hoy,
      });
    }
  }
  return summary;
};

const sendTestEmail = async (to) => {
  await sendMail({
    to,
    subject: 'Prueba de alertas de calibración',
    text: 'Este es un correo de prueba del cronograma de calibración de DataMET+. Si lo recibes, las alertas por correo funcionan.',
    html: '<p style="font-family:Segoe UI,Roboto,Arial,sans-serif;font-size:14px;color:#181816;">Este es un correo de prueba del <strong>cronograma de calibración</strong> de DataMET+.<br>Si lo recibes, las alertas por correo funcionan.</p>',
  });
  return { email: to };
};

module.exports = { claimDailyRun, runAlerts, sendTestEmail };
