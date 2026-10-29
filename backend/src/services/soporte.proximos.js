/**
 * Próximos servicios de Soporte técnico: lectura de los servicios, seguimiento
 * del área y avisos por correo.
 *
 * Los servicios se leen de DATA_SERVICIOS_DATOS_* (sin modificarlas) con las
 * correcciones del informe (ST_INFORMES.datos) encima, igual que el informe.
 * Las reglas viven en soporte.proximos.reglas.js.
 */
const { getPool, sql } = require('../config/db');
const env = require('../config/env');
const { todayLocal, addDays } = require('./calibration.schedule');
const { normalizeArea, withTransaction } = require('./calibration.db');
const { isMailConfigured, mailStatus, sendMail } = require('./mailer.service');
const { CLAVES_TIPO, TIPOS, numeroInforme } = require('./soporte.tipos');
const { httpError, text } = require('./soporte.validation');
const { columnasDe, leerDatos, permisos } = require('./soporte.informes');
const { datosPesaje } = require('./soporte.equipo');
const {
  alertasActivas,
  armarResumenes,
  construirEquipos,
  eventosDelAnio,
  normalizeEmail,
  publicarGestion,
  renderizarCorreo,
  resumen,
  validarGestion,
} = require('./soporte.proximos.reglas');

// Los avisos repetidos se cuentan en esta ventana hacia atrás.
const HISTORIAL_AVISOS_DIAS = 400;

const fechaIso = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return null;
};
const limpio = (value) => (value === null || value === undefined ? null : text(value) || null);

// ─── Servicios ─────────────────────────────────────────────────────────────

/**
 * Columnas que usa la vista, con su nombre en la tabla de origen. Algunas no
 * existen en todos los servicios (el diagnóstico no sugiere fecha; el
 * relevamiento guarda el tipo sugerido en `recomendaciones`).
 */
const CAMPOS = [
  ['otst', 'otst'],
  ['fecha_servicio', 'fecha_servicio'],
  ['personal', 'personal'],
  ['cliente', 'cliente'],
  ['planta', 'planta'],
  ['dep_planta', 'dep_planta'],
  ['cod_metrica', 'cod_metrica'],
  ['cod_planta', 'cod_planta'],
  ['cod_int', 'cod_int'],
  ['tipo_equipo', 'tipo_equipo'],
  ['marca', 'marca'],
  ['modelo', 'modelo'],
  ['serie', 'serie'],
  ['ubicacion', 'ubicacion'],
  ['unidades', 'unidades'],
  ...[1, 2, 3].flatMap(n => [`cap_max${n}`, `d${n}`, `e${n}`].map(campo => [campo, campo])),
  ['fecha_prox_servicio', 'fecha_prox_servicio'],
];

/** Campo del tipo de servicio sugerido en la tabla del tipo. */
const campoRecomendacion = (columnas) => {
  if (columnas.has('recomendacion')) return 'recomendacion';
  if (columnas.has('recomendaciones')) return 'recomendaciones';
  return null;
};

const fuenteTipo = async (tipo) => {
  const columnas = await columnasDe(tipo);
  const select = CAMPOS.map(([alias, columna]) => (columnas.has(columna)
    ? `t.[${columna}] AS ${alias}`
    : `CAST(NULL AS ${columna.startsWith('fecha') ? 'date' : 'nvarchar(250)'}) AS ${alias}`));
  const rec = campoRecomendacion(columnas);
  select.push(rec ? `t.[${rec}] AS recomendacion` : 'CAST(NULL AS nvarchar(500)) AS recomendacion');
  return `
    SELECT '${tipo}' AS tipo, N'${rec || ''}' AS campo_rec, x.*
    FROM (
      SELECT t.codigo_registro, ${select.join(', ')},
        ROW_NUMBER() OVER (PARTITION BY t.codigo_registro ORDER BY t.n DESC) AS rn
      FROM dbo.[${TIPOS[tipo].tabla}] t
      WHERE t.codigo_registro IS NOT NULL AND ISNULL(t.estado_servicio_csv, N'') <> N'ANULADO'
    ) x
    WHERE x.rn = 1 AND NULLIF(LTRIM(RTRIM(x.cod_metrica)), N'') IS NOT NULL`;
};

