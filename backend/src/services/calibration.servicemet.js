/**
 * Versiones de ServiceMET (NB/ISO/IEC 17025, 7.11.2): cada versión de la app
 * de los técnicos se documenta, se valida y la aprueba el jefe de Calibración
 * antes de ponerse en uso. Cada paso y cada edición quedan en
 * CAL_SERVICEMET_HISTORIAL.
 *
 * Flujo: REGISTRADA → VALIDADA (validación conforme) → APROBADA → EN_USO, o
 * RECHAZADA. Registra y valida Sistemas (nivel 3), que desarrolla la app;
 * aprueba o rechaza solo el jefe de área de Calibración, y nunca quien validó.
 *
 * Qué versión usa cada teléfono sale de lo que ServiceMET envía con cada RIM
 * y cada talonario (form_rim y rim_talonarios, que no se modifican).
 */
const { getPool, sql } = require('../config/db');
const { todayLocal } = require('./calibration.schedule');
const { actorName, clean, httpError, normalizeArea, withTransaction } = require('./calibration.db');
const { describeChanges, formatIso, snapshot } = require('./calibration.history');
const { tablesFor } = require('./rim.registros');

const CLASES = { A: 'Crítico', B: 'Funcional', C: 'Menor' };

/** Días hacia atrás en que se buscan los reportes de los teléfonos. */
const DIAS_TELEFONOS = 180;

// ─── Permisos ──────────────────────────────────────────────────────────────

const esSistemas = (user) => String(user?.acceso_cron) === '3';

/** Jefe de área de Calibración: quien aprueba cada versión para uso. */
const esJefeCalibracion = ({ area, cargo } = {}) => normalizeArea(area) === 'calibracion'
  && normalizeArea(cargo).replace(/\s+/g, ' ') === 'jefe de area';

/** Qué puede hacer el usuario (área y cargo vigentes de DATA_USERS, puestos por `protect`). */
const permisosDe = (user) => ({
  registrar: esSistemas(user),
  aprobar: esJefeCalibracion(user),
  ponerEnUso: esSistemas(user) || esJefeCalibracion(user),
});

// ─── Versiones ─────────────────────────────────────────────────────────────

const versionParts = (version) => {
  const [base = '', build = ''] = String(version || '').trim().split('+');
  return { base, numbers: [...base.split('.').map(part => Number.parseInt(part, 10) || 0), Number.parseInt(build, 10) || 0] };
};

