/**
 * Gestión de los equipos de calibración: alta, edición, certificados, bajas
 * e historial.
 *
 * DATA_EQUIPOS_CAL guarda una fila por equipo con su certificado vigente y
 * no tiene clave primaria. Se escribe con las mismas convenciones que ya
 * usa: id = siguiente número, reg_usuario = iniciales de DATA_USERS,
 * reg_fecha = día del registro, estado ACTIVO / DESACTIVADO. Cada cambio de
 * certificado queda además en CAL_CERTIFICADOS y cada operación en
 * CAL_EQUIPOS_HISTORIAL.
 */
const { getPool, sql } = require('../config/db');
const { addDays, todayLocal } = require('./calibration.schedule');
const {
  EQUIPO_SELECT,
  actorName,
  clean,
  httpError,
  mapEquipo,
  withTransaction,
} = require('./calibration.db');
const { conflictingAuthor, describeChanges } = require('./calibration.history');

const ESTADO_ACTIVO = 'ACTIVO';
// DESACTIVADO es el valor que ya usan DATA_USERS y DATA_ACTIVOS; "BAJA
// DEFINITIVA" no cabe en estado (nvarchar 12).
const ESTADO_BAJA = 'DESACTIVADO';

// ─── Reglas puras ──────────────────────────────────────────────────────────

/** Código comparable: sin espacios de no separación ni distinción de mayúsculas. */
const normalizeCode = (value) => String(value ?? '').replace(/\u00a0/g, ' ').trim().toUpperCase();

const CODE_SQL = `UPPER(LTRIM(RTRIM(REPLACE(cod_instrumento, NCHAR(160), N' '))))`;

const formatIso = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const expiryDate = (fecha, periodoDias) => (fecha && periodoDias > 0 ? addDays(fecha, periodoDias) : null);

/**
 * Un certificado nuevo debe ser posterior al vigente y no estar en el futuro.
 * Devuelve el mensaje de error o null.
 */
const checkNewCertificate = (current, next, hoy) => {
  if (next.fecha > hoy) return 'La fecha de emisión no puede ser posterior a hoy.';
  if (current?.certFecha && next.fecha <= current.certFecha) {
    return `La emisión debe ser posterior a la del certificado vigente (${formatIso(current.certFecha)}). `
      + 'Si el vigente tiene un error, corrígelo en lugar de registrar uno nuevo.';
  }
  return null;
};

const DATOS_LABELS = { codigo: 'Código', instrumento: 'Instrumento', planta: 'Planta', observaciones: 'Observaciones' };
const CERT_LABELS = { numero: 'Número', fecha: 'Emisión', periodoDias: 'Vigencia (días)', ente: 'Ente' };
const CERT_CORRECTION_LABELS = { ...CERT_LABELS, observaciones: 'Observaciones' };
const formatCertValue = (key, value) => {
  if (key === 'fecha') return formatIso(value);
  if (key === 'observaciones') return String(value).length > 60 ? `«${String(value).slice(0, 59)}…»` : `«${value}»`;
  return value;
};

/** Versión completa de un certificado para el historial. */
const certVersion = (cert) => (cert ? {
  numero: cert.numero || null,
  fecha: cert.fecha || null,
  periodoDias: cert.periodoDias ?? null,
  vence: expiryDate(cert.fecha, cert.periodoDias),
  ente: cert.ente || null,
  observaciones: cert.observaciones || null,
} : null);

const datosVersion = (datos) => ({
  codigo: datos.codigo || null,
  instrumento: datos.instrumento || null,
  planta: datos.planta || null,
  observaciones: datos.observaciones || null,
});

const certFromEquipo = (equipo) => ({
  numero: equipo.certificado,
  fecha: equipo.certFecha,
  periodoDias: equipo.periodoDias,
  ente: equipo.enteCalibrador,
});

// ─── Acceso a datos ────────────────────────────────────────────────────────

/** Iniciales del usuario (convención de reg_usuario) y su nombre de usuario. */
const findActor = async (createRequest, actor) => {
  const id = Number(actor?.id);
  let inicial = null;
  if (Number.isInteger(id)) {
    const result = await createRequest()
      .input('uid', sql.Int, id)
      .query('SELECT TOP 1 LTRIM(RTRIM(inicial)) AS inicial FROM DATA_USERS WHERE id = @uid');
    inicial = clean(result.recordset[0]?.inicial);
  }
  return { registro: (inicial || actorName(actor)).slice(0, 50), usuario: actorName(actor) };
};