/** Valor que muestra el informe: el corregido si lo hay, si no el original. */
const efectivo = (datos, campo, original) => (
  campo && Object.prototype.hasOwnProperty.call(datos, campo) ? datos[campo] : original
);

const mapServicio = (row) => {
  const datos = leerDatos(row.datos);
  const valor = (campo) => efectivo(datos, campo, row[campo]);
  return {
    tipo: row.tipo,
    codigo: row.codigo_registro,
    otst: limpio(valor('otst')),
    numero: row.numero_informe || numeroInforme(valor('otst'), row.cod_metrica),
    estadoInforme: row.estado_informe || 'PENDIENTE',
    fecha: fechaIso(valor('fecha_servicio')),
    fechaProx: fechaIso(valor('fecha_prox_servicio')),
    recomendacion: limpio(efectivo(datos, row.campo_rec || null, row.recomendacion)),
    tecnico: limpio(valor('personal')),
    codMetrica: limpio(row.cod_metrica),
    cliente: limpio(valor('cliente')),
    planta: limpio(valor('planta')),
    ciudad: limpio(valor('dep_planta')),
    codPlanta: limpio(row.cod_planta),
    codInt: limpio(valor('cod_int')),
    tipoEquipo: limpio(valor('tipo_equipo')),
    marca: limpio(valor('marca')),
    modelo: limpio(valor('modelo')),
    serie: limpio(valor('serie')),
    ubicacion: limpio(valor('ubicacion')),
    ...datosPesaje(Object.fromEntries(['unidades', ...[1, 2, 3].flatMap(n => [`cap_max${n}`, `d${n}`, `e${n}`])]
      .map(campo => [campo, valor(campo)]))),
  };
};

/** Servicios vigentes de los 8 tipos (o de un equipo), con las correcciones del informe. */
const cargarServicios = async ({ codMetrica = null, request = getPool().request() } = {}) => {
  const fuentes = await Promise.all(CLAVES_TIPO.map(fuenteTipo));
  if (codMetrica) request.input('cod', sql.NVarChar(50), codMetrica);
  const result = await request.query(`
    SELECT f.*, i.estado AS estado_informe, i.numero AS numero_informe, i.datos
    FROM (${fuentes.join('\n    UNION ALL')}) f
    LEFT JOIN dbo.ST_INFORMES i ON i.tipo = f.tipo AND i.codigo_registro = f.codigo_registro
    ${codMetrica ? 'WHERE UPPER(LTRIM(RTRIM(f.cod_metrica))) = @cod' : ''};`);
  return result.recordset.map(mapServicio);
};

// ─── Seguimiento ───────────────────────────────────────────────────────────

const SEGUIMIENTO_SELECT = `
  SELECT id, cod_metrica, origen_tipo, origen_codigo,
    CONVERT(varchar(10), fecha_sugerida, 23) AS fecha_sugerida, accion,
    CONVERT(varchar(10), fecha_nueva, 23) AS fecha_nueva, nota, usuario, usuario_nombre,
    CONVERT(varchar(19), registrado_en, 126) AS registrado_en
  FROM dbo.ST_PROXIMOS_SEGUIMIENTO`;

const mapGestion = (row) => ({
  id: row.id,
  codMetrica: row.cod_metrica,
  origenTipo: row.origen_tipo,
  origenCodigo: row.origen_codigo,
  fechaSugerida: row.fecha_sugerida || null,
  accion: row.accion,
  fechaNueva: row.fecha_nueva || null,
  nota: row.nota,
  usuario: row.usuario,
  usuarioNombre: row.usuario_nombre || null,
  registradoEn: row.registrado_en ? `${row.registrado_en}Z` : null,
});

const cargarSeguimiento = async ({ codMetrica = null, request = getPool().request(), bloquear = false } = {}) => {
  if (codMetrica) request.input('cod', sql.NVarChar(50), codMetrica);
  const result = await request.query(`${SEGUIMIENTO_SELECT}${bloquear ? ' WITH (UPDLOCK, HOLDLOCK)' : ''}
    ${codMetrica ? 'WHERE cod_metrica = @cod' : ''}
    ORDER BY id;`);
  return result.recordset.map(mapGestion);
};

