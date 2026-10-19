/**
 * Registros RIM (recepción de instrumentos de pesaje).
 *
 * Los RIM viven en la base `servicios_extras` (misma instancia de SQL Server),
 * creada por ServiceMET: `form_rim` con cada RIM y sus dos firmas,
 * `form_rim_anulaciones`, `form_rim_fotos`, `rim_talonarios` y
 * `rim_talonarios_cierres` (scripts 012 y 014 de ServiceMET).
 *
 * Un RIM emitido no se edita ni se borra (NB/ISO/IEC 17025, 7.5.2): se anula
 * agregando una fila en `form_rim_anulaciones`, con motivo, quién y cuándo.
 * Su ejecución (6.2) y su entrega (6.3) se registran en `form_rim_ejecucion`
 * y `form_rim_entregas` (script 016): cada cambio es una fila nueva que
 * apunta a la vigente. El usuario de DataMET+ solo tiene SELECT e INSERT en
 * esas tablas.
 */
const env = require('../config/env');
const { getPool, sql } = require('../config/db');
const { rimCodigo, leerCodigo } = require('./rim.validation');
const seguimiento = require('./rim.seguimiento');

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const DATABASE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** Nombres completos de las tablas en la base de los RIM. */
const tablesFor = (database = env.rim.database) => {
  if (!DATABASE_NAME.test(database)) throw new Error('RIM_DB_NAME inválido.');
  const t = (name) => `[${database}].[dbo].[${name}]`;
  return {
    rim: t('form_rim'),
    anulaciones: t('form_rim_anulaciones'),
    fotos: t('form_rim_fotos'),
    talonarios: t('rim_talonarios'),
    cierres: t('rim_talonarios_cierres'),
    reservar: t('rim_reservar_talonario'),
    ejecucion: t('form_rim_ejecucion'),
    entregas: t('form_rim_entregas'),
  };
};

/** Bolivia está en UTC−4 todo el año. */
const LA_PAZ_OFFSET = '-04:00';
const gestionActual = (now = new Date()) =>
  new Date(now.getTime() - 4 * 60 * 60 * 1000).getUTCFullYear();

const ETIQUETA_AREA = { calibracion: 'Calibración', soporte: 'Soporte técnico', directo: 'Registro directo' };
const ETIQUETA_ORIGEN = { servicemet: 'ServiceMET', datametplus: 'DataMET+ (web)' };

const escapeLike = (value) => String(value).replace(/[\\%_[]/g, (char) => `\\${char}`);

const iso = (value) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null);

/** datetime2 con la hora del servidor (La Paz) como ISO con su desfase. */
const horaServidor = (value) => (value ? `${value}${LA_PAZ_OFFSET}` : null);

/**
 * WHERE del historial a partir de los filtros validados. Con
 * `conEstado: false` omite el filtro de estado (para contar vigentes y
 * anulados del mismo conjunto).
 */
