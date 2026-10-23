const { sql } = require('../config/db');
const { normalizeArea, withTransaction } = require('./calibration.db');
const { esJefeArea } = require('./soporte.aprobacion');
const { httpError } = require('./soporte.validation');

const exigirJefe = async (request, user) => {
  const id = Number(user?.id);
  if (!Number.isInteger(id) || id <= 0) throw httpError(403, 'Solo el jefe de área de Soporte Técnico puede configurar aprobadores.');
  const result = await request().input('id', sql.Int, id).query(`
    SELECT TOP (1) id, area, cargo, usuario, LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre
    FROM DATA_USERS WITH (HOLDLOCK) WHERE id = @id AND estado = 'ACTIVO';`);
  const actor = result.recordset[0];
  if (!esJefeArea(actor)) throw httpError(403, 'Solo el jefe de área de Soporte Técnico puede configurar aprobadores.');
  return actor;
};

const leer = async (request, bloquear = false) => {
  const ajustes = await request().query(`SELECT version, actualizado_por, actualizado_en
    FROM dbo.ST_APROBADORES_AJUSTES ${bloquear ? 'WITH (UPDLOCK, HOLDLOCK)' : ''} WHERE id = 1;`);
  if (!ajustes.recordset[0]) throw httpError(503, 'Falta inicializar la configuración de aprobadores (migración 013).');
  const personal = await request().query(`SELECT id, usuario, area, cargo,
    LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre
    FROM DATA_USERS ${bloquear ? 'WITH (HOLDLOCK)' : ''} WHERE estado = 'ACTIVO';`);
  const permisos = await request().query('SELECT usuario_id FROM dbo.ST_APROBADORES;');
  const ids = permisos.recordset.map(row => row.usuario_id);
  const personas = personal.recordset.filter(row => normalizeArea(row.area) === 'soporte tecnico')
    .map(row => ({ id: row.id, usuario: row.usuario, nombre: row.nombre || row.usuario || `Personal ${row.id}`,
      cargo: row.cargo, esJefe: esJefeArea(row), autorizado: esJefeArea(row) || ids.includes(row.id) }))
    .sort((a, b) => Number(b.esJefe) - Number(a.esJefe) || a.nombre.localeCompare(b.nombre, 'es'));
  return { version: ajustes.recordset[0].version, personal: personas,
    aprobadores: personas.filter(row => !row.esJefe && row.autorizado).map(row => row.id),
    actualizadoPor: ajustes.recordset[0].actualizado_por, actualizadoEn: ajustes.recordset[0].actualizado_en,
    idsGuardados: ids };
};
const publica = config => ({ version: config.version, personal: config.personal, aprobadores: config.aprobadores,
  actualizadoPor: config.actualizadoPor, actualizadoEn: config.actualizadoEn });

const obtener = user => withTransaction(async request => {
  await exigirJefe(request, user);
  return publica(await leer(request, true));
});

const guardar = (body, user) => withTransaction(async request => {
  const actor = await exigirJefe(request, user);
  const actual = await leer(request, true);
  if (body.version !== actual.version) throw httpError(409, 'La configuración cambió. Recárguela antes de guardar.');
  const elegibles = new Set(actual.personal.filter(row => !row.esJefe).map(row => row.id));
  if (body.aprobadores.some(id => !elegibles.has(id))) {
    throw httpError(400, 'Seleccione solo personal activo de Soporte Técnico. El jefe de área ya tiene autorización por su cargo.');
  }
  const nuevos = [...body.aprobadores].sort((a, b) => a - b);
  const anteriores = [...actual.idsGuardados].sort((a, b) => a - b);
  if (JSON.stringify(nuevos) === JSON.stringify(anteriores)) return publica(actual);
  const usuario = String(actor.usuario || user.usuario).slice(0, 50);
  await request().input('ids', sql.NVarChar(sql.MAX), JSON.stringify(nuevos))
    .input('usuario', sql.NVarChar(50), usuario).query(`
      DELETE FROM dbo.ST_APROBADORES;
      INSERT INTO dbo.ST_APROBADORES (usuario_id, autorizado_por)
        SELECT CONVERT(INT, value), @usuario FROM OPENJSON(@ids);`);
  await request().input('usuario', sql.NVarChar(50), usuario)
    .input('version', sql.Int, actual.version + 1)
    .input('anteriores', sql.NVarChar(sql.MAX), JSON.stringify(anteriores))
    .input('nuevos', sql.NVarChar(sql.MAX), JSON.stringify(nuevos))
    .input('nombre', sql.NVarChar(120), String(actor.nombre || usuario).slice(0, 120)).query(`
      UPDATE dbo.ST_APROBADORES_AJUSTES SET version = @version, actualizado_por = @usuario,
        actualizado_en = SYSUTCDATETIME() WHERE id = 1;
      INSERT INTO dbo.ST_APROBADORES_HISTORIAL (version, anteriores, nuevos, usuario, nombre)
        VALUES (@version, @anteriores, @nuevos, @usuario, @nombre);`);
  return publica(await leer(request));
});

module.exports = { obtener, guardar };
