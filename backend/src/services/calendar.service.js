const { getPool, sql } = require('../config/db');

/**
 * Retorna todas las tareas del cronograma en un rango de fechas.
 * @param {string} start - Fecha inicio ISO (YYYY-MM-DD)
 * @param {string} end   - Fecha fin ISO (YYYY-MM-DD)
 * @returns {Promise<Array>}
 */
const getSchedule = async (start, end) => {
  const pool = getPool();
  
  // Extraemos los años y meses del rango
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  const startGestion = startDate.getFullYear();
  const startMes = startDate.getMonth() + 1;
  const endGestion = endDate.getFullYear();
  const endMes = endDate.getMonth() + 1;

  const result = await pool.request()
    .input('startGestion', sql.Int, startGestion)
    .input('startMes', sql.Int, startMes)
    .input('endGestion', sql.Int, endGestion)
    .input('endMes', sql.Int, endMes)
    .query(`
      SELECT *
      FROM data_cronograma
      WHERE (gestion = @startGestion AND mes >= @startMes)
         OR (gestion = @endGestion AND mes <= @endMes)
         OR (gestion > @startGestion AND gestion < @endGestion)
      ORDER BY gestion, mes, dia
    `);

  return result.recordset;
};

/**
 * Retorna todas las columnas válidas para los recursos (Técnicos + Vehículos)
 * Lee dinámicamente desde DATA_USERS y añade furgon/camioneta.
 */
const getTecnicos = async () => {
  const pool = getPool();

  const result = await pool.request()
    .query(`
      SELECT 
        REPLACE(TRIM(ISNULL(nombre1, 'SIN_NOMBRE')), ' ', '_') + '_' + REPLACE(TRIM(ISNULL(apellido1, 'SIN_APELLIDO')), ' ', '_') AS id,
        CONCAT(TRIM(nombre1), ' ', TRIM(apellido1)) AS nombre,
        cargo,
        area
      FROM DATA_USERS
      WHERE estado = 'ACTIVO'
      ORDER BY apellido1, nombre1
    `);

  const tecnicos = result.recordset;
  
  // Añadimos los vehículos que existen como columnas estáticas extra
  tecnicos.push({ id: 'FURGON', nombre: 'FURGÓN', cargo: 'Vehículo', area: 'Logística' });
  tecnicos.push({ id: 'CAMIONETA', nombre: 'CAMIONETA', cargo: 'Vehículo', area: 'Logística' });

  return tecnicos;
};

/**
 * Inserta o actualiza una celda en una fecha específica para una columna específica
 * Esto reemplaza a create/update/delete (delete = mandar string vacío)
 */
const upsertScheduleCell = async (data) => {
  const pool = getPool();
  const { date, resource, text } = data; // date => 'YYYY-MM-DD', resource => 'Jhona_Doe', text => 'Embol'
  
  const d = new Date(date);
  // Ajuste timezone local a UTC simple
  const dia = d.getUTCDate();
  const mes = d.getUTCMonth() + 1;
  const gestion = d.getUTCFullYear();
  
  const diasSemanas = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const ndia = diasSemanas[d.getUTCDay()];
  
  const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const nmes = mesesNombres[mes - 1];

  // IMPORTANTE: Prevenimos Inyección SQL sanitizando el nombre de la columna. 
  // Solo se permiten alfanuméricos y guiones bajos (que es el formato de nuestras columnas nombre_apellido)
  const safeResource = resource.replace(/[^a-zA-Z0-9_ñÑáéíóúÁÉÍÓÚ]/g, '');

  // Paso 1: Comprobar si existe la fila para el día
  const checkReq = pool.request()
    .input('dia', sql.Int, dia)
    .input('mes', sql.Int, mes)
    .input('gestion', sql.Int, gestion);
    
  let result = await checkReq.query('SELECT id FROM data_cronograma WHERE dia = @dia AND mes = @mes AND gestion = @gestion');

  if (result.recordset.length === 0) {
    // INSERT si no existe
    await pool.request()
      .input('dia', sql.Int, dia)
      .input('ndia', sql.NVarChar, ndia)
      .input('mes', sql.Int, mes)
      .input('nmes', sql.NVarChar, nmes)
      .input('gestion', sql.Int, gestion)
      .input('texto', sql.NVarChar, text || null)
      .query(`
        INSERT INTO data_cronograma (dia, ndia, mes, nmes, gestion, [${safeResource}])
        VALUES (@dia, @ndia, @mes, @nmes, @gestion, @texto)
      `);
  } else {
    // UPDATE si ya existe
    await pool.request()
      .input('dia', sql.Int, dia)
      .input('mes', sql.Int, mes)
      .input('gestion', sql.Int, gestion)
      .input('texto', sql.NVarChar, text || null)
      .query(`
        UPDATE data_cronograma
        SET [${safeResource}] = @texto
        WHERE dia = @dia AND mes = @mes AND gestion = @gestion
      `);
  }

  // Retornar el registro actualizado (la fila entera)
  const q2 = await checkReq.query('SELECT * FROM data_cronograma WHERE dia = @dia AND mes = @mes AND gestion = @gestion');
  return q2.recordset[0];
};

module.exports = {
  getSchedule,
  getTecnicos,
  upsertScheduleCell
};
