/** Actividades del área en el plan (series de tipo ACTIVIDAD) y su historial. */
const { getPool, sql } = require('../config/db');
const { serieKey } = require('./calibration.schedule');
const { actorName, clean, httpError, withTransaction } = require('./calibration.db');
const { describePlanChanges, logPlan } = require('./calibration.history');
const {
  changedColumns,
  findResponsable,
  programaRow,
  programaVersion,
  selectPrograma,
} = require('./calibration.programas');

const bindActividad = (request, data, responsableNombre, actor) => request
  .input('titulo', sql.NVarChar(150), data.titulo)
  .input('categoria', sql.NVarChar(60), data.categoria)
  .input('descripcion', sql.NVarChar(500), data.descripcion)
  .input('frecuencia', sql.Int, data.frecuenciaMeses)
  .input('inicio', sql.Date, data.fechaInicio)
  .input('rid', sql.Int, data.responsableId)
  .input('rnombre', sql.NVarChar(100), responsableNombre)
  .input('adias', sql.Int, data.alertaDias)
  .input('afrec', sql.VarChar(10), data.alertaFrecuencia)
  .input('acorreo', sql.Bit, data.alertaCorreo)
  .input('actor', sql.NVarChar(50), actorName(actor));

/** Columnas de una actividad con los datos del formulario. */
const actividadValues = (data, responsableNombre) => ({
  titulo: data.titulo,
  categoria: data.categoria,
  descripcion: data.descripcion,
  frecuencia_meses: data.frecuenciaMeses,
  fecha_inicio: data.fechaInicio,
  responsable_id: data.responsableId,
  responsable_nombre: responsableNombre,
  alerta_dias: data.alertaDias,
  alerta_frecuencia: data.alertaFrecuencia,
  alerta_correo: data.alertaCorreo,
});

const loadActividad = async (createRequest, id) => {
  const result = await createRequest()
    .input('id', sql.Int, id)
    .query(`${selectPrograma(true)} WHERE id = @id AND tipo = 'ACTIVIDAD' AND activo = 1`);
  const row = programaRow(result.recordset[0]);
  if (!row) throw httpError(404, 'La actividad no existe.');
  return row;
};

const createActividad = async (data, actor) => withTransaction(async (createRequest) => {
  const responsable = await findResponsable(createRequest, data.responsableId);
  const result = await bindActividad(createRequest(), data, responsable, actor).query(`
    INSERT INTO dbo.CAL_PROGRAMAS
      (tipo, titulo, categoria, descripcion, frecuencia_meses, fecha_inicio, responsable_id,
       responsable_nombre, alerta_dias, alerta_frecuencia, alerta_correo, activo, creado_por)
    OUTPUT INSERTED.id
    VALUES
      ('ACTIVIDAD', @titulo, @categoria, @descripcion, @frecuencia, @inicio, @rid,
       @rnombre, @adias, @afrec, @acorreo, 1, @actor);
  `);
  const id = result.recordset[0].id;
  await logPlan(createRequest, {
    programaId: id,
    tipo: 'ACTIVIDAD',
    accion: 'CREACION',
    detalle: `Nueva actividad: ${data.titulo}`,
    despues: programaVersion({ activo: true, ...actividadValues(data, responsable) }),
    usuario: actorName(actor),
  });
  return { id };
});

const updateActividad = async (id, data, actor) => withTransaction(async (createRequest) => {
  const before = await loadActividad(createRequest, id);
  const responsable = await findResponsable(createRequest, data.responsableId);
  const values = actividadValues(data, responsable);
  if (changedColumns(before, values).length === 0) return { id };

  await bindActividad(createRequest(), data, responsable, actor)
    .input('id', sql.Int, id)
    .query(`
      UPDATE dbo.CAL_PROGRAMAS
      SET titulo = @titulo, categoria = @categoria, descripcion = @descripcion,
        frecuencia_meses = @frecuencia, fecha_inicio = @inicio, responsable_id = @rid,
        responsable_nombre = @rnombre, alerta_dias = @adias, alerta_frecuencia = @afrec,
        alerta_correo = @acorreo, actualizado_por = @actor, actualizado_en = SYSUTCDATETIME()
      WHERE id = @id
    `);
  const after = { ...before, ...values };
  await logPlan(createRequest, {
    programaId: id,
    tipo: 'ACTIVIDAD',
    accion: 'EDICION',
    detalle: describePlanChanges(before, after) || 'Actividad actualizada',
    antes: programaVersion(before),
    despues: programaVersion(after),
    usuario: actorName(actor),
  });
  return { id };
});

/** Retira la actividad del plan; su historial se conserva. */
const deleteActividad = async (id, actor) => withTransaction(async (createRequest) => {
  const before = await loadActividad(createRequest, id);
  await createRequest()
    .input('id', sql.Int, id)
    .input('actor', sql.NVarChar(50), actorName(actor))
    .query(`
      UPDATE dbo.CAL_PROGRAMAS
      SET activo = 0, actualizado_por = @actor, actualizado_en = SYSUTCDATETIME()
      WHERE id = @id
    `);
  await logPlan(createRequest, {
    programaId: id,
    tipo: 'ACTIVIDAD',
    accion: 'RETIRO',
    detalle: `Retirada del plan: ${before.titulo}`,
    antes: programaVersion(before),
    despues: programaVersion({ ...before, activo: false }),
    usuario: actorName(actor),
  });
  return { id };
});

// Una línea de historial de cualquiera de las tres bitácoras.
const mapActivity = (row) => ({
  id: `${row.fuente}-${row.id}`,
  fuente: row.fuente,
  tipo: row.tipo || null,
  accion: row.accion,
  detalle: clean(row.detalle),
  motivo: clean(row.motivo),
  fechaProgramada: row.fecha_programada || null,
  usuario: clean(row.usuario),
  fecha: row.fecha ? `${row.fecha}Z` : null,
});

/** Historial de una actividad: su configuración y lo registrado en cada fecha. */
const getActividadHistorial = async (id) => {
  const result = await getPool().request()
    .input('id', sql.Int, id)
    .input('serie', sql.VarChar(30), serieKey('ACTIVIDAD', id))
    .query(`
      SELECT TOP 60 * FROM (
        SELECT 'PLAN' AS fuente, id, tipo, accion, detalle, CAST(NULL AS nvarchar(300)) AS motivo,
          CAST(NULL AS varchar(10)) AS fecha_programada, usuario, CONVERT(varchar(19), fecha, 126) AS fecha, fecha AS orden
        FROM dbo.CAL_PLAN_HISTORIAL
        WHERE entidad = 'PROGRAMA' AND programa_id = @id
        UNION ALL
        SELECT 'FECHA', id, tipo, accion, detalle, motivo,
          CONVERT(varchar(10), fecha_programada, 23), usuario, CONVERT(varchar(19), fecha, 126), fecha
        FROM dbo.CAL_EVENTOS_HISTORIAL
        WHERE serie = @serie
      ) h
      ORDER BY orden DESC, id DESC
    `);
  return result.recordset.map(mapActivity);
};

module.exports = { createActividad, deleteActividad, getActividadHistorial, updateActividad };
