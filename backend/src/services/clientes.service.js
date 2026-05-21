const { getPool, sql } = require('../config/db');

/**
 * Busca clientes en DATA_CLIENTES e incluye el primer contacto
 * asociado desde DATA_CONTACTOS usando codigo_cliente = cliente_id.
 * @param {string} searchTerm - Término de búsqueda (nombre cliente)
 * @returns {Promise<Array>}
 */
const searchClientes = async (searchTerm) => {
  const pool = getPool();
  const result = await pool.request()
    .input('search', sql.VarChar, `%${searchTerm}%`)
    .query(`
      SELECT DISTINCT
        c.cliente,
        c.razonsocial,
        c.nit,
        c.codigo_cliente,
        (SELECT TOP 1 dc.nombre  FROM DATA_CONTACTOS dc WHERE dc.cliente_id = c.codigo_cliente) AS contacto_nombre,
        (SELECT TOP 1 dc.cargo   FROM DATA_CONTACTOS dc WHERE dc.cliente_id = c.codigo_cliente) AS contacto_cargo,
        (SELECT TOP 1 dc.fono_1  FROM DATA_CONTACTOS dc WHERE dc.cliente_id = c.codigo_cliente) AS contacto_fono,
        (SELECT TOP 1 dc.email_1 FROM DATA_CONTACTOS dc WHERE dc.cliente_id = c.codigo_cliente) AS contacto_email
      FROM DATA_CLIENTES c
      WHERE c.cliente LIKE @search
      ORDER BY c.cliente
    `);

  return result.recordset;
};

/**
 * Obtiene todos los clientes (con límite para no saturar)
 * @returns {Promise<Array>}
 */
const getAllClientes = async () => {
  const pool = getPool();
  const result = await pool.request()
    .query('SELECT DISTINCT cliente FROM DATA_CLIENTES ORDER BY cliente');

  return result.recordset;
};

/**
 * Obtiene las plantas de un cliente filtrando DATA_PLANTAS por codigo_cliente.
 * El codigo_planta tiene el formato: {codigo_cliente}-{sufijo} (ej: "0458-11")
 * @param {string} codigoCliente - codigo_cliente de DATA_CLIENTES (ej: "0458")
 * @returns {Promise<Array>} Lista de plantas del cliente
 */
const getPlantasByCliente = async (codigoCliente) => {
  const pool = getPool();
  const result = await pool.request()
    .input('clienteId', sql.Int, parseInt(codigoCliente, 10))
    .query(`
      SELECT codigo_planta, dir, localidad, localidad AS dep
      FROM DATA_PLANTAS
      WHERE cliente_id = @clienteId
      ORDER BY codigo_planta
    `);

  return result.recordset;
};

module.exports = {
  searchClientes,
  getAllClientes,
  getPlantasByCliente
};

