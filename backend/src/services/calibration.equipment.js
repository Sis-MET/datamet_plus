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

/** Resumen legible de lo que cambió: "Planta: La Paz → Santa Cruz". */
const describeChanges = (before, after, labels) => Object.entries(labels)
  .filter(([key]) => String(before[key] ?? '') !== String(after[key] ?? ''))
  .map(([key, label]) => `${label}: ${before[key] || '—'} → ${after[key] || '—'}`)
  .join('; ');

const DATOS_LABELS = { codigo: 'Código', instrumento: 'Instrumento', planta: 'Planta', observaciones: 'Observaciones' };
const CERT_LABELS = { numero: 'Número', fecha: 'Emisión', periodoDias: 'Vigencia (días)', ente: 'Ente' };

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

const logAction = (createRequest, equipoId, accion, detalle, usuario) => createRequest()
  .input('eid', sql.Int, equipoId)
  .input('accion', sql.VarChar(20), accion)
  .input('detalle', sql.NVarChar(400), detalle ? String(detalle).slice(0, 400) : null)
  .input('usuario', sql.NVarChar(50), usuario)
  .query(`
    INSERT INTO dbo.CAL_EQUIPOS_HISTORIAL (equipo_id, accion, detalle, usuario)
    VALUES (@eid, @accion, @detalle, @usuario)
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
    who.usuario
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
  await logAction(createRequest, id, 'EDICION', changes, who.usuario);
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
    who.usuario
  );
  return { id, vence };
});

/** Corrige un error en el certificado vigente sin crear uno nuevo. */
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

  const changes = describeChanges(certFromEquipo(equipo), data, CERT_LABELS);
  if (!changes && String(data.observaciones || '') === '') return { id, cambios: 0 };

  await writeCurrentCertificate(createRequest, id, data, null);
  await createRequest()
    .input('cid', sql.Int, currentId)
    .input('numero', sql.NVarChar(100), data.numero)
    .input('fecha', sql.Date, data.fecha)
    .input('periodo', sql.Int, data.periodoDias)
    .input('vence', sql.Date, expiryDate(data.fecha, data.periodoDias))
    .input('ente', sql.NVarChar(50), data.ente)
    .input('obs', sql.NVarChar(300), data.observaciones || null)
    .query(`
      UPDATE dbo.CAL_CERTIFICADOS
      SET certificado = @numero, cert_fecha = @fecha, cert_periodo = @periodo,
        cert_fechaven = @vence, ente_calibrador = @ente,
        observaciones = COALESCE(@obs, observaciones)
      WHERE id = @cid
    `);
  await logAction(createRequest, id, 'CORRECCION', changes || 'Observaciones del certificado', who.usuario);
  return { id, cambios: 1 };
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
    who.usuario
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
  await logAction(createRequest, id, activo ? 'REACTIVACION' : 'BAJA', motivo || null, who.usuario);
  return { id, estado: activo ? ESTADO_ACTIVO : ESTADO_BAJA };
});

/** Ficha histórica de un equipo: certificados, verificaciones y bitácora. */
const getEquipoHistorial = async (id) => {
  const createRequest = () => getPool().request();
  const equipo = await loadEquipo(createRequest, id);
  const [certificados, actividad, verificaciones] = await Promise.all([
    createRequest().input('eid', sql.Int, id).query(`
      SELECT id, certificado, CONVERT(varchar(10), cert_fecha, 23) AS cert_fecha, cert_periodo,
        CONVERT(varchar(10), cert_fechaven, 23) AS cert_fechaven, ente_calibrador, observaciones,
        origen, anulado, motivo_anulacion, anulado_por,
        CONVERT(varchar(19), anulado_en, 126) AS anulado_en,
        registrado_por, CONVERT(varchar(19), registrado_en, 126) AS registrado_en
      FROM dbo.CAL_CERTIFICADOS
      WHERE equipo_id = @eid
      ORDER BY cert_fecha DESC, id DESC
    `),
    createRequest().input('eid', sql.Int, id).query(`
      SELECT TOP 60 id, accion, detalle, usuario, CONVERT(varchar(19), fecha, 126) AS fecha
      FROM dbo.CAL_EQUIPOS_HISTORIAL
      WHERE equipo_id = @eid
      ORDER BY fecha DESC, id DESC
    `),
    createRequest().input('serie', sql.VarChar(30), `VER-${id}`).query(`
      SELECT CONVERT(varchar(10), fecha_programada, 23) AS fecha_programada,
        CONVERT(varchar(10), fecha_realizada, 23) AS fecha_realizada,
        resultado, observaciones, actualizado_por
      FROM dbo.CAL_EVENTOS
      WHERE serie = @serie AND estado = 'REALIZADO'
      ORDER BY fecha_realizada DESC
    `),
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
    vigente: false,
  }));

  // El vigente es el que coincide con DATA_EQUIPOS_CAL. Si otro sistema lo
  // cambió y aún no está en el historial, se muestra igual.
  if (equipo.certFecha) {
    const vigente = lista.find(item => !item.anulado && item.fecha === equipo.certFecha
      && (item.numero || '') === (equipo.certificado || ''));
    if (vigente) {
      vigente.vigente = true;
    } else {
      lista.unshift({
        id: null,
        ...certFromEquipo(equipo),
        vence: expiryDate(equipo.certFecha, equipo.periodoDias),
        observaciones: null,
        origen: 'EXTERNO',
        anulado: false,
        registradoPor: equipo.registradoPor,
        registradoEn: equipo.registradoEn,
        vigente: true,
      });
    }
  }
  const anteriores = lista.filter(item => !item.anulado && !item.vigente);

  return {
    equipo,
    puedeAnular: Boolean(equipo.certFecha) && anteriores.some(item => item.fecha < equipo.certFecha),
    certificados: lista,
    verificaciones: verificaciones.recordset.map(row => ({
      fechaProgramada: row.fecha_programada,
      fechaRealizada: row.fecha_realizada,
      resultado: row.resultado,
      observaciones: clean(row.observaciones),
      registradoPor: clean(row.actualizado_por),
    })),
    actividad: actividad.recordset.map(row => ({
      id: row.id,
      accion: row.accion,
      detalle: clean(row.detalle),
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
  createEquipo,
  updateEquipoDatos,
  registrarCertificado,
  corregirCertificado,
  anularCertificado,
  cambiarEstado,
  getEquipoHistorial,
};