/** Compara «6.4.1+19» con «6.4.0+18» por sus números (build incluido). */
const compareVersions = (a, b) => {
  const [pa, pb] = [versionParts(a).numbers, versionParts(b).numbers];
  for (let index = 0; index < Math.max(pa.length, pb.length); index += 1) {
    const diff = (pa[index] || 0) - (pb[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

/**
 * La versión registrada que corresponde a la que informa un teléfono. Sin
 * build («6.4.1»), la de mayor build con ese número.
 */
const findVersion = (reported, versiones) => {
  const text = String(reported || '').trim().replace(/^v/i, '');
  if (!text) return null;
  const exact = versiones.find(version => version.version === text);
  if (exact || text.includes('+')) return exact || null;
  return versiones
    .filter(version => versionParts(version.version).base === text)
    .sort((a, b) => compareVersions(b.version, a.version))[0] || null;
};

const parseList = (value) => {
  if (!value) return [];
  try {
    const list = JSON.parse(value);
    return Array.isArray(list) ? list.map(item => String(item)) : [];
  } catch {
    return String(value).split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  }
};

const utc = (value) => (value ? `${value}Z` : null);

const VERSION_SELECT = `
  SELECT id, version, CONVERT(varchar(10), fecha_version, 23) AS fecha_version, commit_ref, clase, resumen,
    nuevo, corregido, impacto_registros, registro_validacion, estado,
    validacion, validacion_resultado, validado_por, CONVERT(varchar(19), validado_en, 126) AS validado_en,
    decision_obs, decidido_por, decidido_nombre, decidido_cargo, CONVERT(varchar(19), decidido_en, 126) AS decidido_en,
    CONVERT(varchar(10), en_uso_desde, 23) AS en_uso_desde, dispositivos, puesta_obs, puesta_por,
    CONVERT(varchar(19), puesta_en, 126) AS puesta_en,
    a_posteriori, registrado_por, CONVERT(varchar(19), registrado_en, 126) AS registrado_en,
    actualizado_por, CONVERT(varchar(19), actualizado_en, 126) AS actualizado_en
  FROM dbo.CAL_SERVICEMET_VERSIONES`;

/** Fila → versión, con las acciones que le corresponden a `permisos`. */
const mapVersion = (row, permisos = {}) => {
  const version = {
    id: row.id,
    version: row.version,
    fecha: row.fecha_version,
    commit: clean(row.commit_ref),
    clase: row.clase,
    resumen: clean(row.resumen),
    nuevo: parseList(row.nuevo),
    corregido: parseList(row.corregido),
    impacto: clean(row.impacto_registros),
    registroValidacion: clean(row.registro_validacion),
    estado: row.estado,
    validacion: clean(row.validacion),
    validacionResultado: row.validacion_resultado || null,
    validadoPor: clean(row.validado_por),
    validadoEn: utc(row.validado_en),
    decisionObs: clean(row.decision_obs),
    decididoPor: clean(row.decidido_por),
    decididoNombre: clean(row.decidido_nombre),
    decididoCargo: clean(row.decidido_cargo),
    decididoEn: utc(row.decidido_en),
    enUsoDesde: row.en_uso_desde || null,
    dispositivos: clean(row.dispositivos),
    puestaObs: clean(row.puesta_obs),
    puestaPor: clean(row.puesta_por),
    puestaEn: utc(row.puesta_en),
    aPosteriori: Boolean(row.a_posteriori),
    registradoPor: clean(row.registrado_por),
    registradoEn: utc(row.registrado_en),
    actualizadoPor: clean(row.actualizado_por),
    actualizadoEn: utc(row.actualizado_en),
  };
  const abierta = ['REGISTRADA', 'VALIDADA'].includes(version.estado);
  const decidir = Boolean(permisos.aprobar) && abierta;
  return {
    ...version,
    acciones: {
      editar: Boolean(permisos.registrar) && abierta,
      validar: Boolean(permisos.registrar) && abierta,
      // El jefe puede no aprobarla en cualquier momento; aprobarla exige una validación conforme.
      decidir,
      aprobar: decidir && version.validacionResultado === 'CONFORME',
      ponerEnUso: Boolean(permisos.ponerEnUso) && version.estado === 'APROBADA',
    },
  };
};

/** Lo que describe la versión (sin su validación ni su aprobación). */
const contentOf = (data) => ({
  version: data.version || null,
  fecha: data.fecha || null,
  commit: data.commit || null,
  clase: data.clase || null,
  resumen: data.resumen || null,
  nuevo: data.nuevo || [],
  corregido: data.corregido || [],
  impacto: data.impacto || null,
});

const CONTENT_LABELS = {
  version: 'Versión',
  fecha: 'Fecha',
  commit: 'Commit',
  clase: 'Clase',
  resumen: 'Resumen',
  nuevo: 'Nuevo',
  corregido: 'Corregido',
  impacto: 'Impacto en los registros',
};

const formatContent = (key, value) => {
  if (key === 'clase') return `${value} (${CLASES[value] || value})`;
  if (key === 'fecha') return formatIso(value);
  if (key === 'nuevo' || key === 'corregido') {
    const items = Array.isArray(value) ? value : [];
    if (items.length === 0) return '—';
    const first = items[0].length > 40 ? `${items[0].slice(0, 39)}…` : items[0];
    return `«${first}»${items.length > 1 ? ` y ${items.length - 1} más` : ''}`;
  }
  if (key === 'resumen' || key === 'impacto') {
    return String(value).length > 50 ? `«${String(value).slice(0, 49)}…»` : `«${value}»`;
  }
  return value;
};

/** Compara listas por su contenido para describeChanges. */
const comparable = (content) => ({
  ...content,
  nuevo: JSON.stringify(content.nuevo),
  corregido: JSON.stringify(content.corregido),
});

const log = (createRequest, { versionId, accion, detalle, antes, despues, usuario }) => createRequest()
  .input('vid', sql.Int, versionId)
  .input('accion', sql.VarChar(20), accion)
  .input('detalle', sql.NVarChar(400), detalle ? String(detalle).slice(0, 400) : null)
  .input('antes', sql.NVarChar(sql.MAX), snapshot(antes))
  .input('despues', sql.NVarChar(sql.MAX), snapshot(despues))
  .input('usuario', sql.NVarChar(50), usuario)
  .query(`
    INSERT INTO dbo.CAL_SERVICEMET_HISTORIAL (version_id, accion, detalle, antes, despues, usuario)
    VALUES (@vid, @accion, @detalle, @antes, @despues, @usuario)
  `);

const loadVersion = async (createRequest, id, permisos, { lock = false } = {}) => {
  const result = await createRequest()
    .input('id', sql.Int, id)
    .query(`${VERSION_SELECT}${lock ? ' WITH (UPDLOCK, HOLDLOCK)' : ''} WHERE id = @id`);
  if (!result.recordset[0]) throw httpError(404, 'La versión no existe.');
  return mapVersion(result.recordset[0], permisos);
};

const exigirSistemas = (user) => {
  if (!esSistemas(user)) {
    throw httpError(403, 'Solo Sistemas (nivel 3) registra las versiones de ServiceMET y su validación.');
  }
};

// ─── Teléfonos ─────────────────────────────────────────────────────────────

/**
 * Último reporte de cada instalación de ServiceMET (RIM y talonarios) en los
 * últimos DIAS_TELEFONOS días. Sin esas tablas devuelve `disponible: false`.
 */
const leerTelefonos = async (tablas = tablesFor()) => {
  const existe = await getPool().request()
    .input('talonarios', sql.NVarChar(300), tablas.talonarios)
    .input('rim', sql.NVarChar(300), tablas.rim)
    .query(`
      SELECT
        CASE WHEN OBJECT_ID(@talonarios, 'U') IS NULL THEN 0 ELSE 1 END AS talonarios,
        CASE WHEN OBJECT_ID(@rim, 'U') IS NOT NULL
          AND COL_LENGTH(@rim, 'instalacion') IS NOT NULL
          AND COL_LENGTH(@rim, 'origen') IS NOT NULL THEN 1 ELSE 0 END AS rim
    `);
  const { talonarios, rim } = existe.recordset[0];
  if (!talonarios && !rim) return { disponible: false, dias: DIAS_TELEFONOS, items: [] };

  const fuentes = [
    talonarios && `SELECT instalacion, dispositivo, reg_por, usuario, app_version, fecha_reg
      FROM ${tablas.talonarios}
      WHERE origen = N'servicemet' AND instalacion IS NOT NULL AND app_version IS NOT NULL AND fecha_reg >= @desde`,
    rim && `SELECT instalacion, CAST(NULL AS nvarchar(120)) AS dispositivo, reg_por, reg_usuario AS usuario, app_version, fecha_reg
      FROM ${tablas.rim}
      WHERE origen = N'servicemet' AND instalacion IS NOT NULL AND app_version IS NOT NULL AND fecha_reg >= @desde`,
  ].filter(Boolean);

  const result = await getPool().request()
    .input('desde', sql.DateTime2(0), new Date(Date.now() - DIAS_TELEFONOS * 86400000 - 4 * 3600000))
    .query(`
      WITH reportes AS (${fuentes.join(' UNION ALL ')}),
      ordenados AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY instalacion ORDER BY fecha_reg DESC) AS n
        FROM reportes
      )
      SELECT CONVERT(varchar(36), o.instalacion) AS instalacion, o.app_version, o.reg_por, o.usuario,
        CONVERT(varchar(19), o.fecha_reg, 126) AS fecha,
        (SELECT TOP (1) r.dispositivo FROM reportes r
          WHERE r.instalacion = o.instalacion AND r.dispositivo IS NOT NULL ORDER BY r.fecha_reg DESC) AS dispositivo
      FROM ordenados o
      WHERE o.n = 1
      ORDER BY o.fecha_reg DESC
    `);
  return {
    disponible: true,
    dias: DIAS_TELEFONOS,
    items: result.recordset.map(row => ({
      instalacion: row.instalacion,
      version: clean(row.app_version),
      tecnico: clean(row.reg_por) || clean(row.usuario),
      dispositivo: clean(row.dispositivo),
      // fecha_reg es la hora del servidor (La Paz, UTC−4).
      ultimoReporte: row.fecha ? `${row.fecha}-04:00` : null,
    })),
  };
};

/** Situación de la versión que usa un teléfono. */
const situacionTelefono = (version) => {
  if (!version) return 'SIN_REGISTRAR';
  if (version.estado === 'APROBADA' || version.estado === 'EN_USO') return 'APROBADA';
  if (version.estado === 'RECHAZADA') return 'RECHAZADA';
  return 'PENDIENTE';
};

const conVersiones = (telefonos, versiones) => ({
  ...telefonos,
  items: telefonos.items.map((telefono) => {
    const version = findVersion(telefono.version, versiones);
    return {
      ...telefono,
      versionId: version?.id ?? null,
      situacion: situacionTelefono(version),
    };
  }),
});

// ─── Consultas ─────────────────────────────────────────────────────────────

const listVersiones = async (user) => {
  const permisos = permisosDe(user);
  const [result, telefonos] = await Promise.all([
    getPool().request().query(VERSION_SELECT),
    // Los teléfonos son un dato de apoyo: si fallan, el registro se muestra igual.
    leerTelefonos().catch((error) => {
      console.error('Versiones de ServiceMET: no se leyeron los teléfonos:', error.message);
      return { disponible: false, dias: DIAS_TELEFONOS, items: [], error: true };
    }),
  ]);
  const versiones = result.recordset
    .map(row => mapVersion(row, permisos))
    .sort((a, b) => compareVersions(b.version, a.version));
  return { versiones, telefonos: conVersiones(telefonos, versiones), permisos };
};

const getVersion = async (id, user) => {
  const permisos = permisosDe(user);
  const createRequest = () => getPool().request();
  const [version, historial] = await Promise.all([
    loadVersion(createRequest, id, permisos),
    createRequest().input('id', sql.Int, id).query(`
      SELECT id, accion, detalle, usuario, CONVERT(varchar(19), fecha, 126) AS fecha
      FROM dbo.CAL_SERVICEMET_HISTORIAL WHERE version_id = @id
      ORDER BY fecha DESC, id DESC
    `),
  ]);
  return {
    ...version,
    historial: historial.recordset.map(row => ({
      id: row.id,
      accion: row.accion,
      detalle: clean(row.detalle),
      usuario: clean(row.usuario),
      fecha: utc(row.fecha),
    })),
  };
};

// ─── Escritura ─────────────────────────────────────────────────────────────

const bindContent = (request, data) => request
  .input('version', sql.VarChar(30), data.version)
  .input('fecha', sql.Date, data.fecha)
  .input('commit', sql.VarChar(40), data.commit)
  .input('clase', sql.Char(1), data.clase)
  .input('resumen', sql.NVarChar(1000), data.resumen)
  .input('nuevo', sql.NVarChar(sql.MAX), data.nuevo.length ? JSON.stringify(data.nuevo) : null)
  .input('corregido', sql.NVarChar(sql.MAX), data.corregido.length ? JSON.stringify(data.corregido) : null)
  .input('impacto', sql.NVarChar(2000), data.impacto);

const exigirFecha = (fecha) => {
  if (fecha > todayLocal()) throw httpError(400, 'La fecha de la versión no puede ser posterior a hoy.');
};

const versionDuplicada = (error) => /UQ_CAL_SERVICEMET_VERSIONES_Version|duplicate key/i.test(error?.message || '');

const createVersion = async (data, user) => {
  exigirSistemas(user);
  exigirFecha(data.fecha);
  try {
    return await withTransaction(async (createRequest) => {
      const usuario = actorName(user);
      const result = await bindContent(createRequest(), data)
        .input('usuario', sql.NVarChar(50), usuario)
        .query(`
          INSERT INTO dbo.CAL_SERVICEMET_VERSIONES
            (version, fecha_version, commit_ref, clase, resumen, nuevo, corregido, impacto_registros, registrado_por)
          OUTPUT INSERTED.id
          VALUES (@version, @fecha, @commit, @clase, @resumen, @nuevo, @corregido, @impacto, @usuario)
        `);
      const id = result.recordset[0].id;
      await log(createRequest, {
        versionId: id,
        accion: 'REGISTRO',
        detalle: `Registrada la versión ${data.version}`,
        despues: contentOf(data),
        usuario,
      });
      return { id, version: data.version };
    });
  } catch (error) {
    if (versionDuplicada(error)) throw httpError(409, `La versión ${data.version} ya está registrada.`);
    throw error;
  }
};

/**
 * Edita una versión que aún no se decide. Si ya tenía validación, deja de
 * valer: describe otra cosa.
 */
const updateVersion = async (id, data, user) => {
  exigirSistemas(user);
  exigirFecha(data.fecha);
  try {
    return await withTransaction(async (createRequest) => {
      const actual = await loadVersion(createRequest, id, permisosDe(user), { lock: true });
      if (!actual.acciones.editar) {
        throw httpError(409, 'Una versión aprobada o rechazada no se edita: registra la versión corregida con su propio número.');
      }
      const before = contentOf(actual);
      const after = contentOf(data);
      const detalle = describeChanges(comparable(before), comparable(after), CONTENT_LABELS, (key, value) => (
        key === 'nuevo' || key === 'corregido' ? formatContent(key, JSON.parse(value)) : formatContent(key, value)
      ));
      if (!detalle) return { id, cambios: 0 };

      const anula = Boolean(actual.validacion);
      const usuario = actorName(user);
      await bindContent(createRequest(), data)
        .input('id', sql.Int, id)
        .input('usuario', sql.NVarChar(50), usuario)
        .input('anula', sql.Bit, anula)
        .query(`
          UPDATE dbo.CAL_SERVICEMET_VERSIONES
          SET version = @version, fecha_version = @fecha, commit_ref = @commit, clase = @clase,
            resumen = @resumen, nuevo = @nuevo, corregido = @corregido, impacto_registros = @impacto,
            actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME(),
            estado = CASE WHEN @anula = 1 THEN 'REGISTRADA' ELSE estado END,
            validacion = CASE WHEN @anula = 1 THEN NULL ELSE validacion END,
            validacion_resultado = CASE WHEN @anula = 1 THEN NULL ELSE validacion_resultado END,
            validado_por = CASE WHEN @anula = 1 THEN NULL ELSE validado_por END,
            validado_en = CASE WHEN @anula = 1 THEN NULL ELSE validado_en END
          WHERE id = @id
        `);
      await log(createRequest, {
        versionId: id,
        accion: 'EDICION',
        detalle: anula ? `${detalle}. La validación anterior queda sin efecto` : detalle,
        antes: before,
        despues: after,
        usuario,
      });
      return { id, cambios: 1, validacionAnulada: anula };
    });
  } catch (error) {
    if (versionDuplicada(error)) throw httpError(409, `La versión ${data.version} ya está registrada.`);
    throw error;
  }
};

const validarVersion = async (id, data, user) => {
  exigirSistemas(user);
  return withTransaction(async (createRequest) => {
    const actual = await loadVersion(createRequest, id, permisosDe(user), { lock: true });
    if (!actual.acciones.validar) throw httpError(409, 'Esta versión ya fue aprobada o rechazada.');
    const usuario = actorName(user);
    const conforme = data.resultado === 'CONFORME';
    const estado = conforme ? 'VALIDADA' : 'REGISTRADA';
    await createRequest()
      .input('id', sql.Int, id)
      .input('validacion', sql.NVarChar(2000), data.validacion)
      .input('resultado', sql.VarChar(20), data.resultado)
      .input('registro', sql.NVarChar(60), data.registro)
      .input('estado', sql.VarChar(20), estado)
      .input('usuario', sql.NVarChar(50), usuario)
      .query(`
        UPDATE dbo.CAL_SERVICEMET_VERSIONES
        SET validacion = @validacion, validacion_resultado = @resultado, registro_validacion = @registro,
          validado_por = @usuario, validado_en = SYSUTCDATETIME(), estado = @estado
        WHERE id = @id
      `);
    await log(createRequest, {
      versionId: id,
      accion: 'VALIDACION',
      detalle: `Validación ${conforme ? 'conforme' : 'no conforme'}${data.registro ? ` (${data.registro})` : ''}${actual.validacion ? '; reemplaza la anterior' : ''}`,
      antes: actual.validacion
        ? { validacion: actual.validacion, resultado: actual.validacionResultado, registro: actual.registroValidacion, por: actual.validadoPor }
        : null,
      despues: { validacion: data.validacion, resultado: data.resultado, registro: data.registro },
      usuario,
    });
    return { id, estado };
  });
};

/** Nombre y cargo vigentes de quien decide, leídos con bloqueo de DATA_USERS. */
const leerActor = async (createRequest, user) => {
  const id = Number(user?.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const result = await createRequest().input('id', sql.Int, id).query(`
    SELECT TOP (1) usuario, area, cargo, LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre
    FROM DATA_USERS WITH (HOLDLOCK) WHERE id = @id AND estado = 'ACTIVO'
  `);
  return result.recordset[0] || null;
};

const decidirVersion = async (id, data, user) => withTransaction(async (createRequest) => {
  const actor = await leerActor(createRequest, user);
  if (!actor || !esJefeCalibracion(actor)) {
    throw httpError(403, 'Solo el jefe de área de Calibración aprueba o rechaza las versiones de ServiceMET.');
  }
  const actual = await loadVersion(createRequest, id, { aprobar: true }, { lock: true });
  if (!actual.acciones.decidir) throw httpError(409, 'Esta versión ya fue aprobada o rechazada.');
  const aprueba = data.decision === 'APROBAR';
  if (aprueba && !actual.acciones.aprobar) {
    throw httpError(409, 'Antes de aprobarla, Sistemas debe registrar una validación conforme.');
  }
  const usuario = actorName(user);
  if (actual.validadoPor && actual.validadoPor.toLowerCase() === usuario.toLowerCase()) {
    throw httpError(409, 'Quien validó la versión no puede aprobarla ni rechazarla.');
  }
  const estado = aprueba ? 'APROBADA' : 'RECHAZADA';
  await createRequest()
    .input('id', sql.Int, id)
    .input('obs', sql.NVarChar(500), data.observaciones)
    .input('estado', sql.VarChar(20), estado)
    .input('usuario', sql.NVarChar(50), usuario)
    .input('nombre', sql.NVarChar(120), clean(actor.nombre))
    .input('cargo', sql.NVarChar(60), clean(actor.cargo))
    .query(`
      UPDATE dbo.CAL_SERVICEMET_VERSIONES
      SET decision_obs = @obs, decidido_por = @usuario, decidido_nombre = @nombre, decidido_cargo = @cargo,
        decidido_en = SYSUTCDATETIME(), estado = @estado
      WHERE id = @id
    `);
  await log(createRequest, {
    versionId: id,
    accion: aprueba ? 'APROBACION' : 'RECHAZO',
    detalle: aprueba
      ? `Aprobada para uso${actual.aPosteriori ? ' (a posteriori)' : ''}${data.observaciones ? `: ${data.observaciones}` : ''}`
      : `No aprobada: ${data.observaciones}`,
    usuario,
  });
  return { id, estado };
});

const ponerEnUso = async (id, data, user) => withTransaction(async (createRequest) => {
  const permisos = permisosDe(user);
  if (!permisos.ponerEnUso) {
    throw httpError(403, 'La puesta en uso la registran Sistemas o el jefe de área de Calibración.');
  }
  const actual = await loadVersion(createRequest, id, permisos, { lock: true });
  if (!actual.acciones.ponerEnUso) throw httpError(409, 'Solo se pone en uso una versión aprobada.');
  if (data.fecha > todayLocal()) throw httpError(400, 'La fecha de puesta en uso no puede ser posterior a hoy.');
  if (data.fecha < actual.fecha) throw httpError(400, 'La versión no puede estar en uso antes de su fecha.');
  // Lo que se libera desde ahora se usa después de aprobarse; las versiones
  // anteriores a este control pueden llevar una fecha anterior.
  const aprobadaEl = actual.decididoEn ? todayLocal(new Date(actual.decididoEn)) : null;
  if (!actual.aPosteriori && aprobadaEl && data.fecha < aprobadaEl) {
    throw httpError(400, `La versión se aprobó el ${formatIso(aprobadaEl)}: no puede estar en uso desde antes.`);
  }
  const usuario = actorName(user);
  await createRequest()
    .input('id', sql.Int, id)
    .input('fecha', sql.Date, data.fecha)
    .input('dispositivos', sql.NVarChar(500), data.dispositivos)
    .input('obs', sql.NVarChar(500), data.observaciones)
    .input('usuario', sql.NVarChar(50), usuario)
    .query(`
      UPDATE dbo.CAL_SERVICEMET_VERSIONES
      SET en_uso_desde = @fecha, dispositivos = @dispositivos, puesta_obs = @obs, puesta_por = @usuario,
        puesta_en = SYSUTCDATETIME(), estado = 'EN_USO'
      WHERE id = @id
    `);
  await log(createRequest, {
    versionId: id,
    accion: 'PUESTA_EN_USO',
    detalle: `En uso desde el ${formatIso(data.fecha)}${data.dispositivos ? ` en ${data.dispositivos}` : ''}`,
    despues: { fecha: data.fecha, dispositivos: data.dispositivos, observaciones: data.observaciones },
    usuario,
  });
  return { id, estado: 'EN_USO' };
});

/** Resumen para la pestaña Cumplimiento (7.11.2); `instalada: false` sin la migración 014. */
const resumenCumplimiento = async () => {
  const existe = await getPool().request()
    .query("SELECT CASE WHEN OBJECT_ID('dbo.CAL_SERVICEMET_VERSIONES', 'U') IS NULL THEN 0 ELSE 1 END AS ok");
  if (!existe.recordset[0].ok) return { instalada: false };
  const { versiones, telefonos } = await listVersiones({});
  const [ultima, ...anteriores] = versiones;
  const telefonosSinAprobar = telefonos.items.filter(telefono => telefono.situacion !== 'APROBADA');
  return {
    instalada: true,
    total: versiones.length,
    ultima: ultima ? { version: ultima.version, estado: ultima.estado } : null,
    aprobadas: versiones.filter(version => ['APROBADA', 'EN_USO'].includes(version.estado)).length,
    anterioresSinDecidir: anteriores.filter(version => !version.decididoPor).length,
    telefonos: telefonos.disponible ? telefonos.items.length : null,
    telefonosSinAprobar: telefonos.disponible ? telefonosSinAprobar.length : null,
    versionesSinAprobarEnTelefonos: [...new Set(telefonosSinAprobar.map(telefono => telefono.version))],
  };
};

module.exports = {
  CLASES,
  compareVersions,
  createVersion,
  decidirVersion,
  esJefeCalibracion,
  findVersion,
  getVersion,
  leerTelefonos,
  listVersiones,
  mapVersion,
  permisosDe,
  ponerEnUso,
  resumenCumplimiento,
  situacionTelefono,
  updateVersion,
  validarVersion,
};
