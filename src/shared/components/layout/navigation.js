import { CalendarRange, ClipboardCheck, Gauge, History, KeyRound, MapPinned, Receipt, ServerCrash, ShieldCheck, Wrench } from 'lucide-react';

const normalizeArea = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

/** Jefe de un área por su área y su cargo («Jefe de Area», sin importar tildes ni espacios). */
const esJefeDe = (areaId) => (user) => normalizeArea(user?.area) === areaId
  && normalizeArea(user?.cargo).replace(/\s+/g, ' ') === 'jefe de area';

/**
 * Jefe de Soporte Técnico: el único que ve la configuración de aprobadores.
 * Es solo para el menú; la página y el backend lo vuelven a comprobar.
 */
const esJefeSoporte = esJefeDe('soporte tecnico');

/**
 * Permisos con nombre (Sistema › Gestión de permisos). Sistemas (nivel 3) los
 * tiene todos; los demás, los que trae `user.permisos` de
 * /api/sistema/permisos/mios (null mientras no llegan). Solo para el menú: el
 * backend lo vuelve a comprobar en cada petición.
 */
export const tienePermiso = (user, clave) => isSystemAdmin(user)
  || (Array.isArray(user?.permisos) && user.permisos.includes(clave));

/**
 * Control de cambios: Sistemas registra, valida e implementa; el jefe de área
 * de Calibración entra para aprobar o rechazar. Solo para el menú; el backend
 * lo vuelve a comprobar en cada paso.
 */
export const veControlCambios = (user) => isSystemAdmin(user) || esJefeDe('calibracion')(user);

