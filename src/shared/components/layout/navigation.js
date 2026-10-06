import { CalendarRange, ClipboardCheck, Gauge, History, MapPinned, ServerCrash, ShieldCheck } from 'lucide-react';

// Módulos de la aplicación. `inNav` refleja los accesos visibles en la barra
// lateral: Salidas del personal solo se abre desde una vista guardada.
export const APP_VIEWS = {
  rim: {
    id: 'rim',
    label: 'Formulario RIM',
    description: 'Recepción de instrumentos de pesaje',
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
  },
  ivmet: {
    id: 'ivmet',
    label: 'Gestión IvMET',
    description: 'Clientes, licencias y sincronización',
    icon: ShieldCheck,
    inNav: true,
    requiresIvmet: true,
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

export const canManageIvmet = (user) => String(user?.acceso_cron) === '3';

// Control de cambios y registro de fallas: administración del sistema (nivel 3).
export const isSystemAdmin = canManageIvmet;

/** La vista solo se abre si el usuario tiene acceso; si no, el Formulario RIM. */
export const allowedView = (view, user) => {
  const config = APP_VIEWS[view];
  if (!config) return 'rim';
  if (config.requiresIvmet && !canManageIvmet(user)) return 'rim';
  if (config.requiresAdmin && !isSystemAdmin(user)) return 'rim';
  return view;
};

// Quien gestiona el plan de calibración ve su contador de alertas. El backend
// vuelve a comprobarlo en cada cambio.
export const managesCalibration = (user) => canManageIvmet(user) || String(user?.area || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase() === 'calibracion';

export function getNavigation(user) {
  return Object.values(APP_VIEWS).filter(
    (view) => view.inNav
      && (!view.requiresIvmet || canManageIvmet(user))
      && (!view.requiresAdmin || isSystemAdmin(user))
  );
}
