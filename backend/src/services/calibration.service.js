const { getPool, sql } = require('../config/db');
const env = require('../config/env');
const {
  activeAlerts,
  addDays,
  addMonths,
  buildOccurrences,
  certificateStatus,
  nextPending,
  resolveAlert,
  serieKey,
  todayLocal,
} = require('./calibration.schedule');
const { buildDigests, renderDigestEmail, normalizeEmail } = require('./calibration.alerts');
const { isMailConfigured, mailStatus, sendMail } = require('./mailer.service');
const {
  EQUIPO_SELECT,
  IS_ACTIVE,
  actorName,
  clean,
  httpError,
  mapEquipo,
  normalizeArea,
  withTransaction,
} = require('./calibration.db');

// Hacia atrás se mira poco más de un año (vencidas sin resolver). Hacia
// adelante, tres años: cubre ventanas de aviso largas y la próxima fecha de
// certificados de dos años.
const ALERT_HORIZON_DAYS = 400;
const NEXT_HORIZON_DAYS = 1100;

// ─── Lecturas ──────────────────────────────────────────────────────────────

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
      resultado, observaciones, actualizado_por,
      CONVERT(varchar(19), actualizado_en, 126)    AS actualizado_en
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
    actualizadoPor: row.actualizado_por,
    actualizadoEn: row.actualizado_en ? `${row.actualizado_en}Z` : null,
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

// ─── Permisos ──────────────────────────────────────────────────────────────

/** Edita el plan el área Calibración y los usuarios de nivel 3. */
const getCalibrationPermissions = async (user) => {
  if (String(user?.acceso_cron) === '3') return { canEdit: true };
  const userId = Number(user?.id);
  if (!Number.isInteger(userId)) return { canEdit: false };
  const result = await getPool().request()
    .input('id', sql.Int, userId)
    .query(`SELECT TOP 1 area FROM DATA_USERS WHERE id = @id AND estado = 'ACTIVO'`);
  return { canEdit: normalizeArea(result.recordset[0]?.area) === 'calibracion' };
};

// ─── Plan ──────────────────────────────────────────────────────────────────

const loadPlanSources = async () => {
  const [equipos, programas, eventos, ajustes] = await Promise.all([
    getEquipos(),
    getProgramas(),
    getEventos(),
    getAjustes(),
  ]);
  return { equipos, programas, eventos, ajustes };
};

const horizonOccurrences = (sources, hoy) => buildOccurrences({
  ...sources,
  desde: addDays(hoy, -ALERT_HORIZON_DAYS),
  hasta: addDays(hoy, NEXT_HORIZON_DAYS),
  hoy,
});

const publicPrograma = (programa) => (programa ? {
  programaId: programa.id,
  activo: programa.activo,
  frecuenciaMeses: programa.frecuenciaMeses,
  fechaInicio: programa.fechaInicio,
  responsableId: programa.responsableId,
  responsableNombre: programa.responsableNombre,
  alertaDias: programa.alertaDias,
  alertaFrecuencia: programa.alertaFrecuencia,
  alertaCorreo: programa.alertaCorreo,
} : null);

