import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

// Las fechas del plan viajan como YYYY-MM-DD; se interpretan como fecha local
// para que el huso horario del navegador no las corra un día.
export const parseISODate = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const toISODate = (date) => format(date, 'yyyy-MM-dd');

export const formatDate = (iso, pattern = 'd MMM yyyy') => (
  iso ? format(parseISODate(iso), pattern, { locale: es }) : '—'
);

export const formatLongDate = (iso) => formatDate(iso, "EEEE d 'de' MMMM 'de' yyyy");

export const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '');

export const TIPOS = {
  CALIBRACION: { label: 'Calibración', plural: 'Calibraciones', shape: 'circle' },
  VERIFICACION: { label: 'Verificación interna', plural: 'Verificaciones', shape: 'diamond' },
  ACTIVIDAD: { label: 'Actividad', plural: 'Actividades', shape: 'square' },
};

export const TIPO_ORDER = ['CALIBRACION', 'VERIFICACION', 'ACTIVIDAD'];

// Tono visual de cada situación (ver .cal-tone-* en calibration.css).
export const SITUACION_TONE = {
  VENCIDO: 'danger',
  PROXIMO: 'warning',
  EN_PROCESO: 'info',
  PROGRAMADO: 'neutral',
  REALIZADO: 'success',
  CANCELADO: 'muted',
};

export const SITUACION_ORDER = ['VENCIDO', 'PROXIMO', 'EN_PROCESO', 'PROGRAMADO', 'REALIZADO', 'CANCELADO'];

export function situationLabel(situacion, tipo) {
  switch (situacion) {
    case 'VENCIDO': return tipo === 'CALIBRACION' ? 'Vencida' : 'Atrasada';
    case 'PROXIMO': return 'Próxima';
    case 'EN_PROCESO': return 'En proceso';
    case 'REALIZADO': return 'Realizada';
    case 'CANCELADO': return 'Cancelada';
    default: return 'Programada';
  }
}

/** Distancia legible a una fecha pendiente. */
export function relativeDays(dias, tipo) {
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias > 1) return `En ${dias} días`;
  const atraso = Math.abs(dias);
  if (tipo === 'CALIBRACION') return atraso === 1 ? 'Venció ayer' : `Vencida hace ${atraso} días`;
  return `Atrasada ${atraso} ${atraso === 1 ? 'día' : 'días'}`;
}

/** Texto corto del estado de una fecha del plan, para listas y avisos. */
export function occurrenceWhen(occurrence) {
  if (occurrence.situacion === 'REALIZADO') return `Realizada el ${formatDate(occurrence.fecha, 'd MMM')}`;
  if (occurrence.situacion === 'CANCELADO') return 'Cancelada';
  return relativeDays(occurrence.diasRestantes, occurrence.tipo);
}

export const FRECUENCIAS_ACTIVIDAD = [0, 1, 2, 3, 4, 6, 12, 24];
export const FRECUENCIAS_VERIFICACION = [1, 2, 3, 4, 6, 12];

export function frequencyLabel(meses) {
  const value = Number(meses) || 0;
  switch (value) {
    case 0: return 'Una sola vez';
    case 1: return 'Mensual';
    case 2: return 'Bimestral';
    case 3: return 'Trimestral';
    case 4: return 'Cuatrimestral';
    case 6: return 'Semestral';
    case 12: return 'Anual';
    case 24: return 'Cada 2 años';
    default: return `Cada ${value} meses`;
  }
}

export function everyMonthsLabel(meses) {
  const value = Number(meses) || 0;
  if (value === 1) return 'Cada mes';
  if (value === 12) return 'Cada año';
  return `Cada ${value} meses`;
}

/** Periodo del certificado (días) en meses o años legibles. */
export function periodLabel(dias) {
  const value = Number(dias);
  if (!value) return '—';
  const meses = Math.round(value / 30.44);
  if (meses >= 12 && meses % 12 === 0) {
    const anios = meses / 12;
    return anios === 1 ? '1 año' : `${anios} años`;
  }
  return meses === 1 ? '1 mes' : `${meses} meses`;
}

export const ALERT_FREQUENCIES = [
  { value: 'UNICA', label: 'Una vez' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'DIARIA', label: 'Diaria' },
  { value: 'NINGUNA', label: 'Sin alertas' },
];

// Alertas por correo: el envío sigue funcionando en el backend, pero su
// configuración (destinatarios, servidor, frecuencia y hora de envío) se
// oculta hasta definirla con el área. Poner esto en true la vuelve a mostrar
// tal cual estaba.
export const EMAIL_ALERTS_UI = false;

const ALERT_FREQUENCY_TEXT = { UNICA: 'una vez', SEMANAL: 'cada semana', DIARIA: 'cada día' };

/** Resumen de una alerta efectiva: "30 días antes · cada semana · correo". */
export function alertSummary({ dias, frecuencia, correo }) {
  if (frecuencia === 'NINGUNA') return 'Sin avisos';
  const anticipacion = dias === 0 ? 'El mismo día' : `${dias} ${dias === 1 ? 'día' : 'días'} antes`;
  if (!EMAIL_ALERTS_UI) return anticipacion;
  return [
    anticipacion,
    ALERT_FREQUENCY_TEXT[frecuencia],
    correo ? 'correo' : 'solo en el cronograma',
  ].filter(Boolean).join(' · ');
}