// Módulos de la aplicación. `inNav` refleja los accesos visibles en la barra
// lateral: Salidas del personal solo se abre desde una vista guardada.
// `sections` son las pestañas del apartado (/<apartado>/<sección>): en la
// barra lateral se despliegan como sub-lista. `badgeSection` es la sección que
// lleva el contador del apartado cuando la sub-lista está abierta. Una sección
// con `permiso` la ve solo quien lo tiene, sea o no del área del apartado:
// quien no es del área entra solo a esas secciones.
export const APP_VIEWS = {
  rim: {
    id: 'rim',
    label: 'RIM',
    title: 'Recepción de instrumentos (RIM)',
    description: 'Registros, numeración y formulario de recepción de instrumentos',
    icon: ClipboardCheck,
    inNav: true,
    sections: [
      { id: 'registros', label: 'Registros' },
      { id: 'numeracion', label: 'Numeración' },
      { id: 'nuevo', label: 'Nuevo RIM' },
    ],
  },
  calendar: {
    id: 'calendar',
    label: 'Cronograma',
    title: 'Cronograma Métrica',
    description: 'Planificación de tareas del personal',
    icon: CalendarRange,
    inNav: true,
  },
  calibration: {
    id: 'calibration',
    label: 'Calibración',
    title: 'Cronograma de calibración',
    description: 'Calibraciones, verificaciones internas y actividades del área',
    icon: Gauge,
    inNav: true,
    area: { id: 'calibracion', nombre: 'Calibración' },
    sections: [
      { id: 'cronograma', label: 'Cronograma' },
      // Desplegable: el gestor de equipos y, aparte, el estado de los patrones
      // (pesas y termohigrómetros) para los certificados; los datos se cargan
      // siempre en la ficha de cada equipo.
      {
        id: 'equipos',
        label: 'Equipos',
        children: [
          { id: 'equipos', label: 'Todos los equipos' },
          { id: 'patrones', label: 'Patrones' },
        ],
      },
      { id: 'actividades', label: 'Actividades' },
      // Desplegable: los registros de los servicios de ServiceMET (con sus
      // certificados) y el método con el que se calculan, por versión (fase 6).
      {
        id: 'certificados',
        label: 'Certificados',
        children: [
          { id: 'certificados', label: 'Registros' },
          { id: 'emitidos', label: 'Emitidos' },
          { id: 'metodo', label: 'Método de cálculo' },
          // Los ejemplos publicados recalculados con el motor y su evidencia (7.11.2).
          { id: 'validacion', label: 'Validación' },
        ],
      },
      { id: 'alertas', label: 'Alertas' },
      // Con el permiso la ve también quien no es del área (los jefes de todas las áreas).
      { id: 'tiempos', label: 'Tiempos de servicio', permiso: 'tiempos.calibracion.ver' },
      { id: 'cumplimiento', label: 'Cumplimiento' },
      // Versiones de la app de los técnicos y su aprobación (17025, 7.11.2).
      { id: 'servicemet', label: 'Versiones ServiceMET' },
    ],
    badgeSection: 'alertas',
  },
  soporte: {
    id: 'soporte',
    label: 'Soporte técnico',
    title: 'Soporte técnico',
    description: 'Informes de servicio, próximos servicios y avisos',
    icon: Wrench,
    inNav: true,
    area: { id: 'soporte tecnico', nombre: 'Soporte Técnico' },
    sections: [
      { id: 'informes', label: 'Informes' },
      { id: 'proximos', label: 'Próximos servicios' },
      { id: 'avisos', label: 'Avisos' },
      { id: 'tiempos', label: 'Tiempos de servicio', permiso: 'tiempos.soporte.ver' },
      { id: 'configuracion', label: 'Configuración', visible: esJefeSoporte },
    ],
    // Comercial solo consulta: los informes emitidos y los próximos servicios.
    consulta: {
      areas: ['comercial'],
      secciones: ['informes', 'proximos'],
      etiquetas: { informes: 'Informes emitidos' },
    },
    badgeSection: 'proximos',
  },
  comercial: {
    id: 'comercial',
    label: 'Comercial',
    title: 'Comercial',
    description: 'Facturas, pagos y cuentas por cobrar',
    icon: Receipt,
    inNav: true,
    area: { id: 'comercial', nombre: 'Comercial' },
    sections: [
      { id: 'facturas', label: 'Facturas' },
      { id: 'cobranza', label: 'Cuentas por cobrar' },
      { id: 'pagos', label: 'Pagos' },
      { id: 'bitrix', label: 'Bitrix24' },
    ],
    // Administración y Gerencia consultan, sin registrar ni anular.
    consulta: {
      areas: ['administracion', 'gerencia'],
      secciones: ['facturas', 'cobranza', 'pagos', 'bitrix'],
    },
  },
  ivmet: {
    id: 'ivmet',
    label: 'Gestión IvMET',
    description: 'Clientes, licencias y sincronización',
    icon: ShieldCheck,
    inNav: true,
    // De momento solo Sistemas.
    area: { id: null, nombre: 'Sistemas' },
  },
  departures: {
    id: 'departures',
    label: 'Salidas del personal',
    description: 'Registro de salidas del personal',
    icon: MapPinned,
    inNav: false,
  },
  // Administración del sistema (NB/ISO/IEC 17025, 7.11): van al pie de la
  // barra lateral, sobre el usuario.
  changes: {
    id: 'changes',
    label: 'Control de cambios',
    description: 'Cambios del sistema, su validación y aprobación',
    icon: History,
    inNav: true,
    group: 'system',
    requiresAdmin: true,
    // Además de Sistemas, el jefe de área de Calibración, que aprueba.
    access: veControlCambios,
  },
  failures: {
    id: 'failures',
    label: 'Registro de fallas',
    description: 'Fallas del sistema y sus acciones inmediatas y correctivas',
    icon: ServerCrash,
    inNav: true,
    group: 'system',
    requiresAdmin: true,
  },
  permisos: {
    id: 'permisos',
    label: 'Gestión de permisos',
    description: 'Qué puede ver o hacer cada persona, por persona o por grupo',
    icon: KeyRound,
    inNav: true,
    group: 'system',
    requiresAdmin: true,
    // Además de Sistemas, el jefe de Sistemas: lo decide el backend (`gestionar`).
    access: user => user?.gestionaPermisos === true,
    dependeDePermisos: true,
  },
};

/**
 * Sistemas: el nivel 3, la administración del sistema. Entra a todos los
 * apartados y es el único que ve Registro de fallas; Control de cambios lo
 * comparte con el jefe de área de Calibración y Gestión de permisos, con el
 * jefe de Sistemas.
 */
export const isSystemAdmin = (user) => String(user?.acceso_cron) === '3';

export const canManageIvmet = isSystemAdmin;

/** ¿Abre el apartado? Los de Sistemas, solo el nivel 3 o quien diga su `access`. */
const puedeAbrir = (config, user) => !config.requiresAdmin || isSystemAdmin(user) || Boolean(config.access?.(user));

/**
 * ¿El usuario solo consulta el apartado? Un área de `consulta` (Comercial en
 * Soporte técnico) lo abre sin editar y solo con algunas secciones.
 */