/** Carga un equipo (bloqueado dentro de una transacción si se pide). */
const loadEquipo = async (createRequest, id, { lock = false } = {}) => {
  const result = await createRequest()
    .input('eid', sql.Int, id)
    .query(`${EQUIPO_SELECT.replace('FROM DATA_EQUIPOS_CAL', `FROM DATA_EQUIPOS_CAL${lock ? ' WITH (UPDLOCK, HOLDLOCK)' : ''}`)}
      WHERE id = @eid`);
  if (result.recordset.length === 0) throw httpError(404, 'El equipo no existe.');
  if (result.recordset.length > 1) {
    throw httpError(409, `Hay ${result.recordset.length} registros con el id ${id} en DATA_EQUIPOS_CAL. Corrígelos antes de modificar el equipo.`);
  }
  return mapEquipo(result.recordset[0]);
};

const assertActive = (equipo) => {
  if (equipo.estado !== ESTADO_ACTIVO) {
    throw httpError(409, `${equipo.codigo} está dado de baja. Reactívalo para modificarlo.`);
  }
};

const assertCodeAvailable = async (createRequest, codigo, excludeId = null) => {
  const result = await createRequest()
    .input('code', sql.NVarChar(30), normalizeCode(codigo))
    .input('exclude', sql.Int, excludeId)
    .query(`
      SELECT TOP 1 id, LTRIM(RTRIM(estado)) AS estado FROM DATA_EQUIPOS_CAL WITH (UPDLOCK, HOLDLOCK)
      WHERE ${CODE_SQL} = @code AND (@exclude IS NULL OR id <> @exclude)
    `);
  const existing = result.recordset[0];
  if (existing) {
    const baja = String(existing.estado || '').toUpperCase() !== ESTADO_ACTIVO;
    throw httpError(409, baja
      ? `Ya existe un equipo dado de baja con el código ${clean(codigo)}. Reactívalo en lugar de registrarlo de nuevo.`
      : `Ya existe un equipo con el código ${clean(codigo)}.`);
  }
};

/** Bitácora del equipo; `extra` guarda las versiones completas y el motivo. */
const logAction = (createRequest, equipoId, accion, detalle, usuario, extra = {}) => createRequest()
  .input('eid', sql.Int, equipoId)
  .input('accion', sql.VarChar(20), accion)
  .input('detalle', sql.NVarChar(400), detalle ? String(detalle).slice(0, 400) : null)
  .input('usuario', sql.NVarChar(50), usuario)
  .input('antes', sql.NVarChar(sql.MAX), extra.antes ? JSON.stringify(extra.antes) : null)
  .input('despues', sql.NVarChar(sql.MAX), extra.despues ? JSON.stringify(extra.despues) : null)
  .input('motivo', sql.NVarChar(300), extra.motivo || null)
  .query(`
    INSERT INTO dbo.CAL_EQUIPOS_HISTORIAL (equipo_id, accion, detalle, usuario, antes, despues, motivo)
    VALUES (@eid, @accion, @detalle, @usuario, @antes, @despues, @motivo)
  `);

const insertCertificate = (createRequest, equipoId, cert, { origen, usuario }) => createRequest()
  .input('eid', sql.Int, equipoId)
  .input('numero', sql.NVarChar(100), cert.numero || null)
  .input('fecha', sql.Date, cert.fecha)
  .input('periodo', sql.Int, cert.periodoDias ?? null)
  .input('vence', sql.Date, expiryDate(cert.fecha, cert.periodoDias))
  .input('ente', sql.NVarChar(50), cert.ente || null)
  .input('obs', sql.NVarChar(300), cert.observaciones || null)
  .input('origen', sql.VarChar(10), origen)
  .input('usuario', sql.NVarChar(50), usuario)
  .query(`
    INSERT INTO dbo.CAL_CERTIFICADOS
      (equipo_id, certificado, cert_fecha, cert_periodo, cert_fechaven, ente_calibrador,
       observaciones, origen, registrado_por)
    VALUES (@eid, @numero, @fecha, @periodo, @vence, @ente, @obs, @origen, @usuario)
  `);

