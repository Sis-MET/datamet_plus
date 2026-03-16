const { getPool, sql } = require('../config/db');

/**
 * Retorna todas las tareas del cronograma en un rango de fechas.
 * Hace JOIN con DATA_USERS para obtener el nombre del técnico.
 * @param {string} start - Fecha inicio ISO (YYYY-MM-DD)
 * @param {string} end   - Fecha fin ISO (YYYY-MM-DD)
 * @returns {Promise<Array>}
 */
const getSchedule = async (start, end) => {
  const pool = getPool();

  const result = await pool.request()
    .input('start', sql.Date, start)
    .input('end', sql.Date, end)
    .query(`
      SELECT
        s.id,
        s.Tecnico,
        ISNULL(NULLIF(LTRIM(RTRIM(CONCAT(u.nombre1, ' ', u.apellido1))), ''), s.Tecnico) AS tecnico_nombre,
        s.fecha_inicio,
        s.fecha_fin,
        s.tipo,
        s.estado,
        s.cod_metrica,
        s.descripcion,
        s.cliente
      FROM DATA_SCHEDULE s
      LEFT JOIN DATA_USERS u ON u.usuario = s.Tecnico
      WHERE s.fecha_inicio <= @end
        AND s.fecha_fin   >= @start
      ORDER BY s.Tecnico, s.fecha_inicio
    `);

  return result.recordset;
};

/**
 * Retorna todos los usuarios/técnicos activos para las filas del Gantt.
 */
const getTecnicos = async () => {
  const pool = getPool();

  const result = await pool.request()
    .query(`
      SELECT
        usuario,
        ISNULL(NULLIF(LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))), ''), usuario) AS nombre,
        cargo,
        area
      FROM DATA_USERS
      ORDER BY nombre1
    `);

  return result.recordset;
};

/**
 * Crea una nueva tarea en DATA_SCHEDULE
 */
const createEvent = async (data) => {
  const pool = getPool();
  const request = pool.request();

  const result = await request
    .input('Tecnico', sql.VarChar, data.Tecnico)
    .input('fecha_inicio', sql.Date, data.fecha_inicio)
    .input('fecha_fin', sql.Date, data.fecha_fin)
    .input('tipo', sql.VarChar, data.tipo)
    .input('estado', sql.VarChar, data.estado)
    .input('cod_metrica', sql.VarChar, data.cod_metrica || null)
    .input('descripcion', sql.VarChar, data.descripcion || null)
    .input('cliente', sql.VarChar, data.cliente || null)
    .input('codigo_cliente', sql.Int, data.codigo_cliente || null)
    .input('codigo_planta', sql.VarChar, data.codigo_planta || null)
    .query(`
      INSERT INTO DATA_SCHEDULE 
        (Tecnico, fecha_inicio, fecha_fin, tipo, estado, cod_metrica, descripcion, cliente, codigo_cliente, codigo_planta)
      OUTPUT INSERTED.*
      VALUES 
        (@Tecnico, @fecha_inicio, @fecha_fin, @tipo, @estado, @cod_metrica, @descripcion, @cliente, @codigo_cliente, @codigo_planta)
    `);

  return result.recordset[0];
};

/**
 * Actualiza una tarea existente
 */
const updateEvent = async (id, data) => {
  const pool = getPool();

  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('Tecnico', sql.VarChar, data.Tecnico)
    .input('fecha_inicio', sql.Date, data.fecha_inicio)
    .input('fecha_fin', sql.Date, data.fecha_fin)
    .input('tipo', sql.VarChar, data.tipo)
    .input('estado', sql.VarChar, data.estado)
    .input('cod_metrica', sql.VarChar, data.cod_metrica || null)
    .input('descripcion', sql.VarChar, data.descripcion || null)
    .input('cliente', sql.VarChar, data.cliente || null)
    .input('codigo_cliente', sql.Int, data.codigo_cliente || null)
    .input('codigo_planta', sql.VarChar, data.codigo_planta || null)
    .query(`
      UPDATE DATA_SCHEDULE SET
        Tecnico = @Tecnico,
        fecha_inicio = @fecha_inicio,
        fecha_fin = @fecha_fin,
        tipo = @tipo,
        estado = @estado,
        cod_metrica = @cod_metrica,
        descripcion = @descripcion,
        cliente = @cliente,
        codigo_cliente = @codigo_cliente,
        codigo_planta = @codigo_planta
      OUTPUT INSERTED.*
      WHERE id = @id
    `);

  return result.recordset[0];
};

/**
 * Elimina una tarea
 */
const deleteEvent = async (id) => {
  const pool = getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .query('DELETE FROM DATA_SCHEDULE WHERE id = @id');
  return true;
};

module.exports = {
  getSchedule,
  getTecnicos,
  createEvent,
  updateEvent,
  deleteEvent
};
