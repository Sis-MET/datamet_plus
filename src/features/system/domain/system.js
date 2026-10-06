/**
 * Control de cambios (NB/ISO/IEC 17025, 7.11.2) y registro de fallas
 * (7.11.3 e): etiquetas, pasos, filtros y agrupaciones.
 */

export const TIPOS_CAMBIO = {
  MODULO: 'Módulo nuevo',
  MEJORA: 'Mejora',
  CORRECCION: 'Corrección',
  SEGURIDAD: 'Seguridad',
  BASE_DATOS: 'Base de datos',
  CONFIGURACION: 'Configuración',
};

export const ACCIONES_CAMBIO = {
  REGISTRO: 'Registrado',
  EDICION: 'Editado',
  VALIDACION: 'Validación registrada',
  APROBACION: 'Aprobado',
  RECHAZO: 'Rechazado',
  IMPLEMENTACION: 'Implementado',
};

/** Los cuatro pasos de un cambio y en cuál está. */
export function changeSteps(cambio) {
  const rechazado = cambio.estado === 'RECHAZADO';
  return [
    { id: 'registro', label: 'Registrado', done: true },
    {
      id: 'validacion',
      label: 'Validado',
      done: cambio.validacionResultado === 'CONFORME',
      failed: cambio.validacionResultado === 'NO_CONFORME',
    },
    { id: 'aprobacion', label: 'Aprobado', done: Boolean(cambio.aprobadoPor) && !rechazado, failed: rechazado },
    { id: 'implementacion', label: 'Implementado', done: cambio.estado === 'IMPLEMENTADO' },
  ];
}

/** Qué le falta a un cambio, en palabras y con su tono. */
export function changeSituation(cambio) {
  if (cambio.estado === 'RECHAZADO') return { label: 'Rechazado', tone: 'danger' };
  if (cambio.estado === 'IMPLEMENTADO') {
    return cambio.aprobadoPor ? { label: 'Implementado', tone: 'success' } : { label: 'En uso sin aprobar', tone: 'warning' };
  }
  if (cambio.estado === 'APROBADO') return { label: 'Por implementar', tone: 'info' };
  if (cambio.estado === 'VALIDADO') return { label: 'Por aprobar', tone: 'info' };
  if (cambio.validacionResultado === 'NO_CONFORME') return { label: 'Validación no conforme', tone: 'danger' };
  return { label: 'Por validar', tone: 'neutral' };
}

/** PENDIENTE: aún le falta un paso; COMPLETO: implementado y aprobado; RECHAZADO. */
export function changeGroup(cambio) {
  if (cambio.estado === 'RECHAZADO') return 'RECHAZADO';
  if (cambio.estado === 'IMPLEMENTADO' && cambio.aprobadoPor) return 'COMPLETO';
  return 'PENDIENTE';
}

export const CHANGE_FILTERS = [
  { value: 'PENDIENTE', label: 'Pendientes', tone: 'warning' },
  { value: 'COMPLETO', label: 'Completos', tone: 'success' },
  { value: 'RECHAZADO', label: 'Rechazados', tone: 'danger' },
];

const versionParts = (version) => String(version).split('.').map(part => Number.parseInt(part, 10) || 0);

/** Compara «2.7.0» con «2.6.1» por sus números. */
export function compareVersions(a, b) {
  const [pa, pb] = [versionParts(a), versionParts(b)];
  for (let index = 0; index < Math.max(pa.length, pb.length); index += 1) {
    const diff = (pa[index] || 0) - (pb[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Cambios agrupados por versión, de la más nueva a la más antigua; sin versión al final. */
export function groupByVersion(cambios) {
  const groups = new Map();
  for (const cambio of cambios) {
    const key = cambio.version || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cambio);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : compareVersions(b, a)))
    .map(([version, items]) => ({ version: version || null, items }));
}

/** Cuántos cambios de una versión están aprobados. */
export function versionStatus(cambios, version) {
  const propios = cambios.filter(cambio => cambio.version === version && cambio.estado !== 'RECHAZADO');
  const aprobados = propios.filter(cambio => cambio.aprobadoPor).length;
  return { total: propios.length, aprobados, pendientes: propios.length - aprobados };
}

// ─── Fallas ────────────────────────────────────────────────────────────────

export const ORIGENES_FALLA = {
  SERVIDOR: 'Servidor',
  TAREA: 'Tarea programada',
  PROCESO: 'Proceso del servidor',
  MANUAL: 'Registrada a mano',
};

export const ESTADOS_FALLA = {
  ABIERTA: { label: 'Abierta', tone: 'danger' },
  EN_CURSO: { label: 'En curso', tone: 'warning' },
  CERRADA: { label: 'Cerrada', tone: 'success' },
  DESCARTADA: { label: 'Descartada', tone: 'neutral' },
};

export const FAILURE_FILTERS = [
  { value: 'ABIERTAS', label: 'Abiertas', tone: 'danger' },
  { value: 'CERRADA', label: 'Cerradas', tone: 'success' },
  { value: 'DESCARTADA', label: 'Descartadas', tone: 'neutral' },
];

export const failureGroup = (falla) => (falla.estado === 'ABIERTA' || falla.estado === 'EN_CURSO' ? 'ABIERTAS' : falla.estado);

/** «hace 5 min», «hace 3 h», «hace 2 días» o la fecha si pasó más de una semana. */
export function relativeTime(iso, now = new Date()) {
  if (!iso) return '';
  const date = new Date(iso);
  const minutes = Math.round((now - date) / 60000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
  return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Fecha y hora de Bolivia (UTC-4) para un <input type="datetime-local">. */
export const boliviaDateTimeInput = (date = new Date()) => new Date(date.getTime() - 4 * 3600 * 1000).toISOString().slice(0, 16);

/** Hoy en Bolivia, AAAA-MM-DD. */
export const boliviaToday = (date = new Date()) => boliviaDateTimeInput(date).slice(0, 10);