/** Fila del historial que corresponde al certificado vigente del equipo. */
const findCurrentCertificate = async (createRequest, equipo) => {
  if (!equipo.certFecha) return null;
  const result = await createRequest()
    .input('eid', sql.Int, equipo.id)
    .input('fecha', sql.Date, equipo.certFecha)
    .input('numero', sql.NVarChar(100), equipo.certificado || '')
    .query(`
      SELECT TOP 1 id FROM dbo.CAL_CERTIFICADOS WITH (UPDLOCK)
      WHERE equipo_id = @eid AND cert_fecha = @fecha AND anulado = 0
        AND ISNULL(certificado, '') = @numero
      ORDER BY id DESC
    `);
  return result.recordset[0]?.id ?? null;
};

/**
 * Si otro sistema cambió el certificado en DATA_EQUIPOS_CAL, se archiva antes
 * de reemplazarlo para no perderlo.
 */
const archiveCurrentIfMissing = async (createRequest, equipo, usuario) => {
  if (!equipo.certFecha) return null;
  const existing = await findCurrentCertificate(createRequest, equipo);
  if (existing) return existing;
  await insertCertificate(createRequest, equipo.id, certFromEquipo(equipo), { origen: 'EXTERNO', usuario });
  return findCurrentCertificate(createRequest, equipo);
};

/**
 * Escribe el certificado vigente en DATA_EQUIPOS_CAL. Con `registro` también
 * actualiza quién y cuándo lo registró (al renovar, no al corregir).
 */
const writeCurrentCertificate = (createRequest, equipoId, cert, registro) => {
  const request = createRequest()
    .input('eid', sql.Int, equipoId)
    .input('numero', sql.NVarChar(100), cert.numero || null)
    .input('fecha', sql.Date, cert.fecha || null)
    .input('periodo', sql.Int, cert.periodoDias ?? null)
    .input('vence', sql.Date, expiryDate(cert.fecha, cert.periodoDias))
    .input('ente', sql.NVarChar(50), cert.ente || null);
  let stamp = '';
  if (registro) {
    request.input('registro', sql.NVarChar(50), registro.usuario).input('hoy', sql.Date, registro.fecha);
    stamp = ', reg_usuario = @registro, reg_fecha = @hoy';
  }
  return request.query(`
    UPDATE DATA_EQUIPOS_CAL
    SET certificado = @numero, cert_fecha = @fecha, cert_periodo = @periodo,
      ente_calibrador = @ente, cert_fechaven = @vence${stamp}
    WHERE id = @eid
  `);
};

// ─── Operaciones ───────────────────────────────────────────────────────────

const createEquipo = async (data, actor) => withTransaction(async (createRequest) => {
  const hoy = todayLocal();
  const who = await findActor(createRequest, actor);
  await assertCodeAvailable(createRequest, data.codigo);
  if (data.certificado) {
    const error = checkNewCertificate(null, data.certificado, hoy);
    if (error) throw httpError(400, error);
  }

  // Sin identidad ni clave: el siguiente id se reserva bloqueando la tabla
  // hasta terminar la transacción.
  const next = await createRequest().query(`
    SELECT ISNULL(MAX(id), 0) + 1 AS id FROM DATA_EQUIPOS_CAL WITH (TABLOCKX, HOLDLOCK)
  `);
  const id = next.recordset[0].id;
  const cert = data.certificado;

  await createRequest()
    .input('id', sql.Int, id)
    .input('instrumento', sql.NVarChar(30), data.instrumento)
    .input('codigo', sql.NVarChar(30), data.codigo)
    .input('numero', sql.NVarChar(100), cert?.numero || null)
    .input('fecha', sql.Date, cert?.fecha || null)
    .input('periodo', sql.Int, cert?.periodoDias ?? null)
    .input('ente', sql.NVarChar(50), cert?.ente || null)
    .input('registro', sql.NVarChar(50), who.registro)
    .input('estado', sql.NVarChar(12), ESTADO_ACTIVO)
    .input('planta', sql.NVarChar(50), data.planta)
    .input('hoy', sql.Date, hoy)
    .input('obs', sql.NVarChar(200), data.observaciones || null)
    .input('vence', sql.Date, cert ? expiryDate(cert.fecha, cert.periodoDias) : null)
    .query(`
      INSERT INTO DATA_EQUIPOS_CAL
        (id, instrumento, cod_instrumento, certificado, cert_fecha, cert_periodo, ente_calibrador,
         reg_usuario, estado, planta, reg_fecha, obs, cert_fechaven)
      VALUES
        (@id, @instrumento, @codigo, @numero, @fecha, @periodo, @ente,
         @registro, @estado, @planta, @hoy, @obs, @vence)
    `);

  if (cert) await insertCertificate(createRequest, id, cert, { origen: 'MODULO', usuario: who.usuario });
  await logAction(
    createRequest,
    id,
    'ALTA',
    [data.codigo, data.instrumento, data.planta, cert ? `certificado ${cert.numero}` : 'sin certificado'].join(' · '),
    who.usuario,
    { despues: { ...datosVersion(data), certificado: certVersion(cert) } }
  );
  return { id };
});

