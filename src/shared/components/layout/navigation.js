import { CalendarRange, ClipboardCheck, MapPinned, ShieldCheck } from 'lucide-react';

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
};

export const canManageIvmet = (user) => String(user?.acceso_cron) === '3';

export function getNavigation(user) {
  return Object.values(APP_VIEWS).filter(
    (view) => view.inNav && (!view.requiresIvmet || canManageIvmet(user))
  );
}