const getPlan = async ({ anio, user }) => {
  const hoy = todayLocal();
  const year = Number(anio) || Number(hoy.slice(0, 4));
  const desde = `${year}-01-01`;
  const hasta = `${year}-12-31`;

  const [sources, permisos, bajas, catalogos] = await Promise.all([
    loadPlanSources(),
    getCalibrationPermissions(user),
    getEquiposBaja(),
    getCatalogos(),
  ]);
  const { equipos, programas, ajustes } = sources;
  const eventos = buildOccurrences({ ...sources, desde, hasta, hoy });
  const horizon = horizonOccurrences(sources, hoy);

  const programaPor = new Map(programas.filter(p => p.equipoId != null).map(p => [`${p.tipo}:${p.equipoId}`, p]));

  const equiposPlan = equipos.map((equipo) => {
    const calibracion = programaPor.get(`CALIBRACION:${equipo.id}`) || null;
    const verificacion = programaPor.get(`VERIFICACION:${equipo.id}`) || null;
    const alerta = resolveAlert(calibracion, ajustes);
    return {
      ...equipo,
      ...certificateStatus(equipo, hoy, alerta.dias),
      enPlan: !calibracion || calibracion.activo,
      calibracion: publicPrograma(calibracion),
      verificacion: publicPrograma(verificacion),
      proximaCalibracion: nextPending(horizon, serieKey('CALIBRACION', equipo.id)),
      proximaVerificacion: verificacion?.activo ? nextPending(horizon, serieKey('VERIFICACION', equipo.id)) : null,
    };
  });

  const actividades = programas
    .filter(programa => programa.tipo === 'ACTIVIDAD' && programa.activo)
    .sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), 'es'))
    .map(programa => ({
      id: programa.id,
      titulo: programa.titulo,
      categoria: programa.categoria,
      descripcion: programa.descripcion,
      frecuenciaMeses: programa.frecuenciaMeses ?? 0,
      fechaInicio: programa.fechaInicio,
      responsableId: programa.responsableId,
      responsableNombre: programa.responsableNombre,
      alertaDias: programa.alertaDias,
      alertaFrecuencia: programa.alertaFrecuencia,
      alertaCorreo: programa.alertaCorreo,
      proxima: nextPending(horizon, serieKey('ACTIVIDAD', programa.id)),
    }));

  return {
    anio: year,
    hoy,
    permisos,
    ajustes: {
      alertaDias: ajustes.alertaDias,
      alertaFrecuencia: ajustes.alertaFrecuencia,
      alertaCorreo: ajustes.alertaCorreo,
    },
    equipos: equiposPlan,
    bajas,
    catalogos,
    actividades,
    eventos,
    alertas: activeAlerts(horizon),
  };
};

const getAlertSummary = async () => {
  const hoy = todayLocal();
  const alertas = activeAlerts(horizonOccurrences(await loadPlanSources(), hoy));
  return {
    total: alertas.length,
    vencidas: alertas.filter(alerta => alerta.situacion === 'VENCIDO').length,
  };
};

/** Próximas fechas de una configuración que aún no se guarda. */
const previewDates = async ({ tipo, equipoId, frecuenciaMeses, fechaInicio }) => {
  const hoy = todayLocal();
  const ajustes = await getAjustes();
  let equipos = [];
  if (tipo === 'VERIFICACION') {
    equipos = (await getEquipos()).filter(equipo => equipo.id === equipoId);
    if (equipos.length === 0) throw httpError(404, 'El equipo no existe o no está activo.');
  }
  const programa = tipo === 'VERIFICACION'
    ? { id: 0, tipo, equipoId, frecuenciaMeses, fechaInicio, activo: true }
    : { id: 0, tipo, titulo: 'Vista previa', frecuenciaMeses, fechaInicio, activo: true };
  const occurrences = buildOccurrences({
    equipos,
    programas: [
      // La calibración no interesa en la vista previa de una verificación.
      ...equipos.map(equipo => ({ id: -1, tipo: 'CALIBRACION', equipoId: equipo.id, activo: false })),
      programa,
    ],
    eventos: [],
    desde: addMonths(hoy, -1),
    hasta: addMonths(hoy, 36),
    hoy,
    ajustes,
  });
  return occurrences
    .filter(occurrence => occurrence.tipo === tipo && occurrence.fecha >= hoy)
    .slice(0, 6)
    .map(occurrence => ({ fecha: occurrence.fecha, proyectado: occurrence.proyectado }));
};

// ─── Escrituras ────────────────────────────────────────────────────────────