const updateEquipoDatos = async (id, data, actor) => withTransaction(async (createRequest) => {
  const equipo = await loadEquipo(createRequest, id, { lock: true });
  assertActive(equipo);
  await assertCodeAvailable(createRequest, data.codigo, id);
  const who = await findActor(createRequest, actor);

  const changes = describeChanges(equipo, data, DATOS_LABELS);
  if (!changes) return { id, cambios: 0 };

  await createRequest()
    .input('eid', sql.Int, id)
    .input('instrumento', sql.NVarChar(30), data.instrumento)
    .input('codigo', sql.NVarChar(30), data.codigo)
    .input('planta', sql.NVarChar(50), data.planta)
    .input('obs', sql.NVarChar(200), data.observaciones || null)
    .query(`
      UPDATE DATA_EQUIPOS_CAL
      SET instrumento = @instrumento, cod_instrumento = @codigo, planta = @planta, obs = @obs
      WHERE id = @eid
    `);
  await logAction(createRequest, id, 'EDICION', changes, who.usuario, { antes: datosVersion(equipo), despues: datosVersion(data) });
  return { id, cambios: 1 };
});

/** Renovación: el certificado nuevo pasa a regir y el anterior queda en el historial. */
const registrarCertificado = async (id, data, actor) => withTransaction(async (createRequest) => {
  const hoy = todayLocal();
  const equipo = await loadEquipo(createRequest, id, { lock: true });
  assertActive(equipo);
  const error = checkNewCertificate(equipo, data, hoy);
  if (error) throw httpError(400, error);
  const who = await findActor(createRequest, actor);

  await archiveCurrentIfMissing(createRequest, equipo, who.usuario);
  await writeCurrentCertificate(createRequest, id, data, { usuario: who.registro, fecha: hoy });
  await insertCertificate(createRequest, id, data, { origen: 'MODULO', usuario: who.usuario });
  const vence = expiryDate(data.fecha, data.periodoDias);
  await logAction(
    createRequest,
    id,
    'CERTIFICADO',
    `${data.numero} · emitido ${formatIso(data.fecha)} · vence ${formatIso(vence)}${equipo.certificado ? ` · reemplaza ${equipo.certificado}` : ''}`,
    who.usuario,
    { antes: equipo.certFecha ? certVersion(certFromEquipo(equipo)) : null, despues: certVersion(data) }
  );
  return { id, vence };
});

/**
 * Quién transcribió los valores del certificado (migración 016); null si no
 * hay valores o la migración aún no se aplicó.
 */
const findTranscriptor = async (createRequest, certificadoId) => {
  if (!certificadoId) return null;
  const result = await createRequest()
    .input('cid', sql.Int, certificadoId)
    .query(`
      IF OBJECT_ID('dbo.CAL_CERT_TRANSCRIPCION', 'U') IS NOT NULL
        SELECT transcrito_por FROM dbo.CAL_CERT_TRANSCRIPCION WHERE certificado_id = @cid
    `);
  return clean(result.recordset?.[0]?.transcrito_por);
};

