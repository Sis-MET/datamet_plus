/**
 * Informes de Soporte técnico.
 *
 * Los datos de cada servicio los sube ServiceMET a DATA_SERVICIOS_DATOS_*
 * (una tabla por tipo, ver soporte.tipos.js). Esas filas son las
 * observaciones originales del técnico y aquí solo se leen: cuando una
 * reposición anula la anterior (`estado_servicio_csv = 'ANULADO'`) vale la
 * fila vigente con el mismo `codigo_registro`.
 *
 * Lo que el área corrige o completa vive en ST_INFORMES.datos (campo → valor)
 * y se superpone a la fila original. Cada cambio queda en
 * ST_INFORMES_HISTORIAL con el valor anterior y el nuevo, quién y cuándo; en
 * un informe emitido, además, con su motivo (NB/ISO/IEC 17025, 7.5.2).
 */
const { getPool, sql } = require('../config/db');
const { withTransaction } = require('./calibration.db');
const { permiteArea } = require('./access.areas');
const { CLAVES_TIPO, ESTADOS, TIPOS, numeroInforme } = require('./soporte.tipos');
const { MAX_FOTOS, httpError, text } = require('./soporte.validation');
const redaccion = require('./soporte.redaccion');

// ─── Columnas ──────────────────────────────────────────────────────────────

/** Columnas de sistema o de identidad del servicio: nunca se editan. */
const PROTEGIDAS = new Set([
  'n', 'id', 'codigo_registro', 'otst', 'cod_metrica', 'cod_planta', 'session_id',
  'tipo_servicio', 'estado_servicio', 'estado_servicio_csv', 'nombre_zip', 'inf_bal',
  'foto_balanza', 'categoria_balanza', 'hora_inicio', 'hora_fin',
]);

const esEditable = (nombre, meta) => Boolean(meta)
  && !PROTEGIDAS.has(nombre)
  && !nombre.endsWith('_foto')
  && meta.tipo !== 'fechahora'
  && meta.tipo !== 'otro';

const TIPO_COLUMNA = {
  nvarchar: 'texto', varchar: 'texto', nchar: 'texto', char: 'texto', ntext: 'texto', text: 'texto',
  int: 'entero', bigint: 'entero', smallint: 'entero', tinyint: 'entero', bit: 'entero',
  decimal: 'decimal', numeric: 'decimal', float: 'decimal', real: 'decimal', money: 'decimal',
  date: 'fecha',
  time: 'hora',
  datetime: 'fechahora', datetime2: 'fechahora', smalldatetime: 'fechahora', datetimeoffset: 'fechahora',
};

/** Fila de INFORMATION_SCHEMA.COLUMNS → { tipo, max }. */
const mapColumna = (row) => {
  const tipo = TIPO_COLUMNA[String(row.DATA_TYPE).toLowerCase()] || 'otro';
  const largo = Number(row.CHARACTER_MAXIMUM_LENGTH);
  return {
    tipo,
    max: tipo === 'texto' ? (largo > 0 ? largo : 4000) : null,
  };
};

const cacheColumnas = new Map();