// ─── Ajustes de los avisos ─────────────────────────────────────────────────

const getAjustes = async () => {
  const result = await getPool().request().query(`
    SELECT TOP 1 alerta_dias, alerta_frecuencia, alerta_correo, hora_envio,
      CONVERT(varchar(10), ultima_revision, 23) AS ultima_revision, actualizado_por,
      CONVERT(varchar(19), actualizado_en, 126) AS actualizado_en
    FROM dbo.ST_AVISOS_AJUSTES WHERE id = 1;`);
  const row = result.recordset[0] || {};
  return {
    alertaDias: row.alerta_dias ?? 30,
    alertaFrecuencia: row.alerta_frecuencia || 'SEMANAL',
    alertaCorreo: row.alerta_correo === undefined || row.alerta_correo === null ? true : Boolean(row.alerta_correo),
    horaEnvio: String(row.hora_envio || '08:00').trim(),
    ultimaRevision: row.ultima_revision || null,
    actualizadoPor: row.actualizado_por || null,
    actualizadoEn: row.actualizado_en ? `${row.actualizado_en}Z` : null,
  };
};

const actorDe = (user) => String(user?.usuario || 'sistema').slice(0, 50);

const exigirArea = async (user, accion) => {
  const actor = await permisos(user);
  if (!actor.editar) throw httpError(403, `Solo el área de Soporte Técnico puede ${accion}.`);
  return { usuario: actorDe(user), nombre: actor.nombre ? actor.nombre.slice(0, 120) : null };
};

const registrarHistorial = (request, { entidad, entidadId = null, accion, detalle, antes = null, despues = null, usuario }) => request
  .input('entidad', sql.VarChar(20), entidad)
  .input('entidadId', sql.Int, entidadId)
  .input('accion', sql.VarChar(20), accion)
  .input('detalle', sql.NVarChar(400), detalle ? String(detalle).slice(0, 400) : null)
  .input('antes', sql.NVarChar(sql.MAX), antes ? JSON.stringify(antes) : null)
  .input('despues', sql.NVarChar(sql.MAX), despues ? JSON.stringify(despues) : null)
  .input('usuario', sql.NVarChar(50), usuario)
  .query(`
    INSERT INTO dbo.ST_AVISOS_HISTORIAL (entidad, entidad_id, accion, detalle, antes, despues, usuario)
    VALUES (@entidad, @entidadId, @accion, @detalle, @antes, @despues, @usuario);`);

const ETIQUETA_FRECUENCIA = { UNICA: 'una vez', SEMANAL: 'semanal', DIARIA: 'diaria', NINGUNA: 'sin avisos' };
const AJUSTES_TEXTO = {
  alertaDias: (v) => `anticipación ${v} días`,
  alertaFrecuencia: (v) => `repetición ${ETIQUETA_FRECUENCIA[v] || v}`,
  alertaCorreo: (v) => (v ? 'con correo' : 'sin correo'),
  horaEnvio: (v) => `hora ${v}`,
};

const updateAjustes = async (data, user) => {
  const { usuario } = await exigirArea(user, 'cambiar los avisos');
  await withTransaction(async (createRequest) => {
    const found = await createRequest().query(`
      SELECT alerta_dias, alerta_frecuencia, alerta_correo, hora_envio
      FROM dbo.ST_AVISOS_AJUSTES WITH (UPDLOCK, HOLDLOCK) WHERE id = 1;`);
    const row = found.recordset[0];
    if (!row) throw httpError(503, 'Faltan los ajustes de avisos: aplique la migración 009.');
    const antes = {
      alertaDias: row.alerta_dias,
      alertaFrecuencia: row.alerta_frecuencia,
      alertaCorreo: Boolean(row.alerta_correo),
      horaEnvio: String(row.hora_envio || '').trim(),
    };
    const despues = {
      alertaDias: data.alertaDias,
      alertaFrecuencia: data.alertaFrecuencia,
      alertaCorreo: data.alertaCorreo,
      horaEnvio: data.horaEnvio,
    };
    const cambiados = Object.keys(despues).filter(clave => antes[clave] !== despues[clave]);
    if (cambiados.length === 0) return;
    await createRequest()
      .input('dias', sql.Int, data.alertaDias)
      .input('frec', sql.VarChar(10), data.alertaFrecuencia)
      .input('correo', sql.Bit, data.alertaCorreo)
      .input('hora', sql.Char(5), data.horaEnvio)
      .input('actor', sql.NVarChar(50), usuario)
      .query(`
        UPDATE dbo.ST_AVISOS_AJUSTES
        SET alerta_dias = @dias, alerta_frecuencia = @frec, alerta_correo = @correo,
          hora_envio = @hora, actualizado_por = @actor, actualizado_en = SYSUTCDATETIME()
        WHERE id = 1;`);
    await registrarHistorial(createRequest(), {
      entidad: 'AJUSTES',
      accion: 'EDICION',
      detalle: `Avisos: ${cambiados.map(clave => AJUSTES_TEXTO[clave](despues[clave])).join(', ')}`,
      antes,
      despues,
      usuario,
    });
  });
  return getAjustes();
};