const findResponsable = async (createRequest, responsableId) => {
  if (responsableId == null) return null;
  const result = await createRequest()
    .input('rid', sql.Int, responsableId)
    .query(`
      SELECT TOP 1 CONCAT(TRIM(nombre1), ' ', TRIM(apellido1)) AS nombre
      FROM DATA_USERS WHERE id = @rid AND estado = 'ACTIVO'
    `);
  if (!result.recordset[0]) throw httpError(400, 'El responsable elegido no está activo.');
  return result.recordset[0].nombre;
};

const assertEquipos = async (createRequest, equipoIds) => {
  const result = await createRequest().query(`
    SELECT id FROM DATA_EQUIPOS_CAL
    WHERE id IN (${equipoIds.map(Number).filter(Number.isInteger).join(',')})
      AND UPPER(LTRIM(RTRIM(ISNULL(estado, 'ACTIVO')))) = 'ACTIVO'
  `);
  if (result.recordset.length !== equipoIds.length) {
    throw httpError(404, 'Alguno de los equipos no existe o no está activo.');
  }
};

const PROGRAMA_COLUMNS = {
  activo: sql.Bit,
  frecuencia_meses: sql.Int,
  fecha_inicio: sql.Date,
  responsable_id: sql.Int,
  responsable_nombre: sql.NVarChar(100),
  alerta_dias: sql.Int,
  alerta_frecuencia: sql.VarChar(10),
  alerta_correo: sql.Bit,
};

/**
 * Crea o actualiza la serie de un equipo modificando solo las columnas
 * recibidas (las demás conservan su valor).
 */
const upsertEquipoPrograma = async (createRequest, { tipo, equipoId, fields, actor }) => {
  const columns = Object.keys(fields);
  const request = createRequest()
    .input('tipo', sql.VarChar(20), tipo)
    .input('equipo', sql.Int, equipoId)
    .input('actor', sql.NVarChar(50), actorName(actor));
  for (const column of columns) request.input(column, PROGRAMA_COLUMNS[column], fields[column]);

  const insertColumns = [...columns];
  if (!insertColumns.includes('activo')) {
    // Una verificación creada solo para guardar responsable o alertas nace apagada.
    request.input('activo', sql.Bit, tipo !== 'VERIFICACION');
    insertColumns.push('activo');
  }

  const setClause = [...columns.map(column => `${column} = @${column}`), 'actualizado_por = @actor', 'actualizado_en = SYSUTCDATETIME()'].join(', ');
  await request.query(`
    UPDATE dbo.CAL_PROGRAMAS WITH (UPDLOCK, SERIALIZABLE)
    SET ${setClause}
    WHERE tipo = @tipo AND equipo_id = @equipo;

    IF @@ROWCOUNT = 0
      INSERT INTO dbo.CAL_PROGRAMAS (tipo, equipo_id, ${insertColumns.join(', ')}, creado_por)
      VALUES (@tipo, @equipo, ${insertColumns.map(column => `@${column}`).join(', ')}, @actor);
  `);
};

const alertFields = (data) => ({
  alerta_dias: data.alertaDias,
  alerta_frecuencia: data.alertaFrecuencia,
  alerta_correo: data.alertaCorreo,
});

const updateEquipoConfig = async (equipoId, data, actor) => withTransaction(async (createRequest) => {
  await assertEquipos(createRequest, [equipoId]);
  const calResponsable = await findResponsable(createRequest, data.calibracion.responsableId);
  const verResponsable = await findResponsable(createRequest, data.verificacion.responsableId);

  await upsertEquipoPrograma(createRequest, {
    tipo: 'CALIBRACION',
    equipoId,
    actor,
    fields: {
      activo: data.calibracion.activo,
      responsable_id: data.calibracion.responsableId,
      responsable_nombre: calResponsable,
      ...alertFields(data.calibracion),
    },
  });
  await upsertEquipoPrograma(createRequest, {
    tipo: 'VERIFICACION',
    equipoId,
    actor,
    fields: {
      activo: data.verificacion.activo,
      frecuencia_meses: data.verificacion.frecuenciaMeses,
      fecha_inicio: data.verificacion.fechaInicio,
      responsable_id: data.verificacion.responsableId,
      responsable_nombre: verResponsable,
      ...alertFields(data.verificacion),
    },
  });
  return { equipoId };
});

