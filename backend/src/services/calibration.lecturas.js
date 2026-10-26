/** Lecturas del cronograma de calibración: equipos, series, fechas, ajustes y envíos. */
const { getPool, sql } = require('../config/db');
const { EQUIPO_SELECT, IS_ACTIVE, clean, mapEquipo, normalizeArea } = require('./calibration.db');

const getEquipos = async () => {
  const result = await getPool().request().query(`${EQUIPO_SELECT}
    WHERE ${IS_ACTIVE}
    ORDER BY planta, cod_instrumento
  `);
  return result.recordset.map(mapEquipo);
};

/** Equipos dados de baja: fuera del plan, pero se pueden reactivar. */
const getEquiposBaja = async () => {
  const result = await getPool().request().query(`${EQUIPO_SELECT}
    WHERE NOT (${IS_ACTIVE})
    ORDER BY planta, cod_instrumento
  `);
  return result.recordset.map(mapEquipo);
};

/** Valores ya usados, para sugerirlos al registrar o editar equipos. */
const getCatalogos = async () => {
  const result = await getPool().request().query(`
    SELECT DISTINCT 'instrumento' AS campo, instrumento AS valor FROM DATA_EQUIPOS_CAL
    UNION SELECT DISTINCT 'ente', ente_calibrador FROM DATA_EQUIPOS_CAL
    UNION SELECT DISTINCT 'planta', planta FROM DATA_EQUIPOS_CAL
  `);
  const catalogos = { instrumentos: new Map(), entes: new Map(), plantas: new Map() };
  const target = { instrumento: catalogos.instrumentos, ente: catalogos.entes, planta: catalogos.plantas };
  for (const row of result.recordset) {
    const valor = clean(row.valor);
    if (valor) target[row.campo].set(valor.toLowerCase(), valor);
  }
  const sorted = (map) => [...map.values()].sort((a, b) => a.localeCompare(b, 'es'));
  return {
    instrumentos: sorted(catalogos.instrumentos),
    entes: sorted(catalogos.entes),
    plantas: sorted(catalogos.plantas),
  };
};

/**
 * Revisión del certificado vigente de cada equipo activo (7.5.1): REVISADO o
 * PENDIENTE. El vigente es la fila del historial que coincide con
 * DATA_EQUIPOS_CAL; si otro sistema lo cambió y aún no está, queda pendiente.
 */
const getCertRevisions = async () => {
  const same = (column) => `LTRIM(RTRIM(REPLACE(ISNULL(${column}, ''), NCHAR(160), N' ')))`;
  const result = await getPool().request().query(`
    SELECT e.id, actual.revisado_por
    FROM DATA_EQUIPOS_CAL e
    OUTER APPLY (
      SELECT TOP 1 c.revisado_por FROM dbo.CAL_CERTIFICADOS c
      WHERE c.equipo_id = e.id AND c.anulado = 0 AND c.cert_fecha = e.cert_fecha
        AND ${same('c.certificado')} = ${same('e.certificado')}
      ORDER BY c.id DESC
    ) actual
    WHERE e.cert_fecha IS NOT NULL AND ${IS_ACTIVE}
  `);
  return new Map(result.recordset.map(row => [row.id, clean(row.revisado_por) ? 'REVISADO' : 'PENDIENTE']));
};

const mapPrograma = (row) => ({
  id: row.id,
  tipo: row.tipo,
  equipoId: row.equipo_id,
  titulo: row.titulo,
  categoria: row.categoria,
  descripcion: row.descripcion,
  frecuenciaMeses: row.frecuencia_meses,
  fechaInicio: row.fecha_inicio,
  responsableId: row.responsable_id,
  responsableNombre: row.responsable_nombre,
  alertaDias: row.alerta_dias,
  alertaFrecuencia: row.alerta_frecuencia,
  alertaCorreo: row.alerta_correo,
  activo: Boolean(row.activo),
  actualizadoPor: row.actualizado_por || row.creado_por,
});

const getProgramas = async () => {
  const result = await getPool().request().query(`
    SELECT id, tipo, equipo_id, titulo, categoria, descripcion, frecuencia_meses,
      CONVERT(varchar(10), fecha_inicio, 23) AS fecha_inicio,
      responsable_id, responsable_nombre, alerta_dias, alerta_frecuencia, alerta_correo,
      activo, creado_por, actualizado_por
    FROM dbo.CAL_PROGRAMAS
  `);
  return result.recordset.map(mapPrograma);
};