// ─── Destinatarios ─────────────────────────────────────────────────────────

const mapContacto = (row) => ({
  id: row.id,
  usuarioId: row.usuario_id,
  nombre: row.nombre,
  email: row.email,
  activo: Boolean(row.activo),
});

const getContactos = async (request = getPool().request()) => {
  const result = await request.query(`
    SELECT id, usuario_id, nombre, email, activo FROM dbo.ST_AVISOS_CONTACTOS ORDER BY activo DESC, nombre;`);
  return result.recordset.map(mapContacto);
};

const exigirContactoUnico = async (createRequest, data, excluir = null) => {
  const result = await createRequest()
    .input('email', sql.NVarChar(150), data.email)
    .input('uid', sql.Int, data.usuarioId)
    .input('excluir', sql.Int, excluir)
    .query(`
      SELECT TOP 1 email, usuario_id FROM dbo.ST_AVISOS_CONTACTOS WITH (UPDLOCK, HOLDLOCK)
      WHERE (LOWER(email) = @email OR (@uid IS NOT NULL AND usuario_id = @uid))
        AND (@excluir IS NULL OR id <> @excluir);`);
  const existente = result.recordset[0];
  if (!existente) return;
  throw httpError(409, normalizeEmail(existente.email) === data.email
    ? 'Ese correo ya está registrado.'
    : 'Esa persona ya tiene un correo registrado.');
};

const leerContacto = async (createRequest, id) => {
  const result = await createRequest()
    .input('id', sql.Int, id)
    .query('SELECT id, usuario_id, nombre, email, activo FROM dbo.ST_AVISOS_CONTACTOS WITH (UPDLOCK, HOLDLOCK) WHERE id = @id;');
  if (!result.recordset[0]) throw httpError(404, 'El destinatario no existe.');
  return mapContacto(result.recordset[0]);
};

const omitir = (objeto, claves) => Object.fromEntries(Object.entries(objeto).filter(([clave]) => !claves.includes(clave)));
const sinId = (contacto) => omitir(contacto, ['id']);

const createContacto = async (data, user) => {
  const { usuario } = await exigirArea(user, 'cambiar los destinatarios');
  return withTransaction(async (createRequest) => {
    await exigirContactoUnico(createRequest, data);
    const result = await createRequest()
      .input('uid', sql.Int, data.usuarioId)
      .input('nombre', sql.NVarChar(100), data.nombre)
      .input('email', sql.NVarChar(150), data.email)
      .input('activo', sql.Bit, data.activo)
      .input('actor', sql.NVarChar(50), usuario)
      .query(`
        INSERT INTO dbo.ST_AVISOS_CONTACTOS (usuario_id, nombre, email, activo, creado_por)
        OUTPUT INSERTED.id
        VALUES (@uid, @nombre, @email, @activo, @actor);`);
    const id = result.recordset[0].id;
    await registrarHistorial(createRequest(), {
      entidad: 'CONTACTO', entidadId: id, accion: 'ALTA', detalle: `Destinatario agregado: ${data.nombre} <${data.email}>`, despues: data, usuario,
    });
    return { id };
  });
};

