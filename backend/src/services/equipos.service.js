const { getPool, sql } = require('../config/db');

/**
 * Busca equipos en DATA_EQUIPOS por cod_metrica (con soporte de filtro por planta/cliente).
 * Hace LEFT JOIN con DATA_EQUIPOS_BALANZAS para obtener cap_max1 y d1.
 * @param {string} searchTerm - Término de búsqueda (cod_metrica parcial)
 * @param {string} [codPlanta] - Código de planta opcional (ej: "0121-41") para filtrar
 * @returns {Promise<Array>}
 */
const searchEquipos = async (searchTerm, codPlanta) => {
  const pool = getPool();

  // Construir el prefijo de búsqueda: si hay planta, filtrar por planta; si no, búsqueda libre
  const likePattern = codPlanta
    ? `${codPlanta}-%${searchTerm}%`
    : `%${searchTerm}%`;

  const result = await pool.request()
    .input('search', sql.VarChar, likePattern)
    .query(`
      SELECT TOP 20
        e.cod_metrica,
        e.instrumento,
        e.marca,
        e.modelo,
        e.serie,
        e.ubicacion,
        b.cap_max1,
        b.d1,
        b.unidad
      FROM DATA_EQUIPOS e
      LEFT JOIN DATA_EQUIPOS_BALANZAS b ON b.cod_metrica = e.cod_metrica
      WHERE e.cod_metrica LIKE @search
      ORDER BY e.cod_metrica
    `);

  return result.recordset;
};

/**
 * Obtiene un equipo por su cod_metrica exacto.
 * @param {string} codMetrica
 */
const getEquipoByCode = async (codMetrica) => {
  const pool = getPool();
  const result = await pool.request()
    .input('cod', sql.VarChar, codMetrica)
    .query(`
      SELECT
        e.cod_metrica,
        e.instrumento,
        e.marca,
        e.modelo,
        e.serie,
        e.ubicacion,
        b.cap_max1,
        b.d1,
        b.unidad
      FROM DATA_EQUIPOS e
      LEFT JOIN DATA_EQUIPOS_BALANZAS b ON b.cod_metrica = e.cod_metrica
      WHERE e.cod_metrica = @cod
    `);

  return result.recordset[0] || null;
};

module.exports = {
  searchEquipos,
  getEquipoByCode
};
