/**
 * Series de calibración y verificación de cada equipo (CAL_PROGRAMAS): se
 * cambian solo las columnas recibidas y cada cambio queda en el historial.
 */
const { sql } = require('../config/db');
const { actorName, httpError, withTransaction } = require('./calibration.db');
const { PROGRAMA_LABELS, describePlanChanges, logPlan } = require('./calibration.history');

const findResponsable = async (createRequest, responsableId) => {
  if (responsableId == null) return null;
  const result = await createRequest()
    .input('rid', sql.Int, responsableId)
    .query(`
      SELECT TOP 1 CONCAT(TRIM(nombre1), ' ', TRIM(apellido1)) AS nombre
      FROM DATA_USERS WHERE id = @rid AND estado = 'ACTIVO'
    `);
  if (!result.recordset[0]) throw httpError(400, 'El responsable elegido no está activo.');
  return result.recordset[0].nombre;
};

const assertEquipos = async (createRequest, equipoIds) => {
  const result = await createRequest().query(`
    SELECT id FROM DATA_EQUIPOS_CAL
    WHERE id IN (${equipoIds.map(Number).filter(Number.isInteger).join(',')})
      AND UPPER(LTRIM(RTRIM(ISNULL(estado, 'ACTIVO')))) = 'ACTIVO'
  `);
  if (result.recordset.length !== equipoIds.length) {
    throw httpError(404, 'Alguno de los equipos no existe o no está activo.');
  }
};

const PROGRAMA_COLUMNS = {
  activo: sql.Bit,
  frecuencia_meses: sql.Int,
  fecha_inicio: sql.Date,
  responsable_id: sql.Int,
  responsable_nombre: sql.NVarChar(100),
  alerta_dias: sql.Int,
  alerta_frecuencia: sql.VarChar(10),
  alerta_correo: sql.Bit,
};

const selectPrograma = (lock = false) => `
  SELECT id, tipo, equipo_id, activo, titulo, categoria, descripcion, frecuencia_meses,
    CONVERT(varchar(10), fecha_inicio, 23) AS fecha_inicio, responsable_id, responsable_nombre,
    alerta_dias, alerta_frecuencia, alerta_correo
  FROM dbo.CAL_PROGRAMAS${lock ? ' WITH (UPDLOCK, HOLDLOCK)' : ''}`;

const programaRow = (row) => (row ? {
  ...row,
  activo: Boolean(row.activo),
  alerta_correo: row.alerta_correo == null ? null : Boolean(row.alerta_correo),
} : null);

/** Versión de una serie tal como queda en el historial del plan. */
const programaVersion = (row) => (row
  ? Object.fromEntries(Object.keys(PROGRAMA_LABELS).map(key => [key, row[key] ?? null]))
  : null);

const changedColumns = (before, values) => Object.keys(values)
  .filter(column => String(before[column] ?? '') !== String(values[column] ?? ''));

/**
 * Crea o actualiza la serie de un equipo modificando solo las columnas
 * recibidas (las demás conservan su valor). Cada cambio queda en
 * CAL_PLAN_HISTORIAL con la versión anterior y la nueva.
 */