const getEventos = async () => {
  // La tabla solo guarda lo que el personal cambia: decenas de filas por año.
  const result = await getPool().request().query(`
    SELECT serie,
      CONVERT(varchar(10), fecha_programada, 23)   AS fecha_programada,
      CONVERT(varchar(10), fecha_reprogramada, 23) AS fecha_reprogramada,
      estado,
      CONVERT(varchar(10), fecha_realizada, 23)    AS fecha_realizada,
      resultado, observaciones, registro_ref, actualizado_por,
      CONVERT(varchar(19), actualizado_en, 126)    AS actualizado_en,
      revisado_por,
      CONVERT(varchar(19), revisado_en, 126)       AS revisado_en
    FROM dbo.CAL_EVENTOS
  `);
  return result.recordset.map(row => ({
    serie: row.serie,
    fechaProgramada: row.fecha_programada,
    fechaReprogramada: row.fecha_reprogramada,
    estado: row.estado,
    fechaRealizada: row.fecha_realizada,
    resultado: row.resultado,
    observaciones: row.observaciones,
    registroRef: clean(row.registro_ref),
    actualizadoPor: row.actualizado_por,
    actualizadoEn: row.actualizado_en ? `${row.actualizado_en}Z` : null,
    revisadoPor: clean(row.revisado_por),
    revisadoEn: row.revisado_en ? `${row.revisado_en}Z` : null,
  }));
};

const getAjustes = async () => {
  const result = await getPool().request().query(`
    SELECT TOP 1 alerta_dias, alerta_frecuencia, alerta_correo, hora_envio,
      CONVERT(varchar(10), ultima_revision, 23) AS ultima_revision
    FROM dbo.CAL_AJUSTES WHERE id = 1
  `);
  const row = result.recordset[0] || {};
  return {
    alertaDias: row.alerta_dias ?? 30,
    alertaFrecuencia: row.alerta_frecuencia || 'SEMANAL',
    alertaCorreo: row.alerta_correo ?? true,
    horaEnvio: String(row.hora_envio || '08:00').trim(),
    ultimaRevision: row.ultima_revision || null,
  };
};

const getContactos = async () => {
  const result = await getPool().request().query(`
    SELECT id, usuario_id, nombre, email, recibe_todas, activo
    FROM dbo.CAL_CONTACTOS
    ORDER BY recibe_todas DESC, nombre
  `);
  return result.recordset.map(row => ({
    id: row.id,
    usuarioId: row.usuario_id,
    nombre: row.nombre,
    email: row.email,
    recibeTodas: Boolean(row.recibe_todas),
    activo: Boolean(row.activo),
  }));
};

const getPersonal = async () => {
  const result = await getPool().request().query(`
    SELECT id,
      CONCAT(TRIM(nombre1), ' ', TRIM(apellido1)) AS nombre,
      TRIM(area) AS area,
      TRIM(cargo) AS cargo
    FROM DATA_USERS
    WHERE estado = 'ACTIVO'
    ORDER BY nombre1, apellido1
  `);
  const personal = result.recordset.map(row => ({
    id: row.id,
    nombre: row.nombre,
    area: row.area || '',
    cargo: row.cargo || '',
    esCalibracion: normalizeArea(row.area) === 'calibracion',
  }));
  // El personal de Calibración va primero en los selectores.
  return personal.sort((a, b) => Number(b.esCalibracion) - Number(a.esCalibracion));
};

const getEnvios = async (limit = 40) => {
  const result = await getPool().request()
    .input('limit', sql.Int, limit)
    .query(`
      SELECT TOP (@limit) id, serie,
        CONVERT(varchar(10), fecha_programada, 23) AS fecha_programada,
        email, motivo, estado, error,
        CONVERT(varchar(19), enviado_en, 126) AS enviado_en
      FROM dbo.CAL_ALERTAS_ENVIOS
      ORDER BY id DESC
    `);
  return result.recordset.map(row => ({
    id: row.id,
    serie: row.serie,
    fechaProgramada: row.fecha_programada,
    email: row.email,
    motivo: row.motivo,
    estado: row.estado,
    error: row.error,
    enviadoEn: row.enviado_en ? `${row.enviado_en}Z` : null,
  }));
};

const getAlertHistory = async (desde) => {
  const result = await getPool().request()
    .input('desde', sql.Date, desde)
    .query(`
      SELECT serie, CONVERT(varchar(10), fecha_programada, 23) AS fecha_programada,
        email, motivo, CONVERT(varchar(10), fecha_local, 23) AS fecha_local
      FROM dbo.CAL_ALERTAS_ENVIOS
      WHERE estado = 'ENVIADO' AND fecha_local >= @desde
    `);
  return result.recordset.map(row => ({
    serie: row.serie,
    fechaProgramada: row.fecha_programada,
    email: row.email,
    motivo: row.motivo,
    fechaLocal: row.fecha_local,
  }));
};

module.exports = {
  getAjustes,
  getAlertHistory,
  getCatalogos,
  getCertRevisions,
  getContactos,
  getEnvios,
  getEquipos,
  getEquiposBaja,
  getEventos,
  getPersonal,
  getProgramas,
};
