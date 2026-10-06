/**
 * Motor del cronograma de calibración. Funciones puras: reciben los equipos,
 * las series configuradas y los cambios guardados, y devuelven las fechas del
 * plan con su situación. Las fechas viajan como texto YYYY-MM-DD y se operan
 * en días UTC para que la zona horaria del servidor no las desplace.
 */

const DAY_MS = 86400000;
const TIME_ZONE = 'America/La_Paz';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STEPS = 600;
// Una verificación tan cerca de la recalibración la reemplaza la propia calibración.
const VERIFICATION_GAP_DAYS = 14;
// Una calibración marcada como realizada en el módulo y el certificado que
// llega después son el mismo hecho si caen dentro de esta ventana.
const CERTIFICATE_MATCH_DAYS = 60;

const TIPOS = ['CALIBRACION', 'VERIFICACION', 'ACTIVIDAD'];
const ESTADOS = ['PROGRAMADO', 'EN_PROCESO', 'REALIZADO', 'CANCELADO'];
const FRECUENCIAS_ALERTA = ['UNICA', 'SEMANAL', 'DIARIA', 'NINGUNA'];

const isDate = (value) => typeof value === 'string' && DATE_PATTERN.test(value);
const toDays = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};
const fromDays = (days) => new Date(days * DAY_MS).toISOString().slice(0, 10);
const addDays = (iso, days) => fromDays(toDays(iso) + days);
const diffDays = (a, b) => toDays(a) - toDays(b);

/** Suma meses conservando el día; si el mes destino es más corto, usa su último día. */
const addMonths = (iso, months) => {
  const [y, m, d] = iso.split('-').map(Number);
  const total = (y * 12) + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - (year * 12);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return fromDays(Date.UTC(year, month, Math.min(d, lastDay)) / DAY_MS);
};

const localParts = (now) => Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value])
);

