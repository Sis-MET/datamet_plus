/**
 * Control de cambios del sistema (NB/ISO/IEC 17025, 7.11.2): cada cambio se
 * documenta, se valida, se aprueba y recién entonces se implementa. Cada paso
 * y cada edición quedan en APP_CAMBIOS_HISTORIAL.
 *
 * Flujo: REGISTRADO → VALIDADO (validación conforme) → APROBADO →
 * IMPLEMENTADO, o RECHAZADO. Los cambios registrados a posteriori ya están en
 * uso: siguen IMPLEMENTADOS y se les puede completar la validación y la
 * aprobación.
 *
 * Quién hace qué (como en las versiones de ServiceMET): Sistemas (nivel 3)
 * registra, edita, valida e implementa; el jefe de área de Calibración aprueba
 * o rechaza, nunca quien validó. Los dos consultan el apartado.
 */
const { getPool, sql } = require('../config/db');
const { todayLocal } = require('./calibration.schedule');
const { actorName, clean, httpError, normalizeArea, withTransaction } = require('./calibration.db');
const { describeChanges, formatIso, snapshot } = require('./calibration.history');

// ─── Permisos ──────────────────────────────────────────────────────────────

const esSistemas = (user) => String(user?.acceso_cron) === '3';

/** Jefe de área de Calibración (área y cargo vigentes de DATA_USERS, puestos por `protect`). */
const esJefeCalibracion = ({ area, cargo } = {}) => normalizeArea(area) === 'calibracion'
  && normalizeArea(cargo).replace(/\s+/g, ' ') === 'jefe de area';

/** Qué puede hacer el usuario en Control de cambios. */
const permisosCambios = (user) => {
  const sistemas = esSistemas(user);
  const jefe = esJefeCalibracion(user || {});
  return { ver: sistemas || jefe, registrar: sistemas, validar: sistemas, aprobar: jefe, implementar: sistemas };
};

const exigir = (user, permiso, mensaje) => {
  if (!permisosCambios(user)[permiso]) throw httpError(403, mensaje);
};

const TIPO_LABELS = {
  MODULO: 'Módulo nuevo',
  MEJORA: 'Mejora',
  CORRECCION: 'Corrección',
  SEGURIDAD: 'Seguridad',
  BASE_DATOS: 'Base de datos',
  CONFIGURACION: 'Configuración',
};

const CONTENT_LABELS = {
  titulo: 'Título',
  version: 'Versión',
  tipo: 'Tipo',
  modulos: 'Módulos',
  descripcion: 'Descripción',
  impacto: 'Impacto',
  referencias: 'Referencias',
  fechaCambio: 'Fecha del cambio',
};

const formatContent = (key, value) => {
  if (key === 'tipo') return TIPO_LABELS[value] || value;
  if (key === 'fechaCambio') return formatIso(value);
  if (['descripcion', 'impacto', 'referencias'].includes(key)) {
    return String(value).length > 50 ? `«${String(value).slice(0, 49)}…»` : `«${value}»`;
  }
  return value;
};

const utc = (value) => (value ? `${value}Z` : null);

const CAMBIO_SELECT = `
  SELECT id, codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias,
    CONVERT(varchar(10), fecha_cambio, 23) AS fecha_cambio, estado,
    validacion, validacion_resultado, validado_por, CONVERT(varchar(19), validado_en, 126) AS validado_en,
    aprobacion_obs, aprobado_por, CONVERT(varchar(19), aprobado_en, 126) AS aprobado_en,
    CONVERT(varchar(10), implementado_en, 23) AS implementado_en, implementado_por, implementacion_obs,
    a_posteriori, registrado_por, CONVERT(varchar(19), registrado_en, 126) AS registrado_en,
    actualizado_por, CONVERT(varchar(19), actualizado_en, 126) AS actualizado_en
  FROM dbo.APP_CAMBIOS`;

/**
 * Cambio con lo que se puede hacer en su estado. Con `permisos` (los de quien
 * consulta), además, solo lo que esa persona puede hacer.
 */