const updateEquiposMasivo = async (data, actor) => withTransaction(async (createRequest) => {
  await assertEquipos(createRequest, data.equipoIds);
  const responsable = data.responsableId !== undefined
    ? { responsable_id: data.responsableId, responsable_nombre: await findResponsable(createRequest, data.responsableId) }
    : {};
  const alerta = data.alerta ? alertFields(data.alerta) : {};

  for (const equipoId of data.equipoIds) {
    const shared = { ...responsable, ...alerta };
    if (Object.keys(shared).length > 0) {
      await upsertEquipoPrograma(createRequest, { tipo: 'CALIBRACION', equipoId, actor, fields: shared });
    }
    const verificacion = data.verificacion ? {
      activo: data.verificacion.activo,
      frecuencia_meses: data.verificacion.frecuenciaMeses,
      fecha_inicio: data.verificacion.fechaInicio,
    } : {};
    if (Object.keys({ ...shared, ...verificacion }).length > 0) {
      await upsertEquipoPrograma(createRequest, {
        tipo: 'VERIFICACION',
        equipoId,
        actor,
        fields: { ...shared, ...verificacion },
      });
    }
  }
  return { actualizados: data.equipoIds.length };
});

const bindActividad = (request, data, responsableNombre, actor) => request
  .input('titulo', sql.NVarChar(150), data.titulo)
  .input('categoria', sql.NVarChar(60), data.categoria)
  .input('descripcion', sql.NVarChar(500), data.descripcion)
  .input('frecuencia', sql.Int, data.frecuenciaMeses)
  .input('inicio', sql.Date, data.fechaInicio)
  .input('rid', sql.Int, data.responsableId)
  .input('rnombre', sql.NVarChar(100), responsableNombre)
  .input('adias', sql.Int, data.alertaDias)
  .input('afrec', sql.VarChar(10), data.alertaFrecuencia)
  .input('acorreo', sql.Bit, data.alertaCorreo)
  .input('actor', sql.NVarChar(50), actorName(actor));

const createActividad = async (data, actor) => withTransaction(async (createRequest) => {
  const responsable = await findResponsable(createRequest, data.responsableId);
  const result = await bindActividad(createRequest(), data, responsable, actor).query(`
    INSERT INTO dbo.CAL_PROGRAMAS
      (tipo, titulo, categoria, descripcion, frecuencia_meses, fecha_inicio, responsable_id,
       responsable_nombre, alerta_dias, alerta_frecuencia, alerta_correo, activo, creado_por)
    OUTPUT INSERTED.id
    VALUES
      ('ACTIVIDAD', @titulo, @categoria, @descripcion, @frecuencia, @inicio, @rid,
       @rnombre, @adias, @afrec, @acorreo, 1, @actor);
  `);
  return { id: result.recordset[0].id };
});

const updateActividad = async (id, data, actor) => withTransaction(async (createRequest) => {
  const responsable = await findResponsable(createRequest, data.responsableId);
  const result = await bindActividad(createRequest(), data, responsable, actor)
    .input('id', sql.Int, id)
    .query(`
      UPDATE dbo.CAL_PROGRAMAS
      SET titulo = @titulo, categoria = @categoria, descripcion = @descripcion,
        frecuencia_meses = @frecuencia, fecha_inicio = @inicio, responsable_id = @rid,
        responsable_nombre = @rnombre, alerta_dias = @adias, alerta_frecuencia = @afrec,
        alerta_correo = @acorreo, actualizado_por = @actor, actualizado_en = SYSUTCDATETIME()
      WHERE id = @id AND tipo = 'ACTIVIDAD' AND activo = 1
    `);
  if (result.rowsAffected[0] === 0) throw httpError(404, 'La actividad no existe.');
  return { id };
});