const buildWhere = (filtros, { conEstado = true } = {}) => {
  const where = [];
  const params = [];
  const add = (name, type, value) => params.push({ name, type, value });

  if (filtros.q) {
    add('q', sql.NVarChar(200), `%${escapeLike(filtros.q)}%`);
    where.push(`(${['r.codigo_rim', 'r.cod_metrica', 'r.serie', 'r.contacto_nombre', 'r.cliente',
      'r.planta', 'r.seca_otst', 'r.instrumento', 'r.representante_metrica']
      .map(column => `${column} LIKE @q ESCAPE '\\'`).join(' OR ')})`);
  }
  if (filtros.cliente) {
    add('cliente', sql.NVarChar(30), filtros.cliente);
    where.push('r.cod_cliente = @cliente');
  }
  if (filtros.planta) {
    add('planta', sql.NVarChar(30), filtros.planta);
    where.push('r.cod_planta = @planta');
  }
  if (filtros.desde) {
    add('desde', sql.DateTimeOffset(0), new Date(`${filtros.desde}T00:00:00${LA_PAZ_OFFSET}`));
    where.push('r.emitido_en >= @desde');
  }
  if (filtros.hasta) {
    const hasta = new Date(`${filtros.hasta}T00:00:00${LA_PAZ_OFFSET}`);
    hasta.setUTCDate(hasta.getUTCDate() + 1);
    add('hasta', sql.DateTimeOffset(0), hasta);
    where.push('r.emitido_en < @hasta');
  }
  if (filtros.area) {
    add('area', sql.NVarChar(20), filtros.area);
    where.push('r.tipo_servicio = @area');
  }
  if (filtros.origen) {
    add('origen', sql.NVarChar(20), filtros.origen);
    where.push('r.origen = @origen');
  }
  if (conEstado && filtros.estado === 'vigente') where.push('a.id IS NULL');
  if (conEstado && filtros.estado === 'anulado') where.push('a.id IS NOT NULL');
  if (filtros.etapa) {
    add('etapa', sql.NVarChar(20), filtros.etapa);
    where.push('s.etapa = @etapa');
  }

  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

/**
 * Etapa de cada RIM según la última fila de su ejecución y de su entrega
 * (la cadena es lineal: la última es la de mayor id).
 */
const etapaJoins = (tables) => {
  const conDatos = seguimiento.CAMPOS_EJECUCION.map(({ columna }) => `e.${columna} IS NOT NULL`).join(' OR ');
  return `
    OUTER APPLY (
      SELECT TOP (1) e.fecha_conclusion, CASE WHEN ${conDatos} THEN 1 ELSE 0 END AS con_datos
      FROM ${tables.ejecucion} e WHERE e.rim_uuid = r.uuid ORDER BY e.id DESC) ej
    OUTER APPLY (
      SELECT TOP (1) en.tipo FROM ${tables.entregas} en
      WHERE en.rim_uuid = r.uuid ORDER BY en.id DESC) et
    CROSS APPLY (SELECT CASE
      WHEN et.tipo IN (N'registro', N'correccion') THEN N'entregado'
      WHEN ej.fecha_conclusion IS NOT NULL THEN N'concluido'
      WHEN ej.con_datos = 1 THEN N'en_ejecucion'
      ELSE N'recibido' END AS etapa) s`;
};

/**
 * Consultas del historial: página de filas y conteos del conjunto. Con
 * `seguimiento: false` (falta el script 016) omite la etapa.
 */
const buildListQuery = (filtros, tables = tablesFor(), { seguimiento: conSeguimiento = true } = {}) => {
  if (!conSeguimiento && filtros.etapa) throw new Error('El filtro por etapa necesita el seguimiento.');
  const { where, params } = buildWhere(filtros);
  const conteo = buildWhere(filtros, { conEstado: false });
  const offset = (filtros.page - 1) * filtros.pageSize;
  const from = `FROM ${tables.rim} r LEFT JOIN ${tables.anulaciones} a ON a.rim_uuid = r.uuid${conSeguimiento ? etapaJoins(tables) : ''}`;
  return {
    rows: {
      text: `
        SELECT r.n, r.uuid, r.codigo_rim, r.gestion, r.numero, r.origen, r.tipo_servicio,
          r.servicio, r.seca_otst, r.cod_cliente, r.cliente, r.cod_planta, r.planta,
          r.cod_metrica, r.instrumento, r.marca, r.modelo, r.serie,
          r.contacto_nombre, r.representante_metrica, r.reg_usuario, r.reg_por, r.emitido_en,
          a.id AS anulacion_id, a.motivo AS anulacion_motivo, a.anulado_en,
          a.anulado_por, a.anulado_por_nombre, a.origen AS anulacion_origen,${conSeguimiento ? '\n          s.etapa,' : ''}
          COUNT(*) OVER () AS total
        ${from}
        ${where}
        ORDER BY r.emitido_en DESC, r.n DESC
        OFFSET ${offset} ROWS FETCH NEXT ${filtros.pageSize} ROWS ONLY;`,
      params,
    },
    counts: {
      text: `
        SELECT COUNT(*) AS total,
          SUM(CASE WHEN a.id IS NULL THEN 1 ELSE 0 END) AS vigentes,
          SUM(CASE WHEN a.id IS NULL THEN 0 ELSE 1 END) AS anulados
        ${from}
        ${conteo.where};`,
      params: conteo.params,
    },
  };
};

const anulacionDe = (row) => (row.anulacion_id ? {
  motivo: row.anulacion_motivo,
  anuladoEn: iso(row.anulado_en),
  anuladoPor: row.anulado_por,
  anuladoPorNombre: row.anulado_por_nombre || null,
  origen: row.anulacion_origen,
  origenLabel: ETIQUETA_ORIGEN[row.anulacion_origen] || row.anulacion_origen,
  reemplazadoPor: row.reemplazado_por || null,
} : null);

/** Fila del historial, sin firmas ni fotos. */
const mapFila = (row) => ({
  n: row.n,
  uuid: String(row.uuid).toLowerCase(),
  codigo: row.codigo_rim,
  // Los RIM emitidos antes de la numeración conservan su código anterior.
  formatoAnterior: row.numero === null || row.numero === undefined,
  gestion: row.gestion ?? null,
  numero: row.numero ?? null,
  origen: row.origen || 'servicemet',
  origenLabel: ETIQUETA_ORIGEN[row.origen || 'servicemet'],
  area: row.tipo_servicio,
  areaLabel: ETIQUETA_AREA[row.tipo_servicio] || row.tipo_servicio,
  servicio: row.servicio || null,
  secaOtst: row.seca_otst || null,
  cliente: { codigo: row.cod_cliente || null, nombre: row.cliente || null },
  planta: { codigo: row.cod_planta || null, nombre: row.planta || null },
  instrumento: {
    codMetrica: row.cod_metrica || null,
    tipo: row.instrumento || null,
    marca: row.marca || null,
    modelo: row.modelo || null,
    serie: row.serie || null,
  },
  contacto: row.contacto_nombre,
  representanteMetrica: row.representante_metrica,
  subidoPor: row.reg_por || row.reg_usuario,
  emitidoEn: iso(row.emitido_en),
  estado: row.anulacion_id ? 'anulado' : 'vigente',
  // Etapa alcanzada (ejecución y entrega); null si falta el script 016.
  etapa: row.etapa || null,
  anulacion: anulacionDe(row),
});

const parseJson = (value, fallback) => {
  try {
    const parsed = JSON.parse(value || '');
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const dataUrl = (tipo, bytes) => (bytes ? `data:${tipo};base64,${Buffer.from(bytes).toString('base64')}` : null);

/** Quién puede anular un RIM o cerrar un talonario: jefes de área y niveles 2 y 3. */
const puedeGestionar = (user) => {
  const cargo = String(user?.cargo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  return cargo === 'jefe de area' || ['2', '3'].includes(String(user?.acceso_cron));
};

/**
 * RIM completo, de solo lectura: datos, firmas, fotos, trazabilidad y su
 * seguimiento (ejecución y entrega, ver rim.seguimiento.js).
 */
const mapDetalle = (row, { fotos = [], user, seguimiento: seguimientoRim = null } = {}) => {
  const inventario = parseJson(row.inventario, {});
  const fila = mapFila(row);
  return {
    ...fila,
    servicio: {
      tipo: row.tipo_servicio,
      nombre: row.servicio || null,
      secaOtst: row.seca_otst || null,
      sessionId: row.session_id || null,
    },
    cliente: {
      codigo: row.cod_cliente || null,
      nombre: row.cliente || null,
      razonSocial: row.razon_social || null,
      nit: row.nit || null,
    },
    planta: {
      codigo: row.cod_planta || null,
      nombre: row.planta || null,
      direccion: row.dir_planta || null,
      departamento: row.dep_planta || null,
    },
    instrumento: {
      ...fila.instrumento,
      capacidad: row.capacidad || null,
      division: row.division || null,
      unidad: row.unidad || null,
      ubicacion: row.ubicacion || null,
      observaciones: row.observaciones || null,
    },
    motivo: row.motivo,
    inventario: {
      items: inventario.items && typeof inventario.items === 'object' ? inventario.items : {},
      cantidades: inventario.quantities && typeof inventario.quantities === 'object' ? inventario.quantities : {},
      otros: Array.isArray(inventario.others) ? inventario.others : [],
      observaciones: row.obs_inventario || null,
    },
    estadoGeneral: row.estado_general,
    danos: parseJson(row.danos, {}),
    descripcionDanos: row.descripcion_danos || null,
    nivelSuciedad: row.nivel_suciedad,
    pruebas: {
      realizadas: Boolean(row.pruebas_funcionamiento),
      descripcion: row.descripcion_pruebas || null,
    },
    recepcion: {
      contactoNombre: row.contacto_nombre,
      contactoCargo: row.contacto_cargo || null,
      contactoTelefono: row.contacto_telefono || null,
      contactoCorreo: row.contacto_correo || null,
      representanteMetrica: row.representante_metrica,
      lugar: row.lugar_recepcion,
      tecnicoAsignado: row.tecnico_asignado || null,
    },
    firmas: {
      cliente: dataUrl('image/png', row.firma_cliente),
      representante: dataUrl('image/png', row.firma_representante),
    },
    fotos: fotos.map(foto => ({
      orden: foto.orden,
      nombre: foto.nombre || `Foto ${foto.orden}`,
      url: dataUrl(foto.tipo, foto.contenido),
    })),
    trazabilidad: {
      uuid: String(row.uuid).toLowerCase(),
      emitidoEn: iso(row.emitido_en),
      emitidoPor: row.usuario_app || null,
      registradoEn: horaServidor(row.fecha_reg_texto),
      registradoPor: row.reg_usuario,
      registradoPorNombre: row.reg_por || null,
      appVersion: row.app_version || null,
      talonarioId: row.talonario_id ?? null,
      instalacion: row.instalacion ? String(row.instalacion).toLowerCase() : null,
    },
    etapa: seguimientoRim?.etapa ?? null,
    seguimiento: seguimientoRim,
    acciones: { anular: !row.anulacion_id && puedeGestionar(user) },
  };
};

/**
 * Estado de los números de un talonario según los RIM registrados:
 *  - registrados: tienen RIM en el servidor;
 *  - pendientes: un número menor que otro ya registrado (o que el último
 *    usado informado al cerrar) que todavía no llegó: el RIM se emitió y
 *    falta subirlo;
 *  - noUtilizados: el talonario está cerrado y el número nunca se usará;
 *  - disponibles: siguen en el teléfono para RIM futuros.
 */
const clasificarNumeros = (talonario, registrados) => {
  const usados = new Set(registrados);
  const cerrado = Boolean(talonario.cierre);
  const maxRegistrado = registrados.length ? Math.max(...registrados) : null;
  const tope = cerrado
    ? Math.max(talonario.cierre.ultimoUsado ?? 0, maxRegistrado ?? 0)
    : (maxRegistrado ?? 0);
  const resultado = { registrados: [], pendientes: [], noUtilizados: [], disponibles: [] };
  for (let numero = talonario.desde; numero <= talonario.hasta; numero += 1) {
    if (usados.has(numero)) resultado.registrados.push(numero);
    else if (numero <= tope) resultado.pendientes.push(numero);
    else if (cerrado) resultado.noUtilizados.push(numero);
    else resultado.disponibles.push(numero);
  }
  let estado = 'en_uso';
  if (cerrado) estado = 'cerrado';
  else if (resultado.registrados.length === talonario.hasta - talonario.desde + 1) estado = 'completo';
  return { ...resultado, estado };
};

const mapTalonario = (row, registrados, user) => {
  const talonario = {
    id: row.id,
    gestion: row.gestion,
    desde: row.desde,
    hasta: row.hasta,
    rango: `${rimCodigo(row.gestion, row.desde)} a ${rimCodigo(row.gestion, row.hasta)}`,
    origen: row.origen,
    origenLabel: ETIQUETA_ORIGEN[row.origen] || row.origen,
    instalacion: row.instalacion ? String(row.instalacion).toLowerCase() : null,
    dispositivo: row.dispositivo || null,
    usuario: row.usuario,
    usuarioNombre: row.reg_por || null,
    appVersion: row.app_version || null,
    entregadoEn: horaServidor(row.fecha_reg_texto),
    cierre: row.cierre_id ? {
      motivo: row.cierre_motivo,
      detalle: row.cierre_detalle || null,
      ultimoUsado: row.ultimo_usado ?? null,
      origen: row.cierre_origen,
      usuario: row.cierre_usuario,
      fecha: horaServidor(row.cierre_fecha_texto),
    } : null,
  };
  const numeros = clasificarNumeros(talonario, registrados);
  return {
    ...talonario,
    ...numeros,
    acciones: { cerrar: !talonario.cierre && talonario.origen === 'servicemet' && puedeGestionar(user) },
  };
};

const TABLAS_SEGUIMIENTO = /form_rim_(ejecucion|entregas)/i;

/**
 * Traduce los errores de SQL Server que indican que falta preparar la base.
 * Los de la ejecución y la entrega (script 016) quedan marcados con
 * `faltaSeguimiento`: la ficha y el historial se muestran igual sin ellas.
 */
const notReady = (error) => {
  if (TABLAS_SEGUIMIENTO.test(error?.message || '')) {
    if ([208].includes(error?.number) || /Invalid object name/i.test(error?.message || '')) {
      return Object.assign(
        httpError(503, 'Falta ejecutar el script 016 de ServiceMET en servicios_extras: la ejecución y la entrega del RIM todavía no pueden registrarse.'),
        { faltaSeguimiento: true },
      );
    }
    if ([229, 230].includes(error?.number)) {
      return Object.assign(
        httpError(503, 'El usuario de DataMET+ no tiene permiso sobre la ejecución y la entrega del RIM: complete @loginDataMetPlus en el script 016 de ServiceMET y ejecútelo.'),
        { faltaSeguimiento: true },
      );
    }
  }
  if ([208, 2812].includes(error?.number) || /Invalid (object|column) name/i.test(error?.message || '')) {
    return httpError(503, 'La base de los RIM no está lista: falta ejecutar el script 014 de ServiceMET en servicios_extras.');
  }
  if ([229, 230, 916, 4060].includes(error?.number)) {
    return httpError(503, 'El usuario de DataMET+ no tiene permiso en servicios_extras: complete @loginDataMetPlus en el script 014 de ServiceMET y ejecútelo.');
  }
  return null;
};

const run = async (text, params = [], request = () => getPool().request()) => {
  const req = request();
  for (const param of params) req.input(param.name, param.type, param.value);
  try {
    const result = await req.query(text);
    return result.recordset ?? [];
  } catch (error) {
    throw notReady(error) || error;
  }
};

/** Nombre completo del usuario en DATA_USERS, como referencia. */
const nombreDe = async (usuario, request) => {
  try {
    const rows = await run(
      `SELECT TOP (1) LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre
       FROM DATA_USERS WHERE usuario = @usuario`,
      [{ name: 'usuario', type: sql.VarChar(50), value: usuario }],
      request,
    );
    return rows[0]?.nombre || null;
  } catch {
    return null;
  }
};

const usuarioDe = (user) => String(user?.usuario || '').slice(0, 100);

const consultarHistorial = (queries) => Promise.all([
  run(queries.rows.text, queries.rows.params),
  run(queries.counts.text, queries.counts.params),
]);

/**
 * Historial paginado con sus conteos y la etapa de cada RIM. Sin el script
 * 016 se lista igual, sin etapa (salvo que se filtre por ella).
 */
const listRims = async (filtros) => {
  let rows;
  let counts;
  try {
    [rows, counts] = await consultarHistorial(buildListQuery(filtros));
  } catch (error) {
    if (!error?.faltaSeguimiento || filtros.etapa) throw error;
    [rows, counts] = await consultarHistorial(buildListQuery(filtros, tablesFor(), { seguimiento: false }));
  }
  const conteo = counts[0] || {};
  return {
    items: rows.map(mapFila),
    total: rows[0]?.total ?? 0,
    page: filtros.page,
    pageSize: filtros.pageSize,
    resumen: {
      total: conteo.total ?? 0,
      vigentes: conteo.vigentes ?? 0,
      anulados: conteo.anulados ?? 0,
    },
  };
};

/** Clientes y plantas que tienen RIM, para los filtros del historial. */
const getFiltros = async () => {
  const tables = tablesFor();
  const rows = await run(`
    SELECT DISTINCT cod_cliente, cliente, cod_planta, planta
    FROM ${tables.rim}
    WHERE cod_cliente IS NOT NULL OR cod_planta IS NOT NULL;`);
  const clientes = new Map();
  const plantas = new Map();
  for (const row of rows) {
    if (row.cod_cliente && !clientes.has(row.cod_cliente)) {
      clientes.set(row.cod_cliente, { codigo: row.cod_cliente, nombre: row.cliente || row.cod_cliente });
    }
    if (row.cod_planta && !plantas.has(row.cod_planta)) {
      plantas.set(row.cod_planta, {
        codigo: row.cod_planta,
        nombre: row.planta || row.cod_planta,
        cliente: row.cod_cliente || null,
      });
    }
  }
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
  return {
    clientes: [...clientes.values()].sort(porNombre),
    plantas: [...plantas.values()].sort(porNombre),
  };
};

const DETALLE_SELECT = (tables) => `
  SELECT r.*, CONVERT(varchar(19), r.fecha_reg, 126) AS fecha_reg_texto,
    a.id AS anulacion_id, a.motivo AS anulacion_motivo, a.anulado_en, a.anulado_por,
    a.anulado_por_nombre, a.origen AS anulacion_origen, a.reemplazado_por
  FROM ${tables.rim} r
  LEFT JOIN ${tables.anulaciones} a ON a.rim_uuid = r.uuid`;

/** Fecha «yyyy-mm-dd» de una columna date, sin pasar por la zona horaria. */
const fechaTexto = (columna, alias = columna) => `CONVERT(varchar(10), ${columna}, 23) AS ${alias}`;

/** Filas de la ejecución de un RIM, de la primera a la última. */
const filasEjecucion = (uuid, tables = tablesFor()) => run(`
  SELECT id, anterior_id, tipo, motivo, recepcion_st, ${fechaTexto('fecha_ingreso')}, tecnico_asignado,
    ${fechaTexto('fecha_inicio')}, ${fechaTexto('fecha_informe')}, ${fechaTexto('fecha_conclusion')},
    nro_cotizacion, nro_informe, nro_factura, usuario, usuario_nombre,
    CONVERT(varchar(19), fecha_reg, 126) AS fecha_reg_texto
  FROM ${tables.ejecucion} WHERE rim_uuid = @uuid ORDER BY id;`,
[{ name: 'uuid', type: sql.UniqueIdentifier, value: uuid }]);

/**
 * Filas de la entrega de un RIM. Las firmas solo de la última fila (la
 * vigente): las correcciones las copian de la anterior.
 */
const filasEntrega = (uuid, tables = tablesFor()) => run(`
  SELECT e.id, e.anterior_id, e.tipo, e.motivo, e.recibe_nombre, e.entrega_por,
    ${fechaTexto('e.fecha_entrega', 'fecha_entrega')}, e.lugar_entrega, e.observaciones,
    CASE WHEN s.id IS NULL THEN e.firma_cliente END AS firma_cliente,
    CASE WHEN s.id IS NULL THEN e.firma_representante END AS firma_representante,
    e.usuario, e.usuario_nombre, CONVERT(varchar(19), e.fecha_reg, 126) AS fecha_reg_texto
  FROM ${tables.entregas} e
  LEFT JOIN ${tables.entregas} s ON s.anterior_id = e.id
  WHERE e.rim_uuid = @uuid ORDER BY e.id;`,
[{ name: 'uuid', type: sql.UniqueIdentifier, value: uuid }]);

/** Ejecución y entrega para la ficha; sin el script 016, el aviso. */
const cargarSeguimiento = async (row, user) => {
  try {
    const [ejecucion, entregas] = await Promise.all([filasEjecucion(row.uuid), filasEntrega(row.uuid)]);
    return seguimiento.mapSeguimiento({ ejecucion, entregas }, {
      anulado: Boolean(row.anulacion_id),
      puedeCorregir: puedeGestionar(user),
    });
  } catch (error) {
    if (error?.faltaSeguimiento) return seguimiento.seguimientoNoDisponible(error.message);
    throw error;
  }
};

/** RIM completo por su N.º (correlativo del servidor). */
const getRim = async (n, user) => {
  const tables = tablesFor();
  const rows = await run(`${DETALLE_SELECT(tables)} WHERE r.n = @n;`, [{ name: 'n', type: sql.Int, value: n }]);
  if (!rows.length) throw httpError(404, 'El RIM no existe.');
  const [fotos, seguimientoRim] = await Promise.all([
    run(
      `SELECT orden, nombre, tipo, contenido FROM ${tables.fotos} WHERE rim_uuid = @uuid ORDER BY orden;`,
      [{ name: 'uuid', type: sql.UniqueIdentifier, value: rows[0].uuid }],
    ),
    cargarSeguimiento(rows[0], user),
  ]);
  return mapDetalle(rows[0], { fotos, user, seguimiento: seguimientoRim });
};

/** Lo que hace falta del RIM para registrar su ejecución o su entrega. */
const rimParaSeguimiento = async (n, tables) => {
  const [rim] = await run(`
    SELECT r.uuid, a.id AS anulacion_id,
      CONVERT(varchar(10), SWITCHOFFSET(r.emitido_en, '${LA_PAZ_OFFSET}'), 23) AS emitido
    FROM ${tables.rim} r LEFT JOIN ${tables.anulaciones} a ON a.rim_uuid = r.uuid
    WHERE r.n = @n;`, [{ name: 'n', type: sql.Int, value: n }]);
  if (!rim) throw httpError(404, 'El RIM no existe.');
  if (rim.anulacion_id) throw httpError(409, 'El RIM está anulado: no se registran su ejecución ni su entrega.');
  return rim;
};

/** Guarda: la fila no se agrega si el RIM se anuló mientras tanto. */
const SIN_ANULAR = (tables) => `
  SET XACT_ABORT ON;
  IF EXISTS (SELECT 1 FROM ${tables.anulaciones} WHERE rim_uuid = @uuid)
    THROW 51050, N'El RIM está anulado: no se registran su ejecución ni su entrega.', 1;`;

/** Usuario de la sesión: lo impone el servidor en cada fila. */
const paramsRegistro = ({ uuid, plan, usuario, nombre }) => [
  { name: 'uuid', type: sql.UniqueIdentifier, value: uuid },
  { name: 'anterior_id', type: sql.Int, value: plan.anteriorId },
  { name: 'tipo', type: sql.NVarChar(20), value: plan.tipo },
  { name: 'motivo', type: sql.NVarChar(1000), value: plan.motivo },
  { name: 'usuario', type: sql.NVarChar(100), value: usuario },
  { name: 'nombre', type: sql.NVarChar(150), value: nombre },
];

/** INSERT de una versión de la ejecución ya decidida por planEjecucion. */
const buildEjecucionInsert = ({ uuid, plan, usuario, nombre }, tables = tablesFor()) => {
  const campos = seguimiento.CAMPOS_EJECUCION;
  const valores = campos.map(({ columna, fecha }) => (fecha ? `CONVERT(date, @${columna}, 23)` : `@${columna}`));
  return {
    text: `${SIN_ANULAR(tables)}
      INSERT INTO ${tables.ejecucion}
        (rim_uuid, anterior_id, tipo, motivo, ${campos.map(c => c.columna).join(', ')}, origen, usuario, usuario_nombre)
      VALUES (@uuid, @anterior_id, @tipo, @motivo, ${valores.join(', ')}, N'datametplus', @usuario, @nombre);`,
    params: [
      ...paramsRegistro({ uuid, plan, usuario, nombre }),
      ...campos.map(({ campo, columna, fecha, max }) => ({
        name: columna,
        type: fecha ? sql.VarChar(10) : sql.NVarChar(max),
        value: plan.datos[campo],
      })),
    ],
  };
};

/**
 * INSERT de una fila de la entrega ya decidida por planEntrega. La
 * corrección copia las firmas de la fila que reemplaza: no se vuelven a
 * pedir ni pueden cambiarse.
 */
const buildEntregaInsert = ({ uuid, plan, usuario, nombre }, tables = tablesFor()) => {
  const datos = plan.datos || {};
  const params = [
    ...paramsRegistro({ uuid, plan, usuario, nombre }),
    ...seguimiento.CAMPOS_ENTREGA.map(({ campo, columna, fecha, max }) => ({
      name: columna,
      type: fecha ? sql.VarChar(10) : sql.NVarChar(max),
      value: datos[campo] ?? null,
    })),
  ];
  const columnas = `(rim_uuid, anterior_id, tipo, motivo, recibe_nombre, entrega_por, fecha_entrega,
        lugar_entrega, observaciones, firma_cliente, firma_representante, origen, usuario, usuario_nombre)`;
  const datosSql = '@recibe_nombre, @entrega_por, CONVERT(date, @fecha_entrega, 23), @lugar_entrega, @observaciones';
  let insert;
  if (plan.tipo === 'registro') {
    params.push(
      { name: 'firma_cliente', type: sql.VarBinary(sql.MAX), value: plan.firmas.cliente },
      { name: 'firma_representante', type: sql.VarBinary(sql.MAX), value: plan.firmas.representante },
    );
    insert = `INSERT INTO ${tables.entregas} ${columnas}
      VALUES (@uuid, @anterior_id, @tipo, NULL, ${datosSql}, @firma_cliente, @firma_representante,
        N'datametplus', @usuario, @nombre);`;
  } else if (plan.tipo === 'correccion') {
    insert = `INSERT INTO ${tables.entregas} ${columnas}
      SELECT @uuid, @anterior_id, @tipo, @motivo, ${datosSql}, p.firma_cliente, p.firma_representante,
        N'datametplus', @usuario, @nombre
      FROM ${tables.entregas} p WHERE p.id = @anterior_id AND p.rim_uuid = @uuid;
      IF @@ROWCOUNT = 0 THROW 51051, N'La entrega que se corrige no existe.', 1;`;
  } else {
    insert = `INSERT INTO ${tables.entregas} ${columnas}
      VALUES (@uuid, @anterior_id, @tipo, @motivo, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
        N'datametplus', @usuario, @nombre);`;
  }
  return { text: `${SIN_ANULAR(tables)}
      ${insert}`, params };
};

const erroresSeguimiento = (error, etapa) => {
  if (error?.number === 51050) return httpError(409, error.message);
  // Índices únicos de la cadena: otro usuario agregó una fila a la vez.
  if ([2601, 2627, 51051].includes(error?.number)) {
    return httpError(409, `Otro usuario actualizó la ${etapa} mientras la editabas. Recarga la ficha y vuelve a intentarlo.`);
  }
  return error;
};

/**
 * Agrega una versión de la ejecución (6.2): registro, avance o corrección,
 * según lo que cambie respecto de la vigente (ver planEjecucion).
 */
const registrarEjecucion = async (n, entrada, user, { now = new Date() } = {}) => {
  const tables = tablesFor();
  const rim = await rimParaSeguimiento(n, tables);
  const plan = seguimiento.planEjecucion({
    filas: await filasEjecucion(rim.uuid, tables),
    nueva: entrada,
    emitido: rim.emitido,
    hoy: seguimiento.hoyLaPaz(now),
    puedeCorregir: puedeGestionar(user),
  });
  const usuario = usuarioDe(user);
  const insert = buildEjecucionInsert({ uuid: rim.uuid, plan, usuario, nombre: await nombreDe(usuario) }, tables);
  try {
    await run(insert.text, insert.params);
  } catch (error) {
    throw erroresSeguimiento(error, 'ejecución');
  }
  return getRim(n, user);
};

/** Registra, corrige o anula la entrega (6.3); ver planEntrega. */
const registrarEntrega = async (n, entrada, user, { now = new Date() } = {}) => {
  const tables = tablesFor();
  const rim = await rimParaSeguimiento(n, tables);
  const plan = seguimiento.planEntrega({
    filas: await filasEntrega(rim.uuid, tables),
    entrada,
    emitido: rim.emitido,
    hoy: seguimiento.hoyLaPaz(now),
    puedeCorregir: puedeGestionar(user),
  });
  const usuario = usuarioDe(user);
  const insert = buildEntregaInsert({ uuid: rim.uuid, plan, usuario, nombre: await nombreDe(usuario) }, tables);
  try {
    await run(insert.text, insert.params);
  } catch (error) {
    throw erroresSeguimiento(error, 'entrega');
  }
  return getRim(n, user);
};

/**
 * Anula un RIM: agrega su fila en form_rim_anulaciones. El RIM no se
 * modifica; una anulación no se edita ni se repite.
 */
const anularRim = async (n, { motivo, reemplazadoPor }, user) => {
  const tables = tablesFor();
  const usuario = usuarioDe(user);
  const nombre = await nombreDe(usuario);
  try {
    await run(`
      SET XACT_ABORT ON;
      DECLARE @uuid uniqueidentifier = (SELECT uuid FROM ${tables.rim} WHERE n = @n);
      IF @uuid IS NULL THROW 51030, N'El RIM no existe.', 1;
      IF EXISTS (SELECT 1 FROM ${tables.anulaciones} WHERE rim_uuid = @uuid)
        THROW 51031, N'El RIM ya está anulado.', 1;
      IF @reemplazado_por IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM ${tables.rim} WHERE codigo_rim = @reemplazado_por AND uuid <> @uuid)
        THROW 51032, N'No existe otro RIM registrado con el código indicado como reemplazo.', 1;
      INSERT INTO ${tables.anulaciones}
        (rim_uuid, motivo, anulado_en, anulado_por, anulado_por_nombre, origen, reemplazado_por, reg_usuario)
      VALUES (@uuid, @motivo, SYSDATETIMEOFFSET(), @usuario, @nombre, N'datametplus', @reemplazado_por, @usuario);`,
    [
      { name: 'n', type: sql.Int, value: n },
      { name: 'motivo', type: sql.NVarChar(1000), value: motivo },
      { name: 'usuario', type: sql.NVarChar(100), value: usuario },
      { name: 'nombre', type: sql.NVarChar(150), value: nombre },
      { name: 'reemplazado_por', type: sql.NVarChar(60), value: reemplazadoPor },
    ]);
  } catch (error) {
    if (error?.number === 51030) throw httpError(404, error.message);
    if ([51031, 2601, 2627].includes(error?.number)) throw httpError(409, 'El RIM ya está anulado.');
    if (error?.number === 51032) throw httpError(400, error.message);
    throw error;
  }
  return getRim(n, user);
};

/** Talonarios de la gestión, con el estado de cada número. */
const listTalonarios = async (gestion, user) => {
  const tables = tablesFor();
  const params = [{ name: 'gestion', type: sql.SmallInt, value: gestion }];
  const [rows, numeros] = await Promise.all([
    run(`
      SELECT t.id, t.gestion, t.desde, t.hasta, t.origen, t.instalacion, t.dispositivo, t.usuario,
        t.reg_por, t.app_version, CONVERT(varchar(19), t.fecha_reg, 126) AS fecha_reg_texto,
        c.id AS cierre_id, c.ultimo_usado, c.motivo AS cierre_motivo, c.detalle AS cierre_detalle,
        c.origen AS cierre_origen, c.usuario AS cierre_usuario,
        CONVERT(varchar(19), c.fecha_reg, 126) AS cierre_fecha_texto
      FROM ${tables.talonarios} t
      LEFT JOIN ${tables.cierres} c ON c.talonario_id = t.id
      WHERE t.gestion = @gestion
      ORDER BY t.desde DESC;`, params),
    run(`
      SELECT talonario_id, numero FROM ${tables.rim}
      WHERE gestion = @gestion AND talonario_id IS NOT NULL;`, params),
  ]);
  const porTalonario = new Map();
  for (const row of numeros) {
    if (!porTalonario.has(row.talonario_id)) porTalonario.set(row.talonario_id, []);
    porTalonario.get(row.talonario_id).push(row.numero);
  }
  return {
    gestion,
    talonarios: rows.map(row => mapTalonario(row, porTalonario.get(row.id) || [], user)),
  };
};

/**
 * Cierra un talonario de un teléfono que ya no lo usará (perdido,
 * reinstalado): sus números sin RIM pasan a «no utilizados».
 */
const cerrarTalonario = async (id, { motivo, detalle, ultimoUsado }, user) => {
  const tables = tablesFor();
  const usuario = usuarioDe(user);
  const nombre = await nombreDe(usuario);
  let gestion;
  try {
    const rows = await run(`
      SET XACT_ABORT ON;
      DECLARE @desde int = NULL, @hasta int = NULL, @gestion smallint = NULL;
      SELECT @desde = desde, @hasta = hasta, @gestion = gestion
      FROM ${tables.talonarios} WHERE id = @id AND origen = N'servicemet';
      IF @desde IS NULL THROW 51040, N'El talonario no existe.', 1;
      IF @ultimo_usado IS NOT NULL AND @ultimo_usado NOT BETWEEN @desde AND @hasta
        THROW 51041, N'El último número usado no pertenece al talonario.', 1;
      IF EXISTS (SELECT 1 FROM ${tables.cierres} WHERE talonario_id = @id)
        THROW 51042, N'El talonario ya está cerrado.', 1;
      INSERT INTO ${tables.cierres} (talonario_id, ultimo_usado, motivo, detalle, origen, usuario, reg_por)
      VALUES (@id, @ultimo_usado, @motivo, @detalle, N'datametplus', @usuario, @nombre);
      SELECT @gestion AS gestion;`,
    [
      { name: 'id', type: sql.Int, value: id },
      { name: 'ultimo_usado', type: sql.Int, value: ultimoUsado },
      { name: 'motivo', type: sql.NVarChar(30), value: motivo },
      { name: 'detalle', type: sql.NVarChar(500), value: detalle },
      { name: 'usuario', type: sql.NVarChar(100), value: usuario },
      { name: 'nombre', type: sql.NVarChar(150), value: nombre },
    ]);
    gestion = rows[0]?.gestion;
  } catch (error) {
    if (error?.number === 51040) throw httpError(404, error.message);
    if (error?.number === 51041) throw httpError(400, error.message);
    if ([51042, 2601, 2627].includes(error?.number)) throw httpError(409, 'El talonario ya está cerrado.');
    throw error;
  }
  const { talonarios } = await listTalonarios(gestion, user);
  return talonarios.find(talonario => talonario.id === id) || null;
};

/** Columnas de form_rim para un RIM del formulario web ya validado. */
const webRimColumns = (rim, { usuario, nombre, gestion, numero }) => {
  const text = (name, max, value) => ({ name, type: sql.NVarChar(max), value: value ?? null });
  return [
    { name: 'uuid', type: sql.UniqueIdentifier, value: rim.uuid },
    text('codigo_rim', 60, rimCodigo(gestion, numero)),
    text('origen', 20, 'datametplus'),
    { name: 'gestion', type: sql.SmallInt, value: gestion },
    { name: 'numero', type: sql.Int, value: numero },
    text('reg_usuario', 100, usuario),
    text('reg_por', 150, nombre),
    text('usuario_app', 100, usuario),
    text('app_version', 30, rim.appVersion),
    text('tipo_servicio', 20, 'directo'),
    text('servicio', 100, 'Registro web (DataMET+)'),
    text('cod_cliente', 30, rim.cliente.codigo),
    text('cliente', 255, rim.cliente.nombre),
    text('razon_social', 255, rim.cliente.razonSocial),
    text('nit', 30, rim.cliente.nit),
    text('cod_planta', 30, rim.planta.codigo),
    text('planta', 255, rim.planta.nombre),
    text('dir_planta', 255, rim.planta.direccion || rim.cliente.direccion),
    text('dep_planta', 120, rim.planta.departamento || rim.cliente.ciudad),
    text('cod_metrica', 80, rim.instrumento.codMetrica || ''),
    text('instrumento', 120, rim.instrumento.tipo),
    text('marca', 120, rim.instrumento.marca),
    text('modelo', 120, rim.instrumento.modelo),
    text('serie', 120, rim.instrumento.serie),
    text('capacidad', 120, rim.instrumento.capacidad),
    text('division', 120, rim.instrumento.division),
    text('unidad', 20, rim.instrumento.unidad),
    text('ubicacion', 255, rim.instrumento.ubicacion),
    text('observaciones', 2000, rim.instrumento.observaciones),
    text('motivo', 2000, rim.motivo),
    {
      name: 'inventario',
      type: sql.NVarChar(sql.MAX),
      value: JSON.stringify({
        items: rim.inventario.items,
        quantities: Object.fromEntries(Object.entries(rim.inventario.cantidades).filter(([, value]) => value)),
        others: rim.inventario.otros.map(item => ({ name: item.nombre, status: item.estado })),
      }),
    },
    text('obs_inventario', 1000, rim.obsInventario),
    text('estado_general', 20, rim.estadoGeneral),
    { name: 'danos', type: sql.NVarChar(sql.MAX), value: JSON.stringify(rim.danos) },
    text('descripcion_danos', 2000, rim.descripcionDanos),
    text('nivel_suciedad', 20, rim.nivelSuciedad),
    { name: 'pruebas_funcionamiento', type: sql.Bit, value: rim.pruebas },
    text('descripcion_pruebas', 2000, rim.descripcionPruebas),
    text('contacto_nombre', 150, rim.contacto.nombre),
    text('contacto_cargo', 100, rim.contacto.cargo),
    text('contacto_telefono', 30, rim.contacto.telefono),
    text('contacto_correo', 150, rim.contacto.correo),
    text('representante_metrica', 150, rim.representanteMetrica),
    text('lugar_recepcion', 255, rim.lugarRecepcion),
    text('tecnico_asignado', 150, rim.tecnicoAsignado),
    { name: 'firma_cliente', type: sql.VarBinary(sql.MAX), value: rim.firmaCliente },
    { name: 'firma_representante', type: sql.VarBinary(sql.MAX), value: rim.firmaRepresentante },
  ];
};

/**
 * Registra un RIM del formulario web. En una sola transacción toma el
 * siguiente número de la gestión (talonario de un número, con el UUID del
 * RIM como solicitud: reenviar no consume otro), inserta el RIM y sus fotos.
 */
const createWebRim = async (rim, user, { withTransaction, now = new Date() }) => {
  const tables = tablesFor();
  const usuario = usuarioDe(user);
  const nombre = await nombreDe(usuario);
  const gestion = gestionActual(now);
  try {
    return await withTransaction(async (request) => {
      const existente = await run(
        `SELECT n, codigo_rim FROM ${tables.rim} WHERE uuid = @uuid;`,
        [{ name: 'uuid', type: sql.UniqueIdentifier, value: rim.uuid }],
        request,
      );
      if (existente.length) {
        return { n: existente[0].n, codigo: existente[0].codigo_rim, duplicate: true };
      }
      const [talonario] = await run(`
        EXEC ${tables.reservar} @solicitud = @solicitud, @gestion = @gestion, @cantidad = 1,
          @origen = N'datametplus', @usuario = @usuario, @reg_por = @nombre, @app_version = @app_version;`,
      [
        { name: 'solicitud', type: sql.UniqueIdentifier, value: rim.uuid },
        { name: 'gestion', type: sql.SmallInt, value: gestion },
        { name: 'usuario', type: sql.NVarChar(100), value: usuario },
        { name: 'nombre', type: sql.NVarChar(150), value: nombre },
        { name: 'app_version', type: sql.NVarChar(30), value: rim.appVersion },
      ], request);
      if (!talonario?.id) throw httpError(500, 'SQL Server no devolvió el número del RIM.');

      const columns = webRimColumns(rim, { usuario, nombre, gestion, numero: talonario.desde });
      const names = [...columns.map(column => `[${column.name}]`), '[talonario_id]', '[emitido_en]'];
      const values = [...columns.map(column => `@${column.name}`), '@talonario_id', 'SYSDATETIMEOFFSET()'];
      const [insertado] = await run(`
        INSERT INTO ${tables.rim} (${names.join(', ')})
        OUTPUT INSERTED.n, INSERTED.emitido_en
        VALUES (${values.join(', ')});`,
      [...columns, { name: 'talonario_id', type: sql.Int, value: talonario.id }], request);

      for (const [index, foto] of rim.fotos.entries()) {
        await run(`
          INSERT INTO ${tables.fotos} (rim_uuid, orden, nombre, tipo, contenido)
          VALUES (@uuid, @orden, @nombre, @tipo, @contenido);`,
        [
          { name: 'uuid', type: sql.UniqueIdentifier, value: rim.uuid },
          { name: 'orden', type: sql.TinyInt, value: index + 1 },
          { name: 'nombre', type: sql.NVarChar(255), value: foto.nombre },
          { name: 'tipo', type: sql.NVarChar(50), value: foto.contenido.tipo },
          { name: 'contenido', type: sql.VarBinary(sql.MAX), value: foto.contenido.bytes },
        ], request);
      }
      return {
        n: insertado.n,
        codigo: rimCodigo(gestion, talonario.desde),
        gestion,
        numero: talonario.desde,
        emitidoEn: iso(insertado.emitido_en),
        duplicate: false,
      };
    });
  } catch (error) {
    if ([2601, 2627].includes(error?.number)) {
      // El mismo RIM se envió dos veces a la vez: vale el que llegó primero.
      const [existente] = await run(
        `SELECT n, codigo_rim FROM ${tables.rim} WHERE uuid = @uuid;`,
        [{ name: 'uuid', type: sql.UniqueIdentifier, value: rim.uuid }],
      );
      if (existente) return { n: existente.n, codigo: existente.codigo_rim, duplicate: true };
    }
    if (error?.number === 51011) throw httpError(409, 'Se agotó la numeración del RIM de esta gestión.');
    if (error?.number === 51012) throw httpError(503, 'La numeración del RIM está ocupada; intente de nuevo.');
    throw notReady(error) || error;
  }
};

module.exports = {
  anularRim,
  buildEjecucionInsert,
  buildEntregaInsert,
  buildListQuery,
  buildWhere,
  cerrarTalonario,
  clasificarNumeros,
  createWebRim,
  gestionActual,
  getFiltros,
  getRim,
  leerCodigo,
  listRims,
  listTalonarios,
  mapDetalle,
  mapFila,
  mapTalonario,
  notReady,
  puedeGestionar,
  registrarEjecucion,
  registrarEntrega,
  tablesFor,
  webRimColumns,
};
