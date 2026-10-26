/** Quién edita, emite y aprueba los informes de Soporte técnico. */
const { getPool, sql } = require('../config/db');
const { permiteArea } = require('./access.areas');
const { httpError } = require('./soporte.validation');
const aprobacion = require('./soporte.aprobacion');

/** Editan, emiten y corrigen el área Soporte Técnico y Sistemas (nivel 3). */
const puedeEditarArea = (area, accesoCron) => permiteArea('soporte', { area, acceso_cron: accesoCron });

const datosUsuario = async (user) => {
  const userId = Number(user?.id);
  if (!Number.isInteger(userId)) return { area: null, nombre: null, cargo: null, activo: false };
  const result = await getPool().request()
    .input('id', sql.Int, userId)
    .query(`
      SELECT TOP (1) area, cargo, LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre,
        CASE WHEN EXISTS (SELECT 1 FROM dbo.ST_APROBADORES a WHERE a.usuario_id = DATA_USERS.id) THEN 1 ELSE 0 END AS aprobador_delegado
      FROM DATA_USERS WHERE id = @id AND estado = 'ACTIVO';`);
  const row = result.recordset[0] || {};
  return { area: row.area || null, nombre: row.nombre || null, cargo: row.cargo || null,
    autorizado: row.aprobador_delegado === 1 || row.aprobador_delegado === true, activo: Boolean(result.recordset[0]) };
};

const permisos = async (user) => {
  const { area, nombre, cargo, activo, autorizado } = await datosUsuario(user);
  return { editar: activo && puedeEditarArea(area, user?.acceso_cron), aprobar: activo && aprobacion.puedeAprobar({ area, cargo, autorizado }),
    configurarAprobadores: activo && aprobacion.esJefeArea({ area, cargo }), nombre };
};

const exigirEditor = async (user) => {
  const actor = await permisos(user);
  if (!actor.editar) throw httpError(403, 'Solo el área de Soporte Técnico puede modificar los informes.');
  return {
    usuario: String(user?.usuario || 'sistema').slice(0, 50),
    nombre: actor.nombre ? actor.nombre.slice(0, 120) : null,
  };
};

module.exports = { exigirEditor, permisos, puedeEditarArea };