/** Retira la actividad del plan; su historial se conserva. */
const deleteActividad = async (id, actor) => {
  const result = await getPool().request()
    .input('id', sql.Int, id)
    .input('actor', sql.NVarChar(50), actorName(actor))
    .query(`
      UPDATE dbo.CAL_PROGRAMAS
      SET activo = 0, actualizado_por = @actor, actualizado_en = SYSUTCDATETIME()
      WHERE id = @id AND tipo = 'ACTIVIDAD' AND activo = 1
    `);
  if (result.rowsAffected[0] === 0) throw httpError(404, 'La actividad no existe.');
  return { id };
};

const parseSerie = (serie) => {
  const [prefix, rawId] = serie.split('-');
  const tipo = { CAL: 'CALIBRACION', VER: 'VERIFICACION', ACT: 'ACTIVIDAD' }[prefix];
  return { tipo, refId: Number(rawId) };
};

/** Comprueba que la fecha pertenece al plan y se puede modificar. */
const findEditableOccurrence = async ({ serie, fechaProgramada }) => {
  const sources = await loadPlanSources();
  const occurrence = buildOccurrences({
    ...sources,
    desde: addMonths(fechaProgramada, -24),
    hasta: addMonths(fechaProgramada, 24),
    hoy: todayLocal(),
  }).find(item => item.serie === serie && item.fechaProgramada === fechaProgramada);
  if (!occurrence) throw httpError(404, 'Esa fecha ya no forma parte del plan. Recarga el cronograma.');
  if (!occurrence.editable) throw httpError(400, 'La emisión del certificado no se puede modificar desde el cronograma.');
  return occurrence;
};

const saveEvento = async (data, actor) => {
  const occurrence = await findEditableOccurrence(data);
  const { tipo } = parseSerie(data.serie);
  const resetting = data.estado === 'PROGRAMADO'
    && !data.fechaReprogramada && !data.fechaRealizada && !data.resultado && !data.observaciones;
  if (resetting) return deleteEvento(data);

  await getPool().request()
    .input('serie', sql.VarChar(30), data.serie)
    .input('tipo', sql.VarChar(20), tipo)
    .input('equipo', sql.Int, occurrence.equipoId)
    .input('programa', sql.Int, occurrence.programaId)
    .input('fp', sql.Date, data.fechaProgramada)
    .input('frep', sql.Date, data.fechaReprogramada)
    .input('estado', sql.VarChar(20), data.estado)
    .input('freal', sql.Date, data.estado === 'REALIZADO' ? data.fechaRealizada : null)
    .input('resultado', sql.VarChar(20), data.estado === 'REALIZADO' ? data.resultado : null)
    .input('obs', sql.NVarChar(500), data.observaciones)
    .input('actor', sql.NVarChar(50), actorName(actor))
    .query(`
      UPDATE dbo.CAL_EVENTOS WITH (UPDLOCK, SERIALIZABLE)
      SET fecha_reprogramada = @frep, estado = @estado, fecha_realizada = @freal,
        resultado = @resultado, observaciones = @obs, actualizado_por = @actor,
        actualizado_en = SYSUTCDATETIME()
      WHERE serie = @serie AND fecha_programada = @fp;

      IF @@ROWCOUNT = 0
        INSERT INTO dbo.CAL_EVENTOS
          (serie, tipo, equipo_id, programa_id, fecha_programada, fecha_reprogramada, estado,
           fecha_realizada, resultado, observaciones, actualizado_por)
        VALUES
          (@serie, @tipo, @equipo, @programa, @fp, @frep, @estado, @freal, @resultado, @obs, @actor);
    `);
  return { serie: data.serie, fechaProgramada: data.fechaProgramada };
};

