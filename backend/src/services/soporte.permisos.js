/** Quién edita, emite, aprueba y consulta los informes de Soporte técnico. */
const { getPool, sql } = require('../config/db');
const { permiteArea, permiteConsulta } = require('./access.areas');
const { httpError } = require('./soporte.validation');
const aprobacion = require('./soporte.aprobacion');
const permisosConNombre = require('./permisos');

/** Permiso con nombre de los tiempos de servicio (Gestión de permisos). */
const PERMISO_TIEMPOS = 'tiempos.soporte.ver';

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

/**
 * Permisos del usuario en Soporte técnico a partir de su fila de DATA_USERS.
 * `consulta`: un área que solo consulta (Comercial) ve los informes emitidos
 * y los próximos servicios, sin modificar. `tiempos`: los tiempos de servicio
 * del personal (KPI), con el permiso `tiempos.soporte.ver` de Gestión de
 * permisos (de inicio, Sistemas y los jefes de área de todas las áreas).
 */
const permisosDe = ({ area, nombre, cargo, activo, autorizado, tiempos = false }, user) => {
  const editar = activo && puedeEditarArea(area, user?.acceso_cron);
  const jefe = activo && aprobacion.esJefeArea({ area, cargo });
  return {
    editar,
    aprobar: activo && aprobacion.puedeAprobar({ area, cargo, autorizado }),
    configurarAprobadores: jefe,
    consulta: activo && !editar && permiteConsulta('soporte', { area }),
    tiempos: activo && tiempos === true,
    nombre,
  };
};

const permisos = async (user) => {
  const [datos, tiempos] = await Promise.all([datosUsuario(user), permisosConNombre.tienePermiso(user, PERMISO_TIEMPOS)]);
  return permisosDe({ ...datos, tiempos }, user);
};

const exigirEditor = async (user) => {
  const actor = await permisos(user);
  if (!actor.editar) throw httpError(403, 'Solo el área de Soporte Técnico puede modificar los informes.');
  return {
    usuario: String(user?.usuario || 'sistema').slice(0, 50),
    nombre: actor.nombre ? actor.nombre.slice(0, 120) : null,
  };
};

/** Quien lee informes: el área (todo) o quien solo consulta (solo los emitidos). */
const exigirLector = async (user) => {
  const actor = await permisos(user);
  if (!actor.editar && !actor.consulta) throw httpError(403, 'Este apartado es del área de Soporte Técnico.');
  return actor;
};

/** Tiempos de servicio: los ve quien tiene el permiso, sea o no del área. */
const exigirTiempos = (user) => permisosConNombre.exigirPermiso(user, PERMISO_TIEMPOS,
  'No tienes permiso para ver los tiempos de servicio de Soporte técnico. Lo concede Sistemas en Gestión de permisos.');

module.exports = { PERMISO_TIEMPOS, exigirEditor, exigirLector, exigirTiempos, permisos, permisosDe, puedeEditarArea };
