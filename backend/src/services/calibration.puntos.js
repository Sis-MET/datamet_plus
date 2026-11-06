/**
 * Puntos de ensayo acordados de cada instrumento de un cliente (migración
 * 017): cargas de excentricidad, repetibilidad y error de indicación. Antes
 * estaban en Access (ICLI) y en DATA_SERVICIOS_LEC; ahora los mantiene
 * Calibración en DataMET+. Son una referencia para los avisos: el certificado
 * usa lo que realmente se midió.
 */
const { getPool, sql } = require('../config/db');
const { actorName, clean, httpError, withTransaction } = require('./calibration.db');
const { normalizarCodigo } = require('./calibration.fuente');

const ENSAYOS = { EXC: 'excentricidad', REP: 'repetibilidad', ERR: 'errores' };

const leerCodigo = (valor) => {
  const codigo = normalizarCodigo(valor);
  if (!codigo) throw httpError(400, 'Código Métrica inválido: debe tener la forma 0000-00-000.');
  return codigo;
};

/** Filas de CAL_PUNTOS_ACORDADOS_CARGAS → { excentricidad, repetibilidad[], errores[] }. */
const agrupar = (cargas) => {
  const porEnsayo = { EXC: [], REP: [], ERR: [] };
  for (const fila of [...cargas].sort((a, b) => a.orden - b.orden)) porEnsayo[fila.ensayo]?.push(Number(fila.carga));
  return { excentricidad: porEnsayo.EXC[0] ?? null, repetibilidad: porEnsayo.REP, errores: porEnsayo.ERR };
};

/** Versión completa para el historial. */
const version = (puntos) => (puntos ? {
  unidad: puntos.unidad || null,
  excentricidad: puntos.excentricidad ?? null,
  repetibilidad: puntos.repetibilidad || [],
  errores: puntos.errores || [],
  observaciones: puntos.observaciones || null,
} : null);

const igual = (a, b) => JSON.stringify(version(a)) === JSON.stringify(version(b));

// ─── Lectura ───────────────────────────────────────────────────────────────

const cargarUno = async (createRequest, codigo, { lock = false } = {}) => {
  const hint = lock ? 'WITH (UPDLOCK, HOLDLOCK)' : '';
  const cabecera = await createRequest().input('cod', sql.NVarChar(30), codigo).query(`
    SELECT cod_metrica, unidad, origen, origen_ref, CONVERT(varchar(10), origen_fecha, 23) AS origen_fecha,
      observaciones, version, registrado_por, actualizado_por,
      CONVERT(varchar(19), COALESCE(actualizado_en, registrado_en), 126) AS actualizado_en
    FROM dbo.CAL_PUNTOS_ACORDADOS ${hint} WHERE cod_metrica = @cod
  `);
  const row = cabecera.recordset[0];
  if (!row) return null;
  const cargas = await createRequest().input('cod', sql.NVarChar(30), codigo).query(`
    SELECT ensayo, orden, carga FROM dbo.CAL_PUNTOS_ACORDADOS_CARGAS ${hint} WHERE cod_metrica = @cod
  `);
  return {
    codMetrica: row.cod_metrica,
    unidad: clean(row.unidad),
    origen: row.origen,
    origenRef: clean(row.origen_ref),
    origenFecha: row.origen_fecha,
    observaciones: clean(row.observaciones),
    version: row.version,
    actualizadoPor: clean(row.actualizado_por) || clean(row.registrado_por),
    actualizadoEn: row.actualizado_en ? `${row.actualizado_en}Z` : null,
    ...agrupar(cargas.recordset),
  };
};

