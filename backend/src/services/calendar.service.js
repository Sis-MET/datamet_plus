const { getPool, sql } = require('../config/db');

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
        tipo_tarea,
        cotizacion,
        descripcion,
        cliente,
        cod_cliente,
        planta,
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

module.exports = {
  getSchedule,
  getTecnicos
};