const upsertEquipoPrograma = async (createRequest, { tipo, equipoId, fields, actor }) => {
  const usuario = actorName(actor);
  const found = await createRequest()
    .input('tipo', sql.VarChar(20), tipo)
    .input('equipo', sql.Int, equipoId)
    .query(`${selectPrograma(true)} WHERE tipo = @tipo AND equipo_id = @equipo`);
  const before = programaRow(found.recordset[0]);

  if (before) {
    const columns = changedColumns(before, fields);
    if (columns.length === 0) return;
    const request = createRequest()
      .input('id', sql.Int, before.id)
      .input('actor', sql.NVarChar(50), usuario);
    for (const column of columns) request.input(column, PROGRAMA_COLUMNS[column], fields[column]);
    const setClause = [...columns.map(column => `${column} = @${column}`), 'actualizado_por = @actor', 'actualizado_en = SYSUTCDATETIME()'].join(', ');
    await request.query(`UPDATE dbo.CAL_PROGRAMAS SET ${setClause} WHERE id = @id`);
    const after = { ...before, ...fields };
    await logPlan(createRequest, {
      programaId: before.id,
      tipo,
      equipoId,
      accion: 'EDICION',
      detalle: describePlanChanges(before, after) || 'Configuración actualizada',
      antes: programaVersion(before),
      despues: programaVersion(after),
      usuario,
    });
    return;
  }

  // Una verificación creada solo para guardar responsable o alertas nace apagada.
  const values = { activo: tipo !== 'VERIFICACION', ...fields };
  const columns = Object.keys(values);
  const request = createRequest()
    .input('tipo', sql.VarChar(20), tipo)
    .input('equipo', sql.Int, equipoId)
    .input('actor', sql.NVarChar(50), usuario);
  for (const column of columns) request.input(column, PROGRAMA_COLUMNS[column], values[column]);
  const inserted = await request.query(`
    INSERT INTO dbo.CAL_PROGRAMAS (tipo, equipo_id, ${columns.join(', ')}, creado_por)
    OUTPUT INSERTED.id
    VALUES (@tipo, @equipo, ${columns.map(column => `@${column}`).join(', ')}, @actor)
  `);
  await logPlan(createRequest, {
    programaId: inserted.recordset[0].id,
    tipo,
    equipoId,
    accion: 'CREACION',
    detalle: describePlanChanges({}, values),
    despues: programaVersion(values),
    usuario,
  });
};

const alertFields = (data) => ({
  alerta_dias: data.alertaDias,
  alerta_frecuencia: data.alertaFrecuencia,
  alerta_correo: data.alertaCorreo,
});

const updateEquipoConfig = async (equipoId, data, actor) => withTransaction(async (createRequest) => {
  await assertEquipos(createRequest, [equipoId]);
  const calResponsable = await findResponsable(createRequest, data.calibracion.responsableId);
  const verResponsable = await findResponsable(createRequest, data.verificacion.responsableId);

  await upsertEquipoPrograma(createRequest, {
    tipo: 'CALIBRACION',
    equipoId,
    actor,
    fields: {
      activo: data.calibracion.activo,
      responsable_id: data.calibracion.responsableId,
      responsable_nombre: calResponsable,
      ...alertFields(data.calibracion),
    },
  });
  await upsertEquipoPrograma(createRequest, {
    tipo: 'VERIFICACION',
    equipoId,
    actor,
    fields: {
      activo: data.verificacion.activo,
      frecuencia_meses: data.verificacion.frecuenciaMeses,
      fecha_inicio: data.verificacion.fechaInicio,
      responsable_id: data.verificacion.responsableId,
      responsable_nombre: verResponsable,
      ...alertFields(data.verificacion),
    },
  });
  return { equipoId };
});

const updateEquiposMasivo = async (data, actor) => withTransaction(async (createRequest) => {
  await assertEquipos(createRequest, data.equipoIds);
  const responsable = data.responsableId !== undefined
    ? { responsable_id: data.responsableId, responsable_nombre: await findResponsable(createRequest, data.responsableId) }
    : {};
  const alerta = data.alerta ? alertFields(data.alerta) : {};

  for (const equipoId of data.equipoIds) {
    const shared = { ...responsable, ...alerta };
    if (Object.keys(shared).length > 0) {
      await upsertEquipoPrograma(createRequest, { tipo: 'CALIBRACION', equipoId, actor, fields: shared });
    }
    const verificacion = data.verificacion ? {
      activo: data.verificacion.activo,
      frecuencia_meses: data.verificacion.frecuenciaMeses,
      fecha_inicio: data.verificacion.fechaInicio,
    } : {};
    if (Object.keys({ ...shared, ...verificacion }).length > 0) {
      await upsertEquipoPrograma(createRequest, {
        tipo: 'VERIFICACION',
        equipoId,
        actor,
        fields: { ...shared, ...verificacion },
      });
    }
  }
  return { actualizados: data.equipoIds.length };
});

module.exports = {
  changedColumns,
  findResponsable,
  programaRow,
  programaVersion,
  selectPrograma,
  updateEquipoConfig,
  updateEquiposMasivo,
};