async function deleteEvento({ serie, fechaProgramada }) {
  await getPool().request()
    .input('serie', sql.VarChar(30), serie)
    .input('fp', sql.Date, fechaProgramada)
    .query('DELETE FROM dbo.CAL_EVENTOS WHERE serie = @serie AND fecha_programada = @fp');
  return { serie, fechaProgramada };
}

const updateAjustes = async (data, actor) => {
  await getPool().request()
    .input('dias', sql.Int, data.alertaDias)
    .input('frec', sql.VarChar(10), data.alertaFrecuencia)
    .input('correo', sql.Bit, data.alertaCorreo)
    .input('hora', sql.Char(5), data.horaEnvio)
    .input('actor', sql.NVarChar(50), actorName(actor))
    .query(`
      UPDATE dbo.CAL_AJUSTES
      SET alerta_dias = @dias, alerta_frecuencia = @frec, alerta_correo = @correo,
        hora_envio = @hora, actualizado_por = @actor, actualizado_en = SYSUTCDATETIME()
      WHERE id = 1
    `);
  return getAjustes();
};

const assertUniqueContacto = async (data, excludeId = null) => {
  const result = await getPool().request()
    .input('email', sql.NVarChar(150), data.email)
    .input('uid', sql.Int, data.usuarioId)
    .input('exclude', sql.Int, excludeId)
    .query(`
      SELECT TOP 1 email, usuario_id FROM dbo.CAL_CONTACTOS
      WHERE (LOWER(email) = @email OR (@uid IS NOT NULL AND usuario_id = @uid))
        AND (@exclude IS NULL OR id <> @exclude)
    `);
  const existing = result.recordset[0];
  if (!existing) return;
  throw httpError(409, normalizeEmail(existing.email) === data.email
    ? 'Ese correo ya está registrado.'
    : 'Esa persona ya tiene un correo registrado.');
};

const bindContacto = (request, data) => request
  .input('uid', sql.Int, data.usuarioId)
  .input('nombre', sql.NVarChar(100), data.nombre)
  .input('email', sql.NVarChar(150), data.email)
  .input('todas', sql.Bit, data.recibeTodas)
  .input('activo', sql.Bit, data.activo);

const createContacto = async (data) => {
  await assertUniqueContacto(data);
  const result = await bindContacto(getPool().request(), data).query(`
    INSERT INTO dbo.CAL_CONTACTOS (usuario_id, nombre, email, recibe_todas, activo)
    OUTPUT INSERTED.id
    VALUES (@uid, @nombre, @email, @todas, @activo)
  `);
  return { id: result.recordset[0].id };
};

const updateContacto = async (id, data) => {
  await assertUniqueContacto(data, id);
  const result = await bindContacto(getPool().request(), data)
    .input('id', sql.Int, id)
    .query(`
      UPDATE dbo.CAL_CONTACTOS
      SET usuario_id = @uid, nombre = @nombre, email = @email, recibe_todas = @todas,
        activo = @activo, actualizado_en = SYSUTCDATETIME()
      WHERE id = @id
    `);
  if (result.rowsAffected[0] === 0) throw httpError(404, 'El contacto no existe.');
  return { id };
};

const deleteContacto = async (id) => {
  const result = await getPool().request()
    .input('id', sql.Int, id)
    .query('DELETE FROM dbo.CAL_CONTACTOS WHERE id = @id');
  if (result.rowsAffected[0] === 0) throw httpError(404, 'El contacto no existe.');
  return { id };
};

const getAlertSettings = async () => {
  const [ajustes, contactos, envios] = await Promise.all([getAjustes(), getContactos(), getEnvios()]);
  return {
    ajustes,
    contactos,
    envios,
    correo: { ...mailStatus(), alertasActivas: env.calibration.alertsEnabled },
  };
};