const mapCambio = (row, permisos = null) => {
  const cambio = {
    id: row.id,
    codigo: row.codigo,
    version: clean(row.version),
    titulo: clean(row.titulo),
    tipo: row.tipo,
    modulos: clean(row.modulos),
    descripcion: clean(row.descripcion),
    impacto: clean(row.impacto),
    referencias: clean(row.referencias),
    fechaCambio: row.fecha_cambio,
    estado: row.estado,
    validacion: clean(row.validacion),
    validacionResultado: row.validacion_resultado,
    validadoPor: clean(row.validado_por),
    validadoEn: utc(row.validado_en),
    aprobacionObs: clean(row.aprobacion_obs),
    aprobadoPor: clean(row.aprobado_por),
    aprobadoEn: utc(row.aprobado_en),
    implementadoEn: row.implementado_en,
    implementadoPor: clean(row.implementado_por),
    implementacionObs: clean(row.implementacion_obs),
    aPosteriori: Boolean(row.a_posteriori),
    registradoPor: clean(row.registrado_por),
    registradoEn: utc(row.registrado_en),
    actualizadoPor: clean(row.actualizado_por),
    actualizadoEn: utc(row.actualizado_en),
  };
  const abierto = !cambio.aprobadoPor && cambio.estado !== 'RECHAZADO';
  const acciones = {
    editar: abierto,
    validar: abierto,
    aprobar: abierto && cambio.validacionResultado === 'CONFORME',
    implementar: cambio.estado === 'APROBADO'
      || (cambio.aPosteriori && cambio.estado === 'IMPLEMENTADO' && !cambio.implementadoEn),
  };
  if (!permisos) return { ...cambio, acciones };
  return {
    ...cambio,
    acciones: {
      editar: acciones.editar && permisos.registrar,
      validar: acciones.validar && permisos.validar,
      aprobar: acciones.aprobar && permisos.aprobar,
      implementar: acciones.implementar && permisos.implementar,
    },
  };
};

/** Lo que describe el cambio (sin su validación ni aprobación). */
const contentOf = (cambio) => ({
  titulo: cambio.titulo || null,
  version: cambio.version || null,
  tipo: cambio.tipo || null,
  modulos: cambio.modulos || null,
  descripcion: cambio.descripcion || null,
  impacto: cambio.impacto || null,
  referencias: cambio.referencias || null,
  fechaCambio: cambio.fechaCambio || null,
});

const logCambio = (createRequest, { cambioId, accion, detalle, antes, despues, usuario }) => createRequest()
  .input('cid', sql.Int, cambioId)
  .input('accion', sql.VarChar(20), accion)
  .input('detalle', sql.NVarChar(400), detalle ? String(detalle).slice(0, 400) : null)
  .input('antes', sql.NVarChar(sql.MAX), snapshot(antes))
  .input('despues', sql.NVarChar(sql.MAX), snapshot(despues))
  .input('usuario', sql.NVarChar(50), usuario)
  .query(`
    INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, antes, despues, usuario)
    VALUES (@cid, @accion, @detalle, @antes, @despues, @usuario)
  `);

const loadCambio = async (createRequest, id, { lock = false } = {}, permisos = null) => {
  const result = await createRequest()
    .input('id', sql.Int, id)
    .query(`${CAMBIO_SELECT}${lock ? ' WITH (UPDLOCK, HOLDLOCK)' : ''} WHERE id = @id`);
  if (!result.recordset[0]) throw httpError(404, 'El cambio no existe.');
  return mapCambio(result.recordset[0], permisos);
};

const listCambios = async (user) => {
  const permisos = permisosCambios(user);
  const result = await getPool().request().query(`${CAMBIO_SELECT} ORDER BY codigo DESC`);
  return result.recordset.map(row => mapCambio(row, permisos));
};

const getCambio = async (id, user) => {
  const createRequest = () => getPool().request();
  const [cambio, historial, fallas] = await Promise.all([
    loadCambio(createRequest, id, {}, permisosCambios(user)),
    createRequest().input('id', sql.Int, id).query(`
      SELECT id, accion, detalle, usuario, CONVERT(varchar(19), fecha, 126) AS fecha
      FROM dbo.APP_CAMBIOS_HISTORIAL WHERE cambio_id = @id
      ORDER BY fecha DESC, id DESC
    `),
    createRequest().input('id', sql.Int, id).query(`
      SELECT id, mensaje, estado FROM dbo.APP_FALLAS WHERE cambio_id = @id ORDER BY id DESC
    `),
  ]);
  return {
    ...cambio,
    historial: historial.recordset.map(row => ({
      id: row.id,
      accion: row.accion,
      detalle: clean(row.detalle),
      usuario: clean(row.usuario),
      fecha: utc(row.fecha),
    })),
    fallas: fallas.recordset.map(row => ({ id: row.id, mensaje: clean(row.mensaje), estado: row.estado })),
  };
};

/** CC-2026-019: el siguiente número del año, reservado hasta terminar la transacción. */
const nextCodigo = async (createRequest, year) => {
  const result = await createRequest()
    .input('prefijo', sql.VarChar(20), `CC-${year}-%`)
    .query('SELECT MAX(codigo) AS ultimo FROM dbo.APP_CAMBIOS WITH (UPDLOCK, HOLDLOCK) WHERE codigo LIKE @prefijo');
  const last = Number(String(result.recordset[0]?.ultimo || '').split('-')[2]) || 0;
  return `CC-${year}-${String(last + 1).padStart(3, '0')}`;
};

