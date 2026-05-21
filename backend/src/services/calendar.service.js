const { getPool, sql } = require('../config/db');

/**
 * Retorna todas las tareas del cronograma en un rango de fechas.
 * Cada fila de DATA_CRONOGRAMA es una actividad independiente.
 */
const getSchedule = async (start, end) => {
  const pool = getPool();
  
  const result = await pool.request()
    .input('start', sql.Date, start)
    .input('end', sql.Date, end)
    .query(`
      SELECT 
        id,
        id_usuario,
        usuario,
        CONVERT(varchar, fecha, 23) as fecha,
        codigo_reg,
        cotizacion,
        descripcion,
        cliente,
        cod_cliente,
        color,
        estado,
        CONVERT(varchar(8), hora_inicio, 8) as hora_inicio,
        CONVERT(varchar(8), hora_fin,    8) as hora_fin,
        hora_total,
        creado_por,
        creado_en,
        CONVERT(varchar, fecha_creacion, 23) as fecha_creacion,
        CONVERT(varchar, hora_creacion, 8) as hora_creacion,
        actualizado_por,
        CONVERT(varchar, fecha_modificacion, 23) as fecha_modificacion,
        CONVERT(varchar, hora_modificacion, 8) as hora_modificacion
      FROM DATA_CRONOGRAMA
      WHERE fecha >= @start AND fecha <= @end
        AND ISNULL(estado, '') <> 'Anulado'
    `);

  return result.recordset;
};

/**
 * Retorna todas las columnas válidas para los recursos (Técnicos + Vehículos)
 */
const getTecnicos = async () => {
  const pool = getPool();

  const result = await pool.request()
    .query(`
      SELECT 
        id as user_id,
        REPLACE(TRIM(ISNULL(nombre1, 'SIN_NOMBRE')), ' ', '_') + '_' + REPLACE(TRIM(ISNULL(apellido1, 'SIN_APELLIDO')), ' ', '_') AS id,
        CONCAT(TRIM(nombre1), ' ', TRIM(apellido1)) AS nombre,
        cargo,
        area,
        CONVERT(varchar(8), hora_ingreso, 8) as hora_ingreso,
        CONVERT(varchar(8), hora_salida, 8) as hora_salida
      FROM DATA_USERS
      WHERE estado = 'ACTIVO'
      
      UNION ALL
      
      SELECT 
        id as user_id,
        REPLACE(TRIM(ISNULL(identificacion, 'SIN_IDENTIFICACION')), ' ', '_') AS id,
        TRIM(ISNULL(identificacion, 'SIN_IDENTIFICACION')) AS nombre,
        categoria AS cargo,
        'VEHÍCULOS' AS area,
        NULL as hora_ingreso,
        NULL as hora_salida
      FROM DATA_ACTIVOS
      WHERE categoria = 'VEHICULO' 
        AND estado = 'ACTIVO' 
        AND acceso_cron = 1
      
      ORDER BY area, nombre
    `);

  const tecnicos = result.recordset;
  return tecnicos;
};

/**
 * Inserta, actualiza o elimina un registro en DATA_CRONOGRAMA.
 * Cada fila = 1 actividad independiente.
 * 
 * - Si rowId es null  → INSERT nueva fila
 * - Si rowId existe y cotizacion vacía → DELETE esa fila
 * - Si rowId existe y hay cotizacion   → UPDATE esa fila
 */

const getNextRSPCode = async (pool) => {
  const currentYear = new Date().getFullYear().toString().slice(-2); // ej. '26' para 2026
  const prefix = `RSP${currentYear}-`;
  
  const result = await pool.request()
    .input('prefixLiteral', sql.VarChar, prefix)
    .input('prefixLike', sql.VarChar, `${prefix}%`)
    .query(`
      SELECT ISNULL(MAX(TRY_CAST(REPLACE(codigo_reg, @prefixLiteral, '') AS INT)), 0) as maxId
      FROM DATA_CRONOGRAMA
      WHERE codigo_reg LIKE @prefixLike
    `);
    
  const nextId = result.recordset[0].maxId + 1;
  return `${prefix}${nextId}`;
};

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