const updateContacto = async (id, data, user) => {
  const { usuario } = await exigirArea(user, 'cambiar los destinatarios');
  return withTransaction(async (createRequest) => {
    const antes = await leerContacto(createRequest, id);
    await exigirContactoUnico(createRequest, data, id);
    await createRequest()
      .input('id', sql.Int, id)
      .input('uid', sql.Int, data.usuarioId)
      .input('nombre', sql.NVarChar(100), data.nombre)
      .input('email', sql.NVarChar(150), data.email)
      .input('activo', sql.Bit, data.activo)
      .input('actor', sql.NVarChar(50), usuario)
      .query(`
        UPDATE dbo.ST_AVISOS_CONTACTOS
        SET usuario_id = @uid, nombre = @nombre, email = @email, activo = @activo,
          actualizado_por = @actor, actualizado_en = SYSUTCDATETIME()
        WHERE id = @id;`);
    const pausa = antes.activo !== data.activo ? (data.activo ? 'reanudado' : 'en pausa') : null;
    await registrarHistorial(createRequest(), {
      entidad: 'CONTACTO',
      entidadId: id,
      accion: 'EDICION',
      detalle: `Destinatario ${pausa || 'editado'}: ${data.nombre} <${data.email}>`,
      antes: sinId(antes),
      despues: data,
      usuario,
    });
    return { id };
  });
};

const deleteContacto = async (id, user) => {
  const { usuario } = await exigirArea(user, 'cambiar los destinatarios');
  return withTransaction(async (createRequest) => {
    const antes = await leerContacto(createRequest, id);
    await createRequest().input('id', sql.Int, id).query('DELETE FROM dbo.ST_AVISOS_CONTACTOS WHERE id = @id;');
    await registrarHistorial(createRequest(), {
      entidad: 'CONTACTO', entidadId: id, accion: 'BAJA', detalle: `Destinatario quitado: ${antes.nombre} <${antes.email}>`, antes: sinId(antes), usuario,
    });
    return { id };
  });
};

/** Personal activo para elegir destinatarios; el de Soporte Técnico primero. */
const getPersonal = async () => {
  const result = await getPool().request().query(`
    SELECT id, CONCAT(TRIM(nombre1), ' ', TRIM(apellido1)) AS nombre, TRIM(area) AS area
    FROM DATA_USERS WHERE estado = 'ACTIVO' ORDER BY nombre1, apellido1;`);
  return result.recordset
    .map(row => ({ id: row.id, nombre: row.nombre, area: row.area || '', esSoporte: normalizeArea(row.area) === 'soporte tecnico' }))
    .sort((a, b) => Number(b.esSoporte) - Number(a.esSoporte));
};

// ─── Bitácora de envíos ────────────────────────────────────────────────────

const getEnvios = async (limit = 40) => {
  const result = await getPool().request()
    .input('limit', sql.Int, limit)
    .query(`
      SELECT TOP (@limit) id, cod_metrica, origen_tipo, origen_codigo,
        CONVERT(varchar(10), fecha_aviso, 23) AS fecha_aviso, email, motivo, estado, error,
        CONVERT(varchar(19), enviado_en, 126) AS enviado_en
      FROM dbo.ST_AVISOS_ENVIOS ORDER BY id DESC;`);
  return result.recordset.map(row => ({
    id: row.id,
    codMetrica: row.cod_metrica,
    origenTipo: row.origen_tipo,
    origenCodigo: row.origen_codigo,
    fechaAviso: row.fecha_aviso,
    email: row.email,
    motivo: row.motivo,
    estado: row.estado,
    error: row.error,
    enviadoEn: row.enviado_en ? `${row.enviado_en}Z` : null,
  }));
};

const getHistorialAvisos = async (limit = 30) => {
  const result = await getPool().request()
    .input('limit', sql.Int, limit)
    .query(`
      SELECT TOP (@limit) id, entidad, accion, detalle, usuario, CONVERT(varchar(19), fecha, 126) AS fecha
      FROM dbo.ST_AVISOS_HISTORIAL ORDER BY id DESC;`);
  return result.recordset.map(row => ({ ...row, fecha: row.fecha ? `${row.fecha}Z` : null }));
};

