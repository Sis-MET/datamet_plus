const { getPool, sql } = require('../config/db');
const { validateScheduleBatch, validateScheduleInput } = require('./schedule.validation');

const calculateHourTotal = (horaInicio, horaFin) => {
  if (!horaInicio || !horaFin) return null;

  const [startHour, startMinute] = String(horaInicio).split(':').map(Number);
  const [endHour, endMinute] = String(horaFin).split(':').map(Number);

  if (
    Number.isNaN(startHour) || Number.isNaN(startMinute) ||
    Number.isNaN(endHour) || Number.isNaN(endMinute)
  ) {
    return null;
  }

  const startMinutes = (startHour * 60) + startMinute;
  const endMinutes = (endHour * 60) + endMinute;
  const diffMinutes = endMinutes - startMinutes;

  if (diffMinutes <= 0) return null;

  return Number((diffMinutes / 60).toFixed(2));
};

const executeUpsertScheduleCell = async (data, createRequest) => {
  const { date, resource, payload } = data;

  const tipoTarea    = payload ? (payload.tipo_tarea || payload.tipoTarea || payload.morning || '') : '';
  const cotizacion   = payload ? (payload.cotizacion || '') : '';
  const descripcion  = payload ? (payload.descripcion || '') : '';
  const cliente      = payload ? (payload.cliente || '') : '';
  const codCliente   = payload ? (payload.cod_cliente || '') : '';
  const planta       = payload ? (payload.planta || '') : '';
  const color        = payload ? (payload.color   || payload.colorAM || '#10B981') : '#10B981';
  const estado       = payload ? (payload.estado  || payload.estadoAM || 'Pendiente') : 'Pendiente';
  const autor        = payload ? (payload.autor   || 'Sistema') : 'Sistema';
  const lastModified = payload ? (payload.lastModified || null) : null;
  const rowId        = payload ? (payload.rowId   || null) : null;
  const horaInicio   = payload ? (payload.horaInicio || '') : '';
  const horaFin      = payload ? (payload.horaFin    || '') : '';
  const horaTotal    = calculateHourTotal(horaInicio, horaFin);
  const creadoEn     = payload ? (payload.creado_en  || null) : null;

  let id_usuario     = null;
  let usuario_nombre = null;

  const userMatch = await createRequest()
    .input('res', sql.VarChar, resource)
    .query(`
      SELECT id, CONCAT(TRIM(nombre1), ' ', TRIM(apellido1)) as fullname 
      FROM DATA_USERS 
      WHERE REPLACE(TRIM(ISNULL(nombre1, 'SIN_NOMBRE')), ' ', '_') + '_' + REPLACE(TRIM(ISNULL(apellido1, 'SIN_APELLIDO')), ' ', '_') = @res
    `);

  if (userMatch.recordset.length > 0) {
    id_usuario     = userMatch.recordset[0].id;
    usuario_nombre = userMatch.recordset[0].fullname;
  } else {
    const vehMatch = await createRequest()
      .input('res', sql.VarChar, resource)
      .query(`
        SELECT id, TRIM(ISNULL(identificacion, 'SIN_IDENTIFICACION')) as fullname
        FROM DATA_ACTIVOS
        WHERE REPLACE(TRIM(ISNULL(identificacion, 'SIN_IDENTIFICACION')), ' ', '_') = @res
          AND categoria = 'VEHICULO'
          AND estado = 'ACTIVO'
      `);

    if (vehMatch.recordset.length > 0) {
      id_usuario     = vehMatch.recordset[0].id;
      usuario_nombre = vehMatch.recordset[0].fullname;
    } else {
      id_usuario     = 999999;
      usuario_nombre = resource;
    }
  }

  if (!payload || Object.keys(payload).length === 0) {
    return { status: 'ignored' };
  }

  const upsertReq = createRequest()
    .input('id_us',   sql.Int,      id_usuario)
    .input('usr',     sql.VarChar,  usuario_nombre)
    .input('f',       sql.Date,     date)
    .input('tipo',    sql.NVarChar, tipoTarea.trim())
    .input('cot',     sql.NVarChar, cotizacion.trim() || null)
    .input('desc',    sql.NVarChar, descripcion || null)
    .input('cliente', sql.NVarChar, cliente || null)
    .input('cod_cliente', sql.VarChar, codCliente || null)
    .input('planta',  sql.NVarChar, planta || null)
    .input('col',     sql.VarChar,  color)
    .input('est',     sql.NVarChar, estado)
    .input('autor',   sql.VarChar,  autor)
    .input('hinicio', sql.VarChar,  horaInicio || null)
    .input('hfin',    sql.VarChar,  horaFin    || null)
    .input('htotal',  sql.Decimal(5, 2), horaTotal)
    .input('creado_en', sql.VarChar, creadoEn   || null);

  if (!rowId) {
    if (!tipoTarea.trim()) {
      return { status: 'ignored_empty_insert' };
    }

    if (horaInicio && horaFin) {
      const overlapCheck = await createRequest()
        .input('ov_id_us',  sql.Int,     id_usuario)
        .input('ov_usr',    sql.VarChar, usuario_nombre)
        .input('ov_fecha',  sql.Date,    date)
        .input('ov_inicio', sql.VarChar, horaInicio)
        .input('ov_fin',    sql.VarChar, horaFin)
        .query(`
          SELECT COUNT(*) AS cnt
          FROM DATA_CRONOGRAMA WITH (UPDLOCK, HOLDLOCK)
          WHERE id_usuario  = @ov_id_us
            AND usuario     = @ov_usr
            AND fecha       = @ov_fecha
            AND (estado IS NULL OR estado != 'Anulado')
            AND hora_inicio IS NOT NULL
            AND hora_fin    IS NOT NULL
            AND CAST(@ov_inicio AS time(7)) < hora_fin
            AND CAST(@ov_fin    AS time(7)) > hora_inicio
        `);
      if (overlapCheck.recordset[0].cnt > 0) {
        const err = new Error(
          `El rango horario ${horaInicio}–${horaFin} se superpone con una actividad ya registrada para este recurso en este día.`
        );
        err.statusCode = 409;
        throw err;
      }
    }

    const insertResult = await upsertReq.query(`
      INSERT INTO DATA_CRONOGRAMA
        (id_usuario, usuario, fecha, tipo_tarea, cotizacion, descripcion, cliente, cod_cliente, planta, color, estado, hora_inicio, hora_fin, hora_total,
         creado_por, fecha_creacion, hora_creacion, creado_en)
      VALUES
        (@id_us, @usr, @f, @tipo, @cot, @desc, @cliente, @cod_cliente, @planta, @col, @est,
         CASE WHEN @hinicio IS NULL OR @hinicio = '' THEN NULL ELSE CAST(@hinicio AS time(7)) END,
         CASE WHEN @hfin    IS NULL OR @hfin    = '' THEN NULL ELSE CAST(@hfin    AS time(7)) END,
         @htotal,
         @autor,
         CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS DATE),
         CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS TIME),
         @creado_en);

      SELECT
        CAST(SCOPE_IDENTITY() AS INT) AS id,
        CONCAT(
          CONVERT(varchar, CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS DATE), 23),
          ' ',
          CONVERT(varchar(8), CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS TIME), 8)
        ) AS last_modified;
    `);

    return {
      status: 'inserted',
      resource,
      id: insertResult.recordset[0]?.id || null,
      lastModified: insertResult.recordset[0]?.last_modified || null,
    };
  }

  upsertReq.input('row_id', sql.Int, rowId);

  const existingRes = await upsertReq.query(`
    SELECT id,
      CONVERT(varchar, fecha_modificacion, 23) as fmod,
      CONVERT(varchar, hora_modificacion, 8)   as hmod,
      CONVERT(varchar, fecha_creacion, 23)     as fcrea,
      CONVERT(varchar, hora_creacion, 8)       as hcrea
    FROM DATA_CRONOGRAMA WITH (UPDLOCK, HOLDLOCK)
    WHERE id = @row_id
  `);

  if (existingRes.recordset.length === 0) {
    return { status: 'ignored_not_found', resource };
  }

  if (!tipoTarea.trim()) {
    await upsertReq.query(`
      UPDATE DATA_CRONOGRAMA 
      SET estado = 'Anulado',
          actualizado_por = @autor,
          fecha_modificacion = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS DATE),
          hora_modificacion = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS TIME)
      WHERE id = @row_id
    `);
    return { status: 'deleted', resource, id: rowId };
  }

  const row = existingRes.recordset[0];
  const fmod = row.fmod ? String(row.fmod).trim() : null;
  const hmod = row.hmod ? String(row.hmod).trim() : null;
  let currentTimestamp = (fmod && hmod) ? `${fmod} ${hmod}` : null;

  if (!currentTimestamp) {
    const fcrea = row.fcrea ? String(row.fcrea).trim() : null;
    const hcrea = row.hcrea ? String(row.hcrea).trim() : null;
    currentTimestamp = (fcrea && hcrea) ? `${fcrea} ${hcrea}` : null;
  }

  const clientTimestamp = (lastModified !== null && lastModified !== undefined && lastModified !== '')
    ? String(lastModified).trim()
    : null;

  if (clientTimestamp && currentTimestamp !== clientTimestamp) {
    const concurrencyErr = new Error(
      `Celda modif. por otro proceso. (Servidor: ${currentTimestamp || 'Nulo'} | Tuyo: ${clientTimestamp}). Recarga la página.`
    );
    concurrencyErr.statusCode = 409;
    throw concurrencyErr;
  }

  if (horaInicio && horaFin) {
    const overlapCheck = await createRequest()
      .input('ov_id_us',  sql.Int,     id_usuario)
      .input('ov_usr',    sql.VarChar, usuario_nombre)
      .input('ov_fecha',  sql.Date,    date)
      .input('ov_inicio', sql.VarChar, horaInicio)
      .input('ov_fin',    sql.VarChar, horaFin)
      .input('ov_row_id', sql.Int,     rowId)
      .query(`
        SELECT COUNT(*) AS cnt
        FROM DATA_CRONOGRAMA WITH (UPDLOCK, HOLDLOCK)
        WHERE id_usuario  = @ov_id_us
          AND usuario     = @ov_usr
          AND fecha       = @ov_fecha
          AND id         != @ov_row_id
          AND (estado IS NULL OR estado != 'Anulado')
          AND hora_inicio IS NOT NULL
          AND hora_fin    IS NOT NULL
          AND CAST(@ov_inicio AS time(7)) < hora_fin
          AND CAST(@ov_fin    AS time(7)) > hora_inicio
      `);
    if (overlapCheck.recordset[0].cnt > 0) {
      const err = new Error(
        `El rango horario ${horaInicio}–${horaFin} se superpone con una actividad ya registrada para este recurso en este día.`
      );
      err.statusCode = 409;
      throw err;
    }
  }

  const result = await upsertReq.query(`
    UPDATE DATA_CRONOGRAMA
    SET tipo_tarea         = @tipo,
        cotizacion         = @cot,
        descripcion        = @desc,
        cliente            = @cliente,
        cod_cliente        = @cod_cliente,
        planta             = @planta,
        color              = @col,
        estado             = @est,
        hora_inicio        = CASE WHEN @hinicio IS NULL OR @hinicio = '' THEN NULL ELSE CAST(@hinicio AS time(7)) END,
        hora_fin           = CASE WHEN @hfin    IS NULL OR @hfin    = '' THEN NULL ELSE CAST(@hfin    AS time(7)) END,
        hora_total         = @htotal,
        actualizado_por    = @autor,
        fecha_modificacion = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS DATE),
        hora_modificacion  = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS TIME),
        fecha              = @f,
        id_usuario         = @id_us,
        usuario            = @usr
    WHERE id = @row_id;

    SELECT
      id,
      CONCAT(
        CONVERT(varchar, fecha_modificacion, 23),
        ' ',
        CONVERT(varchar(8), hora_modificacion, 8)
      ) AS last_modified
    FROM DATA_CRONOGRAMA
    WHERE id = @row_id;
  `);

  if (result.rowsAffected[0] === 0) {
    const concurrencyErr = new Error('La celda fue modificada por otro proceso. Recarga la página para sincronizar.');
    concurrencyErr.statusCode = 409;
    throw concurrencyErr;
  }

  return {
    status: 'upserted',
    resource,
    id: result.recordset[0]?.id || rowId,
    lastModified: result.recordset[0]?.last_modified || null,
  };
};

const runTransaction = async (work) => {
  const pool = getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const result = await work(() => new sql.Request(transaction));
    await transaction.commit();
    return result;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  }
};

const upsertScheduleCell = async (data) => {
  const normalized = validateScheduleInput(data);
  return runTransaction(createRequest => executeUpsertScheduleCell(normalized, createRequest));
};

const upsertScheduleAssignments = async (data) => {
  const assignments = validateScheduleBatch(data);
  return runTransaction(async createRequest => {
    const results = [];
    for (const assignment of assignments) {
      results.push(await executeUpsertScheduleCell(assignment, createRequest));
    }
    return results;
  });
};

module.exports = {
  upsertScheduleCell,
  upsertScheduleAssignments,
  calculateHourTotal,
};