/** Puntos acordados de un instrumento con su historial; null si no tiene. */
const getPuntos = async (codMetrica) => {
  const codigo = leerCodigo(codMetrica);
  const createRequest = () => getPool().request();
  const puntos = await cargarUno(createRequest, codigo);
  const historial = await createRequest().input('cod', sql.NVarChar(30), codigo).query(`
    SELECT TOP 50 id, accion, antes, despues, motivo, usuario, CONVERT(varchar(19), fecha, 126) AS fecha
    FROM dbo.CAL_PUNTOS_ACORDADOS_HISTORIAL WHERE cod_metrica = @cod ORDER BY fecha DESC, id DESC
  `);
  return {
    codMetrica: codigo,
    puntos,
    historial: historial.recordset.map(row => ({
      id: row.id,
      accion: row.accion,
      antes: row.antes ? JSON.parse(row.antes) : null,
      despues: row.despues ? JSON.parse(row.despues) : null,
      motivo: clean(row.motivo),
      usuario: clean(row.usuario),
      fecha: `${row.fecha}Z`,
    })),
  };
};

/**
 * Todos los puntos acordados, para el contexto del adaptador de servicios:
 * Map(código Métrica → { unidad, origen, excentricidad, repetibilidad, errores }).
 * Sin la migración 017 devuelve un mapa vacío.
 */
const cargarTodos = async () => {
  const pool = getPool();
  const existe = await pool.request().query("SELECT OBJECT_ID('dbo.CAL_PUNTOS_ACORDADOS', 'U') AS id");
  if (existe.recordset[0].id == null) return new Map();
  const [cabeceras, cargas] = await Promise.all([
    pool.request().query('SELECT cod_metrica, unidad, origen FROM dbo.CAL_PUNTOS_ACORDADOS'),
    pool.request().query('SELECT cod_metrica, ensayo, orden, carga FROM dbo.CAL_PUNTOS_ACORDADOS_CARGAS'),
  ]);
  const porCodigo = new Map();
  for (const fila of cargas.recordset) {
    porCodigo.set(fila.cod_metrica, [...(porCodigo.get(fila.cod_metrica) || []), fila]);
  }
  return new Map(cabeceras.recordset.map(row => [row.cod_metrica, {
    unidad: clean(row.unidad),
    origen: row.origen,
    ...agrupar(porCodigo.get(row.cod_metrica) || []),
  }]));
};

// ─── Escritura ─────────────────────────────────────────────────────────────

const escribirCargas = async (createRequest, codigo, puntos) => {
  await createRequest().input('cod', sql.NVarChar(30), codigo)
    .query('DELETE FROM dbo.CAL_PUNTOS_ACORDADOS_CARGAS WHERE cod_metrica = @cod');
  const filas = [
    ...(puntos.excentricidad ? [['EXC', 1, puntos.excentricidad]] : []),
    ...puntos.repetibilidad.map((carga, i) => ['REP', i + 1, carga]),
    ...puntos.errores.map((carga, i) => ['ERR', i + 1, carga]),
  ];
  for (const [ensayo, orden, carga] of filas) {
    await createRequest()
      .input('cod', sql.NVarChar(30), codigo)
      .input('ensayo', sql.VarChar(3), ensayo)
      .input('orden', sql.Int, orden)
      .input('carga', sql.Decimal(18, 8), carga)
      .query('INSERT INTO dbo.CAL_PUNTOS_ACORDADOS_CARGAS (cod_metrica, ensayo, orden, carga) VALUES (@cod, @ensayo, @orden, @carga)');
  }
};

const registrarHistorial = (createRequest, codigo, accion, antes, despues, motivo, usuario) => createRequest()
  .input('cod', sql.NVarChar(30), codigo)
  .input('accion', sql.VarChar(20), accion)
  .input('antes', sql.NVarChar(sql.MAX), antes ? JSON.stringify(version(antes)) : null)
  .input('despues', sql.NVarChar(sql.MAX), despues ? JSON.stringify(version(despues)) : null)
  .input('motivo', sql.NVarChar(500), motivo || null)
  .input('usuario', sql.NVarChar(50), usuario)
  .query(`INSERT INTO dbo.CAL_PUNTOS_ACORDADOS_HISTORIAL (cod_metrica, accion, antes, despues, motivo, usuario)
    VALUES (@cod, @accion, @antes, @despues, @motivo, @usuario)`);