/** Fecha de hoy en Bolivia (UTC-4), sin depender de la zona del servidor. */
const todayLocal = (now = new Date()) => {
  const parts = localParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** Hora local HH:mm en Bolivia. */
const timeLocal = (now = new Date()) => {
  const parts = localParts(now);
  return `${parts.hour}:${parts.minute}`;
};

const serieKey = (tipo, id) => `${tipo === 'CALIBRACION' ? 'CAL' : tipo === 'VERIFICACION' ? 'VER' : 'ACT'}-${id}`;

/** Vencimiento del certificado: emisión + periodo en días (cert_fechaven no es confiable). */
const certificateDueDate = (equipo) => {
  if (!isDate(equipo?.certFecha) || !(Number(equipo?.periodoDias) > 0)) return null;
  return addDays(equipo.certFecha, Number(equipo.periodoDias));
};

/** Combina la alerta propia de la serie con los valores generales. */
const resolveAlert = (programa, ajustes) => ({
  dias: programa?.alertaDias ?? ajustes.alertaDias,
  frecuencia: programa?.alertaFrecuencia ?? ajustes.alertaFrecuencia,
  correo: programa?.alertaCorreo ?? ajustes.alertaCorreo,
});

/** Situación visible de una fecha del plan. */
const resolveSituation = ({ estado, fecha, proyectado }, hoy, alerta) => {
  if (estado === 'REALIZADO') return 'REALIZADO';
  if (estado === 'CANCELADO') return 'CANCELADO';
  if (proyectado) return 'PROGRAMADO';
  const dias = diffDays(fecha, hoy);
  if (dias < 0) return 'VENCIDO';
  if (estado === 'EN_PROCESO') return 'EN_PROCESO';
  if (alerta.frecuencia !== 'NINGUNA' && dias <= alerta.dias) return 'PROXIMO';
  return 'PROGRAMADO';
};

/**
 * Fechas de una serie mensual: inicio + k·frecuencia (k ≥ 0) hasta `hasta`.
 * Frecuencia 0 o vacía = una sola vez.
 */
const monthlySeries = (inicio, frecuencia, hasta) => {
  if (!isDate(inicio)) return [];
  const step = Number(frecuencia) || 0;
  if (step <= 0) return inicio <= hasta ? [inicio] : [];
  const dates = [];
  for (let k = 0; k < MAX_STEPS; k += 1) {
    const date = addMonths(inicio, k * step);
    if (date > hasta) break;
    dates.push(date);
  }
  return dates;
};

/** Fechas teóricas de calibración: vencimiento del certificado y sus repeticiones. */
const calibrationDates = (equipo, hasta) => {
  const due = certificateDueDate(equipo);
  if (!due) return [];
  const dates = [];
  for (let k = 1; k < MAX_STEPS; k += 1) {
    const date = addDays(equipo.certFecha, k * Number(equipo.periodoDias));
    if (date > hasta) break;
    dates.push({ fecha: date, ciclo: k });
  }
  return dates;
};

/**
 * Fechas de verificación interna. Con fecha de inicio la serie es fija; sin
 * ella se repite cada N meses dentro de cada ciclo de calibración (contando
 * desde el certificado) y se omite cuando coincide con la recalibración.
 */
const verificationDates = (equipo, programa, hasta) => {
  const step = Number(programa?.frecuenciaMeses) || 0;
  if (step <= 0) return [];
  if (isDate(programa.fechaInicio)) {
    return monthlySeries(programa.fechaInicio, step, hasta).map(fecha => ({ fecha, ciclo: 0 }));
  }
  if (!isDate(equipo?.certFecha)) return [];

  const period = Number(equipo.periodoDias) || 0;
  const dates = [];
  for (let ciclo = 0; ciclo < MAX_STEPS; ciclo += 1) {
    const start = period > 0 ? addDays(equipo.certFecha, ciclo * period) : equipo.certFecha;
    if (start > hasta) break;
    const end = period > 0 ? addDays(start, period - VERIFICATION_GAP_DAYS) : hasta;
    for (let k = 1; k < MAX_STEPS; k += 1) {
      const fecha = addMonths(start, k * step);
      if (fecha > hasta || fecha >= end) break;
      dates.push({ fecha, ciclo });
    }
    if (period <= 0) break;
  }
  return dates;
};

const eventKey = (serie, fecha) => `${serie}|${fecha}`;

const baseFields = (equipo, programa) => ({
  equipoId: equipo?.id ?? null,
  programaId: programa?.id ?? null,
  codigo: equipo?.codigo ?? null,
  instrumento: equipo?.instrumento ?? null,
  planta: equipo?.planta ?? null,
  enteCalibrador: equipo?.enteCalibrador ?? null,
  responsableId: programa?.responsableId ?? null,
  responsableNombre: programa?.responsableNombre ?? null,
  categoria: programa?.categoria ?? null,
});

/** Aplica el estado guardado a una fecha generada. */
const withOverride = (occurrence, saved) => {
  if (!saved) return occurrence;
  return {
    ...occurrence,
    estado: saved.estado,
    fechaReprogramada: saved.fechaReprogramada || null,
    fechaRealizada: saved.fechaRealizada || null,
    resultado: saved.resultado || null,
    observaciones: saved.observaciones || null,
    registroRef: saved.registroRef || null,
    actualizadoPor: saved.actualizadoPor || null,
    actualizadoEn: saved.actualizadoEn || null,
    revisadoPor: saved.revisadoPor || null,
    revisadoEn: saved.revisadoEn || null,
    guardado: true,
  };
};

const finalize = (occurrence, hoy, alerta) => {
  const fechaPlan = occurrence.fechaReprogramada || occurrence.fechaProgramada;
  const fecha = occurrence.estado === 'REALIZADO'
    ? (occurrence.fechaRealizada || fechaPlan)
    : fechaPlan;
  const situacion = resolveSituation({ ...occurrence, fecha: fechaPlan }, hoy, alerta);
  return {
    ...occurrence,
    id: eventKey(occurrence.serie, occurrence.fechaProgramada),
    fecha,
    fechaPlan,
    diasRestantes: diffDays(fechaPlan, hoy),
    situacion,
    alerta,
  };
};

const emptyOccurrence = (fields) => ({
  estado: 'PROGRAMADO',
  fechaReprogramada: null,
  fechaRealizada: null,
  resultado: null,
  observaciones: null,
  registroRef: null,
  actualizadoPor: null,
  actualizadoEn: null,
  revisadoPor: null,
  revisadoEn: null,
  guardado: false,
  proyectado: false,
  editable: true,
  origen: 'PLAN',
  certificado: null,
  ...fields,
});

/**
 * Construye las fechas del plan entre `desde` y `hasta` (incluidos).
 *
 * @param {object} input
 * @param {Array}  input.equipos   Equipos normalizados (id, codigo, certFecha, periodoDias...).
 * @param {Array}  input.programas Series configuradas (CAL_PROGRAMAS normalizado).
 * @param {Array}  input.eventos   Cambios guardados (CAL_EVENTOS normalizado).
 * @param {string} input.desde
 * @param {string} input.hasta
 * @param {string} input.hoy
 * @param {object} input.ajustes   { alertaDias, alertaFrecuencia, alertaCorreo }
 */
const buildOccurrences = ({ equipos = [], programas = [], eventos = [], desde, hasta, hoy, ajustes }) => {
  // Se genera con un año de margen: una fecha de diciembre reprogramada a
  // enero debe aparecer en el año siguiente.
  const genHasta = addMonths(hasta, 12);
  const saved = new Map(eventos.map(evento => [eventKey(evento.serie, evento.fechaProgramada), evento]));
  const used = new Set();
  const result = [];

  const take = (serie, fecha) => {
    const key = eventKey(serie, fecha);
    used.add(key);
    return saved.get(key);
  };

  // Datos de cada serie activa, para mostrar como historial las fechas
  // realizadas que dejaron de coincidir con el plan (cambió la frecuencia).
  const seriesContext = new Map();

  const programaPorEquipo = new Map();
  for (const programa of programas) {
    if (programa.equipoId != null) programaPorEquipo.set(`${programa.tipo}:${programa.equipoId}`, programa);
  }

  for (const equipo of equipos) {
    const calPrograma = programaPorEquipo.get(`CALIBRACION:${equipo.id}`) || null;
    const verPrograma = programaPorEquipo.get(`VERIFICACION:${equipo.id}`) || null;
    const calSerie = serieKey('CALIBRACION', equipo.id);
    const calibracionesHechas = new Map();

    if (!calPrograma || calPrograma.activo) {
      const alerta = resolveAlert(calPrograma, ajustes);
      const base = baseFields(equipo, calPrograma);

      // Calibraciones registradas en el módulo que ya no coinciden con el plan
      // (llegó un certificado nuevo): se conservan como historial.
      const huerfanas = eventos.filter(evento => evento.serie === calSerie && evento.estado === 'REALIZADO');
      let certificadoFusionado = false;

      let previaHecha = true;
      for (const { fecha, ciclo } of calibrationDates(equipo, genHasta)) {
        const guardado = take(calSerie, fecha);
        const occurrence = withOverride(emptyOccurrence({
          ...base,
          serie: calSerie,
          tipo: 'CALIBRACION',
          fechaProgramada: fecha,
          ciclo,
          proyectado: ciclo > 1 && !previaHecha,
        }), guardado);
        previaHecha = occurrence.estado === 'REALIZADO';
        if (previaHecha) calibracionesHechas.set(ciclo, occurrence.fechaRealizada || fecha);
        result.push(finalize(occurrence, hoy, alerta));
      }

      for (const evento of huerfanas) {
        const key = eventKey(evento.serie, evento.fechaProgramada);
        if (used.has(key)) continue;
        used.add(key);
        const hecha = evento.fechaRealizada || evento.fechaProgramada;
        const esCertificado = isDate(equipo.certFecha)
          && Math.abs(diffDays(hecha, equipo.certFecha)) <= CERTIFICATE_MATCH_DAYS;
        if (esCertificado) certificadoFusionado = true;
        result.push(finalize(withOverride(emptyOccurrence({
          ...base,
          serie: calSerie,
          tipo: 'CALIBRACION',
          fechaProgramada: evento.fechaProgramada,
          ciclo: 0,
          certificado: esCertificado ? equipo.certificado : null,
        }), evento), hoy, alerta));
      }

      // La emisión del certificado vigente es una calibración ya hecha.
      if (isDate(equipo.certFecha) && !certificadoFusionado) {
        result.push(finalize(emptyOccurrence({
          ...base,
          serie: calSerie,
          tipo: 'CALIBRACION',
          origen: 'CERTIFICADO',
          editable: false,
          estado: 'REALIZADO',
          fechaProgramada: equipo.certFecha,
          fechaRealizada: equipo.certFecha,
          certificado: equipo.certificado,
          ciclo: 0,
        }), hoy, alerta));
      }
    }

    if (verPrograma?.activo) {
      const alerta = resolveAlert(verPrograma, ajustes);
      const serie = serieKey('VERIFICACION', equipo.id);
      const base = baseFields(equipo, verPrograma);
      seriesContext.set(serie, { alerta, fields: { ...base, serie, tipo: 'VERIFICACION' } });
      for (const { fecha, ciclo } of verificationDates(equipo, verPrograma, genHasta)) {
        // Los ciclos futuros dependen de una calibración que aún no ocurre.
        const proyectado = !isDate(verPrograma.fechaInicio) && ciclo > 0 && !calibracionesHechas.has(ciclo);
        result.push(finalize(withOverride(emptyOccurrence({
          ...base,
          serie,
          tipo: 'VERIFICACION',
          fechaProgramada: fecha,
          ciclo,
          proyectado,
        }), take(serie, fecha)), hoy, alerta));
      }
    }
  }

  for (const programa of programas) {
    if (programa.tipo !== 'ACTIVIDAD' || !programa.activo) continue;
    const alerta = resolveAlert(programa, ajustes);
    const serie = serieKey('ACTIVIDAD', programa.id);
    const base = baseFields(null, programa);
    seriesContext.set(serie, {
      alerta,
      fields: { ...base, serie, tipo: 'ACTIVIDAD', titulo: programa.titulo, descripcion: programa.descripcion || null },
    });
    for (const fecha of monthlySeries(programa.fechaInicio, programa.frecuenciaMeses, genHasta)) {
      result.push(finalize(withOverride(emptyOccurrence({
        ...base,
        serie,
        tipo: 'ACTIVIDAD',
        titulo: programa.titulo,
        descripcion: programa.descripcion || null,
        fechaProgramada: fecha,
        ciclo: 0,
      }), take(serie, fecha)), hoy, alerta));
    }
  }

  for (const evento of eventos) {
    const context = seriesContext.get(evento.serie);
    if (!context || evento.estado !== 'REALIZADO' || used.has(eventKey(evento.serie, evento.fechaProgramada))) continue;
    result.push(finalize(withOverride(emptyOccurrence({
      ...context.fields,
      fechaProgramada: evento.fechaProgramada,
      ciclo: 0,
    }), evento), hoy, context.alerta));
  }

  return result
    .filter(occurrence => occurrence.fecha >= desde && occurrence.fecha <= hasta)
    .sort((a, b) => (a.fecha === b.fecha ? a.serie.localeCompare(b.serie) : a.fecha.localeCompare(b.fecha)));
};

/** Fechas que requieren atención hoy: vencidas o dentro de su ventana de alerta. */
const activeAlerts = (occurrences) => occurrences.filter(occurrence => (
  occurrence.alerta.frecuencia !== 'NINGUNA'
  && ['VENCIDO', 'PROXIMO', 'EN_PROCESO'].includes(occurrence.situacion)
  && (occurrence.situacion !== 'EN_PROCESO' || occurrence.diasRestantes <= occurrence.alerta.dias)
));

/** Próxima fecha pendiente de una serie a partir de hoy (o la vencida más antigua). */
const nextPending = (occurrences, serie) => occurrences.find(occurrence => (
  occurrence.serie === serie
  && !occurrence.proyectado
  && ['PROGRAMADO', 'PROXIMO', 'EN_PROCESO', 'VENCIDO'].includes(occurrence.situacion)
)) || null;

/** Estado de vigencia del certificado de un equipo. */
const certificateStatus = (equipo, hoy, alertaDias) => {
  const vence = certificateDueDate(equipo);
  if (!vence) return { vence: null, diasParaVencer: null, vigencia: 'SIN_DATOS' };
  const dias = diffDays(vence, hoy);
  return {
    vence,
    diasParaVencer: dias,
    vigencia: dias < 0 ? 'VENCIDO' : dias <= alertaDias ? 'POR_VENCER' : 'VIGENTE',
  };
};

module.exports = {
  TIPOS,
  ESTADOS,
  FRECUENCIAS_ALERTA,
  isDate,
  addDays,
  addMonths,
  diffDays,
  todayLocal,
  timeLocal,
  serieKey,
  certificateDueDate,
  certificateStatus,
  resolveAlert,
  monthlySeries,
  verificationDates,
  buildOccurrences,
  activeAlerts,
  nextPending,
};