const bindContent = (request, data) => request
  .input('titulo', sql.NVarChar(150), data.titulo)
  .input('version', sql.NVarChar(20), data.version)
  .input('tipo', sql.VarChar(20), data.tipo)
  .input('modulos', sql.NVarChar(200), data.modulos)
  .input('descripcion', sql.NVarChar(sql.MAX), data.descripcion)
  .input('impacto', sql.NVarChar(1000), data.impacto)
  .input('referencias', sql.NVarChar(1000), data.referencias)
  .input('fecha', sql.Date, data.fechaCambio);

const SOLO_SISTEMAS = 'Solo Sistemas (nivel 3) registra, edita, valida e implementa los cambios.';

// Cada paso comprueba el permiso antes de abrir la transacción.
const createCambio = async (data, actor) => {
  exigir(actor, 'registrar', SOLO_SISTEMAS);
  return withTransaction(async (createRequest) => {
    const usuario = actorName(actor);
    const codigo = await nextCodigo(createRequest, todayLocal().slice(0, 4));
    const result = await bindContent(createRequest(), data)
      .input('codigo', sql.VarChar(20), codigo)
      .input('usuario', sql.NVarChar(50), usuario)
      .query(`
        INSERT INTO dbo.APP_CAMBIOS
          (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio, registrado_por)
        OUTPUT INSERTED.id
        VALUES (@codigo, @version, @titulo, @tipo, @modulos, @descripcion, @impacto, @referencias, @fecha, @usuario)
      `);
    const id = result.recordset[0].id;
    await logCambio(createRequest, { cambioId: id, accion: 'REGISTRO', detalle: `Registrado: ${data.titulo}`, despues: contentOf(data), usuario });
    return { id, codigo };
  });
};

/**
 * Edita la descripción de un cambio que aún no se aprueba. Si ya estaba
 * validado, la validación deja de valer: describe otra cosa.
 */
const updateCambio = async (id, data, actor) => {
  exigir(actor, 'registrar', SOLO_SISTEMAS);
  return withTransaction(async (createRequest) => {
    const cambio = await loadCambio(createRequest, id, { lock: true });
    if (!cambio.acciones.editar) {
      throw httpError(409, 'Un cambio aprobado o rechazado no se edita: registra un cambio nuevo.');
    }
    const before = contentOf(cambio);
    const after = contentOf(data);
    const detalle = describeChanges(before, after, CONTENT_LABELS, formatContent);
    if (!detalle) return { id, cambios: 0 };

    const anulaValidacion = Boolean(cambio.validacion) && !cambio.aPosteriori;
    const usuario = actorName(actor);
    await bindContent(createRequest(), data)
      .input('id', sql.Int, id)
      .input('usuario', sql.NVarChar(50), usuario)
      .input('anula', sql.Bit, anulaValidacion)
      .query(`
        UPDATE dbo.APP_CAMBIOS
        SET titulo = @titulo, version = @version, tipo = @tipo, modulos = @modulos,
          descripcion = @descripcion, impacto = @impacto, referencias = @referencias,
          fecha_cambio = @fecha, actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME(),
          estado = CASE WHEN @anula = 1 THEN 'REGISTRADO' ELSE estado END,
          validacion = CASE WHEN @anula = 1 THEN NULL ELSE validacion END,
          validacion_resultado = CASE WHEN @anula = 1 THEN NULL ELSE validacion_resultado END,
          validado_por = CASE WHEN @anula = 1 THEN NULL ELSE validado_por END,
          validado_en = CASE WHEN @anula = 1 THEN NULL ELSE validado_en END
        WHERE id = @id
      `);
    await logCambio(createRequest, {
      cambioId: id,
      accion: 'EDICION',
      detalle: anulaValidacion ? `${detalle}. La validación anterior queda sin efecto` : detalle,
      antes: before,
      despues: after,
      usuario,
  });
  return { id, cambios: 1, validacionAnulada: anulaValidacion };
  });
};