/** Alerta efectiva de una serie: sus valores propios o los generales. */
export function effectiveAlert(config, ajustes) {
  return {
    dias: config?.alertaDias ?? ajustes.alertaDias,
    frecuencia: config?.alertaFrecuencia ?? ajustes.alertaFrecuencia,
    correo: config?.alertaCorreo ?? ajustes.alertaCorreo,
  };
}

export const hasOwnAlert = (config) => (
  config?.alertaDias != null || config?.alertaFrecuencia != null || config?.alertaCorreo != null
);

/** Título principal de una fecha del plan. */
export const occurrenceTitle = (occurrence) => (
  occurrence.tipo === 'ACTIVIDAD' ? occurrence.titulo : occurrence.codigo
);

export const occurrenceSubtitle = (occurrence) => (
  occurrence.tipo === 'ACTIVIDAD'
    ? (occurrence.categoria || 'Actividad del área')
    : [occurrence.instrumento, occurrence.planta].filter(Boolean).join(' · ')
);

export const VIGENCIA = {
  VIGENTE: { label: 'Vigente', tone: 'success' },
  POR_VENCER: { label: 'Por vencer', tone: 'warning' },
  VENCIDO: { label: 'Vencido', tone: 'danger' },
  SIN_DATOS: { label: 'Sin certificado', tone: 'muted' },
};

// Vigencias habituales de los certificados (en días, como cert_periodo).
export const PERIODOS_CERTIFICADO = [183, 365, 730];

/** Vencimiento de un certificado: emisión + vigencia en días. */
export const expiryOf = (fecha, dias) => (
  fecha && Number(dias) > 0 ? toISODate(addDays(parseISODate(fecha), Number(dias))) : null
);

export const daysBetween = (desde, hasta) => differenceInCalendarDays(parseISODate(hasta), parseISODate(desde));

/** Vigencia de un certificado que vence en `vence`, vista desde `hoy`. */
export function vigenciaOf(vence, hoy, alertaDias) {
  if (!vence) return 'SIN_DATOS';
  const dias = daysBetween(hoy, vence);
  if (dias < 0) return 'VENCIDO';
  return dias <= alertaDias ? 'POR_VENCER' : 'VIGENTE';
}

export const ACCIONES_EQUIPO = {
  ALTA: 'Alta del equipo',
  EDICION: 'Datos editados',
  CERTIFICADO: 'Certificado nuevo',
  CORRECCION: 'Certificado corregido',
  ANULACION: 'Certificado anulado',
  BAJA: 'Dado de baja',
  REACTIVACION: 'Reactivado',
  REVISION: 'Certificado revisado',
};

// Cada versión de una fecha del plan (CAL_EVENTOS_HISTORIAL).
export const ACCIONES_FECHA = {
  INICIAL: 'Estado al iniciar el historial',
  REGISTRO: 'Registrada',
  MODIFICACION: 'Modificada',
  RESTABLECIMIENTO: 'Restablecida',
  REVISION: 'Revisada',
};

const PLAN_ACCION = {
  CREACION: 'incluida en el plan',
  EDICION: 'configuración modificada',
  RETIRO: 'retirada del plan',
  INICIAL: 'configuración inicial',
};

/** Título de una línea de la bitácora: cambios del equipo, de su plan o de sus fechas. */
export function activityTitle(item) {
  const tipo = TIPOS[item.tipo]?.label;
  if (item.fuente === 'PLAN') {
    if (item.tipo === 'ACTIVIDAD' && item.accion === 'CREACION') return 'Actividad creada';
    return `${tipo || 'Plan'}: ${PLAN_ACCION[item.accion] || item.accion.toLowerCase()}`;
  }
  if (item.fuente === 'FECHA') {
    const cuando = item.fechaProgramada ? ` del ${formatDate(item.fechaProgramada)}` : '';
    return `${tipo || 'Fecha'}${cuando}: ${(ACCIONES_FECHA[item.accion] || item.accion).toLowerCase()}`;
  }
  return ACCIONES_EQUIPO[item.accion] || item.accion;
}

const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
export const daysInYear = (year) => (isLeapYear(year) ? 366 : 365);
export const monthLengths = (year) => [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Posición (0–1) del centro de un día dentro del año; null si cae fuera. */
export function yearFraction(iso, year) {
  if (!iso) return null;
  const date = parseISODate(iso);
  if (date.getFullYear() !== year) return date.getFullYear() < year ? 0 : 1;
  const start = new Date(year, 0, 1);
  const index = Math.round((date - start) / 86400000);
  return (index + 0.5) / daysInYear(year);
}

const normalize = (text) => String(text || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

/** Coincidencia de búsqueda sin tildes ni mayúsculas. */
export const matchesQuery = (query, ...fields) => {
  const needle = normalize(query).trim();
  if (!needle) return true;
  return fields.some(field => normalize(field).includes(needle));
};