/** Fila del historial con todos sus datos. */
const loadCertificateRow = async (createRequest, certId) => {
  const result = await createRequest()
    .input('cid', sql.Int, certId)
    .query(`
      SELECT id, certificado, CONVERT(varchar(10), cert_fecha, 23) AS cert_fecha, cert_periodo,
        ente_calibrador, observaciones, registrado_por, corregido_por, revisado_por
      FROM dbo.CAL_CERTIFICADOS WITH (UPDLOCK) WHERE id = @cid
    `);
  const row = result.recordset[0];
  return row ? {
    id: row.id,
    numero: clean(row.certificado),
    fecha: row.cert_fecha,
    periodoDias: row.cert_periodo,
    ente: clean(row.ente_calibrador),
    observaciones: clean(row.observaciones),
    registradoPor: clean(row.registrado_por),
    corregidoPor: clean(row.corregido_por),
    revisadoPor: clean(row.revisado_por),
  } : null;
};

/**
 * Corrige un error en el certificado vigente sin crear uno nuevo. La versión
 * anterior queda completa en el historial con el motivo, y la revisión vuelve
 * a quedar pendiente.
 */
const corregirCertificado = async (id, data, actor) => withTransaction(async (createRequest) => {
  const hoy = todayLocal();
  const equipo = await loadEquipo(createRequest, id, { lock: true });
  assertActive(equipo);
  if (!equipo.certFecha) throw httpError(409, 'El equipo no tiene certificado. Registra uno nuevo.');
  if (data.fecha > hoy) throw httpError(400, 'La fecha de emisión no puede ser posterior a hoy.');
  const who = await findActor(createRequest, actor);

  const currentId = await archiveCurrentIfMissing(createRequest, equipo, who.usuario);
  const previous = await createRequest()
    .input('eid', sql.Int, id)
    .input('actual', sql.Int, currentId)
    .query(`
      SELECT TOP 1 CONVERT(varchar(10), cert_fecha, 23) AS cert_fecha
      FROM dbo.CAL_CERTIFICADOS
      WHERE equipo_id = @eid AND anulado = 0 AND id <> @actual
      ORDER BY cert_fecha DESC, id DESC
    `);
  const anterior = previous.recordset[0]?.cert_fecha;
  if (anterior && data.fecha <= anterior) {
    throw httpError(400, `La emisión debe ser posterior a la del certificado anterior (${formatIso(anterior)}).`);
  }

  const current = await loadCertificateRow(createRequest, currentId);
  const before = certVersion(current);
  // Sin observaciones nuevas se conservan las que tenía.
  const after = certVersion({ ...data, observaciones: data.observaciones ?? current.observaciones });
  const changes = describeChanges(before, after, CERT_CORRECTION_LABELS, formatCertValue);
  if (!changes) return { id, cambios: 0 };

  await writeCurrentCertificate(createRequest, id, data, null);
  await createRequest()
    .input('cid', sql.Int, currentId)
    .input('numero', sql.NVarChar(100), after.numero)
    .input('fecha', sql.Date, after.fecha)
    .input('periodo', sql.Int, after.periodoDias)
    .input('vence', sql.Date, after.vence)
    .input('ente', sql.NVarChar(50), after.ente)
    .input('obs', sql.NVarChar(300), after.observaciones)
    .input('usuario', sql.NVarChar(50), who.usuario)
    .query(`
      UPDATE dbo.CAL_CERTIFICADOS
      SET certificado = @numero, cert_fecha = @fecha, cert_periodo = @periodo,
        cert_fechaven = @vence, ente_calibrador = @ente, observaciones = @obs,
        corregido_por = @usuario, corregido_en = SYSUTCDATETIME(),
        revisado_por = NULL, revisado_en = NULL, revision_obs = NULL
      WHERE id = @cid
    `);
  await logAction(createRequest, id, 'CORRECCION', changes, who.usuario, { antes: before, despues: after, motivo: data.motivo });
  return { id, cambios: 1 };
});

/**
 * Un segundo usuario compara el certificado vigente con el original (7.5.1 y
 * 7.11.6). Quien lo registró o lo corrigió no puede revisarlo.
 */
