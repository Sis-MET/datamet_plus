/**
 * Versiones de ServiceMET (NB/ISO/IEC 17025, 7.11.2): etiquetas, pasos y
 * situación de cada versión y de los teléfonos que la usan.
 */

export const CLASES_VERSION = {
  A: { label: 'Crítico', tone: 'danger', description: 'Captura, cálculos, esquema, subida o seguridad.' },
  B: { label: 'Funcional', tone: 'warning', description: 'Flujos o pantallas, sin cambiar los datos.' },
  C: { label: 'Menor', tone: 'neutral', description: 'Textos, estilos o compilación.' },
};

export const ACCIONES_VERSION = {
  REGISTRO: 'Registrada',
  EDICION: 'Editada',
  VALIDACION: 'Validación registrada',
  APROBACION: 'Aprobada para uso',
  RECHAZO: 'No aprobada',
  PUESTA_EN_USO: 'Puesta en uso',
};

/** Qué le falta a una versión, en palabras y con su tono. */
export function versionSituation(version) {
  if (version.estado === 'RECHAZADA') return { label: 'No aprobada', tone: 'danger' };
  if (version.estado === 'EN_USO') return { label: 'En uso', tone: 'success' };
  if (version.estado === 'APROBADA') return { label: 'Aprobada', tone: 'success' };
  if (version.estado === 'VALIDADA') return { label: 'Por aprobar', tone: 'info' };
  if (version.validacionResultado === 'NO_CONFORME') return { label: 'Validación no conforme', tone: 'danger' };
  return { label: 'Por validar', tone: 'neutral' };
}

/** Los cuatro pasos de una versión: registrada, validada, aprobada y en uso. */
export function versionSteps(version) {
  const rechazada = version.estado === 'RECHAZADA';
  return [
    { id: 'registro', label: 'Registrada', done: true },
    {
      id: 'validacion',
      label: 'Validada',
      done: version.validacionResultado === 'CONFORME',
      failed: version.validacionResultado === 'NO_CONFORME',
    },
    { id: 'aprobacion', label: 'Aprobada', done: ['APROBADA', 'EN_USO'].includes(version.estado), failed: rechazada },
    { id: 'uso', label: 'En uso', done: version.estado === 'EN_USO' },
  ];
}

/** PENDIENTE: le falta la decisión del jefe; APROBADA (o en uso); RECHAZADA. */
export function versionGroup(version) {
  if (version.estado === 'RECHAZADA') return 'RECHAZADA';
  if (version.estado === 'APROBADA' || version.estado === 'EN_USO') return 'APROBADA';
  return 'PENDIENTE';
}

export const VERSION_FILTERS = [
  { value: 'PENDIENTE', label: 'Por aprobar', tone: 'warning' },
  { value: 'APROBADA', label: 'Aprobadas', tone: 'success' },
  { value: 'RECHAZADA', label: 'No aprobadas', tone: 'danger' },
];

const parts = (version) => {
  const [base = '', build = ''] = String(version || '').split('+');
  return [...base.split('.').map(part => Number.parseInt(part, 10) || 0), Number.parseInt(build, 10) || 0];
};

/** Compara «6.4.1+19» con «6.4.0+18» por sus números, build incluido. */
export function compareAppVersions(a, b) {
  const [pa, pb] = [parts(a), parts(b)];
  for (let index = 0; index < Math.max(pa.length, pb.length); index += 1) {
    const diff = (pa[index] || 0) - (pb[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * La versión vigente: la puesta en uso más recientemente (y, a igual fecha,
 * la de número mayor). Null si ninguna está en uso.
 */
export function currentVersion(versiones) {
  return versiones
    .filter(version => version.estado === 'EN_USO')
    .sort((a, b) => (b.enUsoDesde || '').localeCompare(a.enUsoDesde || '') || compareAppVersions(b.version, a.version))[0] || null;
}

export const TELEFONO_SITUACION = {
  APROBADA: { label: 'Aprobada', tone: 'success' },
  PENDIENTE: { label: 'Sin aprobar', tone: 'warning' },
  RECHAZADA: { label: 'No aprobada', tone: 'danger' },
  SIN_REGISTRAR: { label: 'Sin registrar', tone: 'danger' },
};

/** Una línea por elemento, sin líneas vacías ni espacios en los extremos. */
export const splitLines = (text) => String(text || '')
  .split(/\r?\n/)
  .map(line => line.replace(/^\s*[-•*]\s+/, '').trim())
  .filter(Boolean);
