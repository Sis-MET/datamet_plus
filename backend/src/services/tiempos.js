/**
 * Tiempos de servicio del personal (KPI de Soporte técnico y de Calibración):
 * lo común a las dos áreas. Cada área lee sus servicios vigentes con la hora
 * de inicio y la hora final que registró el técnico en ServiceMET; la
 * aplicación calcula las duraciones y los indicadores
 * (src/features/tiempos/domain/tiempos.js).
 */
const { z } = require('zod');

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

/** Período más largo que se consulta de una vez (tres años, con margen). */
const MAX_DIAS = 1100;

const fecha = z.iso.date({ error: 'Fecha inválida (AAAA-MM-DD).' });
const periodo = z.object({
  desde: fecha,
  hasta: fecha,
}).refine(p => p.desde <= p.hasta, 'La fecha inicial es posterior a la final.');

const dias = (desde, hasta) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);

/** Período pedido ({ desde, hasta } en AAAA-MM-DD), validado. */
const leerPeriodo = (query = {}) => {
  const result = periodo.safeParse({ desde: query.desde, hasta: query.hasta });
  if (!result.success) throw httpError(400, result.error.issues[0]?.message || 'Período inválido.');
  if (dias(result.data.desde, result.data.hasta) > MAX_DIAS) {
    throw httpError(400, 'Consulta hasta tres años a la vez.');
  }
  return result.data;
};

const pad = (n) => String(n).padStart(2, '0');

/**
 * Hora como «HH:MM». Acepta lo que devuelve SQL Server para una columna
 * time (Date en 1970-01-01 UTC) o un texto «HH:MM[:SS]» (una corrección).
 */
const horaTexto = (valor) => {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return `${pad(valor.getUTCHours())}:${pad(valor.getUTCMinutes())}`;
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/.exec(String(valor ?? '').trim());
  return match ? `${match[1]}:${match[2]}` : null;
};

const fechaTexto = (valor) => (valor instanceof Date && !Number.isNaN(valor.getTime()) ? valor.toISOString().slice(0, 10) : null);

const texto = (valor) => {
  const limpio = String(valor ?? '').replace(/\s+/g, ' ').trim();
  return limpio || null;
};

const numero = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

/**
 * Ubicación aproximada del servicio que envía ServiceMET desde la 6.3.5
 * (latitud, longitud y precisión en metros), o null si no la trae o no es
 * válida (fuera de rango o 0, 0).
 */
const ubicacionTexto = (fila) => {
  const lat = numero(fila.latitud);
  const lng = numero(fila.longitud);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  const precision = numero(fila.precision_gps);
  return { lat, lng, precision: precision === null ? null : Math.round(precision) };
};

/**
 * Coordenadas de cada registro en el resumen DATA_SERVICIOS_DATOS (la
 * última subida que las trae). `conGps` es false si la base aún no tiene
 * esas columnas: entonces van vacías.
 */
const uneUbicacion = (alias, conGps) => (conGps ? `
  LEFT JOIN (
    SELECT d.codigo_registro, d.latitud, d.longitud, d.precision_gps,
      ROW_NUMBER() OVER (PARTITION BY d.codigo_registro ORDER BY d.n DESC) AS rn_gps
    FROM dbo.DATA_SERVICIOS_DATOS d
    WHERE d.latitud IS NOT NULL AND d.longitud IS NOT NULL
  ) gps ON gps.codigo_registro = ${alias}.codigo_registro AND gps.rn_gps = 1` : '');

const columnasUbicacion = conGps => (conGps
  ? 'gps.latitud, gps.longitud, gps.precision_gps'
  : 'CAST(NULL AS decimal(10, 7)) AS latitud, CAST(NULL AS decimal(10, 7)) AS longitud, CAST(NULL AS decimal(10, 2)) AS precision_gps');

/** ¿La base ya recibe la ubicación de ServiceMET? */
const CONSULTA_HAY_GPS = `SELECT COL_LENGTH('dbo.DATA_SERVICIOS_DATOS', 'latitud') AS latitud,
  COL_LENGTH('dbo.DATA_SERVICIOS_DATOS', 'longitud') AS longitud`;
const hayGps = recordset => recordset?.[0]?.latitud != null && recordset?.[0]?.longitud != null;

module.exports = {
  CONSULTA_HAY_GPS, MAX_DIAS, columnasUbicacion, fechaTexto, hayGps, horaTexto, httpError, leerPeriodo, texto, ubicacionTexto, uneUbicacion,
};
