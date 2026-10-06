/**
 * Registro de fallas del sistema (NB/ISO/IEC 17025, 7.11.3 e). Los errores
 * del servidor y de las tareas programadas se guardan solos; las fallas que
 * la aplicación no puede ver (servidor caído, red) se registran a mano. Cada
 * falla se cierra con su acción inmediata y su acción correctiva.
 */
const crypto = require('node:crypto');
const { getPool, sql } = require('../config/db');
const { actorName, clean, httpError, withTransaction } = require('./calibration.db');

const ABIERTAS = ['ABIERTA', 'EN_CURSO'];

// Ids y números cambian entre repeticiones de una misma falla.
const generalize = (text) => String(text || '')
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':uuid')
  .replace(/\d+/g, ':n')
  .slice(0, 300);

/** Huella que agrupa las repeticiones de una falla mientras sigue abierta. */
const fingerprint = ({ origen, ruta, mensaje }) => crypto
  .createHash('sha1')
  .update([origen, generalize(ruta), generalize(mensaje)].join('|'))
  .digest('hex');

/** «PUT /api/calibracion/equipos/:id»: sin la consulta ni los ids. */
const routeOf = (req) => {
  if (!req) return null;
  const path = String(req.originalUrl || req.url || '').split('?')[0].replace(/\/\d+(?=\/|$)/g, '/:id');
  return `${req.method} ${path}`.slice(0, 300);
};

/**
 * Guarda una falla. Nunca lanza: si la base no responde, la falla queda solo
 * en la consola y se puede registrar a mano después. No guarda el cuerpo de
 * la petición (podría traer contraseñas).
 */
const recordFailure = async ({ origen = 'SERVIDOR', error = null, req = null, mensaje = null }) => {
  try {
    const message = String(mensaje || error?.message || 'Error sin mensaje').slice(0, 500);
    const ruta = routeOf(req);
    const status = Number(error?.statusCode) || (origen === 'SERVIDOR' ? 500 : null);
    await getPool().request()
      .input('origen', sql.VarChar(20), origen)
      .input('huella', sql.Char(40), fingerprint({ origen, ruta, mensaje: message }))
      .input('mensaje', sql.NVarChar(500), message)
      .input('detalle', sql.NVarChar(sql.MAX), error?.stack ? String(error.stack).slice(0, 8000) : null)
      .input('ruta', sql.NVarChar(300), ruta)
      .input('status', sql.Int, status)
      .input('usuario', sql.NVarChar(50), req?.user?.usuario ? String(req.user.usuario).slice(0, 50) : null)
      .query(`
        UPDATE dbo.APP_FALLAS WITH (UPDLOCK, SERIALIZABLE)
        SET ocurrencias = ocurrencias + 1, ultima_vez = SYSUTCDATETIME(),
          detalle = COALESCE(@detalle, detalle), usuario = COALESCE(@usuario, usuario)
        WHERE huella = @huella AND estado IN ('ABIERTA', 'EN_CURSO');

        IF @@ROWCOUNT = 0
          INSERT INTO dbo.APP_FALLAS (origen, huella, mensaje, detalle, ruta, estado_http, usuario)
          VALUES (@origen, @huella, @mensaje, @detalle, @ruta, @status, @usuario);
      `);
  } catch (logError) {
    console.error('No se pudo registrar la falla en APP_FALLAS:', logError.message);
  }
};

const utc = (value) => (value ? `${value}Z` : null);

const FALLA_SELECT = `
  SELECT f.id, f.origen, f.mensaje, f.ruta, f.estado_http, f.usuario, f.ocurrencias,
    CONVERT(varchar(19), f.primera_vez, 126) AS primera_vez,
    CONVERT(varchar(19), f.ultima_vez, 126) AS ultima_vez,
    f.estado, f.impacto, f.accion_inmediata, f.causa, f.accion_correctiva,
    f.cambio_id, c.codigo AS cambio_codigo, c.titulo AS cambio_titulo,
    f.registrado_por, f.atendido_por, CONVERT(varchar(19), f.atendido_en, 126) AS atendido_en,
    f.cerrado_por, CONVERT(varchar(19), f.cerrado_en, 126) AS cerrado_en
  FROM dbo.APP_FALLAS f
  LEFT JOIN dbo.APP_CAMBIOS c ON c.id = f.cambio_id`;

const mapFalla = (row) => ({
  id: row.id,
  origen: row.origen,
  mensaje: clean(row.mensaje),
  ruta: clean(row.ruta),
  estadoHttp: row.estado_http,
  usuario: clean(row.usuario),
  ocurrencias: row.ocurrencias,
  primeraVez: utc(row.primera_vez),
  ultimaVez: utc(row.ultima_vez),
  estado: row.estado,
  impacto: clean(row.impacto),
  accionInmediata: clean(row.accion_inmediata),
  causa: clean(row.causa),
  accionCorrectiva: clean(row.accion_correctiva),
  cambio: row.cambio_id ? { id: row.cambio_id, codigo: row.cambio_codigo, titulo: clean(row.cambio_titulo) } : null,
  registradoPor: clean(row.registrado_por),
  atendidoPor: clean(row.atendido_por),
  atendidoEn: utc(row.atendido_en),
  cerradoPor: clean(row.cerrado_por),
  cerradoEn: utc(row.cerrado_en),
  abierta: ABIERTAS.includes(row.estado),
});

