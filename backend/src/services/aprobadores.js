/**
 * Aprobadores delegados por el jefe de un área (Soporte Técnico, migración
 * 013; Calibración, migración 019). El jefe conserva la autorización por su
 * cargo; elige a quién más del área autoriza, con versión e historial.
 *
 * Tablas por área: {PREFIJO}_APROBADORES_AJUSTES (versión), {PREFIJO}_APROBADORES
 * (ids autorizados) y {PREFIJO}_APROBADORES_HISTORIAL.
 */
const { sql } = require('../config/db');
const { httpError, normalizeArea, withTransaction } = require('./calibration.db');

/** Jefe de un área: su área (normalizada) y el cargo «Jefe de área». */
const esJefeDe = (areaNormalizada) => ({ area, cargo } = {}) => normalizeArea(area) === areaNormalizada
  && normalizeArea(cargo).replace(/\s+/g, ' ') === 'jefe de area';

/**
 * prefijo: 'ST' o 'CAL'. area: área normalizada ('soporte tecnico'). mensajes:
 * { soloJefe, sinMigracion, cambio, elegibles } (cada módulo con su trato).
 */
const crearAprobadores = ({ prefijo, area, mensajes }) => {
  const T = {
    ajustes: `dbo.${prefijo}_APROBADORES_AJUSTES`,
    aprobadores: `dbo.${prefijo}_APROBADORES`,
    historial: `dbo.${prefijo}_APROBADORES_HISTORIAL`,
  };
  const esJefe = esJefeDe(area);

  const exigirJefe = async (request, user) => {
    const id = Number(user?.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(403, mensajes.soloJefe);
    const result = await request().input('id', sql.Int, id).query(`
      SELECT TOP (1) id, area, cargo, usuario, LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre
      FROM DATA_USERS WITH (HOLDLOCK) WHERE id = @id AND estado = 'ACTIVO';`);
    const actor = result.recordset[0];
    if (!esJefe(actor)) throw httpError(403, mensajes.soloJefe);
    return actor;
  };

  const leer = async (request, bloquear = false) => {
    const ajustes = await request().query(`SELECT version, actualizado_por, actualizado_en
      FROM ${T.ajustes} ${bloquear ? 'WITH (UPDLOCK, HOLDLOCK)' : ''} WHERE id = 1;`);
    if (!ajustes.recordset[0]) throw httpError(503, mensajes.sinMigracion);
    const personal = await request().query(`SELECT id, usuario, area, cargo,
      LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre
      FROM DATA_USERS ${bloquear ? 'WITH (HOLDLOCK)' : ''} WHERE estado = 'ACTIVO';`);
    const permisos = await request().query(`SELECT usuario_id FROM ${T.aprobadores};`);
    const ids = permisos.recordset.map(row => row.usuario_id);
    const personas = personal.recordset.filter(row => normalizeArea(row.area) === area)
      .map(row => ({ id: row.id, usuario: row.usuario, nombre: row.nombre || row.usuario || `Personal ${row.id}`,
        cargo: row.cargo, esJefe: esJefe(row), autorizado: esJefe(row) || ids.includes(row.id) }))
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

  /**
   * Deja exactamente estos ids. Un parámetro por persona (la lista ya viene
   * validada: enteros, máximo 500) en vez de OPENJSON, que no existe con el
   * nivel de compatibilidad de la base (110).
   */
  const reemplazarAprobadores = (request, ids, usuario) => {
    const consulta = request().input('usuario', sql.NVarChar(50), usuario);
    ids.forEach((id, index) => consulta.input(`id${index}`, sql.Int, id));
    const filas = ids.map((_, index) => `(@id${index}, @usuario)`).join(', ');
    return consulta.query(`
      DELETE FROM ${T.aprobadores};
      ${ids.length ? `INSERT INTO ${T.aprobadores} (usuario_id, autorizado_por) VALUES ${filas};` : ''}`);
  };

  const guardar = (body, user) => withTransaction(async request => {
    const actor = await exigirJefe(request, user);
    const actual = await leer(request, true);
    if (body.version !== actual.version) throw httpError(409, mensajes.cambio);
    const elegibles = new Set(actual.personal.filter(row => !row.esJefe).map(row => row.id));
    if (body.aprobadores.some(id => !elegibles.has(id))) throw httpError(400, mensajes.elegibles);
    const nuevos = [...body.aprobadores].sort((a, b) => a - b);
    const anteriores = [...actual.idsGuardados].sort((a, b) => a - b);
    if (JSON.stringify(nuevos) === JSON.stringify(anteriores)) return publica(actual);
    const usuario = String(actor.usuario || user.usuario).slice(0, 50);
    await reemplazarAprobadores(request, nuevos, usuario);
    await request().input('usuario', sql.NVarChar(50), usuario)
      .input('version', sql.Int, actual.version + 1)
      .input('anteriores', sql.NVarChar(sql.MAX), JSON.stringify(anteriores))
      .input('nuevos', sql.NVarChar(sql.MAX), JSON.stringify(nuevos))
      .input('nombre', sql.NVarChar(120), String(actor.nombre || usuario).slice(0, 120)).query(`
        UPDATE ${T.ajustes} SET version = @version, actualizado_por = @usuario,
          actualizado_en = SYSUTCDATETIME() WHERE id = 1;
        INSERT INTO ${T.historial} (version, anteriores, nuevos, usuario, nombre)
          VALUES (@version, @anteriores, @nuevos, @usuario, @nombre);`);
    return publica(await leer(request));
  });

  return { esJefe, obtener, guardar };
};

module.exports = { crearAprobadores, esJefeDe };