const revisarCertificado = async (id, { observaciones }, actor) => withTransaction(async (createRequest) => {
  const equipo = await loadEquipo(createRequest, id, { lock: true });
  assertActive(equipo);
  if (!equipo.certFecha) throw httpError(409, 'El equipo no tiene certificado que revisar.');
  const who = await findActor(createRequest, actor);

  // Si otro sistema lo cambió, se archiva sin autor: no lo registró quien revisa.
  const currentId = await archiveCurrentIfMissing(createRequest, equipo, null);
  const current = await loadCertificateRow(createRequest, currentId);
  if (current.revisadoPor) throw httpError(409, `Este certificado ya lo revisó ${current.revisadoPor}.`);
  const transcriptor = await findTranscriptor(createRequest, currentId);
  if (conflictingAuthor([who.usuario, who.registro], [current.registradoPor, current.corregidoPor, transcriptor])) {
    throw httpError(409, 'La revisión la debe hacer otra persona: tú registraste, corregiste o transcribiste los valores de este certificado.');
  }

  await createRequest()
    .input('cid', sql.Int, currentId)
    .input('usuario', sql.NVarChar(50), who.usuario)
    .input('obs', sql.NVarChar(300), observaciones || null)
    .query(`
      UPDATE dbo.CAL_CERTIFICADOS
      SET revisado_por = @usuario, revisado_en = SYSUTCDATETIME(), revision_obs = @obs
      WHERE id = @cid
    `);
  await logAction(
    createRequest,
    id,
    'REVISION',
    `${current.numero || 'Certificado'} revisado contra el original${observaciones ? `: ${observaciones}` : ''}`,
    who.usuario,
    { despues: certVersion(current) }
  );
  return { id, revisadoPor: who.usuario };
});

/** Anula el certificado vigente y vuelve a regir el anterior. */
const anularCertificado = async (id, { motivo }, actor) => withTransaction(async (createRequest) => {
  const equipo = await loadEquipo(createRequest, id, { lock: true });
  assertActive(equipo);
  if (!equipo.certFecha) throw httpError(409, 'El equipo no tiene certificado vigente.');
  const who = await findActor(createRequest, actor);

  const currentId = await archiveCurrentIfMissing(createRequest, equipo, who.usuario);
  const previous = await createRequest()
    .input('eid', sql.Int, id)
    .input('actual', sql.Int, currentId)
    .query(`
      SELECT TOP 1 id, certificado, CONVERT(varchar(10), cert_fecha, 23) AS cert_fecha,
        cert_periodo, ente_calibrador
      FROM dbo.CAL_CERTIFICADOS
      WHERE equipo_id = @eid AND anulado = 0 AND id <> @actual
      ORDER BY cert_fecha DESC, id DESC
    `);
  const anterior = previous.recordset[0];
  if (!anterior) {
    throw httpError(409, 'No hay un certificado anterior que pueda volver a regir. Si el vigente tiene un error, corrígelo.');
  }

  await createRequest()
    .input('cid', sql.Int, currentId)
    .input('motivo', sql.NVarChar(300), motivo)
    .input('usuario', sql.NVarChar(50), who.usuario)
    .query(`
      UPDATE dbo.CAL_CERTIFICADOS
      SET anulado = 1, motivo_anulacion = @motivo, anulado_por = @usuario, anulado_en = SYSUTCDATETIME()
      WHERE id = @cid
    `);
  await writeCurrentCertificate(createRequest, id, {
    numero: clean(anterior.certificado),
    fecha: anterior.cert_fecha,
    periodoDias: anterior.cert_periodo,
    ente: clean(anterior.ente_calibrador),
  }, null);
  await logAction(
    createRequest,
    id,
    'ANULACION',
    `${equipo.certificado || 'Certificado'} anulado: ${motivo}. Vuelve a regir ${clean(anterior.certificado) || 'el anterior'}`,
    who.usuario,
    {
      antes: certVersion(certFromEquipo(equipo)),
      despues: certVersion({
        numero: clean(anterior.certificado),
        fecha: anterior.cert_fecha,
        periodoDias: anterior.cert_periodo,
        ente: clean(anterior.ente_calibrador),
      }),
      motivo,
    }
  );
  return { id };
});