const upsertScheduleCell = async (data) => {
  const pool = getPool();
  const { date, resource, payload } = data;
  
  const cotizacion   = payload ? (payload.cotizacion || payload.morning || '') : '';
  const descripcion  = payload ? (payload.descripcion || '') : '';
  const cliente      = payload ? (payload.cliente || '') : '';
  const codCliente   = payload ? (payload.cod_cliente || '') : '';
  const color        = payload ? (payload.color   || payload.colorAM || '#10B981') : '#10B981';
  const estado       = payload ? (payload.estado  || payload.estadoAM || 'Pendiente') : 'Pendiente';
  const autor        = payload ? (payload.autor   || 'Sistema') : 'Sistema';
  const lastModified = payload ? (payload.lastModified || null) : null;
  const codigoRegistro = payload ? (payload.codigoRegistro || null) : null;
  const rowId        = payload ? (payload.rowId   || null) : null;
  const horaInicio   = payload ? (payload.horaInicio || '') : '';
  const horaFin      = payload ? (payload.horaFin    || '') : '';
  const horaTotal    = calculateHourTotal(horaInicio, horaFin);
  const creadoEn     = payload ? (payload.creado_en  || null) : null;

  let id_usuario     = null;
  let usuario_nombre = null;

  // Resolver id_usuario y nombre desde DATA_USERS
  const userMatch = await pool.request()
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
    // Buscar en DATA_ACTIVOS (Vehículos)
    const vehMatch = await pool.request()
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
      // Fallback a un valor por defecto si no es ni usuario ni vehículo,
      // para evitar que la db lance el error por la restricción NOT NULL.
      id_usuario     = 999999;
      usuario_nombre = resource;
    }
  }

  // Prevenir acciones vacías sin ID
  if (!payload || Object.keys(payload).length === 0) {
    return { status: 'ignored' };
  }

  const upsertReq = pool.request()
    .input('id_us',   sql.Int,      id_usuario)
    .input('usr',     sql.VarChar,  usuario_nombre)
    .input('f',       sql.Date,     date)
    .input('cot',     sql.NVarChar, cotizacion)
    .input('desc',    sql.NVarChar, descripcion || null)
    .input('cliente', sql.NVarChar, cliente || null)
    .input('cod_cliente', sql.VarChar, codCliente || null)
    .input('col',     sql.VarChar,  color)
    .input('est',     sql.NVarChar, estado)
    .input('autor',   sql.VarChar,  autor)
    .input('hinicio', sql.VarChar,  horaInicio || null)
    .input('hfin',    sql.VarChar,  horaFin    || null)
    .input('htotal',  sql.Decimal(5, 2), horaTotal)
    .input('creado_en', sql.VarChar, creadoEn   || null);

  if (!rowId) {
    // ── INSERT nuevo ──
    // Prevenir inserción de filas vacías
    if (!cotizacion.trim()) {
      return { status: 'ignored_empty_insert' };
    }

    // ── Validar solapamiento de horario antes de insertar ──
    if (horaInicio && horaFin) {
      const overlapCheck = await pool.request()
        .input('ov_id_us',  sql.Int,     id_usuario)
        .input('ov_usr',    sql.VarChar, usuario_nombre)
        .input('ov_fecha',  sql.Date,    date)
        .input('ov_inicio', sql.VarChar, horaInicio)
        .input('ov_fin',    sql.VarChar, horaFin)
        .query(`
          SELECT COUNT(*) AS cnt
          FROM DATA_CRONOGRAMA
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

    // Usar el código provisto (copia/unificación) o generar uno nuevo
    const finalCodigoReg = codigoRegistro || await getNextRSPCode(pool);

    await upsertReq
      .input('cod_reg', sql.VarChar, finalCodigoReg)
      .query(`
      INSERT INTO DATA_CRONOGRAMA
        (codigo_reg, id_usuario, usuario, fecha, cotizacion, descripcion, cliente, cod_cliente, color, estado, hora_inicio, hora_fin, hora_total,
         creado_por, fecha_creacion, hora_creacion, creado_en)
      VALUES
        (@cod_reg, @id_us, @usr, @f, @cot, @desc, @cliente, @cod_cliente, @col, @est,
         CASE WHEN @hinicio IS NULL OR @hinicio = '' THEN NULL ELSE CAST(@hinicio AS time(7)) END,
         CASE WHEN @hfin    IS NULL OR @hfin    = '' THEN NULL ELSE CAST(@hfin    AS time(7)) END,
         @htotal,
         @autor,
         CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS DATE),
         CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS TIME),
         @creado_en)
    `);

    return { status: 'inserted', resource, codigo_reg: finalCodigoReg };
  }

  // ── Operaciones con rowId ──
  upsertReq.input('row_id', sql.Int, rowId);

  const existingRes = await upsertReq.query(`
    SELECT id,
      CONVERT(varchar, fecha_modificacion, 23) as fmod,
      CONVERT(varchar, hora_modificacion, 8)   as hmod,
      CONVERT(varchar, fecha_creacion, 23)     as fcrea,
      CONVERT(varchar, hora_creacion, 8)       as hcrea
    FROM DATA_CRONOGRAMA
    WHERE id = @row_id
  `);

  if (existingRes.recordset.length === 0) {
    return { status: 'ignored_not_found', resource };
  }

  // Si cotizacion vacía → Cambiar estado a 'Anulado' en vez de eliminar
  if (!cotizacion.trim()) {
    await upsertReq.query(`
      UPDATE DATA_CRONOGRAMA 
      SET estado = 'Anulado',
          actualizado_por = @autor,
          fecha_modificacion = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS DATE),
          hora_modificacion = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS TIME)
      WHERE id = @row_id
    `);
    return { status: 'deleted', resource };
  }

  // ── CONTROL DE CONCURRENCIA OPTIMISTA ──
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

  // ── Validar solapamiento antes de actualizar (excluye la fila actual) ──
  if (horaInicio && horaFin) {
    const overlapCheck = await pool.request()
      .input('ov_id_us',  sql.Int,     id_usuario)
      .input('ov_usr',    sql.VarChar, usuario_nombre)
      .input('ov_fecha',  sql.Date,    date)
      .input('ov_inicio', sql.VarChar, horaInicio)
      .input('ov_fin',    sql.VarChar, horaFin)
      .input('ov_row_id', sql.Int,     rowId)
      .query(`
        SELECT COUNT(*) AS cnt
        FROM DATA_CRONOGRAMA
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

  // ── UPDATE ──
  const result = await upsertReq.query(`
    UPDATE DATA_CRONOGRAMA
    SET cotizacion         = @cot,
        descripcion        = @desc,
        cliente            = @cliente,
        cod_cliente        = @cod_cliente,
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
    OUTPUT INSERTED.codigo_reg
    WHERE id = @row_id
  `);

  if (result.rowsAffected[0] === 0) {
    const concurrencyErr = new Error('La celda fue modificada por otro proceso. Recarga la página para sincronizar.');
    concurrencyErr.statusCode = 409;
    throw concurrencyErr;
  }

  const updatedCodigoReg = result.recordset && result.recordset.length > 0 ? result.recordset[0].codigo_reg : null;
  return { status: 'upserted', resource, codigo_reg: updatedCodigoReg };
};

module.exports = {
  getSchedule,
  getTecnicos,
  upsertScheduleCell
};