const validarCambio = async (id, data, actor) => {
  exigir(actor, 'validar', SOLO_SISTEMAS);
  return withTransaction(async (createRequest) => {
    const cambio = await loadCambio(createRequest, id, { lock: true });
    if (!cambio.acciones.validar) throw httpError(409, 'Este cambio ya fue aprobado o rechazado.');
    const usuario = actorName(actor);
    const conforme = data.resultado === 'CONFORME';
    // Un cambio en uso sigue implementado; los demás avanzan solo si la validación es conforme.
    const estado = cambio.aPosteriori ? cambio.estado : (conforme ? 'VALIDADO' : 'REGISTRADO');
    await createRequest()
      .input('id', sql.Int, id)
      .input('validacion', sql.NVarChar(2000), data.validacion)
      .input('resultado', sql.VarChar(20), data.resultado)
      .input('estado', sql.VarChar(20), estado)
      .input('usuario', sql.NVarChar(50), usuario)
      .query(`
        UPDATE dbo.APP_CAMBIOS
        SET validacion = @validacion, validacion_resultado = @resultado, validado_por = @usuario,
          validado_en = SYSUTCDATETIME(), estado = @estado
        WHERE id = @id
      `);
    await logCambio(createRequest, {
      cambioId: id,
      accion: 'VALIDACION',
      detalle: `Validación ${conforme ? 'conforme' : 'no conforme'}${cambio.validacion ? ' (reemplaza la anterior)' : ''}`,
      antes: cambio.validacion ? { validacion: cambio.validacion, resultado: cambio.validacionResultado, por: cambio.validadoPor } : null,
      despues: { validacion: data.validacion, resultado: data.resultado },
      usuario,
  });
  return { id, estado };
  });
};

const aprobarCambio = async (id, data, actor) => {
  exigir(actor, 'aprobar', 'Solo el jefe de área de Calibración aprueba o rechaza los cambios del sistema.');
  return withTransaction(async (createRequest) => {
    const cambio = await loadCambio(createRequest, id, { lock: true });
    if (!cambio.acciones.validar) throw httpError(409, 'Este cambio ya fue aprobado o rechazado.');
    const usuario = actorName(actor);
    const aprueba = data.decision === 'APROBAR';
    if (aprueba && !cambio.acciones.aprobar) {
      throw httpError(409, 'Antes de aprobarlo, Sistemas debe registrar una validación conforme.');
    }
    if (cambio.validadoPor && cambio.validadoPor.toLowerCase() === usuario.toLowerCase()) {
      throw httpError(409, 'Quien validó el cambio no puede aprobarlo ni rechazarlo.');
    }
    const estado = aprueba ? (cambio.aPosteriori ? 'IMPLEMENTADO' : 'APROBADO') : 'RECHAZADO';
    await createRequest()
      .input('id', sql.Int, id)
      .input('obs', sql.NVarChar(500), data.observaciones)
      .input('estado', sql.VarChar(20), estado)
      .input('usuario', sql.NVarChar(50), usuario)
      .query(`
        UPDATE dbo.APP_CAMBIOS
        SET aprobacion_obs = @obs, aprobado_por = @usuario, aprobado_en = SYSUTCDATETIME(), estado = @estado
        WHERE id = @id
      `);
    await logCambio(createRequest, {
      cambioId: id,
      accion: aprueba ? 'APROBACION' : 'RECHAZO',
      detalle: aprueba
        ? `Aprobado${cambio.aPosteriori ? ' a posteriori' : ' para implementarse'}${data.observaciones ? `: ${data.observaciones}` : ''}`
        : `Rechazado: ${data.observaciones}`,
      usuario,
  });
  return { id, estado };
  });
};

const implementarCambio = async (id, data, actor) => {
  exigir(actor, 'implementar', SOLO_SISTEMAS);
  return withTransaction(async (createRequest) => {
    const cambio = await loadCambio(createRequest, id, { lock: true });
    if (!cambio.acciones.implementar) {
      throw httpError(409, 'Solo se implementa un cambio aprobado.');
    }
    if (data.fecha > todayLocal()) throw httpError(400, 'La fecha de implementación no puede ser posterior a hoy.');
    const usuario = actorName(actor);
    await createRequest()
      .input('id', sql.Int, id)
      .input('fecha', sql.Date, data.fecha)
      .input('obs', sql.NVarChar(500), data.observaciones)
      .input('usuario', sql.NVarChar(50), usuario)
      .query(`
        UPDATE dbo.APP_CAMBIOS
        SET implementado_en = @fecha, implementado_por = @usuario, implementacion_obs = @obs, estado = 'IMPLEMENTADO'
        WHERE id = @id
      `);
    await logCambio(createRequest, {
      cambioId: id,
      accion: 'IMPLEMENTACION',
      detalle: `En producción desde el ${formatIso(data.fecha)}${data.observaciones ? `: ${data.observaciones}` : ''}`,
      usuario,
  });
  return { id, estado: 'IMPLEMENTADO' };
  });
};

module.exports = {
  TIPO_LABELS,
  aprobarCambio,
  createCambio,
  getCambio,
  implementarCambio,
  listCambios,
  mapCambio,
  permisosCambios,
  updateCambio,
  validarCambio,
};
