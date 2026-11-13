/**
 * Catálogo de los permisos con nombre de DataMET+ (Sistema › Gestión de
 * permisos, migración 029). Cada permiso se concede a una persona o a un
 * grupo (un área, un cargo o un cargo de un área) en APP_PERMISOS_CONCESIONES;
 * Sistemas (nivel 3) los tiene todos.
 *
 * Para pasar otro acceso al modelo: agregar aquí su clave, sembrar en una
 * migración las concesiones que hoy da el código (para no cambiar el acceso de
 * nadie), comprobarlo con `tienePermiso` en el backend y marcar la sección o
 * el apartado con `permiso` en `src/shared/components/layout/navigation.js`.
 *
 * `inicial` son las concesiones que siembra la migración 029: valen mientras
 * la migración no esté aplicada, así el backend nuevo no cambia el acceso de
 * nadie antes de tiempo.
 */
const JEFES_DE_AREA = { area: null, cargo: 'jefe de area' };

const PERMISOS = Object.freeze([
  {
    clave: 'tiempos.soporte.ver',
    nombre: 'Ver los tiempos de servicio de Soporte técnico',
    descripcion: 'Soporte técnico › Tiempos de servicio: horas, servicios y medias del personal del área, por técnico y por tipo de servicio.',
    modulo: 'Soporte técnico',
    inicial: [JEFES_DE_AREA],
  },
  {
    clave: 'tiempos.calibracion.ver',
    nombre: 'Ver los tiempos de servicio de Calibración',
    descripcion: 'Calibración › Tiempos de servicio: horas, servicios y medias del personal del área, por técnico y por rango de capacidad.',
    modulo: 'Calibración',
    inicial: [JEFES_DE_AREA],
  },
]);

const CLAVES = Object.freeze(PERMISOS.map(permiso => permiso.clave));

const permisoDe = (clave) => PERMISOS.find(permiso => permiso.clave === clave) || null;

/**
 * Quién gestiona los permisos, además de Sistemas (nivel 3). Va fijo en el
 * código y no se concede desde la pantalla: así nadie puede darse a sí mismo
 * la gestión. Cada regla es una persona ({ usuarioId }) o un grupo
 * ({ area, cargo }, normalizados), como las concesiones.
 *
 * PENDIENTE: confirmar con Sistemas quién es el jefe de Sistemas. En
 * DATA_USERS no hay un área «Sistemas»; mientras tanto solo gestiona el nivel 3.
 */
const GESTORES = Object.freeze([]);

module.exports = { CLAVES, GESTORES, PERMISOS, permisoDe };
