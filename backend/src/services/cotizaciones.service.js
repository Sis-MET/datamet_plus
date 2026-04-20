const { getPool, sql } = require('../config/db');

/**
 * Busca cotizaciones en DATA_COTIZACIONES.
 * Del cod_contacto (ej: '0032-11-C17') se extrae el codigo_planta ('0032-11')
 * quitando el último segmento separado por '-'.
 * Luego se hace JOIN a DATA_PLANTAS y DATA_CLIENTES para obtener
 * el nombre del cliente y de la planta.
 *
 * @param {string} searchTerm - Término de búsqueda libre (cod_cotizacion o nombre cliente)
 * @returns {Promise<Array>}
 */
const searchCotizaciones = async (searchTerm) => {
  const pool = getPool();

  const result = await pool.request()
    .input('search', sql.VarChar, `%${searchTerm}%`)
    .query(`
      SELECT TOP 15
        cot.cod_cotizacion,
        cot.cod_contacto,
        -- Extraer codigo_planta quitando el último segment ("-C17", "-C01", etc.)
        -- Ej: '0032-11-C17' → '0032-11'
        LEFT(
          cot.cod_contacto,
          LEN(cot.cod_contacto) - CHARINDEX('-', REVERSE(cot.cod_contacto))
        ) AS codigo_planta,
        ISNULL(c.cliente, '')    AS nombre_cliente,
        ISNULL(p.dir, '')        AS nombre_planta
      FROM DATA_COTIZACION cot
      LEFT JOIN DATA_PLANTAS p
        ON p.codigo_planta = LEFT(
             cot.cod_contacto,
             LEN(cot.cod_contacto) - CHARINDEX('-', REVERSE(cot.cod_contacto))
           )
      LEFT JOIN DATA_CLIENTES c
        ON c.codigo_cliente = p.cliente_id
      WHERE
        cot.cod_cotizacion LIKE @search
        OR c.cliente        LIKE @search
      ORDER BY cot.cod_cotizacion DESC
    `);

  return result.recordset;
};

module.exports = {
  searchCotizaciones,
};