/** Las abiertas primero; después las más recientes. */
const listFallas = async () => {
  const result = await getPool().request().query(`
    SELECT TOP 300 * FROM (${FALLA_SELECT}) f
    ORDER BY CASE WHEN f.estado IN ('ABIERTA', 'EN_CURSO') THEN 0 ELSE 1 END, f.ultima_vez DESC
  `);
  return result.recordset.map(mapFalla);
};

const getResumenFallas = async () => {
  const result = await getPool().request().query(`
    SELECT
      SUM(CASE WHEN estado = 'ABIERTA' THEN 1 ELSE 0 END) AS abiertas,
      SUM(CASE WHEN estado = 'EN_CURSO' THEN 1 ELSE 0 END) AS enCurso
    FROM dbo.APP_FALLAS
  `);
  const row = result.recordset[0] || {};
  return { abiertas: Number(row.abiertas) || 0, enCurso: Number(row.enCurso) || 0 };
};

const loadFalla = async (createRequest, id, { lock = false } = {}) => {
  const result = await createRequest()
    .input('id', sql.Int, id)
    .query(`${FALLA_SELECT.replace('FROM dbo.APP_FALLAS f', `FROM dbo.APP_FALLAS f${lock ? ' WITH (UPDLOCK, HOLDLOCK)' : ''}`)} WHERE f.id = @id`);
  if (!result.recordset[0]) throw httpError(404, 'La falla no existe.');
  return mapFalla(result.recordset[0]);
};

const getFalla = async (id) => {
  const createRequest = () => getPool().request();
  const [falla, detalle] = await Promise.all([
    loadFalla(createRequest, id),
    createRequest().input('id', sql.Int, id).query('SELECT detalle FROM dbo.APP_FALLAS WHERE id = @id'),
  ]);
  return { ...falla, detalle: detalle.recordset[0]?.detalle || null };
};

/** Falla que la aplicación no pudo registrar sola (p. ej. el servidor estuvo caído). */
const createFalla = async (data, actor) => {
  const usuario = actorName(actor);
  const result = await getPool().request()
    .input('mensaje', sql.NVarChar(500), data.mensaje)
    .input('impacto', sql.NVarChar(500), data.impacto)
    .input('inmediata', sql.NVarChar(1000), data.accionInmediata)
    .input('ocurrida', sql.DateTime2, new Date(data.ocurrida))
    .input('usuario', sql.NVarChar(50), usuario)
    .input('estado', sql.VarChar(20), data.accionInmediata ? 'EN_CURSO' : 'ABIERTA')
    .query(`
      INSERT INTO dbo.APP_FALLAS
        (origen, mensaje, impacto, accion_inmediata, primera_vez, ultima_vez, estado, registrado_por,
         atendido_por, atendido_en)
      OUTPUT INSERTED.id
      VALUES ('MANUAL', @mensaje, @impacto, @inmediata, @ocurrida, @ocurrida, @estado, @usuario,
        CASE WHEN @inmediata IS NULL THEN NULL ELSE @usuario END,
        CASE WHEN @inmediata IS NULL THEN NULL ELSE SYSUTCDATETIME() END)
    `);
  return { id: result.recordset[0].id };
};

/**
 * Registra el análisis y las acciones de una falla. Cerrarla exige la acción
 * inmediata y la correctiva; descartarla, el motivo. Una falla cerrada o
 * descartada ya no se modifica.
 */
const atenderFalla = async (id, data, actor) => withTransaction(async (createRequest) => {
  const falla = await loadFalla(createRequest, id, { lock: true });
  if (!falla.abierta) throw httpError(409, 'La falla ya está cerrada; su registro no se modifica.');
  if (data.cambioId != null) {
    const cambio = await createRequest().input('cid', sql.Int, data.cambioId).query('SELECT id FROM dbo.APP_CAMBIOS WHERE id = @cid');
    if (!cambio.recordset[0]) throw httpError(400, 'El cambio elegido no existe.');
  }
  const usuario = actorName(actor);
  const cierra = !ABIERTAS.includes(data.estado);
  await createRequest()
    .input('id', sql.Int, id)
    .input('estado', sql.VarChar(20), data.estado)
    .input('impacto', sql.NVarChar(500), data.impacto)
    .input('inmediata', sql.NVarChar(1000), data.accionInmediata)
    .input('causa', sql.NVarChar(1000), data.causa)
    .input('correctiva', sql.NVarChar(1000), data.accionCorrectiva)
    .input('cambio', sql.Int, data.cambioId)
    .input('usuario', sql.NVarChar(50), usuario)
    .input('cierra', sql.Bit, cierra)
    .query(`
      UPDATE dbo.APP_FALLAS
      SET estado = @estado, impacto = @impacto, accion_inmediata = @inmediata, causa = @causa,
        accion_correctiva = @correctiva, cambio_id = @cambio,
        atendido_por = COALESCE(atendido_por, @usuario),
        atendido_en = COALESCE(atendido_en, SYSUTCDATETIME()),
        cerrado_por = CASE WHEN @cierra = 1 THEN @usuario ELSE NULL END,
        cerrado_en = CASE WHEN @cierra = 1 THEN SYSUTCDATETIME() ELSE NULL END
      WHERE id = @id
    `);
  return { id, estado: data.estado };
});

module.exports = {
  atenderFalla,
  createFalla,
  fingerprint,
  getFalla,
  getResumenFallas,
  listFallas,
  recordFailure,
  routeOf,
};
