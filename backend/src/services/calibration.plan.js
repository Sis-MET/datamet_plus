/** Plan anual: fechas de cada serie, próximas fechas, alertas y vista previa. */
const {
  activeAlerts,
  addDays,
  addMonths,
  buildOccurrences,
  certificateStatus,
  nextPending,
  resolveAlert,
  serieKey,
  todayLocal,
} = require('./calibration.schedule');
const { tieneAcceso } = require('./access.areas');
const { actorName, httpError } = require('./calibration.db');
const {
  getAjustes,
  getCatalogos,
  getCertRevisions,
  getEquipos,
  getEquiposBaja,
  getEventos,
  getProgramas,
} = require('./calibration.lecturas');

// Hacia atrás se mira poco más de un año (vencidas sin resolver). Hacia
// adelante, tres años: cubre ventanas de aviso largas y la próxima fecha de
// certificados de dos años.
const ALERT_HORIZON_DAYS = 400;
const NEXT_HORIZON_DAYS = 1100;

// ─── Permisos ──────────────────────────────────────────────────────────────

/**
 * Usan y editan el plan el área Calibración y Sistemas (nivel 3); las rutas
 * ya lo exigen con `requireArea('calibracion')`.
 */
const getCalibrationPermissions = async (user) => ({ canEdit: await tieneAcceso(user, 'calibracion') });

// ─── Plan ──────────────────────────────────────────────────────────────────

const loadPlanSources = async () => {
  const [equipos, programas, eventos, ajustes] = await Promise.all([
    getEquipos(),
    getProgramas(),
    getEventos(),
    getAjustes(),
  ]);
  return { equipos, programas, eventos, ajustes };
};

const horizonOccurrences = (sources, hoy) => buildOccurrences({
  ...sources,
  desde: addDays(hoy, -ALERT_HORIZON_DAYS),
  hasta: addDays(hoy, NEXT_HORIZON_DAYS),
  hoy,
});

const publicPrograma = (programa) => (programa ? {
  programaId: programa.id,
  activo: programa.activo,
  frecuenciaMeses: programa.frecuenciaMeses,
  fechaInicio: programa.fechaInicio,
  responsableId: programa.responsableId,
  responsableNombre: programa.responsableNombre,
  alertaDias: programa.alertaDias,
  alertaFrecuencia: programa.alertaFrecuencia,
  alertaCorreo: programa.alertaCorreo,
} : null);

const getPlan = async ({ anio, user }) => {
  const hoy = todayLocal();
  const year = Number(anio) || Number(hoy.slice(0, 4));
  const desde = `${year}-01-01`;
  const hasta = `${year}-12-31`;

  const [sources, permisos, bajas, catalogos, revisiones] = await Promise.all([
    loadPlanSources(),
    getCalibrationPermissions(user),
    getEquiposBaja(),
    getCatalogos(),
    getCertRevisions(),
  ]);
  const { equipos, programas, ajustes } = sources;
  const eventos = buildOccurrences({ ...sources, desde, hasta, hoy });
  const horizon = horizonOccurrences(sources, hoy);

  const programaPor = new Map(programas.filter(p => p.equipoId != null).map(p => [`${p.tipo}:${p.equipoId}`, p]));

  const equiposPlan = equipos.map((equipo) => {
    const calibracion = programaPor.get(`CALIBRACION:${equipo.id}`) || null;
    const verificacion = programaPor.get(`VERIFICACION:${equipo.id}`) || null;
    const alerta = resolveAlert(calibracion, ajustes);
    return {
      ...equipo,
      ...certificateStatus(equipo, hoy, alerta.dias),
      certRevision: revisiones.get(equipo.id) || null,
      enPlan: !calibracion || calibracion.activo,
      calibracion: publicPrograma(calibracion),
      verificacion: publicPrograma(verificacion),
      proximaCalibracion: nextPending(horizon, serieKey('CALIBRACION', equipo.id)),
      proximaVerificacion: verificacion?.activo ? nextPending(horizon, serieKey('VERIFICACION', equipo.id)) : null,
    };
  });

  const actividades = programas
    .filter(programa => programa.tipo === 'ACTIVIDAD' && programa.activo)
    .sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), 'es'))
    .map(programa => ({
      id: programa.id,
      titulo: programa.titulo,
      categoria: programa.categoria,
      descripcion: programa.descripcion,
      frecuenciaMeses: programa.frecuenciaMeses ?? 0,
      fechaInicio: programa.fechaInicio,
      responsableId: programa.responsableId,
      responsableNombre: programa.responsableNombre,
      alertaDias: programa.alertaDias,
      alertaFrecuencia: programa.alertaFrecuencia,
      alertaCorreo: programa.alertaCorreo,
      proxima: nextPending(horizon, serieKey('ACTIVIDAD', programa.id)),
    }));

  return {
    anio: year,
    hoy,
    // El usuario sirve para saber quién puede revisar lo que registró otro.
    permisos: { ...permisos, usuario: actorName(user) },
    ajustes: {
      alertaDias: ajustes.alertaDias,
      alertaFrecuencia: ajustes.alertaFrecuencia,
      alertaCorreo: ajustes.alertaCorreo,
    },
    equipos: equiposPlan,
    bajas,
    catalogos,
    actividades,
    eventos,
    alertas: activeAlerts(horizon),
  };
};

const getAlertSummary = async () => {
  const hoy = todayLocal();
  const alertas = activeAlerts(horizonOccurrences(await loadPlanSources(), hoy));
  return {
    total: alertas.length,
    vencidas: alertas.filter(alerta => alerta.situacion === 'VENCIDO').length,
  };
};

/** Próximas fechas de una configuración que aún no se guarda. */
const previewDates = async ({ tipo, equipoId, frecuenciaMeses, fechaInicio }) => {
  const hoy = todayLocal();
  const ajustes = await getAjustes();
  let equipos = [];
  if (tipo === 'VERIFICACION') {
    equipos = (await getEquipos()).filter(equipo => equipo.id === equipoId);
    if (equipos.length === 0) throw httpError(404, 'El equipo no existe o no está activo.');
  }
  const programa = tipo === 'VERIFICACION'
    ? { id: 0, tipo, equipoId, frecuenciaMeses, fechaInicio, activo: true }
    : { id: 0, tipo, titulo: 'Vista previa', frecuenciaMeses, fechaInicio, activo: true };
  const occurrences = buildOccurrences({
    equipos,
    programas: [
      // La calibración no interesa en la vista previa de una verificación.
      ...equipos.map(equipo => ({ id: -1, tipo: 'CALIBRACION', equipoId: equipo.id, activo: false })),
      programa,
    ],
    eventos: [],
    desde: addMonths(hoy, -1),
    hasta: addMonths(hoy, 36),
    hoy,
    ajustes,
  });
  return occurrences
    .filter(occurrence => occurrence.tipo === tipo && occurrence.fecha >= hoy)
    .slice(0, 6)
    .map(occurrence => ({ fecha: occurrence.fecha, proyectado: occurrence.proyectado }));
};

module.exports = {
  ALERT_HORIZON_DAYS,
  getAlertSummary,
  getCalibrationPermissions,
  getPlan,
  horizonOccurrences,
  loadPlanSources,
  previewDates,
};