const historialEnvios = async (desde) => {
  const result = await getPool().request()
    .input('desde', sql.Date, desde)
    .query(`
      SELECT origen_tipo, origen_codigo, CONVERT(varchar(10), fecha_aviso, 23) AS fecha_aviso, email, motivo,
        CONVERT(varchar(10), fecha_local, 23) AS fecha_local
      FROM dbo.ST_AVISOS_ENVIOS
      WHERE estado = 'ENVIADO' AND fecha_local >= @desde;`);
  return result.recordset.map(row => ({
    origenTipo: row.origen_tipo,
    origenCodigo: row.origen_codigo,
    fechaAviso: row.fecha_aviso,
    email: row.email,
    motivo: row.motivo,
    fechaLocal: row.fecha_local,
  }));
};

/** Pestaña «Avisos»: lo que requiere atención hoy y la configuración del correo. */
const getAlertSettings = async (user) => {
  const hoy = todayLocal();
  const [{ ajustes, equipos }, contactos, envios, historial, actor] = await Promise.all([
    cargarEquipos({ hoy }), getContactos(), getEnvios(), getHistorialAvisos(), permisos(user),
  ]);
  return {
    hoy,
    ajustes,
    alertas: alertasActivas(equipos).map(sinAlerta),
    contactos,
    envios,
    historial,
    permisos: { editar: actor.editar },
    correo: { ...mailStatus(), alertasActivas: env.soporte.alertsEnabled },
  };
};

// ─── Plan ──────────────────────────────────────────────────────────────────

const sinAlerta = (proximo) => omitir(proximo, ['alerta']);

/**
 * Equipo de la línea de tiempo, compacto: el próximo servicio sin repetir los
 * datos del equipo. Lo demás (servicios, códigos, seguimiento) va en su ficha.
 */
const DATOS_REPETIDOS = [
  'alerta', 'equipoId', 'codMetrica', 'cliente', 'planta', 'ciudad', 'instrumento', 'marca', 'modelo', 'serie', 'origen', 'ultimaGestion',
];
const proximoCompacto = (proximo) => ({
  ...omitir(proximo, DATOS_REPETIDOS),
  recomendacion: proximo.tipoSugerido === 'OTRO' ? proximo.recomendacion : null,
});

// La OTST agrupa en las listas los equipos de una misma visita.
const servicioCorto = ({ tipo, fecha, tecnico, otst }) => ({ tipo, fecha, tecnico, otst });

const publicarEquipo = (equipo) => ({
  ...omitir(equipo, ['servicios', 'codInt', 'ubicacion', 'codPlanta']),
  origen: servicioCorto(equipo.origen),
  ultimoServicio: equipo.ultimoServicio.codigo === equipo.origen.codigo ? null : servicioCorto(equipo.ultimoServicio),
  totalServicios: equipo.servicios.length,
  proximo: equipo.proximo ? proximoCompacto(equipo.proximo) : null,
});

const cargarEquipos = async ({ hoy, codMetrica = null } = {}) => {
  const [ajustes, servicios, seguimiento] = await Promise.all([
    getAjustes(),
    cargarServicios({ codMetrica }),
    cargarSeguimiento({ codMetrica }),
  ]);
  return { ajustes, equipos: construirEquipos({ servicios, seguimiento, hoy, ajustes }) };
};

/**
 * Año de la línea de tiempo: los equipos con algún servicio o próximo
 * servicio en el año, sus marcas y, de cualquier año, lo que requiere atención.
 */
const getPlan = async ({ anio, user }) => {
  const hoy = todayLocal();
  const [{ ajustes, equipos }, actor] = await Promise.all([cargarEquipos({ hoy }), permisos(user)]);
  const eventos = eventosDelAnio(equipos, anio);
  const conEventos = new Set(eventos.map(evento => evento.equipoId));
  const alertas = alertasActivas(equipos);
  return {
    hoy,
    anio,
    ajustes: { alertaDias: ajustes.alertaDias, alertaFrecuencia: ajustes.alertaFrecuencia },
    permisos: { editar: actor.editar },
    resumen: resumen(equipos, alertas),
    equipos: equipos.filter(equipo => conEventos.has(equipo.id)).map(publicarEquipo),
    eventos,
    alertas: alertas.map(sinAlerta),
  };
};