/**
 * Guarda los puntos acordados de un instrumento (Calibración, desde DataMET+).
 * Cambiar unos existentes exige motivo y la versión que se editó.
 */
const savePuntos = async (codMetrica, data, actor) => withTransaction(async (createRequest) => {
  const codigo = leerCodigo(codMetrica);
  const usuario = actorName(actor);
  const actual = await cargarUno(createRequest, codigo, { lock: true });
  if (actual && igual(actual, data)) return { codMetrica: codigo, cambios: 0, version: actual.version };
  if (actual) {
    if (data.version !== actual.version) {
      throw httpError(409, `${actorName({ usuario: actual.actualizadoPor })} cambió estos puntos mientras los editabas. Vuelve a abrirlos.`);
    }
    if (!data.motivo) throw httpError(400, 'Escribe el motivo del cambio de los puntos acordados.');
    await createRequest()
      .input('cod', sql.NVarChar(30), codigo)
      .input('unidad', sql.NVarChar(10), data.unidad)
      .input('obs', sql.NVarChar(500), data.observaciones)
      .input('usuario', sql.NVarChar(50), usuario)
      .query(`UPDATE dbo.CAL_PUNTOS_ACORDADOS
        SET unidad = @unidad, observaciones = @obs, origen = 'DATAMET', origen_ref = NULL, origen_fecha = NULL,
          version = version + 1, actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
        WHERE cod_metrica = @cod`);
  } else {
    await createRequest()
      .input('cod', sql.NVarChar(30), codigo)
      .input('unidad', sql.NVarChar(10), data.unidad)
      .input('obs', sql.NVarChar(500), data.observaciones)
      .input('usuario', sql.NVarChar(50), usuario)
      .query(`INSERT INTO dbo.CAL_PUNTOS_ACORDADOS (cod_metrica, unidad, origen, observaciones, registrado_por)
        VALUES (@cod, @unidad, 'DATAMET', @obs, @usuario)`);
  }
  await escribirCargas(createRequest, codigo, data);
  await registrarHistorial(createRequest, codigo, 'EDICION', actual, data, data.motivo, usuario);
  return { codMetrica: codigo, cambios: 1, version: actual ? actual.version + 1 : 1 };
});

/**
 * Carga inicial (script): crea los que aún no existen; nunca pisa lo que ya
 * está en DataMET+. `puntos`: { codMetrica, unidad, origen, origenRef,
 * origenFecha, excentricidad, repetibilidad, errores }.
 */
const importarPuntos = async (puntos, actor) => withTransaction(async (createRequest) => {
  const usuario = actorName(actor);
  const actual = await cargarUno(createRequest, puntos.codMetrica, { lock: true });
  if (actual) return false;
  await createRequest()
    .input('cod', sql.NVarChar(30), puntos.codMetrica)
    .input('unidad', sql.NVarChar(10), puntos.unidad)
    .input('origen', sql.VarChar(10), puntos.origen)
    .input('ref', sql.NVarChar(50), puntos.origenRef)
    .input('fecha', sql.Date, puntos.origenFecha)
    .input('usuario', sql.NVarChar(50), usuario)
    .query(`INSERT INTO dbo.CAL_PUNTOS_ACORDADOS (cod_metrica, unidad, origen, origen_ref, origen_fecha, registrado_por)
      VALUES (@cod, @unidad, @origen, @ref, @fecha, @usuario)`);
  await escribirCargas(createRequest, puntos.codMetrica, puntos);
  await registrarHistorial(createRequest, puntos.codMetrica, 'CARGA_INICIAL', null, puntos,
    `Carga inicial desde ${puntos.origen === 'ICLI' ? 'Access (ICLI)' : `DATA_SERVICIOS_LEC (${puntos.origenRef || 'sin SECA'})`}`, usuario);
  return true;
});

module.exports = {
  ENSAYOS,
  agrupar,
  cargarTodos,
  getPuntos,
  importarPuntos,
  normalizarCodigo,
  savePuntos,
};
