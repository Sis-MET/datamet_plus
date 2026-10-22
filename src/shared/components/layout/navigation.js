import { CalendarRange, ClipboardCheck, Gauge, History, MapPinned, ServerCrash, ShieldCheck, Wrench } from 'lucide-react';

// Módulos de la aplicación. `inNav` refleja los accesos visibles en la barra
// lateral: Salidas del personal solo se abre desde una vista guardada.
export const APP_VIEWS = {
  rim: {
    id: 'rim',
    label: 'RIM',
    title: 'Recepción de instrumentos (RIM)',
    description: 'Registros, numeración y formulario de recepción de instrumentos',
    icon: ClipboardCheck,
    inNav: true,
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
  },
  soporte: {
    id: 'soporte',
    label: 'Soporte técnico',
    title: 'Soporte técnico',
    description: 'Informes de servicio, próximos servicios y avisos',
    icon: Wrench,
    inNav: true,
    area: { id: 'soporte tecnico', nombre: 'Soporte Técnico' },
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
};

/**
 * Sistemas: el nivel 3, la administración del sistema. Entra a todos los
 * apartados y es el único que ve Control de cambios y Registro de fallas.
 */
export const isSystemAdmin = (user) => String(user?.acceso_cron) === '3';

export const canManageIvmet = isSystemAdmin;

const normalizeArea = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

/**
 * Los apartados de un área (`area`) los ve todo el personal, pero solo los
 * usan esa área y Sistemas; los demás ven el aviso de acceso restringido. El
 * backend vuelve a comprobarlo en cada petición.
 */
export const canUseView = (view, user) => {
  const area = APP_VIEWS[view]?.area;
  if (!area) return true;
  return isSystemAdmin(user) || (area.id !== null && normalizeArea(user?.area) === area.id);
};

/**
 * La vista solo se abre si existe y el usuario puede verla; si no, el
 * apartado RIM. Los apartados de un área se abren siempre: si no es la del
 * usuario, con el aviso.
 */
export const allowedView = (view, user) => {
  const config = APP_VIEWS[view];
  if (!config) return 'rim';
  if (config.requiresAdmin && !isSystemAdmin(user)) return 'rim';
  return view;
};

// Quien usa el plan de calibración ve su contador de alertas.
export const managesCalibration = (user) => canUseView('calibration', user);

export function getNavigation(user) {
  return Object.values(APP_VIEWS)
    .filter(view => view.inNav && (!view.requiresAdmin || isSystemAdmin(user)))
    .map(view => ({ ...view, locked: !canUseView(view.id, user) }));
}