const getAlertSummary = async () => {
  const { equipos } = await cargarEquipos({ hoy: todayLocal() });
  const alertas = alertasActivas(equipos);
  return { total: alertas.length, vencidas: alertas.filter(alerta => alerta.situacion === 'VENCIDO').length };
};

/** Ficha de un equipo: todos sus servicios, sus sugerencias y el seguimiento. */
const getEquipo = async (codMetrica, user) => {
  const hoy = todayLocal();
  const [ajustes, servicios, seguimiento, actor] = await Promise.all([
    getAjustes(),
    cargarServicios({ codMetrica }),
    cargarSeguimiento({ codMetrica }),
    permisos(user),
  ]);
  const [equipo] = construirEquipos({ servicios, seguimiento, hoy, ajustes });
  if (!equipo) throw httpError(404, 'No hay servicios de ese equipo.');
  return {
    hoy,
    ajustes: { alertaDias: ajustes.alertaDias, alertaFrecuencia: ajustes.alertaFrecuencia },
    permisos: { editar: actor.editar },
    equipo: { ...equipo, servicios: [...equipo.servicios].reverse(), proximo: equipo.proximo ? sinAlerta(equipo.proximo) : null },
    seguimiento: seguimiento.map(publicarGestion).reverse(),
  };
};

const CAMBIO_AJENO = 'Otra persona registró una gestión en este equipo mientras la preparaba. Se cargó el seguimiento vigente: revíselo y vuelva a intentarlo.';

/** Registra una gestión del próximo servicio vigente del equipo. */
const registrarSeguimiento = async (data, user) => {
  const actor = await exigirArea(user, 'registrar el seguimiento');
  const hoy = todayLocal();
  const [ajustes, servicios] = await Promise.all([getAjustes(), cargarServicios({ codMetrica: data.codMetrica })]);

  await withTransaction(async (createRequest) => {
    const gestiones = await cargarSeguimiento({ codMetrica: data.codMetrica, request: createRequest(), bloquear: true });
    const [equipo] = construirEquipos({ servicios, seguimiento: gestiones, hoy, ajustes });
    if (!equipo) throw httpError(404, 'No hay servicios de ese equipo.');
    if (equipo.origen.tipo !== data.origenTipo || equipo.origen.codigo !== data.origenCodigo) {
      throw httpError(409, 'El equipo tiene un servicio más reciente que cambió su próximo servicio. Se cargó la ficha vigente.');
    }
    if ((equipo.ultimoSeguimientoId ?? null) !== (data.ultimo ?? null)) throw httpError(409, CAMBIO_AJENO);

    const estado = {
      fecha: equipo.proximo?.fecha ?? null,
      descartada: Boolean(equipo.proximo?.descartada),
    };
    const problema = validarGestion({ accion: data.accion, fecha: data.fecha }, { estado, origen: equipo.origen, hoy });
    if (problema) throw httpError(400, problema);

    await createRequest()
      .input('cod', sql.NVarChar(50), equipo.id)
      .input('tipo', sql.VarChar(10), equipo.origen.tipo)
      .input('codigo', sql.NVarChar(100), equipo.origen.codigo)
      .input('sugerida', sql.Date, estado.fecha)
      .input('accion', sql.VarChar(20), data.accion)
      .input('nueva', sql.Date, ['COORDINACION', 'REPROGRAMACION'].includes(data.accion) ? data.fecha : null)
      .input('nota', sql.NVarChar(500), data.nota)
      .input('usuario', sql.NVarChar(50), actor.usuario)
      .input('nombre', sql.NVarChar(120), actor.nombre)
      .query(`
        INSERT INTO dbo.ST_PROXIMOS_SEGUIMIENTO
          (cod_metrica, origen_tipo, origen_codigo, fecha_sugerida, accion, fecha_nueva, nota, usuario, usuario_nombre)
        VALUES (@cod, @tipo, @codigo, @sugerida, @accion, @nueva, @nota, @usuario, @nombre);`);
  });

  return getEquipo(data.codMetrica, user);
};

