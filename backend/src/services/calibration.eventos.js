/**
 * Seguimiento de cada fecha del plan (CAL_EVENTOS): registro, restablecimiento,
 * revisión por un segundo usuario e historial de versiones (7.5).
 */
const { getPool, sql } = require('../config/db');
const { addMonths, buildOccurrences, todayLocal } = require('./calibration.schedule');
const { actorName, clean, httpError, withTransaction } = require('./calibration.db');
const {
  conflictingAuthor,
  describeEventChanges,
  eventView,
  logEvento,
  parseSnapshot,
} = require('./calibration.history');
const { loadPlanSources } = require('./calibration.plan');

const parseSerie = (serie) => {
  const [prefix, rawId] = serie.split('-');
  const tipo = { CAL: 'CALIBRACION', VER: 'VERIFICACION', ACT: 'ACTIVIDAD' }[prefix];
  return { tipo, refId: Number(rawId) };
};

/** Comprueba que la fecha pertenece al plan y se puede modificar. */
const findEditableOccurrence = async ({ serie, fechaProgramada }) => {
  const sources = await loadPlanSources();
  const occurrence = buildOccurrences({
    ...sources,
    desde: addMonths(fechaProgramada, -24),
    hasta: addMonths(fechaProgramada, 24),
    hoy: todayLocal(),
  }).find(item => item.serie === serie && item.fechaProgramada === fechaProgramada);
  if (!occurrence) throw httpError(404, 'Esa fecha ya no forma parte del plan. Recarga el cronograma.');
  if (!occurrence.editable) throw httpError(400, 'La emisión del certificado no se puede modificar desde el cronograma.');
  return occurrence;
};

const EVENTO_COLUMNS = `
  id, serie, tipo, equipo_id, programa_id,
  CONVERT(varchar(10), fecha_programada, 23)   AS fecha_programada,
  CONVERT(varchar(10), fecha_reprogramada, 23) AS fecha_reprogramada,
  estado,
  CONVERT(varchar(10), fecha_realizada, 23)    AS fecha_realizada,
  resultado, observaciones, registro_ref, actualizado_por, revisado_por`;

const loadEvento = async (createRequest, { serie, fechaProgramada }) => {
  const result = await createRequest()
    .input('serie', sql.VarChar(30), serie)
    .input('fp', sql.Date, fechaProgramada)
    .query(`
      SELECT ${EVENTO_COLUMNS}
      FROM dbo.CAL_EVENTOS WITH (UPDLOCK, HOLDLOCK)
      WHERE serie = @serie AND fecha_programada = @fp
    `);
  const row = result.recordset[0];
  return row ? {
    id: row.id,
    tipo: row.tipo,
    estado: row.estado,
    fechaReprogramada: row.fecha_reprogramada,
    fechaRealizada: row.fecha_realizada,
    resultado: row.resultado,
    observaciones: clean(row.observaciones),
    registroRef: clean(row.registro_ref),
    actualizadoPor: clean(row.actualizado_por),
    revisadoPor: clean(row.revisado_por),
  } : null;
};

// Si cambia alguno de estos datos, la revisión anterior deja de valer.
const REVIEWED_FIELDS = ['estado', 'fechaRealizada', 'resultado', 'registroRef', 'observaciones'];

/**
 * Registra el seguimiento de una fecha (7.5). Cada cambio guarda la versión
 * anterior y la nueva en CAL_EVENTOS_HISTORIAL; cambiar una fecha que ya
 * figuraba como realizada exige un motivo. Una fecha sin datos vuelve a su
 * programación original y su última versión queda en el historial.
 */