// ─── Envío de alertas ──────────────────────────────────────────────────────

/** Reserva la revisión del día; solo un proceso la obtiene. */
const claimDailyRun = async (hoy) => {
  const result = await getPool().request()
    .input('hoy', sql.Date, hoy)
    .query(`
      UPDATE dbo.CAL_AJUSTES
      SET ultima_revision = @hoy
      WHERE id = 1 AND (ultima_revision IS NULL OR ultima_revision < @hoy)
    `);
  return result.rowsAffected[0] === 1;
};

const logEnvio = async ({ occurrence, email, motivo, estado, error, hoy }) => {
  await getPool().request()
    .input('serie', sql.VarChar(30), occurrence.serie)
    .input('fp', sql.Date, occurrence.fechaProgramada)
    .input('email', sql.NVarChar(150), email)
    .input('motivo', sql.VarChar(10), motivo)
    .input('estado', sql.VarChar(10), estado)
    .input('error', sql.NVarChar(400), error ? String(error).slice(0, 400) : null)
    .input('hoy', sql.Date, hoy)
    .query(`
      INSERT INTO dbo.CAL_ALERTAS_ENVIOS (serie, fecha_programada, email, motivo, estado, error, fecha_local)
      VALUES (@serie, @fp, @email, @motivo, @estado, @error, @hoy)
    `);
};

/** Envía el resumen del día a cada destinatario y registra cada aviso. */
const runAlerts = async ({ hoy = todayLocal() } = {}) => {
  if (!isMailConfigured()) {
    throw httpError(503, 'El correo no está configurado en el servidor. Define SMTP_HOST y SMTP_FROM en backend/.env.');
  }
  const [sources, contactos, history] = await Promise.all([
    loadPlanSources(),
    getContactos(),
    getAlertHistory(addDays(hoy, -ALERT_HORIZON_DAYS)),
  ]);
  const alerts = activeAlerts(horizonOccurrences(sources, hoy));
  const digests = buildDigests({ alerts, contactos, history, hoy });

  const summary = { destinatarios: 0, avisos: 0, errores: [] };
  for (const digest of digests) {
    const email = renderDigestEmail({
      nombre: digest.contacto.nombre,
      items: digest.items,
      appUrl: env.calibration.appUrl,
    });
    let failure = null;
    try {
      await sendMail({ to: digest.email, ...email });
      summary.destinatarios += 1;
      summary.avisos += digest.items.length;
    } catch (error) {
      failure = error.message || 'Error al enviar';
      summary.errores.push({ email: digest.email, error: failure });
    }
    for (const item of digest.items) {
      await logEnvio({
        occurrence: item.occurrence,
        email: digest.email,
        motivo: item.motivo,
        estado: failure ? 'ERROR' : 'ENVIADO',
        error: failure,
        hoy,
      });
    }
  }
  return summary;
};

const sendTestEmail = async (to) => {
  await sendMail({
    to,
    subject: 'Prueba de alertas de calibración',
    text: 'Este es un correo de prueba del cronograma de calibración de DataMET+. Si lo recibes, las alertas por correo funcionan.',
    html: '<p style="font-family:Segoe UI,Roboto,Arial,sans-serif;font-size:14px;color:#181816;">Este es un correo de prueba del <strong>cronograma de calibración</strong> de DataMET+.<br>Si lo recibes, las alertas por correo funcionan.</p>',
  });
  return { email: to };
};

module.exports = {
  getCalibrationPermissions,
  getPlan,
  getAlertSummary,
  getPersonal,
  previewDates,
  updateEquipoConfig,
  updateEquiposMasivo,
  createActividad,
  updateActividad,
  deleteActividad,
  saveEvento,
  deleteEvento,
  getAjustes,
  updateAjustes,
  getAlertSettings,
  createContacto,
  updateContacto,
  deleteContacto,
  claimDailyRun,
  runAlerts,
  sendTestEmail,
};