/** Baja (sale del plan y de las alertas) o reactivación de un equipo. */
const cambiarEstado = async (id, { activo, motivo }, actor) => withTransaction(async (createRequest) => {
  const equipo = await loadEquipo(createRequest, id, { lock: true });
  const isActive = equipo.estado === ESTADO_ACTIVO;
  if (activo === isActive) {
    throw httpError(409, activo ? `${equipo.codigo} ya está activo.` : `${equipo.codigo} ya está dado de baja.`);
  }
  const who = await findActor(createRequest, actor);
  await createRequest()
    .input('eid', sql.Int, id)
    .input('estado', sql.NVarChar(12), activo ? ESTADO_ACTIVO : ESTADO_BAJA)
    .query('UPDATE DATA_EQUIPOS_CAL SET estado = @estado WHERE id = @eid');
  await logAction(createRequest, id, activo ? 'REACTIVACION' : 'BAJA', motivo || null, who.usuario, { motivo });
  return { id, estado: activo ? ESTADO_ACTIVO : ESTADO_BAJA };
});

/** Revisión del certificado vigente vista por quien consulta. */
const reviewState = (vigente, who) => {
  if (!vigente) return null;
  if (vigente.revisadoPor) {
    return { estado: 'REVISADO', revisadoPor: vigente.revisadoPor, revisadoEn: vigente.revisadoEn, observaciones: vigente.revisionObs };
  }
  const autor = conflictingAuthor([who.usuario, who.registro], [vigente.registradoPor, vigente.corregidoPor, vigente.transcritoPor]);
  return {
    estado: 'PENDIENTE',
    puedeRevisar: !autor,
    motivo: autor ? 'Lo registraste, corregiste o transcribiste tú: debe revisarlo otra persona.' : null,
  };
};

/**
 * Ficha histórica de un equipo: certificados (con su revisión), verificaciones
 * realizadas y una bitácora que une los cambios del equipo, de su plan y de
 * sus fechas.
 */