const saveEvento = async (data, actor) => {
  const occurrence = await findEditableOccurrence(data);
  const { tipo } = parseSerie(data.serie);
  const usuario = actorName(actor);
  const realizado = data.estado === 'REALIZADO';
  const resetting = data.estado === 'PROGRAMADO'
    && !data.fechaReprogramada && !data.observaciones && !data.registroRef;
  const after = resetting ? null : eventView({
    estado: data.estado,
    fechaReprogramada: data.fechaReprogramada,
    fechaRealizada: realizado ? data.fechaRealizada : null,
    resultado: realizado ? data.resultado : null,
    registroRef: realizado ? data.registroRef : null,
    observaciones: data.observaciones,
  });
  const key = {
    serie: data.serie,
    tipo,
    equipoId: occurrence.equipoId,
    programaId: occurrence.programaId,
    fechaProgramada: data.fechaProgramada,
  };

  return withTransaction(async (createRequest) => {
    const before = await loadEvento(createRequest, data);
    const detalle = describeEventChanges(before, after);
    if (!detalle) return { serie: data.serie, fechaProgramada: data.fechaProgramada, cambios: 0 };
    if (before?.estado === 'REALIZADO' && !data.motivo) {
      throw httpError(400, 'Esta fecha ya figura como realizada: escribe el motivo del cambio para que quede en el historial.');
    }

    if (resetting) {
      await createRequest()
        .input('id', sql.Int, before.id)
        .query('DELETE FROM dbo.CAL_EVENTOS WHERE id = @id');
      await logEvento(createRequest, {
        ...key,
        accion: 'RESTABLECIMIENTO',
        detalle,
        antes: eventView(before),
        motivo: data.motivo,
        usuario,
      });
      return { serie: data.serie, fechaProgramada: data.fechaProgramada, cambios: 1 };
    }

    const previous = eventView(before);
    const resetReview = REVIEWED_FIELDS.some(field => String(previous[field] ?? '') !== String(after[field] ?? ''));
    await createRequest()
      .input('serie', sql.VarChar(30), data.serie)
      .input('tipo', sql.VarChar(20), tipo)
      .input('equipo', sql.Int, occurrence.equipoId)
      .input('programa', sql.Int, occurrence.programaId)
      .input('fp', sql.Date, data.fechaProgramada)
      .input('frep', sql.Date, after.fechaReprogramada)
      .input('estado', sql.VarChar(20), after.estado)
      .input('freal', sql.Date, after.fechaRealizada)
      .input('resultado', sql.VarChar(20), after.resultado)
      .input('obs', sql.NVarChar(500), after.observaciones)
      .input('ref', sql.NVarChar(150), after.registroRef)
      .input('actor', sql.NVarChar(50), usuario)
      .input('reset', sql.Bit, resetReview)
      .query(`
        UPDATE dbo.CAL_EVENTOS
        SET fecha_reprogramada = @frep, estado = @estado, fecha_realizada = @freal,
          resultado = @resultado, observaciones = @obs, registro_ref = @ref,
          actualizado_por = @actor, actualizado_en = SYSUTCDATETIME(),
          revisado_por = CASE WHEN @reset = 1 THEN NULL ELSE revisado_por END,
          revisado_en = CASE WHEN @reset = 1 THEN NULL ELSE revisado_en END
        WHERE serie = @serie AND fecha_programada = @fp;

        IF @@ROWCOUNT = 0
          INSERT INTO dbo.CAL_EVENTOS
            (serie, tipo, equipo_id, programa_id, fecha_programada, fecha_reprogramada, estado,
             fecha_realizada, resultado, observaciones, registro_ref, actualizado_por)
          VALUES
            (@serie, @tipo, @equipo, @programa, @fp, @frep, @estado, @freal, @resultado, @obs, @ref, @actor);
      `);
    await logEvento(createRequest, {
      ...key,
      accion: before ? 'MODIFICACION' : 'REGISTRO',
      detalle,
      antes: before ? previous : null,
      despues: after,
      motivo: data.motivo,
      usuario,
    });
    return { serie: data.serie, fechaProgramada: data.fechaProgramada, cambios: 1 };
  });
};

/** Devuelve la fecha a su programación original; su última versión queda en el historial. */
const resetEvento = ({ serie, fechaProgramada, motivo }, actor) => saveEvento({
  serie,
  fechaProgramada,
  estado: 'PROGRAMADO',
  fechaReprogramada: null,
  fechaRealizada: null,
  resultado: null,
  observaciones: null,
  registroRef: null,
  motivo,
}, actor);

/** Un segundo usuario confirma los datos de una verificación realizada (7.5.1). */
const revisarEvento = async ({ serie, fechaProgramada }, actor) => withTransaction(async (createRequest) => {
  const before = await loadEvento(createRequest, { serie, fechaProgramada });
  if (!before || before.estado !== 'REALIZADO' || before.tipo !== 'VERIFICACION') {
    throw httpError(409, 'Solo se revisa una verificación registrada como realizada.');
  }
  if (before.revisadoPor) throw httpError(409, `Esta verificación ya la revisó ${before.revisadoPor}.`);
  const usuario = actorName(actor);
  if (conflictingAuthor([usuario], [before.actualizadoPor])) {
    throw httpError(409, 'La revisión la debe hacer otra persona: tú registraste estos datos.');
  }
  await createRequest()
    .input('id', sql.Int, before.id)
    .input('usuario', sql.NVarChar(50), usuario)
    .query('UPDATE dbo.CAL_EVENTOS SET revisado_por = @usuario, revisado_en = SYSUTCDATETIME() WHERE id = @id');
  const occurrenceKey = parseSerie(serie);
  await logEvento(createRequest, {
    serie,
    tipo: before.tipo,
    equipoId: occurrenceKey.refId,
    fechaProgramada,
    accion: 'REVISION',
    detalle: `Datos revisados; registrados por ${before.actualizadoPor || 'otro usuario'}`,
    antes: eventView(before),
    despues: eventView(before),
    usuario,
  });
  return { serie, fechaProgramada, revisadoPor: usuario };
});

/** Todas las versiones de una fecha del plan, de la más reciente a la primera. */
const getEventoHistorial = async ({ serie, fechaProgramada }) => {
  const result = await getPool().request()
    .input('serie', sql.VarChar(30), serie)
    .input('fp', sql.Date, fechaProgramada)
    .query(`
      SELECT TOP 50 id, accion, detalle, antes, despues, motivo, usuario,
        CONVERT(varchar(19), fecha, 126) AS fecha
      FROM dbo.CAL_EVENTOS_HISTORIAL
      WHERE serie = @serie AND fecha_programada = @fp
      ORDER BY fecha DESC, id DESC
    `);
  return result.recordset.map(row => ({
    id: row.id,
    accion: row.accion,
    detalle: clean(row.detalle),
    motivo: clean(row.motivo),
    usuario: clean(row.usuario),
    fecha: row.fecha ? `${row.fecha}Z` : null,
    antes: parseSnapshot(row.antes),
    despues: parseSnapshot(row.despues),
  }));
};

module.exports = { getEventoHistorial, resetEvento, revisarEvento, saveEvento };
