const { getPool, sql } = require('../config/db');

/**
 * Retorna todas las tareas del cronograma en un rango de fechas.
 * Extraídas desde la tabla normalizada DATA_SCHEDULE_V2
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
        vehiculo,
        CONVERT(varchar, fecha, 23) as fecha,
        manana,
        tarde,
        color_am,
        color_pm,
        creado_por,
        CONVERT(varchar, fecha_creacion, 23) as fecha_creacion,
        CONVERT(varchar, hora_creacion, 8) as hora_creacion,
        actualizado_por,
        CONVERT(varchar, fecha_modificacion, 23) as fecha_modificacion,
        CONVERT(varchar, hora_modificacion, 8) as hora_modificacion
      FROM DATA_CRONOGRAMA
      WHERE fecha >= @start AND fecha <= @end
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
        area
      FROM DATA_USERS
      WHERE estado = 'ACTIVO'
      ORDER BY apellido1, nombre1
    `);

  const tecnicos = result.recordset;
  return tecnicos;
};

/**
 * Inserta o actualiza un registro en DATA_SCHEDULE_V2 adaptando el payload de Frontend.
 */
  const upsertScheduleCell = async (data) => {
  const pool = getPool();
  const { date, resource, payload } = data;
  
  let m = payload ? payload.morning : null;
  let a = payload ? payload.afternoon : null;
  let cAM = payload ? payload.colorAM : '#10B981';
  let cPM = payload ? payload.colorPM : '#10B981';
  let autor = payload ? payload.autor : 'Sistema';
  let vehiculo_nombre = (payload && payload.vehiculo && payload.vehiculo !== 'Ninguno') ? payload.vehiculo : null;
  // ETag de concurrencia: timestamp de la última lectura conocida por el cliente
  let lastModified = payload ? (payload.lastModified || null) : null;

  // Buscar en DATA_USERS estricto para el técnico
  let id_usuario = null;
  let usuario_nombre = null;

  const userMatch = await pool.request()
    .input('res', sql.VarChar, resource)
    .query(`
      SELECT id, CONCAT(TRIM(nombre1), ' ', TRIM(apellido1)) as fullname 
      FROM DATA_USERS 
      WHERE REPLACE(TRIM(ISNULL(nombre1, 'SIN_NOMBRE')), ' ', '_') + '_' + REPLACE(TRIM(ISNULL(apellido1, 'SIN_APELLIDO')), ' ', '_') = @res
    `);
  if (userMatch.recordset.length > 0) {
      id_usuario = userMatch.recordset[0].id;
      usuario_nombre = userMatch.recordset[0].fullname;
  }

  // Comprobar si ya existe fila para esta fecha y este usuario
  // Incluimos fecha_modificacion + hora_modificacion para el check de concurrencia
  const checkReq = pool.request()
    .input('fecha', sql.Date, date)
    .input('id_us', sql.Int, id_usuario);

  const existingRes = await checkReq.query(`
    SELECT id,
      CONVERT(varchar, fecha_modificacion, 23) as fmod,
      CONVERT(varchar, hora_modificacion, 8) as hmod
    FROM DATA_CRONOGRAMA
    WHERE fecha = @fecha AND id_usuario = @id_us
  `);

  // Validación de Choques de Vehículo (Si pide un vehículo que no es propio)
  if (vehiculo_nombre && vehiculo_nombre !== 'Vehículo Propio') {
    const conflictReq = pool.request()
        .input('veh', sql.VarChar, vehiculo_nombre)
        .input('f', sql.Date, date);
        
    let conflictQuery = `SELECT usuario FROM DATA_CRONOGRAMA WHERE vehiculo = @veh AND fecha = @f`;
    if (existingRes.recordset.length > 0) {
        conflictReq.input('self_id', sql.Int, existingRes.recordset[0].id);
        conflictQuery += ` AND id != @self_id`;
    }
    const conflict = await conflictReq.query(conflictQuery);
    if (conflict.recordset.length > 0) {
        throw new Error(`El vehículo ${vehiculo_nombre} ya está reservado por ${conflict.recordset[0].usuario || 'otro técnico'} para este día.`);
    }
  }

  if (!payload || Object.keys(payload).length === 0) {
    return { status: 'ignored' };
  }

  const upsertReq = pool.request()
    .input('id_us', sql.Int, id_usuario)
    .input('usr', sql.VarChar, usuario_nombre)
    .input('veh', sql.VarChar, vehiculo_nombre)
    .input('f', sql.Date, date)
    .input('tm', sql.NVarChar, m)
    .input('tt', sql.NVarChar, a)
    .input('cam', sql.VarChar, cAM)
    .input('cpm', sql.VarChar, cPM)
    .input('autor', sql.VarChar, autor);

  if (existingRes.recordset.length === 0) {
    // Prevenir inserción de filas basura vacías
    if (!m && !a && !vehiculo_nombre) {
         return { status: 'ignored_empty_insert' };
    }
    // INSERT — no hay conflicto de concurrencia en nuevos registros
    await upsertReq.query(`
      INSERT INTO DATA_CRONOGRAMA (id_usuario, usuario, vehiculo, fecha, manana, tarde, color_am, color_pm, creado_por, fecha_creacion, hora_creacion)
      VALUES (@id_us, @usr, @veh, @f, @tm, @tt, @cam, @cpm, @autor,
        CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS DATE),
        CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS TIME)
      )
    `);
  } else {
    // ── CONTROL DE CONCURRENCIA OPTIMISTA ──
    // Reconstruir el timestamp tal como lo envía el frontend ("YYYY-MM-DD HH:MM:SS")
    const row = existingRes.recordset[0];
    const currentTimestamp = (row.fmod && row.hmod) ? `${row.fmod} ${row.hmod}` : null;

    upsertReq.input('row_id', sql.Int, row.id);

    // Si el cliente envió un lastModified y no coincide con el actual → 409 Conflict
    if (lastModified !== null && lastModified !== undefined && lastModified !== '') {
      if (currentTimestamp !== lastModified) {
        const concurrencyErr = new Error(
          'Otro usuario ya modificó esta celda. Recarga la página para ver los últimos datos antes de volver a editar.'
        );
        concurrencyErr.status = 409;
        throw concurrencyErr;
      }
    }

    const result = await upsertReq.query(`
      UPDATE DATA_CRONOGRAMA
      SET manana = @tm,
          tarde = @tt,
          color_am = @cam,
          color_pm = @cpm,
          vehiculo = @veh,
          actualizado_por = @autor,
          fecha_modificacion = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS DATE),
          hora_modificacion  = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SA Western Standard Time' AS TIME)
      WHERE id = @row_id
    `);

    // Verificación de seguridad adicional: si rowsAffected = 0 algo raro pasó
    if (result.rowsAffected[0] === 0) {
      const concurrencyErr = new Error('La celda fue modificada por otro proceso. Recarga la página para sincronizar.');
      concurrencyErr.status = 409;
      throw concurrencyErr;
    }
  }

  return { status: 'upserted', resource };
};

module.exports = {
  getSchedule,
  getTecnicos,
  upsertScheduleCell
};
