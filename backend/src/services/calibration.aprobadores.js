/**
 * Aprobadores de los registros de calibración (migración 019) y quién es
 * quién en Calibración. Los permisos se leen de DATA_USERS en cada solicitud
 * (no del token): un cambio de cargo o de delegación vale de inmediato. El
 * acceso de Sistemas no concede revisar.
 */
const { getPool, sql } = require('../config/db');
const { crearAprobadores } = require('./aprobadores');
const { actorName, normalizeArea } = require('./calibration.db');
const { permiteArea } = require('./access.areas');

const { esJefe, obtener, guardar } = crearAprobadores({
  prefijo: 'CAL',
  area: 'calibracion',
  mensajes: {
    soloJefe: 'Solo el jefe de Calibración configura los aprobadores.',
    sinMigracion: 'Falta la configuración de aprobadores de Calibración (migración 019).',
    cambio: 'Otra persona cambió los aprobadores. Vuelve a abrirlos antes de guardar.',
    elegibles: 'Elige solo personal activo de Calibración; el jefe ya revisa por su cargo.',
  },
});

/**
 * El usuario en Calibración: { usuario, nombre, jefe, revisor, editor }.
 * revisor: el jefe o un aprobador que él designó (y que sigue en el área).
 */
const personaCalibracion = async (user) => {
  const id = Number(user?.id);
  let fila = null;
  if (Number.isInteger(id) && id > 0) {
    const result = await getPool().request().input('id', sql.Int, id).query(`
      SELECT TOP (1) area, cargo, LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre,
        CASE WHEN EXISTS (SELECT 1 FROM dbo.CAL_APROBADORES a WHERE a.usuario_id = DATA_USERS.id) THEN 1 ELSE 0 END AS delegado
      FROM DATA_USERS WHERE id = @id AND estado = 'ACTIVO';`);
    fila = result.recordset[0] || null;
  }
  const jefe = Boolean(fila) && esJefe(fila);
  const delegado = Boolean(fila) && (fila.delegado === 1 || fila.delegado === true) && normalizeArea(fila.area) === 'calibracion';
  return {
    usuario: actorName(user),
    nombre: fila?.nombre || null,
    jefe,
    revisor: jefe || delegado,
    // Elabora el personal de Calibración y Sistemas (nivel 3), como en tieneAcceso.
    editor: permiteArea('calibracion', { area: fila?.area, acceso_cron: user?.acceso_cron }),
  };
};

module.exports = { guardar, obtener, personaCalibracion };
