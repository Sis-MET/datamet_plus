const { getPool, sql } = require('../config/db');

/**
 * Busca clientes en la tabla DATA_CLIENTES por nombre (columna 'cliente')
 * @param {string} searchTerm - Término de búsqueda
 * @returns {Promise<Array>} Lista de clientes que coinciden
 */
const searchClientes = async (searchTerm) => {
  const pool = getPool();
  const result = await pool.request()
    .input('search', sql.VarChar, `%${searchTerm}%`)
    .query('SELECT DISTINCT cliente, razonsocial, nit FROM DATA_CLIENTES WHERE cliente LIKE @search ORDER BY cliente');
  
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

module.exports = {
  searchClientes,
  getAllClientes
};
