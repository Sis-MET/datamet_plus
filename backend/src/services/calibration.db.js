/**
 * Piezas compartidas por los servicios de calibración: transacciones, errores
 * HTTP, limpieza de textos y la lectura de DATA_EQUIPOS_CAL.
 */
const { getPool, sql } = require('../config/db');

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const normalizeArea = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const actorName = (actor) => String(actor?.usuario || 'Sistema').slice(0, 50);

// Algunos registros traen espacios de no separación (U+00A0) que RTRIM no
// quita; trim() de JavaScript sí.
const clean = (value) => String(value ?? '').trim() || null;

const withTransaction = async (work) => {
  const transaction = new sql.Transaction(getPool());
  await transaction.begin();
  try {
    const result = await work(() => new sql.Request(transaction));
    await transaction.commit();
    return result;
  } catch (error) {
    try { await transaction.rollback(); } catch { /* ya revertida */ }
    throw error;
  }
};

// DATA_EQUIPOS_CAL no tiene clave primaria: el id lo asigna quien inserta.
const EQUIPO_SELECT = `
  SELECT
    id,
    LTRIM(RTRIM(instrumento))      AS instrumento,
    LTRIM(RTRIM(cod_instrumento))  AS codigo,
    LTRIM(RTRIM(certificado))      AS certificado,
    CONVERT(varchar(10), cert_fecha, 23) AS cert_fecha,
    cert_periodo,
    LTRIM(RTRIM(ente_calibrador))  AS ente_calibrador,
    LTRIM(RTRIM(planta))           AS planta,
    LTRIM(RTRIM(reg_usuario))      AS reg_usuario,
    CONVERT(varchar(10), reg_fecha, 23) AS reg_fecha,
    LTRIM(RTRIM(estado))           AS estado,
    obs
  FROM DATA_EQUIPOS_CAL`;

const IS_ACTIVE = `UPPER(LTRIM(RTRIM(ISNULL(estado, 'ACTIVO')))) = 'ACTIVO'`;

const mapEquipo = (row) => ({
  id: row.id,
  codigo: clean(row.codigo) || '',
  instrumento: clean(row.instrumento) || '',
  certificado: clean(row.certificado),
  certFecha: row.cert_fecha || null,
  periodoDias: row.cert_periodo ?? null,
  enteCalibrador: clean(row.ente_calibrador),
  planta: clean(row.planta) || 'Sin planta',
  observaciones: clean(row.obs),
  registradoPor: clean(row.reg_usuario),
  registradoEn: row.reg_fecha || null,
  estado: (clean(row.estado) || 'ACTIVO').toUpperCase(),
});

module.exports = {
  EQUIPO_SELECT,
  IS_ACTIVE,
  actorName,
  clean,
  httpError,
  mapEquipo,
  normalizeArea,
  withTransaction,
};