// ─── Envío de avisos ───────────────────────────────────────────────────────

/** Reserva la revisión del día; solo un proceso la obtiene. */
const claimDailyRun = async (hoy) => {
  const result = await getPool().request()
    .input('hoy', sql.Date, hoy)
    .query(`
      UPDATE dbo.ST_AVISOS_AJUSTES SET ultima_revision = @hoy
      WHERE id = 1 AND (ultima_revision IS NULL OR ultima_revision < @hoy);`);
  return result.rowsAffected[0] === 1;
};

const logEnvio = ({ proximo, email, motivo, estado, error, hoy }) => getPool().request()
  .input('cod', sql.NVarChar(50), proximo.equipoId)
  .input('tipo', sql.VarChar(10), proximo.origen.tipo)
  .input('codigo', sql.NVarChar(100), proximo.origen.codigo)
  .input('fecha', sql.Date, proximo.fecha)
  .input('email', sql.NVarChar(150), email)
  .input('motivo', sql.VarChar(10), motivo)
  .input('estado', sql.VarChar(10), estado)
  .input('error', sql.NVarChar(400), error ? String(error).slice(0, 400) : null)
  .input('hoy', sql.Date, hoy)
  .query(`
    INSERT INTO dbo.ST_AVISOS_ENVIOS (cod_metrica, origen_tipo, origen_codigo, fecha_aviso, email, motivo, estado, error, fecha_local)
    VALUES (@cod, @tipo, @codigo, @fecha, @email, @motivo, @estado, @error, @hoy);`);

const SIN_CORREO = 'El correo no está configurado en el servidor. Define SMTP_HOST y SMTP_FROM en backend/.env.';

/** Envía el resumen del día a cada destinatario y registra cada aviso. */
const runAlerts = async ({ hoy = todayLocal() } = {}) => {
  if (!isMailConfigured()) throw httpError(503, SIN_CORREO);
  const [{ equipos }, contactos, historial] = await Promise.all([
    cargarEquipos({ hoy }),
    getContactos(),
    historialEnvios(addDays(hoy, -HISTORIAL_AVISOS_DIAS)),
  ]);
  const resumenes = armarResumenes({ alertas: alertasActivas(equipos), contactos, historial, hoy });

  const salida = { destinatarios: 0, avisos: 0, errores: [] };
  for (const item of resumenes) {
    const correo = renderizarCorreo({ nombre: item.contacto.nombre, items: item.items, appUrl: env.calibration.appUrl });
    let falla = null;
    try {
      await sendMail({ to: item.email, ...correo });
      salida.destinatarios += 1;
      salida.avisos += item.items.length;
    } catch (error) {
      falla = error.message || 'Error al enviar';
      salida.errores.push({ email: item.email, error: falla });
    }
    for (const aviso of item.items) {
      await logEnvio({ proximo: aviso.proximo, email: item.email, motivo: aviso.motivo, estado: falla ? 'ERROR' : 'ENVIADO', error: falla, hoy });
    }
  }
  return salida;
};

const runAlertsManual = async (user) => {
  await exigirArea(user, 'enviar los avisos');
  return runAlerts();
};

const sendTestEmail = async (to, user) => {
  await exigirArea(user, 'enviar correos de prueba');
  await sendMail({
    to,
    subject: 'Prueba de avisos de soporte técnico',
    text: 'Este es un correo de prueba de los próximos servicios de Soporte técnico en DataMET+. Si lo recibes, los avisos por correo funcionan.',
    html: '<p style="font-family:Segoe UI,Roboto,Arial,sans-serif;font-size:14px;color:#181816;">Este es un correo de prueba de los <strong>próximos servicios de Soporte técnico</strong> en DataMET+.<br>Si lo recibes, los avisos por correo funcionan.</p>',
  });
  return { email: to };
};

module.exports = {
  cargarServicios,
  claimDailyRun,
  createContacto,
  deleteContacto,
  getAjustes,
  getAlertSettings,
  getAlertSummary,
  getEquipo,
  getPersonal,
  getPlan,
  mapServicio,
  registrarSeguimiento,
  runAlerts,
  runAlertsManual,
  sendTestEmail,
  updateAjustes,
  updateContacto,
};