export const soloConsulta = (view, user) => {
  const config = APP_VIEWS[view];
  if (!config?.consulta || isSystemAdmin(user)) return false;
  const area = normalizeArea(user?.area);
  return area !== config.area?.id && config.consulta.areas.includes(area);
};

/**
 * Los apartados de un área (`area`) los ve todo el personal, pero solo los
 * usan esa área y Sistemas (y, para consultar, las áreas de `consulta`); los
 * demás ven el aviso de acceso restringido. El backend vuelve a comprobarlo en
 * cada petición.
 */
export const canUseView = (view, user) => {
  const area = APP_VIEWS[view]?.area;
  if (!area) return true;
  return isSystemAdmin(user) || (area.id !== null && normalizeArea(user?.area) === area.id) || soloConsulta(view, user);
};

/**
 * Secciones de un apartado de área que el usuario ve por un permiso con
 * nombre aunque no sea del área (los tiempos de servicio para los jefes de
 * todas las áreas). Vacío si el apartado no tiene secciones con permiso.
 */
export const seccionesPorPermiso = (view, user) => (APP_VIEWS[view]?.sections || [])
  .filter(section => section.permiso && tienePermiso(user, section.permiso));

/**
 * ¿Entra al apartado de otra área solo por sus permisos? Entonces ve solo las
 * secciones con permiso, sin el aviso de acceso restringido.
 */
export const accesoPorPermiso = (view, user) => !canUseView(view, user) && seccionesPorPermiso(view, user).length > 0;

/**
 * ¿Falta saber sus permisos para decidir? Mientras `user.permisos` no llega,
 * un apartado bloqueado con secciones con permiso, o uno que depende de los
 * permisos (Gestión de permisos), todavía no se puede resolver.
 */
export const esperaPermisos = (view, user) => {
  const config = APP_VIEWS[view];
  if (!config || !user || isSystemAdmin(user) || Array.isArray(user.permisos)) return false;
  if (config.dependeDePermisos) return true;
  return !canUseView(view, user) && (config.sections || []).some(section => section.permiso);
};

/**
 * La vista solo se abre si existe y el usuario puede verla; si no, el
 * apartado RIM. Los apartados de un área se abren siempre: si no es la del
 * usuario, con el aviso.
 */
export const allowedView = (view, user) => {
  const config = APP_VIEWS[view];
  if (!config) return 'rim';
  if (!puedeAbrir(config, user)) return 'rim';
  return view;
};

// Quien usa el plan de calibración ve su contador de alertas.
export const managesCalibration = (user) => canUseView('calibration', user);

/**
 * Accesos de la barra lateral. Un apartado con candado no despliega sus
 * secciones: al pulsarlo se abre directamente el aviso de acceso restringido.
 */
export function getNavigation(user) {
  return Object.values(APP_VIEWS)
    .filter(view => view.inNav && puedeAbrir(view, user))
    .map((view) => {
      // Quien no es del área pero tiene el permiso de alguna sección entra solo a ellas.
      const porPermiso = accesoPorPermiso(view.id, user);
      const locked = !canUseView(view.id, user) && !porPermiso;
      const consulta = soloConsulta(view.id, user);
      const sections = locked
        ? []
        : porPermiso
          ? seccionesPorPermiso(view.id, user)
          : (view.sections || [])
            .filter(section => !consulta || view.consulta.secciones.includes(section.id) || section.permiso)
            .filter(section => !section.permiso || tienePermiso(user, section.permiso))
            .filter(section => !section.visible || section.visible(user))
            .map(section => (consulta && view.consulta.etiquetas?.[section.id]
              ? { ...section, label: view.consulta.etiquetas[section.id] }
              : section));
      return { ...view, locked, consulta, porPermiso, sections };
    });
}

/**
 * Secciones de un apartado en una sola lista: las de un desplegable llevan el
 * nombre del grupo («Certificados › Método de cálculo»).
 */
export const seccionesPlanas = sections => sections.flatMap(section => (section.children
  ? section.children.map(child => ({ ...child, grupo: section.label }))
  : [section]));

/** Sección abierta de un apartado (la de la dirección), si el usuario la ve en el menú. */
export function findSection(viewId, sectionId, user) {
  if (!sectionId) return null;
  const view = getNavigation(user).find(item => item.id === viewId);
  return seccionesPlanas(view?.sections || []).find(section => section.id === sectionId) || null;
}