const getEquipoHistorial = async (id, user = null) => {
  const createRequest = () => getPool().request();
  const equipo = await loadEquipo(createRequest, id);
  const [certificados, actividad, verificaciones, who] = await Promise.all([
    createRequest().input('eid', sql.Int, id).query(`
      SELECT id, certificado, CONVERT(varchar(10), cert_fecha, 23) AS cert_fecha, cert_periodo,
        CONVERT(varchar(10), cert_fechaven, 23) AS cert_fechaven, ente_calibrador, observaciones,
        origen, anulado, motivo_anulacion, anulado_por,
        CONVERT(varchar(19), anulado_en, 126) AS anulado_en,
        registrado_por, CONVERT(varchar(19), registrado_en, 126) AS registrado_en,
        corregido_por, CONVERT(varchar(19), corregido_en, 126) AS corregido_en,
        revisado_por, CONVERT(varchar(19), revisado_en, 126) AS revisado_en, revision_obs
      FROM dbo.CAL_CERTIFICADOS
      WHERE equipo_id = @eid
      ORDER BY cert_fecha DESC, id DESC
    `),
    createRequest()
      .input('eid', sql.Int, id)
      .query(`
        SELECT TOP 80 * FROM (
          SELECT 'EQUIPO' AS fuente, id, CAST(NULL AS varchar(20)) AS tipo, accion, detalle, motivo,
            CAST(NULL AS varchar(10)) AS fecha_programada, usuario, CONVERT(varchar(19), fecha, 126) AS fecha, fecha AS orden
          FROM dbo.CAL_EQUIPOS_HISTORIAL WHERE equipo_id = @eid
          UNION ALL
          SELECT 'PLAN', id, tipo, accion, detalle, NULL, NULL, usuario, CONVERT(varchar(19), fecha, 126), fecha
          FROM dbo.CAL_PLAN_HISTORIAL WHERE equipo_id = @eid AND accion <> 'INICIAL'
          UNION ALL
          SELECT 'FECHA', id, tipo, accion, detalle, motivo, CONVERT(varchar(10), fecha_programada, 23),
            usuario, CONVERT(varchar(19), fecha, 126), fecha
          FROM dbo.CAL_EVENTOS_HISTORIAL WHERE equipo_id = @eid AND accion <> 'INICIAL'
        ) h
        ORDER BY orden DESC, id DESC
      `),
    createRequest().input('serie', sql.VarChar(30), `VER-${id}`).query(`
      SELECT CONVERT(varchar(10), fecha_programada, 23) AS fecha_programada,
        CONVERT(varchar(10), fecha_realizada, 23) AS fecha_realizada,
        resultado, observaciones, registro_ref, actualizado_por, revisado_por,
        CONVERT(varchar(19), revisado_en, 126) AS revisado_en
      FROM dbo.CAL_EVENTOS
      WHERE serie = @serie AND estado = 'REALIZADO'
      ORDER BY fecha_realizada DESC
    `),
    user ? findActor(createRequest, user) : Promise.resolve({ usuario: null, registro: null }),
  ]);

  const utc = (value) => (value ? `${value}Z` : null);
  const lista = certificados.recordset.map(row => ({
    id: row.id,
    numero: clean(row.certificado),
    fecha: row.cert_fecha,
    periodoDias: row.cert_periodo,
    vence: row.cert_fechaven || expiryDate(row.cert_fecha, row.cert_periodo),
    ente: clean(row.ente_calibrador),
    observaciones: clean(row.observaciones),
    origen: row.origen,
    anulado: Boolean(row.anulado),
    motivoAnulacion: clean(row.motivo_anulacion),
    anuladoPor: clean(row.anulado_por),
    anuladoEn: utc(row.anulado_en),
    registradoPor: clean(row.registrado_por),
    registradoEn: utc(row.registrado_en),
    corregidoPor: clean(row.corregido_por),
    corregidoEn: utc(row.corregido_en),
    revisadoPor: clean(row.revisado_por),
    revisadoEn: utc(row.revisado_en),
    revisionObs: clean(row.revision_obs),
    vigente: false,
  }));

  // El vigente es el que coincide con DATA_EQUIPOS_CAL. Si otro sistema lo
  // cambió y aún no está en el historial, se muestra igual.
  let vigente = null;
  if (equipo.certFecha) {
    vigente = lista.find(item => !item.anulado && item.fecha === equipo.certFecha
      && (item.numero || '') === (equipo.certificado || ''));
    if (vigente) {
      vigente.vigente = true;
    } else {
      vigente = {
        id: null,
        ...certFromEquipo(equipo),
        vence: expiryDate(equipo.certFecha, equipo.periodoDias),
        observaciones: null,
        origen: 'EXTERNO',
        anulado: false,
        registradoPor: equipo.registradoPor,
        registradoEn: equipo.registradoEn,
        vigente: true,
      };
      lista.unshift(vigente);
    }
  }
  const anteriores = lista.filter(item => !item.anulado && !item.vigente);
  if (vigente?.id) vigente.transcritoPor = await findTranscriptor(createRequest, vigente.id);

  return {
    equipo,
    puedeAnular: Boolean(equipo.certFecha) && anteriores.some(item => item.fecha < equipo.certFecha),
    revision: reviewState(vigente, who),
    certificados: lista,
    verificaciones: verificaciones.recordset.map(row => ({
      fechaProgramada: row.fecha_programada,
      fechaRealizada: row.fecha_realizada,
      resultado: row.resultado,
      observaciones: clean(row.observaciones),
      registroRef: clean(row.registro_ref),
      registradoPor: clean(row.actualizado_por),
      revisadoPor: clean(row.revisado_por),
      revisadoEn: utc(row.revisado_en),
    })),
    actividad: actividad.recordset.map(row => ({
      id: `${row.fuente}-${row.id}`,
      fuente: row.fuente,
      tipo: row.tipo || null,
      accion: row.accion,
      detalle: clean(row.detalle),
      motivo: clean(row.motivo),
      fechaProgramada: row.fecha_programada || null,
      usuario: clean(row.usuario),
      fecha: utc(row.fecha),
    })),
  };
};

module.exports = {
  ESTADO_ACTIVO,
  ESTADO_BAJA,
  normalizeCode,
  checkNewCertificate,
  describeChanges,
  expiryDate,
  // Para los patrones (calibration.patrones.js).
  archiveCurrentIfMissing,
  assertActive,
  findActor,
  loadEquipo,
  logAction,
  createEquipo,
  updateEquipoDatos,
  registrarCertificado,
  corregirCertificado,
  revisarCertificado,
  anularCertificado,
  cambiarEstado,
  getEquipoHistorial,
};
