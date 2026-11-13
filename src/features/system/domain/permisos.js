/**
 * Gestión de permisos: lo que la pantalla calcula con los datos del backend
 * (búsqueda, a quién alcanza una concesión, de dónde viene cada permiso). El
 * backend es quien decide; esto solo muestra.
 */

/** Área o cargo como los compara el backend: sin tildes, en minúsculas y con un solo espacio. */
export const normalizar = (valor) => String(valor ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

/** ¿La regla (persona o grupo de área y cargo) alcanza a la persona? Igual que en el backend. */
export const alcanza = (regla, persona) => {
  if (!regla || !persona) return false;
  if (regla.usuarioId != null) return Number(regla.usuarioId) === Number(persona.id);
  if (!regla.area && !regla.cargo) return false;
  return (!regla.area || normalizar(persona.area) === regla.area)
    && (!regla.cargo || normalizar(persona.cargo) === regla.cargo);
};

/** Personal que coincide con la búsqueda (nombre, usuario, área o cargo) y el área elegida. */
export const filtrarPersonal = (personal, { texto = '', area = null, permiso = null } = {}) => {
  const palabras = normalizar(texto).split(' ').filter(Boolean);
  return personal.filter((persona) => {
    if (area && normalizar(persona.area) !== area) return false;
    if (permiso && !persona.permisos.some(item => item.clave === permiso)) return false;
    const pajar = normalizar([persona.nombre, persona.usuario, persona.area, persona.cargo].join(' '));
    return palabras.every(palabra => pajar.includes(palabra));
  });
};

/**
 * De dónde le viene un permiso a la persona: { sistemas, propia, grupos }.
 * `propia` es la concesión a su nombre (se le puede revocar solo a ella);
 * `grupos`, las de los grupos a los que pertenece. null si no lo tiene.
 */
export const origenDe = (persona, clave, concesiones) => {
  const permiso = persona.permisos.find(item => item.clave === clave);
  if (!permiso) return null;
  const suyas = concesiones.filter(concesion => permiso.concesiones.includes(concesion.id));
  return {
    sistemas: permiso.sistemas,
    propia: suyas.find(concesion => concesion.tipo === 'PERSONA') || null,
    grupos: suyas.filter(concesion => concesion.tipo === 'GRUPO'),
  };
};

/**
 * Quiénes pierden el permiso si se revoca la concesión: los que lo tienen solo
 * por ella (no por Sistemas ni por otra concesión).
 */
export const pierdenAlRevocar = (concesion, personal) => personal.filter((persona) => {
  const permiso = persona.permisos.find(item => item.clave === concesion.permiso);
  return Boolean(permiso) && !permiso.sistemas
    && permiso.concesiones.length === 1 && permiso.concesiones[0] === concesion.id;
});

/** Quiénes lo ganarían con una concesión nueva: los alcanzados que todavía no lo tienen. */
export const ganarianAlConceder = (regla, clave, personal) => personal
  .filter(persona => alcanza(regla, persona) && !persona.permisos.some(item => item.clave === clave));

/** La regla elegida en el formulario, en palabras (como el backend la describirá). */
export const describirRegla = (regla, { personal = [], areas = [], cargos = [] } = {}) => {
  if (regla.usuarioId != null) {
    const persona = personal.find(item => Number(item.id) === Number(regla.usuarioId));
    return persona?.nombre || 'Elige a la persona';
  }
  const area = areas.find(item => item.clave === regla.area)?.nombre;
  const cargo = cargos.find(item => item.clave === regla.cargo)?.nombre;
  if (area && cargo) return `${cargo} de ${area}`;
  if (area) return `Todo el personal de ${area}`;
  if (regla.cargo === 'jefe de area') return 'Jefes de área de todas las áreas';
  if (cargo) return `Cargo «${cargo}» en todas las áreas`;
  return 'Elige un área, un cargo o los dos';
};

/** Nivel de DATA_USERS (acceso_cron) en palabras. */
export const nivelDe = (nivel) => ({ 3: 'Sistemas', 2: 'Nivel 2', 1: 'Nivel 1' }[String(nivel)] || (nivel ? `Nivel ${nivel}` : 'Sin nivel'));

/** Iniciales para el avatar: «Jhonatan Barrau» → «JB». */
export const iniciales = (nombre) => String(nombre || '?')
  .split(/\s+/).filter(Boolean).slice(0, 2).map(parte => parte[0]).join('').toUpperCase();

const FECHA = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/La_Paz',
});

/** Fecha y hora de Bolivia de un instante ISO. */
export const fechaHora = (iso) => (iso ? FECHA.format(new Date(iso)) : '');
