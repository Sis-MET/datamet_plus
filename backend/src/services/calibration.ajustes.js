/** Ajustes de las alertas y contactos que las reciben. */
const { getPool, sql } = require('../config/db');
const env = require('../config/env');
const { normalizeEmail } = require('./calibration.alerts');
const { mailStatus } = require('./mailer.service');
const { actorName, httpError, withTransaction } = require('./calibration.db');
const { AJUSTES_LABELS, describePlanChanges, logPlan } = require('./calibration.history');
const { getAjustes, getContactos, getEnvios } = require('./calibration.lecturas');

const updateAjustes = async (data, actor) => {
  await withTransaction(async (createRequest) => {
    const found = await createRequest().query(`
      SELECT alerta_dias, alerta_frecuencia, alerta_correo, hora_envio
      FROM dbo.CAL_AJUSTES WITH (UPDLOCK, HOLDLOCK) WHERE id = 1
    `);
    const row = found.recordset[0];
    const before = row ? {
      alerta_dias: row.alerta_dias,
      alerta_frecuencia: row.alerta_frecuencia,
      alerta_correo: Boolean(row.alerta_correo),
      hora_envio: String(row.hora_envio || '').trim(),
    } : null;
    const after = {
      alerta_dias: data.alertaDias,
      alerta_frecuencia: data.alertaFrecuencia,
      alerta_correo: data.alertaCorreo,
      hora_envio: data.horaEnvio,
    };
    const detalle = describePlanChanges(before, after, AJUSTES_LABELS);
    if (!detalle) return;
    await createRequest()
      .input('dias', sql.Int, data.alertaDias)
      .input('frec', sql.VarChar(10), data.alertaFrecuencia)
      .input('correo', sql.Bit, data.alertaCorreo)
      .input('hora', sql.Char(5), data.horaEnvio)
      .input('actor', sql.NVarChar(50), actorName(actor))
      .query(`
        UPDATE dbo.CAL_AJUSTES
        SET alerta_dias = @dias, alerta_frecuencia = @frec, alerta_correo = @correo,
          hora_envio = @hora, actualizado_por = @actor, actualizado_en = SYSUTCDATETIME()
        WHERE id = 1
      `);
    await logPlan(createRequest, {
      entidad: 'AJUSTES',
      accion: 'EDICION',
      detalle,
      antes: before,
      despues: after,
      usuario: actorName(actor),
    });
  });
  return getAjustes();
};

const assertUniqueContacto = async (data, excludeId = null) => {
  const result = await getPool().request()
    .input('email', sql.NVarChar(150), data.email)
    .input('uid', sql.Int, data.usuarioId)
    .input('exclude', sql.Int, excludeId)
    .query(`
      SELECT TOP 1 email, usuario_id FROM dbo.CAL_CONTACTOS
      WHERE (LOWER(email) = @email OR (@uid IS NOT NULL AND usuario_id = @uid))
        AND (@exclude IS NULL OR id <> @exclude)
    `);
  const existing = result.recordset[0];
  if (!existing) return;
  throw httpError(409, normalizeEmail(existing.email) === data.email
    ? 'Ese correo ya está registrado.'
    : 'Esa persona ya tiene un correo registrado.');
};

const bindContacto = (request, data) => request
  .input('uid', sql.Int, data.usuarioId)
  .input('nombre', sql.NVarChar(100), data.nombre)
  .input('email', sql.NVarChar(150), data.email)
  .input('todas', sql.Bit, data.recibeTodas)
  .input('activo', sql.Bit, data.activo);

const createContacto = async (data) => {
  await assertUniqueContacto(data);
  const result = await bindContacto(getPool().request(), data).query(`
    INSERT INTO dbo.CAL_CONTACTOS (usuario_id, nombre, email, recibe_todas, activo)
    OUTPUT INSERTED.id
    VALUES (@uid, @nombre, @email, @todas, @activo)
  `);
  return { id: result.recordset[0].id };
};

const updateContacto = async (id, data) => {
  await assertUniqueContacto(data, id);
  const result = await bindContacto(getPool().request(), data)
    .input('id', sql.Int, id)
    .query(`
      UPDATE dbo.CAL_CONTACTOS
      SET usuario_id = @uid, nombre = @nombre, email = @email, recibe_todas = @todas,
        activo = @activo, actualizado_en = SYSUTCDATETIME()
      WHERE id = @id
    `);
  if (result.rowsAffected[0] === 0) throw httpError(404, 'El contacto no existe.');
  return { id };
};

const deleteContacto = async (id) => {
  const result = await getPool().request()
    .input('id', sql.Int, id)
    .query('DELETE FROM dbo.CAL_CONTACTOS WHERE id = @id');
  if (result.rowsAffected[0] === 0) throw httpError(404, 'El contacto no existe.');
  return { id };
};

const getAlertSettings = async () => {
  const [ajustes, contactos, envios] = await Promise.all([getAjustes(), getContactos(), getEnvios()]);
  return {
    ajustes,
    contactos,
    envios,
    correo: { ...mailStatus(), alertasActivas: env.calibration.alertsEnabled },
  };
};

module.exports = { createContacto, deleteContacto, getAlertSettings, updateAjustes, updateContacto };
