const { getPool, sql } = require('../config/db');

/** Columnas de una tarea del cronograma, las mismas para la grilla y el buscador. */
const COLUMNAS_TAREA = `
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
        planta_dir,
        planta_localidad,
        color,
        estado,
        CONVERT(varchar(8), hora_inicio, 8) as hora_inicio,
        CONVERT(varchar(8), hora_fin,    8) as hora_fin,
        hora_total,
        creado_por,
        id_creador,
        grupo_id,
        creado_en,
        CONVERT(varchar, fecha_creacion, 23) as fecha_creacion,
        CONVERT(varchar, hora_creacion, 8) as hora_creacion,
        actualizado_por,
        CONVERT(varchar, fecha_modificacion, 23) as fecha_modificacion,
        CONVERT(varchar, hora_modificacion, 8) as hora_modificacion
`;

/**
 * Dirección y localidad de la planta de cada tarea. Se agrupa por código porque
 * DATA_PLANTAS no lo garantiza único: un duplicado no debe repetir la tarea.
 */
const JOIN_PLANTA = `
      LEFT JOIN (
        SELECT codigo_planta AS planta_codigo, MAX(dir) AS planta_dir, MAX(localidad) AS planta_localidad
        FROM DATA_PLANTAS
        GROUP BY codigo_planta
      ) AS datos_planta ON datos_planta.planta_codigo = DATA_CRONOGRAMA.planta`;

const getSchedule = async (start, end) => {
  const pool = getPool();

  const result = await pool.request()
    .input('start', sql.Date, start)
    .input('end', sql.Date, end)
    .query(`
      SELECT
${COLUMNAS_TAREA}
      FROM DATA_CRONOGRAMA
${JOIN_PLANTA}
      WHERE fecha >= @start AND fecha <= @end
        AND ISNULL(estado, '') <> 'Anulado'
    `);

  return result.recordset;
};

/**
 * Huella barata del rango: cambia con cualquier alta, edición, anulación o
 * movimiento. El cliente la consulta en cada sondeo y solo pide el cronograma
 * completo cuando cambia.
 */
const getScheduleVersion = async (start, end) => {
  const pool = getPool();

  const result = await pool.request()
    .input('start', sql.Date, start)
    .input('end', sql.Date, end)
    .query(`
      SELECT
        COUNT_BIG(*) AS total,
        CHECKSUM_AGG(BINARY_CHECKSUM(
          id, fecha, estado, tipo_tarea, cotizacion, descripcion, cliente, planta, color,
          hora_inicio, hora_fin, fecha_modificacion, hora_modificacion, id_usuario, usuario
        )) AS checksum
      FROM DATA_CRONOGRAMA
      WHERE fecha >= @start AND fecha <= @end
    `);

  const row = result.recordset[0] || {};
  return `${row.total ?? 0}:${row.checksum ?? 0}`;
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

// ─── Buscador del cronograma (Ctrl + K) ────────────────────────────────────

/** Cuántas tareas devuelve como máximo una búsqueda. */
const MAX_RESULTADOS = 40;
const MAX_PALABRAS = 5;

/** Texto en el que se busca: tipo, referencia (cotización, SECA u OTST), descripción, cliente, planta y personas. */
const TEXTO_BUSCABLE = `(ISNULL(tipo_tarea, N'') + N' ' + ISNULL(cotizacion, N'') + N' ' + ISNULL(descripcion, N'')
        + N' ' + ISNULL(cliente, N'') + N' ' + ISNULL(planta, N'') + N' ' + ISNULL(usuario, N'') + N' ' + ISNULL(creado_por, N''))
        COLLATE Latin1_General_CI_AI`;

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

/** Una palabra para LIKE, sin comodines propios (\\ es el escape). */
const patronLike = palabra => `%${palabra.replace(/[\\%_[]/g, caracter => `\\${caracter}`)}%`;

/**
 * Palabras de una búsqueda: cada una debe aparecer en la tarea, en cualquier
 * campo y sin importar mayúsculas ni tildes. Lanza 400 si es muy corta o larga.
 */
const palabrasDeBusqueda = (q) => {
  const texto = String(q ?? '').replace(/\s+/g, ' ').trim();
  if (texto.length < 2) throw httpError(400, 'Escribe al menos 2 caracteres para buscar.');
  if (texto.length > 80) throw httpError(400, 'La búsqueda admite hasta 80 caracteres.');
  return [...new Set(texto.split(' ').map(p => p.slice(0, 40)))].slice(0, MAX_PALABRAS);
};

/** Consulta de la búsqueda para `cantidad` palabras (@p0, @p1, …): las más cercanas a hoy primero. */
const consultaBusqueda = (cantidad) => `
      SELECT TOP (${MAX_RESULTADOS})
${COLUMNAS_TAREA}
      FROM DATA_CRONOGRAMA
${JOIN_PLANTA}
      WHERE ISNULL(estado, '') <> 'Anulado'
        ${Array.from({ length: cantidad }, (_, i) => `AND ${TEXTO_BUSCABLE} LIKE @p${i} ESCAPE '\\'`).join('\n        ')}
      ORDER BY ABS(DATEDIFF(day, fecha, CAST(GETDATE() AS date))), fecha DESC, id DESC`;

/** Tareas de cualquier fecha que coinciden con el texto buscado. */
const searchSchedule = async (q) => {
  const palabras = palabrasDeBusqueda(q);
  const request = getPool().request();
  palabras.forEach((palabra, i) => request.input(`p${i}`, sql.NVarChar(100), patronLike(palabra)));
  const result = await request.query(consultaBusqueda(palabras.length));
  return result.recordset;
};

module.exports = {
  consultaBusqueda,
  palabrasDeBusqueda,
  patronLike,
  searchSchedule,
  getSchedule,
  getScheduleVersion,
  getTecnicos
};