/** Columnas de la tabla del tipo; se leen una vez por proceso. */
const columnasDe = async (tipo) => {
  if (cacheColumnas.has(tipo)) return cacheColumnas.get(tipo);
  const result = await getPool().request()
    .input('tabla', sql.NVarChar(128), TIPOS[tipo].tabla)
    .query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @tabla
      ORDER BY ORDINAL_POSITION;`);
  const columnas = new Map(result.recordset.map(row => [row.COLUMN_NAME, mapColumna(row)]));
  if (columnas.size === 0) throw httpError(503, `La tabla ${TIPOS[tipo].tabla} no existe en la base.`);
  cacheColumnas.set(tipo, columnas);
  return columnas;
};

// ─── Valores ───────────────────────────────────────────────────────────────

const pad = (value) => String(value).padStart(2, '0');

/** Valor leído de SQL Server, listo para JSON. */
const normalizarValor = (valor, meta) => {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    if (meta?.tipo === 'hora') return `${pad(valor.getUTCHours())}:${pad(valor.getUTCMinutes())}`;
    if (meta?.tipo === 'fecha') return valor.toISOString().slice(0, 10);
    return valor.toISOString();
  }
  if (Buffer.isBuffer(valor)) return null;
  if (typeof valor === 'string') return text(valor) || null;
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  return valor;
};

/** Fila original del servicio con valores normalizados. */
const normalizarFuente = (row, columnas) => Object.fromEntries(
  Object.entries(row).map(([campo, valor]) => [campo, normalizarValor(valor, columnas.get(campo))]),
);

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/**
 * Convierte el valor que llega del formulario al tipo de la columna. Vacío
 * es null. Lanza 400 con un mensaje para el usuario si no es válido.
 */
const coercer = (campo, meta, valor) => {
  if (valor === null || valor === undefined) return null;
  const crudo = typeof valor === 'string' ? text(valor) : valor;
  if (crudo === '') return null;

  switch (meta.tipo) {
    case 'texto': {
      const value = String(crudo);
      if (value.length > meta.max) throw httpError(400, `«${campo}» admite como máximo ${meta.max} caracteres.`);
      return value;
    }
    case 'entero':
    case 'decimal': {
      const numero = typeof crudo === 'number' ? crudo : Number(String(crudo).replace(',', '.'));
      if (!Number.isFinite(numero) || Math.abs(numero) >= 1e12) throw httpError(400, `«${campo}» debe ser un número.`);
      if (meta.tipo === 'entero' && !Number.isInteger(numero)) throw httpError(400, `«${campo}» debe ser un número entero.`);
      return numero;
    }
    case 'fecha': {
      const match = FECHA.exec(String(crudo));
      const fecha = match ? new Date(`${crudo}T00:00:00Z`) : null;
      if (!fecha || Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== crudo) {
        throw httpError(400, `«${campo}» debe ser una fecha válida.`);
      }
      return crudo;
    }
    case 'hora': {
      const match = HORA.exec(String(crudo));
      if (!match) throw httpError(400, `«${campo}» debe ser una hora (HH:MM).`);
      return `${match[1]}:${match[2]}`;
    }
    default:
      throw httpError(400, `«${campo}» no se puede editar.`);
  }
};

const iguales = (a, b) => {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a) === String(b);
};

/** Valor que muestra el informe: el corregido si lo hay, si no el original. */
const valorEfectivo = (campo, fuente, datos) => (
  Object.prototype.hasOwnProperty.call(datos, campo) ? datos[campo] : (fuente[campo] ?? null)
);

/**
 * Aplica los cambios entrantes sobre los datos corregidos del informe. Un
 * campo que vuelve a su valor original deja de figurar como corregido.
 * Devuelve los datos nuevos y la lista de cambios reales (antes → después).
 */
const planCambios = ({ fuente, datos, entrantes, columnas }) => {
  const nuevos = { ...datos };
  const cambios = [];
  for (const [campo, valor] of Object.entries(entrantes)) {
    const meta = columnas.get(campo);
    if (!esEditable(campo, meta)) throw httpError(400, `El campo «${campo}» no se puede editar.`);
    const despues = coercer(campo, meta, valor);
    const antes = valorEfectivo(campo, fuente, datos);
    if (iguales(despues, fuente[campo] ?? null)) delete nuevos[campo];
    else nuevos[campo] = despues;
    if (!iguales(antes, despues)) cambios.push({ campo, antes, despues });
  }
  return { datos: ordenarClaves(nuevos), cambios };
};

const ordenarClaves = (objeto) => Object.fromEntries(
  Object.keys(objeto).sort().map(clave => [clave, objeto[clave]]),
);

const leerDatos = (json) => {
  try {
    const value = JSON.parse(json || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

// ─── Permisos ──────────────────────────────────────────────────────────────

/** Editan, emiten y corrigen el área Soporte Técnico y Sistemas (nivel 3). */
const puedeEditarArea = (area, accesoCron) => permiteArea('soporte', { area, acceso_cron: accesoCron });

const datosUsuario = async (user) => {
  const userId = Number(user?.id);
  if (!Number.isInteger(userId)) return { area: null, nombre: null };
  const result = await getPool().request()
    .input('id', sql.Int, userId)
    .query(`
      SELECT TOP (1) area, LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre
      FROM DATA_USERS WHERE id = @id;`);
  const row = result.recordset[0] || {};
  return { area: row.area || null, nombre: row.nombre || null };
};

const permisos = async (user) => {
  const { area, nombre } = await datosUsuario(user);
  return { editar: puedeEditarArea(area, user?.acceso_cron), nombre };
};

const exigirEditor = async (user) => {
  const actor = await permisos(user);
  if (!actor.editar) throw httpError(403, 'Solo el área de Soporte Técnico puede modificar los informes.');
  return {
    usuario: String(user?.usuario || 'sistema').slice(0, 50),
    nombre: actor.nombre ? actor.nombre.slice(0, 120) : null,
  };
};

// ─── Lista ─────────────────────────────────────────────────────────────────

const escapeLike = (value) => String(value).replace(/[\\%_[]/g, (char) => `\\${char}`);

/**
 * El mismo técnico figura con variantes: «Aux. Elvis Villca  .» y
 * «Tec. Elvis Villca  .», o «Tec. Jhonatan Barrau» y «Tec. Jhonatan Barrau F.».
 * Para agrupar y filtrar se quitan el título, el punto final y la inicial
 * del segundo apellido: «Elvis Villca», «Jhonatan Barrau».
 */
const TITULOS_TECNICO = ['Tec.', 'Téc.', 'Aux.', 'Ing.', 'Pas.', 'Lic.', 'Sr.', 'Sra.'];
const claveTecnicoSql = (columna) => `
  CROSS APPLY (SELECT LTRIM(RTRIM(${columna})) AS p0) n0
  CROSS APPLY (SELECT CASE WHEN ${TITULOS_TECNICO.map(t => `n0.p0 LIKE N'${t} %'`).join(' OR ')}
    THEN LTRIM(SUBSTRING(n0.p0, CHARINDEX(N' ', n0.p0) + 1, 200)) ELSE n0.p0 END AS p1) n1
  CROSS APPLY (SELECT CASE WHEN n1.p1 LIKE N'% .' OR n1.p1 = N'.'
    THEN RTRIM(LEFT(n1.p1, LEN(n1.p1) - 1)) ELSE n1.p1 END AS p2) n2a
  CROSS APPLY (SELECT NULLIF(CASE WHEN n2a.p2 LIKE N'% _.'
    THEN RTRIM(LEFT(n2a.p2, LEN(n2a.p2) - 2)) ELSE n2a.p2 END, N'') AS tecnico_clave) n2`;

/** Lo mismo en JavaScript (pruebas y nombres que llegan del navegador). */
const claveTecnico = (nombre) => {
  let valor = text(nombre);
  const titulo = TITULOS_TECNICO.find(t => valor.startsWith(`${t} `));
  if (titulo) valor = valor.slice(titulo.length).trim();
  if (valor.endsWith(' .') || valor === '.') valor = valor.slice(0, -1).trim();
  if (/\s\S\.$/.test(valor)) valor = valor.slice(0, -2).trim();
  return valor || null;
};

/** Fila vigente de cada servicio de un tipo, con las columnas de la lista. */
const fuenteDe = (tipo) => `
  SELECT '${tipo}' AS tipo, x.codigo_registro, x.otst, x.fecha_servicio, x.personal, x.cliente,
    x.planta, x.cod_metrica, x.tipo_equipo, x.marca, x.modelo, x.serie, n2.tecnico_clave
  FROM (
    SELECT t.codigo_registro, t.otst, t.fecha_servicio, t.personal, t.cliente, t.planta,
      t.cod_metrica, t.tipo_equipo, t.marca, t.modelo, t.serie,
      ROW_NUMBER() OVER (PARTITION BY t.codigo_registro ORDER BY t.n DESC) AS rn
    FROM dbo.[${TIPOS[tipo].tabla}] t
    WHERE t.codigo_registro IS NOT NULL AND ISNULL(t.estado_servicio_csv, N'') <> N'ANULADO'
  ) x${claveTecnicoSql('x.personal')}
  WHERE x.rn = 1`;

const NUMERO_SQL = `f.otst + N'-' + CASE WHEN LEN(f.cod_metrica) >= 3 THEN RIGHT(f.cod_metrica, 3) ELSE f.cod_metrica END`;
const ESTADO_SQL = `CASE WHEN i.id IS NULL THEN 'PENDIENTE' ELSE i.estado END`;

/** Agrupaciones de la lista: por OTST o por técnico. Sin dato, clave ''. */
const CLAVE_GRUPO_SQL = {
  otst: `ISNULL(LTRIM(RTRIM(f.otst)), N'')`,
  tecnico: `ISNULL(f.tecnico_clave, N'')`,
};

const fromInformes = (tipos) => `
  FROM (${tipos.map(fuenteDe).join('\n  UNION ALL')}) f
  LEFT JOIN dbo.ST_INFORMES i ON i.tipo = f.tipo AND i.codigo_registro = f.codigo_registro`;

/**
 * WHERE de la lista. Con `conTipo` / `conEstado` en false omite ese filtro
 * (para contar cuántos hay de cada tipo y en cada estado).
 */
const buildWhere = (filtros, { conTipo = true, conEstado = true } = {}) => {
  const where = [];
  const params = [];
  const add = (name, type, value) => params.push({ name, type, value });

  if (filtros.q) {
    add('q', sql.NVarChar(200), `%${escapeLike(filtros.q)}%`);
    const columnas = ['f.codigo_registro', 'f.otst', 'f.cliente', 'f.planta', 'f.cod_metrica', 'f.serie',
      'f.personal', 'f.tipo_equipo', 'f.marca', 'f.modelo', `(${NUMERO_SQL})`];
    where.push(`(${columnas.map(columna => `${columna} LIKE @q ESCAPE '\\'`).join(' OR ')})`);
  }
  if (filtros.cliente) {
    add('cliente', sql.NVarChar(250), filtros.cliente);
    where.push('f.cliente = @cliente');
  }
  if (filtros.tecnico) {
    add('tecnico', sql.NVarChar(100), claveTecnico(filtros.tecnico));
    where.push('f.tecnico_clave = @tecnico');
  }
  // Informes de un grupo de la lista agrupada.
  if (filtros.por && filtros.grupo !== undefined && filtros.grupo !== null) {
    add('grupo', sql.NVarChar(250), filtros.grupo);
    where.push(`${CLAVE_GRUPO_SQL[filtros.por]} = @grupo`);
  }
  if (filtros.desde) {
    add('desde', sql.Date, new Date(`${filtros.desde}T00:00:00Z`));
    where.push('f.fecha_servicio >= @desde');
  }
  if (filtros.hasta) {
    add('hasta', sql.Date, new Date(`${filtros.hasta}T00:00:00Z`));
    where.push('f.fecha_servicio <= @hasta');
  }
  if (conTipo && filtros.tipo) {
    add('tipo', sql.VarChar(10), filtros.tipo);
    where.push('f.tipo = @tipo');
  }
  if (conEstado && filtros.estado) {
    add('estado', sql.VarChar(20), filtros.estado);
    where.push(`${ESTADO_SQL} = @estado`);
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

/** Página de la lista y conteos por tipo y estado. */
const buildListQuery = (filtros) => {
  const { where, params } = buildWhere(filtros);
  const conteo = buildWhere(filtros, { conTipo: false, conEstado: false });
  const offset = (filtros.page - 1) * filtros.pageSize;
  const tiposFila = filtros.tipo ? [filtros.tipo] : CLAVES_TIPO;
  return {
    rows: {
      text: `
        SELECT f.tipo, f.codigo_registro, f.otst, f.fecha_servicio, f.personal, f.cliente, f.planta,
          f.cod_metrica, f.tipo_equipo, f.marca, f.modelo, f.serie,
          ${NUMERO_SQL} AS numero,
          ${ESTADO_SQL} AS estado,
          i.id AS informe_id, i.revision, i.actualizado_en, i.emitido_en,
          (SELECT COUNT(*) FROM dbo.ST_INFORMES_FOTOS ft WHERE ft.informe_id = i.id AND ft.quitada_en IS NULL) AS fotos,
          COUNT(*) OVER () AS total
        ${fromInformes(tiposFila)}
        ${where}
        ORDER BY ${filtros.por === 'otst'
          // Dentro de una OTST, en el orden de los instrumentos (001, 002…).
          ? 'f.cod_metrica, f.tipo, f.fecha_servicio DESC'
          : 'f.fecha_servicio DESC, f.otst DESC, f.cod_metrica, f.tipo'}
        OFFSET ${offset} ROWS FETCH NEXT ${filtros.pageSize} ROWS ONLY;`,
      params,
    },
    counts: {
      text: `
        SELECT f.tipo, ${ESTADO_SQL} AS estado, COUNT(*) AS cantidad
        ${fromInformes(CLAVES_TIPO)}
        ${conteo.where}
        GROUP BY f.tipo, ${ESTADO_SQL};`,
      params: conteo.params,
    },
  };
};

/**
 * Página de grupos (OTST o técnico) con cuántos informes tiene cada uno en
 * cada estado y sus fechas; una segunda consulta trae sus clientes, plantas,
 * técnicos y servicios.
 */
const buildGroupsQuery = (filtros) => {
  const { where, params } = buildWhere({ ...filtros, grupo: undefined });
  const offset = (filtros.page - 1) * filtros.pageSize;
  const clave = CLAVE_GRUPO_SQL[filtros.por];
  const base = `
    WITH base AS (
      SELECT f.tipo, f.otst, f.tecnico_clave, f.cliente, f.planta, f.fecha_servicio,
        ${clave} AS clave, ${ESTADO_SQL} AS estado
      ${fromInformes(filtros.tipo ? [filtros.tipo] : CLAVES_TIPO)}
      ${where}
    )`;
  return {
    grupos: {
      text: `${base}
        SELECT clave, COUNT(*) AS total,
          SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
          SUM(CASE WHEN estado = 'BORRADOR' THEN 1 ELSE 0 END) AS borradores,
          SUM(CASE WHEN estado = 'EMITIDO' THEN 1 ELSE 0 END) AS emitidos,
          MIN(fecha_servicio) AS desde, MAX(fecha_servicio) AS hasta,
          COUNT(DISTINCT otst) AS otsts,
          COUNT(*) OVER () AS total_grupos,
          SUM(COUNT(*)) OVER () AS total_informes
        FROM base
        GROUP BY clave
        ORDER BY ${filtros.por === 'otst' ? 'MAX(fecha_servicio) DESC, clave DESC' : 'clave'}
        OFFSET ${offset} ROWS FETCH NEXT ${filtros.pageSize} ROWS ONLY;`,
      params,
    },
    /** Detalle de los grupos de la página (`claves`, de la primera consulta). */
    detalle: (claves) => ({
      text: `${base}
        SELECT DISTINCT clave, tipo, LTRIM(RTRIM(cliente)) AS cliente, LTRIM(RTRIM(planta)) AS planta, tecnico_clave
        FROM base
        WHERE clave IN (${claves.map((_, index) => `@g${index}`).join(', ') || 'NULL'});`,
      params: [
        ...params,
        ...claves.map((valor, index) => ({ name: `g${index}`, type: sql.NVarChar(250), value: valor })),
      ],
    }),
  };
};

const distintos = (lista) => [...new Set(lista.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

/** Grupo de la lista con su resumen. */
const mapGrupo = (row, detalle) => {
  const filas = detalle.filter(fila => fila.clave === row.clave);
  return {
    clave: row.clave,
    total: row.total,
    estados: { PENDIENTE: row.pendientes, BORRADOR: row.borradores, EMITIDO: row.emitidos },
    desde: fechaIso(row.desde),
    hasta: fechaIso(row.hasta),
    otsts: row.otsts,
    clientes: distintos(filas.map(f => f.cliente)),
    plantas: distintos(filas.map(f => f.planta)),
    tecnicos: distintos(filas.map(f => f.tecnico_clave)),
    tipos: [...new Set(filas.map(f => f.tipo))].sort((a, b) => CLAVES_TIPO.indexOf(a) - CLAVES_TIPO.indexOf(b)),
  };
};

/** Conteos de los chips: cada dimensión respeta el filtro de la otra. */
const mapResumen = (rows, filtros) => {
  const tipos = Object.fromEntries(CLAVES_TIPO.map(tipo => [tipo, 0]));
  const estados = Object.fromEntries(ESTADOS.map(estado => [estado, 0]));
  let total = 0;
  for (const row of rows) {
    const cantidad = Number(row.cantidad) || 0;
    total += cantidad;
    if (!filtros.estado || row.estado === filtros.estado) tipos[row.tipo] = (tipos[row.tipo] || 0) + cantidad;
    if (!filtros.tipo || row.tipo === filtros.tipo) estados[row.estado] = (estados[row.estado] || 0) + cantidad;
  }
  return { tipos, estados, total };
};

const iso = (value) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null);
const fechaIso = (value) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString().slice(0, 10) : null);
const limpio = (value) => (value === null || value === undefined ? null : text(value) || null);

const mapFila = (row) => ({
  tipo: row.tipo,
  tipoLabel: TIPOS[row.tipo]?.etiqueta || row.tipo,
  codigo: row.codigo_registro,
  numero: row.numero || numeroInforme(row.otst, row.cod_metrica),
  otst: limpio(row.otst),
  fechaServicio: fechaIso(row.fecha_servicio),
  tecnico: limpio(row.personal),
  cliente: limpio(row.cliente),
  planta: limpio(row.planta),
  codMetrica: limpio(row.cod_metrica),
  instrumento: {
    tipo: limpio(row.tipo_equipo),
    marca: limpio(row.marca),
    modelo: limpio(row.modelo),
    serie: limpio(row.serie),
  },
  estado: row.estado,
  revision: row.revision ?? 0,
  actualizadoEn: iso(row.actualizado_en),
  emitidoEn: iso(row.emitido_en),
  fotos: row.fotos ?? 0,
});

const runQuery = (query, request = getPool().request()) => {
  for (const param of query.params) request.input(param.name, param.type, param.value);
  return request.query(query.text);
};

const listInformes = async (filtros, user) => {
  const query = buildListQuery(filtros);
  const [rows, counts, actor] = await Promise.all([
    runQuery(query.rows),
    runQuery(query.counts),
    permisos(user),
  ]);
  return {
    items: rows.recordset.map(mapFila),
    total: rows.recordset[0]?.total ?? 0,
    page: filtros.page,
    pageSize: filtros.pageSize,
    resumen: mapResumen(counts.recordset, filtros),
    acciones: { editar: actor.editar },
  };
};

/** Lista agrupada por OTST o por técnico. */
const listGrupos = async (filtros, user) => {
  const query = buildGroupsQuery(filtros);
  const { counts } = buildListQuery({ ...filtros, grupo: undefined });
  const [grupos, conteos, actor] = await Promise.all([
    runQuery(query.grupos),
    runQuery(counts),
    permisos(user),
  ]);
  const claves = grupos.recordset.map(row => row.clave);
  const detalle = claves.length ? (await runQuery(query.detalle(claves))).recordset : [];
  return {
    por: filtros.por,
    grupos: grupos.recordset.map(row => mapGrupo(row, detalle)),
    total: grupos.recordset[0]?.total_grupos ?? 0,
    totalInformes: grupos.recordset[0]?.total_informes ?? 0,
    page: filtros.page,
    pageSize: filtros.pageSize,
    resumen: mapResumen(conteos.recordset, filtros),
    acciones: { editar: actor.editar },
  };
};

/** Clientes y técnicos con servicios, para el panel de filtros. */
const getFiltros = async () => {
  const result = await getPool().request().query(`
    SELECT DISTINCT 'cliente' AS clase, LTRIM(RTRIM(f.cliente)) AS valor
    FROM (${CLAVES_TIPO.map(fuenteDe).join('\n UNION ALL')}) f WHERE NULLIF(LTRIM(RTRIM(f.cliente)), N'') IS NOT NULL
    UNION
    SELECT DISTINCT 'tecnico', f.tecnico_clave
    FROM (${CLAVES_TIPO.map(fuenteDe).join('\n UNION ALL')}) f WHERE f.tecnico_clave IS NOT NULL;`);
  const de = (clase) => result.recordset
    .filter(row => row.clase === clase)
    .map(row => row.valor)
    .sort((a, b) => a.localeCompare(b, 'es'));
  return {
    tipos: CLAVES_TIPO.map(tipo => ({ value: tipo, label: TIPOS[tipo].etiqueta })),
    clientes: de('cliente'),
    tecnicos: de('tecnico'),
  };
};

// ─── Informe ───────────────────────────────────────────────────────────────

const INFORME_SELECT = `
  SELECT id, tipo, codigo_registro, numero, datos, estado, revision, version,
    creado_por, creado_en, actualizado_por, actualizado_en, emitido_por, emitido_en
  FROM dbo.ST_INFORMES`;

const leerFuente = async (tipo, codigo, columnas) => {
  const result = await getPool().request()
    .input('codigo', sql.NVarChar(100), codigo)
    .query(`
      SELECT TOP (1) * FROM dbo.[${TIPOS[tipo].tabla}]
      WHERE codigo_registro = @codigo AND ISNULL(estado_servicio_csv, N'') <> N'ANULADO'
      ORDER BY n DESC;`);
  const row = result.recordset[0];
  if (!row) throw httpError(404, 'No se encontró el servicio en DataMET (o fue anulado al volver a subirse desde ServiceMET).');
  return normalizarFuente(row, columnas);
};

const leerInforme = async (tipo, codigo, request = getPool().request(), { bloquear = false } = {}) => {
  const result = await request
    .input('tipoInf', sql.VarChar(10), tipo)
    .input('codigoInf', sql.NVarChar(100), codigo)
    .query(`${INFORME_SELECT}${bloquear ? ' WITH (UPDLOCK, HOLDLOCK)' : ''}
      WHERE tipo = @tipoInf AND codigo_registro = @codigoInf;`);
  return result.recordset[0] || null;
};

const nombresDe = async (usuarios) => {
  const lista = [...new Set(usuarios.filter(Boolean))];
  if (lista.length === 0) return new Map();
  const request = getPool().request();
  lista.forEach((usuario, index) => request.input(`u${index}`, sql.NVarChar(50), usuario));
  const result = await request.query(`
    SELECT usuario, LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre
    FROM DATA_USERS WHERE usuario IN (${lista.map((_, index) => `@u${index}`).join(', ')});`);
  return new Map(result.recordset.map(row => [row.usuario, row.nombre]));
};

const dataUrl = (tipo, contenido) => `data:${tipo};base64,${Buffer.from(contenido).toString('base64')}`;

const leerCambios = (json) => {
  try {
    const value = JSON.parse(json || 'null');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const mapHistorial = (row) => ({
  id: Number(row.id),
  accion: row.accion,
  detalle: row.detalle || null,
  motivo: row.motivo || null,
  cambios: leerCambios(row.cambios),
  revision: row.revision,
  usuario: row.usuario,
  usuarioNombre: row.usuario_nombre || null,
  fecha: iso(row.fecha),
});

/** Columnas que el formulario puede editar, con su tipo y largo máximo. */
const columnasEditables = (columnas) => Object.fromEntries(
  [...columnas.entries()].filter(([nombre, meta]) => esEditable(nombre, meta)),
);

const mapDetalle = ({ tipo, codigo, fuente, informe, fotos, historial, columnas, nombres, editar }) => {
  const nombre = (usuario) => (usuario ? { usuario, nombre: nombres.get(usuario) || null } : null);
  return {
    tipo,
    tipoLabel: TIPOS[tipo].etiqueta,
    codigo,
    numero: informe?.numero || numeroInforme(fuente.otst, fuente.cod_metrica),
    fuente,
    datos: informe ? leerDatos(informe.datos) : {},
    columnas: columnasEditables(columnas),
    estado: informe ? informe.estado : 'PENDIENTE',
    revision: informe?.revision ?? 0,
    version: informe?.version ?? null,
    trazabilidad: {
      creadoPor: nombre(informe?.creado_por),
      creadoEn: iso(informe?.creado_en),
      actualizadoPor: nombre(informe?.actualizado_por),
      actualizadoEn: iso(informe?.actualizado_en),
      emitidoPor: nombre(informe?.emitido_por),
      emitidoEn: iso(informe?.emitido_en),
    },
    fotos: fotos.map(foto => ({
      id: foto.id,
      orden: foto.orden,
      descripcion: foto.descripcion || null,
      nombre: foto.nombre || null,
      url: dataUrl(foto.tipo, foto.contenido),
      subidoPor: nombre(foto.subido_por),
      subidoEn: iso(foto.subido_en),
    })),
    historial: historial.map(mapHistorial),
    acciones: { editar, redaccion: editar && redaccion.disponible() },
  };
};

const getInforme = async (tipo, codigo, user) => {
  const columnas = await columnasDe(tipo);
  const [fuente, informe, actor] = await Promise.all([
    leerFuente(tipo, codigo, columnas),
    leerInforme(tipo, codigo),
    permisos(user),
  ]);
  let fotos = [];
  let historial = [];
  if (informe) {
    const [fotosResult, historialResult] = await Promise.all([
      getPool().request().input('id', sql.Int, informe.id).query(`
        SELECT id, orden, descripcion, nombre, tipo, contenido, subido_por, subido_en
        FROM dbo.ST_INFORMES_FOTOS WHERE informe_id = @id AND quitada_en IS NULL
        ORDER BY orden, id;`),
      getPool().request().input('id', sql.Int, informe.id).query(`
        SELECT TOP (300) id, accion, detalle, motivo, cambios, revision, usuario, usuario_nombre, fecha
        FROM dbo.ST_INFORMES_HISTORIAL WHERE informe_id = @id ORDER BY id DESC;`),
    ]);
    fotos = fotosResult.recordset;
    historial = historialResult.recordset;
  }
  const nombres = await nombresDe([
    informe?.creado_por, informe?.actualizado_por, informe?.emitido_por,
    ...fotos.map(foto => foto.subido_por),
  ]);
  return mapDetalle({ tipo, codigo, fuente, informe, fotos, historial, columnas, nombres, editar: actor.editar });
};

// ─── Escritura ─────────────────────────────────────────────────────────────

const CONFLICTO = 'Otra persona guardó cambios en este informe mientras lo editaba. Se cargó la versión vigente: revise y vuelva a aplicar sus cambios.';

const esDuplicado = (error) => [2601, 2627].includes(error?.number || error?.originalError?.info?.number);

/** Comprueba la versión que editó el usuario contra la vigente. */
const verificarVersion = (informe, version) => {
  if (!informe) {
    if (version !== null && version !== undefined) throw httpError(409, CONFLICTO);
    return;
  }
  if (version !== informe.version) throw httpError(409, CONFLICTO);
};

/** En un informe emitido todo cambio es una corrección con motivo. */
const exigirMotivo = (informe, motivo) => {
  if (informe?.estado === 'EMITIDO' && !motivo) {
    throw httpError(400, 'El informe ya fue emitido: indique el motivo de la corrección.');
  }
};

const crearInforme = async (newRequest, { tipo, codigo, fuente, actor, estado = 'BORRADOR', datos = {} }) => {
  const result = await newRequest()
    .input('tipo', sql.VarChar(10), tipo)
    .input('codigo', sql.NVarChar(100), codigo)
    .input('numero', sql.NVarChar(80), numeroInforme(fuente.otst, fuente.cod_metrica) || codigo)
    .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datos))
    .input('estado', sql.VarChar(20), estado)
    .input('usuario', sql.NVarChar(50), actor.usuario)
    .query(`
      INSERT INTO dbo.ST_INFORMES (tipo, codigo_registro, numero, datos, estado, creado_por, creado_en,
        actualizado_por, actualizado_en, emitido_por, emitido_en)
      OUTPUT inserted.id, inserted.tipo, inserted.codigo_registro, inserted.numero, inserted.datos,
        inserted.estado, inserted.revision, inserted.version
      VALUES (@tipo, @codigo, @numero, @datos, @estado, @usuario, SYSUTCDATETIME(),
        @usuario, SYSUTCDATETIME(),
        CASE WHEN @estado = 'EMITIDO' THEN @usuario END,
        CASE WHEN @estado = 'EMITIDO' THEN SYSUTCDATETIME() END);`);
  return result.recordset[0];
};

const registrarHistorial = (newRequest, { informeId, accion, detalle = null, motivo = null, cambios = null, revision, actor }) => newRequest()
  .input('informe', sql.Int, informeId)
  .input('accion', sql.VarChar(20), accion)
  .input('detalle', sql.NVarChar(400), detalle ? String(detalle).slice(0, 400) : null)
  .input('motivo', sql.NVarChar(500), motivo)
  .input('cambios', sql.NVarChar(sql.MAX), cambios ? JSON.stringify(cambios) : null)
  .input('revision', sql.Int, revision)
  .input('usuario', sql.NVarChar(50), actor.usuario)
  .input('nombre', sql.NVarChar(120), actor.nombre)
  .query(`
    INSERT INTO dbo.ST_INFORMES_HISTORIAL (informe_id, accion, detalle, motivo, cambios, revision, usuario, usuario_nombre)
    VALUES (@informe, @accion, @detalle, @motivo, @cambios, @revision, @usuario, @nombre);`);

/**
 * Ejecuta `trabajo` en una transacción con el informe bloqueado (lo crea si
 * todavía no existe) y traduce los choques de concurrencia a 409.
 */
const conInforme = async ({ tipo, codigo, fuente, actor, crear = true }, trabajo) => {
  try {
    await withTransaction(async (newRequest) => {
      let informe = await leerInforme(tipo, codigo, newRequest(), { bloquear: true });
      let nuevo = false;
      if (!informe && crear) {
        informe = await crearInforme(newRequest, { tipo, codigo, fuente, actor });
        nuevo = true;
      }
      await trabajo({ informe, nuevo, newRequest });
    });
  } catch (error) {
    if (esDuplicado(error)) throw httpError(409, CONFLICTO);
    throw error;
  }
};

/** Marca en el historial los campos redactados con la sugerencia de Gemini. */
const marcarIa = (cambios, ia = []) => {
  const conIa = new Set(ia);
  return cambios.map(cambio => (conIa.has(cambio.campo) ? { ...cambio, ia: true } : cambio));
};

/** Corrige o completa campos del informe. */
const guardarCambios = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  const columnas = await columnasDe(tipo);
  const fuente = await leerFuente(tipo, codigo, columnas);

  await withTransaction(async (newRequest) => {
    const informe = await leerInforme(tipo, codigo, newRequest(), { bloquear: true });
    verificarVersion(informe, body.version);
    const plan = planCambios({
      fuente,
      datos: informe ? leerDatos(informe.datos) : {},
      entrantes: body.cambios,
      columnas,
    });
    if (plan.cambios.length === 0) return;
    exigirMotivo(informe, body.motivo);
    const cambios = marcarIa(plan.cambios, body.ia);
    const usaronIa = cambios.some(cambio => cambio.ia);

    const correccion = informe?.estado === 'EMITIDO';
    let id = informe?.id;
    let revision = informe?.revision ?? 0;
    if (!informe) {
      const creado = await crearInforme(newRequest, { tipo, codigo, fuente, actor, datos: plan.datos });
      id = creado.id;
    } else {
      revision += correccion ? 1 : 0;
      await newRequest()
        .input('id', sql.Int, id)
        .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(plan.datos))
        .input('revision', sql.Int, revision)
        .input('usuario', sql.NVarChar(50), actor.usuario)
        .query(`
          UPDATE dbo.ST_INFORMES
          SET datos = @datos, revision = @revision, version = version + 1,
            actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
          WHERE id = @id;`);
    }
    await registrarHistorial(newRequest, {
      informeId: id,
      accion: correccion ? 'CORRECCION' : 'EDICION',
      detalle: `${cambios.length} ${cambios.length === 1 ? 'campo' : 'campos'}${usaronIa ? ' · redacción con IA' : ''}`,
      motivo: correccion ? body.motivo : null,
      cambios,
      revision,
      actor,
    });
  }).catch((error) => {
    if (esDuplicado(error)) throw httpError(409, CONFLICTO);
    throw error;
  });

  return getInforme(tipo, codigo, user);
};

/** Emite el informe: queda quién y cuándo, y desde ahí todo cambio es una corrección. */
const emitirInforme = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  const columnas = await columnasDe(tipo);
  const fuente = await leerFuente(tipo, codigo, columnas);

  await withTransaction(async (newRequest) => {
    const informe = await leerInforme(tipo, codigo, newRequest(), { bloquear: true });
    verificarVersion(informe, body.version);
    if (informe?.estado === 'EMITIDO') throw httpError(409, 'El informe ya fue emitido.');
    let id = informe?.id;
    if (!informe) {
      id = (await crearInforme(newRequest, { tipo, codigo, fuente, actor, estado: 'EMITIDO' })).id;
    } else {
      await newRequest()
        .input('id', sql.Int, id)
        .input('usuario', sql.NVarChar(50), actor.usuario)
        .query(`
          UPDATE dbo.ST_INFORMES
          SET estado = 'EMITIDO', emitido_por = @usuario, emitido_en = SYSUTCDATETIME(),
            version = version + 1, actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
          WHERE id = @id;`);
    }
    await registrarHistorial(newRequest, {
      informeId: id, accion: 'EMISION', detalle: 'Informe emitido', revision: informe?.revision ?? 0, actor,
    });
  }).catch((error) => {
    if (esDuplicado(error)) throw httpError(409, CONFLICTO);
    throw error;
  });

  return getInforme(tipo, codigo, user);
};

// ─── Fotos ─────────────────────────────────────────────────────────────────

/**
 * Las fotos no tocan la versión del informe (no chocan con la edición de
 * campos), pero en un informe emitido son una corrección con motivo.
 */
const revisionTrasCambio = async (newRequest, informe, actor) => {
  const correccion = informe.estado === 'EMITIDO';
  const revision = (informe.revision ?? 0) + (correccion ? 1 : 0);
  await newRequest()
    .input('id', sql.Int, informe.id)
    .input('revision', sql.Int, revision)
    .input('usuario', sql.NVarChar(50), actor.usuario)
    .query(`
      UPDATE dbo.ST_INFORMES
      SET revision = @revision, actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
      WHERE id = @id;`);
  return revision;
};

const etiquetaFoto = (orden, descripcion) => `Foto ${orden}${descripcion ? `: ${descripcion}` : ''}`;

const agregarFoto = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  const fuente = await leerFuente(tipo, codigo, await columnasDe(tipo));

  await conInforme({ tipo, codigo, fuente, actor }, async ({ informe, newRequest }) => {
    exigirMotivo(informe, body.motivo);
    const estado = await newRequest()
      .input('id', sql.Int, informe.id)
      .query(`
        SELECT COUNT(*) AS vigentes, ISNULL(MAX(orden), 0) AS ultimo
        FROM dbo.ST_INFORMES_FOTOS WITH (UPDLOCK, HOLDLOCK)
        WHERE informe_id = @id AND quitada_en IS NULL;`);
    const { vigentes, ultimo } = estado.recordset[0];
    if (vigentes >= MAX_FOTOS) throw httpError(400, `El informe admite hasta ${MAX_FOTOS} fotos.`);
    const orden = ultimo + 1;
    await newRequest()
      .input('id', sql.Int, informe.id)
      .input('orden', sql.Int, orden)
      .input('descripcion', sql.NVarChar(300), body.descripcion)
      .input('nombre', sql.NVarChar(255), body.nombre)
      .input('tipo', sql.NVarChar(50), body.contenido.tipo)
      .input('contenido', sql.VarBinary(sql.MAX), body.contenido.bytes)
      .input('usuario', sql.NVarChar(50), actor.usuario)
      .query(`
        INSERT INTO dbo.ST_INFORMES_FOTOS (informe_id, orden, descripcion, nombre, tipo, contenido, subido_por)
        VALUES (@id, @orden, @descripcion, @nombre, @tipo, @contenido, @usuario);`);
    const revision = await revisionTrasCambio(newRequest, informe, actor);
    await registrarHistorial(newRequest, {
      informeId: informe.id,
      accion: 'FOTO_AGREGADA',
      detalle: etiquetaFoto(vigentes + 1, body.descripcion),
      motivo: informe.estado === 'EMITIDO' ? body.motivo : null,
      revision,
      actor,
    });
  });

  return getInforme(tipo, codigo, user);
};

/** Foto vigente del informe, bloqueada para cambiarla. */
const leerFoto = async (newRequest, informe, fotoId) => {
  if (!informe) throw httpError(404, 'La foto no existe.');
  const result = await newRequest()
    .input('informe', sql.Int, informe.id)
    .input('foto', sql.Int, fotoId)
    .query(`
      SELECT id, orden, descripcion FROM dbo.ST_INFORMES_FOTOS WITH (UPDLOCK, HOLDLOCK)
      WHERE id = @foto AND informe_id = @informe AND quitada_en IS NULL;`);
  const foto = result.recordset[0];
  if (!foto) throw httpError(404, 'La foto no existe o ya fue quitada.');
  return foto;
};

/** Posición (1, 2, …) de la foto entre las vigentes, como se imprime. */
const posicionFoto = async (newRequest, informeId, fotoId) => {
  const result = await newRequest()
    .input('informe', sql.Int, informeId)
    .query(`SELECT id FROM dbo.ST_INFORMES_FOTOS WHERE informe_id = @informe AND quitada_en IS NULL ORDER BY orden, id;`);
  return result.recordset.findIndex(row => row.id === fotoId) + 1;
};

const editarFoto = async (tipo, codigo, fotoId, body, user) => {
  const actor = await exigirEditor(user);
  const fuente = await leerFuente(tipo, codigo, await columnasDe(tipo));

  await conInforme({ tipo, codigo, fuente, actor, crear: false }, async ({ informe, newRequest }) => {
    const foto = await leerFoto(newRequest, informe, fotoId);
    if (iguales(foto.descripcion ?? null, body.descripcion)) return;
    exigirMotivo(informe, body.motivo);
    await newRequest()
      .input('foto', sql.Int, foto.id)
      .input('descripcion', sql.NVarChar(300), body.descripcion)
      .query('UPDATE dbo.ST_INFORMES_FOTOS SET descripcion = @descripcion WHERE id = @foto;');
    const revision = await revisionTrasCambio(newRequest, informe, actor);
    await registrarHistorial(newRequest, {
      informeId: informe.id,
      accion: 'FOTO_EDITADA',
      detalle: `Descripción de la foto ${await posicionFoto(newRequest, informe.id, foto.id)}`,
      motivo: informe.estado === 'EMITIDO' ? body.motivo : null,
      cambios: [{ campo: 'descripcion', antes: foto.descripcion ?? null, despues: body.descripcion }],
      revision,
      actor,
    });
  });

  return getInforme(tipo, codigo, user);
};

const quitarFoto = async (tipo, codigo, fotoId, body, user) => {
  const actor = await exigirEditor(user);
  const fuente = await leerFuente(tipo, codigo, await columnasDe(tipo));

  await conInforme({ tipo, codigo, fuente, actor, crear: false }, async ({ informe, newRequest }) => {
    const foto = await leerFoto(newRequest, informe, fotoId);
    exigirMotivo(informe, body.motivo);
    const posicion = await posicionFoto(newRequest, informe.id, foto.id);
    await newRequest()
      .input('foto', sql.Int, foto.id)
      .input('usuario', sql.NVarChar(50), actor.usuario)
      .input('motivo', sql.NVarChar(500), body.motivo)
      .query(`
        UPDATE dbo.ST_INFORMES_FOTOS
        SET quitada_por = @usuario, quitada_en = SYSUTCDATETIME(), quitada_motivo = @motivo
        WHERE id = @foto;`);
    const revision = await revisionTrasCambio(newRequest, informe, actor);
    await registrarHistorial(newRequest, {
      informeId: informe.id,
      accion: 'FOTO_QUITADA',
      detalle: etiquetaFoto(posicion, foto.descripcion),
      motivo: informe.estado === 'EMITIDO' ? body.motivo : null,
      revision,
      actor,
    });
  });

  return getInforme(tipo, codigo, user);
};

const ordenarFotos = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  const fuente = await leerFuente(tipo, codigo, await columnasDe(tipo));

  await conInforme({ tipo, codigo, fuente, actor, crear: false }, async ({ informe, newRequest }) => {
    if (!informe) throw httpError(404, 'El informe no tiene fotos.');
    const actuales = await newRequest()
      .input('informe', sql.Int, informe.id)
      .query(`
        SELECT id FROM dbo.ST_INFORMES_FOTOS WITH (UPDLOCK, HOLDLOCK)
        WHERE informe_id = @informe AND quitada_en IS NULL ORDER BY orden, id;`);
    const ids = actuales.recordset.map(row => row.id);
    if (ids.length !== body.ids.length || ids.some(id => !body.ids.includes(id))) {
      throw httpError(409, 'Las fotos cambiaron mientras las ordenaba. Vuelva a intentarlo.');
    }
    if (ids.every((id, index) => id === body.ids[index])) return;
    exigirMotivo(informe, body.motivo);
    for (const [index, id] of body.ids.entries()) {
      await newRequest()
        .input('foto', sql.Int, id)
        .input('orden', sql.Int, index + 1)
        .query('UPDATE dbo.ST_INFORMES_FOTOS SET orden = @orden WHERE id = @foto;');
    }
    const revision = await revisionTrasCambio(newRequest, informe, actor);
    await registrarHistorial(newRequest, {
      informeId: informe.id,
      accion: 'FOTOS_ORDEN',
      detalle: 'Nuevo orden de las fotos',
      motivo: informe.estado === 'EMITIDO' ? body.motivo : null,
      revision,
      actor,
    });
  });

  return getInforme(tipo, codigo, user);
};

/** Sugerencia de redacción para un texto (solo editores). */
const sugerirRedaccion = async (body, user) => {
  await exigirEditor(user);
  return redaccion.mejorarRedaccion({
    texto: body.texto,
    seccion: body.seccion,
    servicio: TIPOS[body.tipo].etiqueta.toLowerCase(),
  });
};

module.exports = {
  PROTEGIDAS,
  agregarFoto,
  buildGroupsQuery,
  buildListQuery,
  claveTecnico,
  coercer,
  editarFoto,
  emitirInforme,
  esEditable,
  getFiltros,
  getInforme,
  guardarCambios,
  listGrupos,
  listInformes,
  mapColumna,
  marcarIa,
  mapDetalle,
  mapFila,
  mapGrupo,
  mapResumen,
  normalizarFuente,
  ordenarFotos,
  planCambios,
  puedeEditarArea,
  quitarFoto,
  sugerirRedaccion,
  verificarVersion,
  exigirMotivo,
};
