/**
 * Validación del motor de cálculo (Calibración › Certificados › Validación;
 * migración 022). Corre los ejemplos publicados con el motor del servidor
 * (calibracion/validacion.js) y guarda, cuando el personal de Calibración lo
 * pide, la corrida como evidencia de la versión de la aplicación en uso
 * (NB/ISO/IEC 17025, 7.11.2): resultados, huella SHA-256, quién y cuándo. Las
 * evidencias no se editan ni se borran (8.4).
 */
const { createHash } = require('node:crypto');
const { getPool, sql } = require('../config/db');
const { actorName, clean, httpError } = require('./calibration.db');
const { personaCalibracion } = require('./calibration.aprobadores');
const { ejecutarValidacion } = require('./calibracion/validacion');

const sinTabla = err => err?.number === 208 || /Invalid object name 'dbo\.CAL_VALIDACIONES/i.test(String(err?.message || ''));
const versionValida = version => (/^\d+\.\d+\.\d+$/.test(String(version || '')) ? String(version) : null);

const leerEvidencias = async () => {
  try {
    const { recordset } = await getPool().request().query(`
      SELECT id, version_app, huella, casos, valores, aprobados, observacion, registrado_por, registrado_nombre,
        CONVERT(varchar(19), registrado_en, 126) AS registrado_en
      FROM dbo.CAL_VALIDACIONES ORDER BY registrado_en DESC, id DESC`);
    return {
      disponible: true,
      evidencias: recordset.map(r => ({
        id: r.id,
        version: r.version_app,
        huella: r.huella,
        casos: r.casos,
        valores: r.valores,
        aprobados: r.aprobados,
        ok: r.valores === r.aprobados,
        observacion: clean(r.observacion),
        registradoPor: clean(r.registrado_nombre) || clean(r.registrado_por),
        registradoEn: r.registrado_en ? `${r.registrado_en}Z` : null,
      })),
    };
  } catch (err) {
    if (sinTabla(err)) return { disponible: false, evidencias: [] };
    throw err;
  }
};

/** La validación ahora, con el motor que corre, y las evidencias registradas. */
const getValidacion = async ({ version = null } = {}, user) => {
  const [persona, historial] = await Promise.all([personaCalibracion(user), leerEvidencias()]);
  const ahora = ejecutarValidacion();
  const actual = versionValida(version);
  return {
    version: actual,
    ejecutadoEn: new Date().toISOString(),
    ...ahora,
    evidencias: historial.evidencias,
    // Ya registrada para esta versión (no impide registrar otra corrida).
    registradaEstaVersion: Boolean(actual && historial.evidencias.some(e => e.version === actual)),
    permisos: {
      registrar: historial.disponible && persona.editor,
      motivo: !historial.disponible ? 'Falta la migración 022 para guardar la evidencia.' : persona.editor ? null : 'Solo el personal de Calibración registra la evidencia.',
    },
  };
};

/** Registra la corrida de ahora como evidencia de la versión en uso. */
const registrarEvidencia = async ({ version, observacion = null }, user) => {
  const persona = await personaCalibracion(user);
  if (!persona.editor) throw httpError(403, 'Solo el personal de Calibración registra la evidencia de la validación.');
  const versionApp = versionValida(version);
  if (!versionApp) throw httpError(400, 'Falta la versión de la aplicación.');
  const { casos, resumen } = ejecutarValidacion();
  const resultados = JSON.stringify({ version: versionApp, casos });
  const huella = createHash('sha256').update(resultados).digest('hex');
  try {
    const { recordset } = await getPool().request()
      .input('version', sql.NVarChar(20), versionApp)
      .input('resultados', sql.NVarChar(sql.MAX), resultados)
      .input('huella', sql.VarChar(64), huella)
      .input('casos', sql.Int, resumen.casos)
      .input('valores', sql.Int, resumen.valores)
      .input('aprobados', sql.Int, resumen.aprobados)
      .input('observacion', sql.NVarChar(500), clean(observacion) || null)
      .input('usuario', sql.NVarChar(50), actorName(user))
      .input('nombre', sql.NVarChar(120), clean(persona.nombre) || null)
      .query(`INSERT INTO dbo.CAL_VALIDACIONES
          (version_app, resultados, huella, casos, valores, aprobados, observacion, registrado_por, registrado_nombre)
        OUTPUT INSERTED.id VALUES (@version, @resultados, @huella, @casos, @valores, @aprobados, @observacion, @usuario, @nombre)`);
    return { id: recordset[0].id, version: versionApp, huella, ...resumen };
  } catch (err) {
    if (sinTabla(err)) throw httpError(503, 'Falta la migración 022 para guardar la evidencia de la validación.');
    throw err;
  }
};

/** Una evidencia registrada, con sus resultados tal como se guardaron. */
const getEvidencia = async (id) => {
  try {
    const { recordset } = await getPool().request().input('id', sql.Int, id).query(`
      SELECT id, version_app, resultados, huella, observacion, registrado_por, registrado_nombre,
        CONVERT(varchar(19), registrado_en, 126) AS registrado_en
      FROM dbo.CAL_VALIDACIONES WHERE id = @id`);
    const fila = recordset[0];
    if (!fila) throw httpError(404, 'La evidencia no existe.');
    const integra = createHash('sha256').update(fila.resultados).digest('hex') === fila.huella;
    return {
      id: fila.id,
      version: fila.version_app,
      huella: fila.huella,
      integra,
      observacion: clean(fila.observacion),
      registradoPor: clean(fila.registrado_nombre) || clean(fila.registrado_por),
      registradoEn: fila.registrado_en ? `${fila.registrado_en}Z` : null,
      casos: JSON.parse(fila.resultados).casos,
    };
  } catch (err) {
    if (sinTabla(err)) throw httpError(503, 'Falta la migración 022 para ver la evidencia de la validación.');
    throw err;
  }
};

module.exports = { getEvidencia, getValidacion, registrarEvidencia };
