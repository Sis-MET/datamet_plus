/**
 * Lista de informes: una fila por servicio vigente de cada tipo, con sus
 * filtros, la vista agrupada por OTST o por técnico y los conteos de los chips.
 */
const { getPool, sql } = require('../config/db');
const { CLAVES_TIPO, ESTADOS, TIPOS, numeroInforme } = require('./soporte.tipos');
const { text } = require('./soporte.validation');
const { fechaIso, iso } = require('./soporte.columnas');
const { permisos } = require('./soporte.permisos');

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

const NUMERO_SQL = `o.otst + N'-' + CASE WHEN LEN(f.cod_metrica) >= 3 THEN RIGHT(f.cod_metrica, 3) ELSE f.cod_metrica END`;
const ESTADO_SQL = `CASE WHEN i.id IS NULL THEN 'PENDIENTE' ELSE i.estado END`;

/** Agrupaciones de la lista: por OTST o por técnico. Sin dato, clave ''. */
const CLAVE_GRUPO_SQL = {
  otst: `ISNULL(LTRIM(RTRIM(o.otst)), N'')`,
  tecnico: `ISNULL(f.tecnico_clave, N'')`,
};

/**
 * Servicios con su informe. `o.otst` es la OTST vigente: la que corrigió el
 * área (ST_INFORMES.datos.otst) o, si no, la de ServiceMET (`f.otst`).
 */
const fromInformes = (tipos) => `
  FROM (${tipos.map(fuenteDe).join('\n  UNION ALL')}) f
  LEFT JOIN dbo.ST_INFORMES i ON i.tipo = f.tipo AND i.codigo_registro = f.codigo_registro
  CROSS APPLY (SELECT COALESCE(NULLIF(LTRIM(RTRIM(JSON_VALUE(i.datos, '$.otst'))), N''), f.otst) AS otst) o`;

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
    // La OTST anterior también encuentra el informe.
    const columnas = ['f.codigo_registro', 'o.otst', 'f.otst', 'f.cliente', 'f.planta', 'f.cod_metrica', 'f.serie',
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
  if (filtros.validacion) {
    add('validacion', sql.VarChar(20), filtros.validacion);
    where.push(`ISNULL(i.validacion_estado, 'BORRADOR') = @validacion AND ISNULL(i.estado, 'BORRADOR') <> 'EMITIDO'`);
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
        SELECT f.tipo, f.codigo_registro, o.otst, f.fecha_servicio, f.personal, f.cliente, f.planta,
          f.cod_metrica, f.tipo_equipo, f.marca, f.modelo, f.serie,
          ${NUMERO_SQL} AS numero,
          ${ESTADO_SQL} AS estado,
          i.id AS informe_id, i.revision, i.actualizado_en, i.emitido_en, i.validacion_estado,
          (SELECT COUNT(*) FROM dbo.ST_INFORMES_FOTOS ft WHERE ft.informe_id = i.id AND ft.quitada_en IS NULL) AS fotos,
          COUNT(*) OVER () AS total
        ${fromInformes(tiposFila)}
        ${where}
        ORDER BY ${filtros.por === 'otst'
          // Dentro de una OTST, en el orden de los instrumentos (001, 002…).
          ? 'f.cod_metrica, f.tipo, f.fecha_servicio DESC'
          : 'f.fecha_servicio DESC, o.otst DESC, f.cod_metrica, f.tipo'}
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
      SELECT f.tipo, o.otst, f.tecnico_clave, f.cliente, f.planta, f.fecha_servicio,
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
          SUM(CASE WHEN estado = 'EN_REVISION' THEN 1 ELSE 0 END) AS en_revision,
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
    estados: { PENDIENTE: row.pendientes, BORRADOR: row.borradores, EMITIDO: row.emitidos, EN_REVISION: row.en_revision ?? 0 },
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
  validacionEstado: row.validacion_estado || 'BORRADOR',
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

module.exports = {
  buildGroupsQuery,
  buildListQuery,
  claveTecnico,
  getFiltros,
  listGrupos,
  listInformes,
  mapFila,
  mapGrupo,
  mapResumen,
};
