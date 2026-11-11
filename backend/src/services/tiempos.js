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

module.exports = { MAX_DIAS, fechaTexto, horaTexto, httpError, leerPeriodo, texto };
