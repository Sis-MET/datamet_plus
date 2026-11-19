/**
 * Comercial (fase 1): facturas, pagos aplicados y cuentas por cobrar, en las
 * tablas COM_* de DataMET (migración 034). Nada se borra: una factura o un
 * pago se anulan con motivo y cada paso queda en COM_HISTORIAL. Las reglas sin
 * base de datos están en comercial.domain.js.
 *
 * La base está en nivel de compatibilidad 110: no se usa STRING_AGG ni
 * OPENJSON.
 */
const { getPool, sql } = require('../config/db');
const { withTransaction } = require('./calibration.db');
const domain = require('./comercial.domain');

const { httpError } = domain;

const TABLAS = /COM_(CATEGORIAS|FACTURAS|FACTURA_LINEAS|FACTURA_REFERENCIAS|FACTURA_PERSONAS|PAGOS|PAGO_APLICACIONES|CLIENTES|HISTORIAL)/i;

/** Sin la migración 034, Comercial responde 503 con lo que falta. */
const notReady = (error) => {
  const message = error?.message || '';
  if ((error?.number === 208 || /Invalid object name/i.test(message)) && TABLAS.test(message)) {
    return httpError(503, 'Falta aplicar la migración 034 (pnpm migrate en backend): Comercial todavía no tiene sus tablas.');
  }
  return null;
};

const run = async (text, params = [], request = getPool().request()) => {
  for (const param of params) request.input(param.name, param.type, param.value);
  try {
    const result = await request.query(text);
    return result.recordset ?? [];
  } catch (error) {
    if (error?.number === 2627 || error?.number === 2601) {
      throw httpError(409, 'Ese registro ya existe: otra persona lo guardó al mismo tiempo. Recarga y revisa.');
    }
    throw notReady(error) || error;
  }
};

const usuarioDe = (user) => String(user?.usuario || '').slice(0, 50) || 'desconocido';

/** Nombre completo del usuario en DATA_USERS, como referencia. */
const nombreDe = async (usuario) => {
  try {
    const rows = await run(
      `SELECT TOP (1) LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre FROM DATA_USERS WHERE usuario = @usuario`,
      [{ name: 'usuario', type: sql.VarChar(50), value: usuario }],
    );
    return rows[0]?.nombre || null;
  } catch {
    return null;
  }
};

const historial = (newRequest, { entidad, entidadId, accion, detalle, motivo = null, usuario, nombre }) => run(
  `INSERT INTO dbo.COM_HISTORIAL (entidad, entidad_id, accion, detalle, motivo, usuario, nombre)
   VALUES (@entidad, @entidadId, @accion, @detalle, @motivo, @usuario, @nombre)`,
  [
    { name: 'entidad', type: sql.VarChar(10), value: entidad },
    { name: 'entidadId', type: sql.NVarChar(20), value: String(entidadId) },
    { name: 'accion', type: sql.VarChar(15), value: accion },
    { name: 'detalle', type: sql.NVarChar(sql.MAX), value: detalle ? JSON.stringify(detalle) : null },
    { name: 'motivo', type: sql.NVarChar(300), value: motivo },
    { name: 'usuario', type: sql.NVarChar(50), value: usuario },
    { name: 'nombre', type: sql.NVarChar(120), value: nombre },
  ],
  newRequest(),
);

const numero = (value) => (value === null || value === undefined ? null : Number(value));

// ─── Catálogos ────────────────────────────────────────────────────────────

const mapCategoria = (row) => ({
  id: row.id,
  codigo: row.codigo,
  nombre: row.nombre,
  area: row.area,
  subarea: row.subarea,
  regla: row.regla_margen,
  comisiona: Boolean(row.comisiona),
  vigente: Boolean(row.vigente),
  orden: row.orden,
});

const listCategorias = async (request) => (await run(
  `SELECT id, codigo, nombre, area, subarea, regla_margen, comisiona, vigente, orden, excel_columna, excel_encabezado
   FROM dbo.COM_CATEGORIAS ORDER BY orden`,
  [],
  request,
)).map(row => ({ ...mapCategoria(row), excelColumna: row.excel_columna, excelEncabezado: row.excel_encabezado }));

/** Personal activo, para elegir responsables y ejecutores. */
const listPersonal = async () => (await run(
  `SELECT id, LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre, area, cargo
   FROM DATA_USERS WHERE estado = 'ACTIVO' ORDER BY nombre1, apellido1`,
)).map(row => ({ id: row.id, nombre: row.nombre, area: row.area || null, cargo: row.cargo || null }));

/** Clientes de DataMET por código, nombre o NIT, con su ficha de facturación. */
const buscarClientes = async ({ q }) => {
  if (!q) return [];
  const rows = await run(
    `SELECT TOP (15) LTRIM(RTRIM(c.codigo_cliente)) AS codigo, c.razonsocial, c.cliente, c.nit, c.rubro, c.estado,
       cc.plazo_dias, cc.correos
     FROM DATA_CLIENTES c
     LEFT JOIN dbo.COM_CLIENTES cc ON cc.cliente_codigo = LTRIM(RTRIM(c.codigo_cliente))
     WHERE c.codigo_cliente LIKE @q OR c.razonsocial LIKE @like OR c.cliente LIKE @like OR c.nit LIKE @like
     ORDER BY CASE WHEN c.codigo_cliente = @exacto THEN 0 ELSE 1 END, c.razonsocial`,
    [
      { name: 'q', type: sql.NVarChar(30), value: `${q}%` },
      { name: 'like', type: sql.NVarChar(100), value: `%${q}%` },
      { name: 'exacto', type: sql.NVarChar(30), value: q },
    ],
  );
  return rows.map(row => ({
    codigo: row.codigo,
    razonSocial: row.razonsocial || row.cliente,
    nombre: row.cliente || row.razonsocial,
    nit: row.nit && String(row.nit).trim() !== '0' ? String(row.nit).trim() : null,
    rubro: row.rubro || null,
    activo: String(row.estado || '').trim().toUpperCase() === 'ACTIVO',
    plazoDias: numero(row.plazo_dias),
    correos: row.correos ? row.correos.split(';').filter(Boolean) : [],
  }));
};

// ─── Facturas ─────────────────────────────────────────────────────────────

const PAGADO_CTE = `
  WITH pagado AS (
    SELECT a.factura_id, SUM(a.monto) AS pagado
    FROM dbo.COM_PAGO_APLICACIONES a
    JOIN dbo.COM_PAGOS p ON p.id = a.pago_id AND p.estado = 'VIGENTE'
    GROUP BY a.factura_id
  ),
  base AS (
    SELECT f.*, ISNULL(pg.pagado, 0) AS pagado, cc.plazo_dias,
      CASE
        WHEN f.estado = 'ANULADA' THEN 'anulada'
        WHEN ISNULL(pg.pagado, 0) >= f.monto THEN 'pagada'
        WHEN ISNULL(pg.pagado, 0) > 0 THEN 'parcial'
        ELSE 'pendiente'
      END AS situacion
    FROM dbo.COM_FACTURAS f
    LEFT JOIN pagado pg ON pg.factura_id = f.id
    LEFT JOIN dbo.COM_CLIENTES cc ON cc.cliente_codigo = f.cliente_codigo
  )`;

/**
 * WHERE de la lista de facturas con sus parámetros. Sin `estado` sirve para
 * los conteos de los chips.
 */
const buildFacturasWhere = (filtros, { conEstado = true } = {}) => {
  const condiciones = [];
  const params = [];
  if (filtros.q) {
    const q = filtros.q.trim();
    condiciones.push(`(b.razon_social LIKE @like OR b.nit LIKE @like OR b.cliente_codigo = @q
      OR CAST(b.numero AS varchar(12)) = @q
      OR EXISTS (SELECT 1 FROM dbo.COM_FACTURA_REFERENCIAS r WHERE r.factura_id = b.id AND r.valor LIKE @like)
      OR EXISTS (SELECT 1 FROM dbo.COM_FACTURA_PERSONAS pe WHERE pe.factura_id = b.id AND pe.nombre LIKE @like))`);
    params.push(
      { name: 'like', type: sql.NVarChar(100), value: `%${q}%` },
      { name: 'q', type: sql.NVarChar(80), value: q },
    );
  }
  if (filtros.cliente) {
    condiciones.push('b.cliente_codigo = @cliente');
    params.push({ name: 'cliente', type: sql.NVarChar(20), value: filtros.cliente });
  }
  if (filtros.desde) {
    condiciones.push('b.fecha_emision >= @desde');
    params.push({ name: 'desde', type: sql.Date, value: filtros.desde });
  }
  if (filtros.hasta) {
    condiciones.push('b.fecha_emision <= @hasta');
    params.push({ name: 'hasta', type: sql.Date, value: filtros.hasta });
  }
  if (filtros.tipo) {
    condiciones.push('b.tipo = @tipo');
    params.push({ name: 'tipo', type: sql.VarChar(10), value: filtros.tipo });
  }
  if (filtros.area) {
    condiciones.push(`EXISTS (SELECT 1 FROM dbo.COM_FACTURA_LINEAS l JOIN dbo.COM_CATEGORIAS c ON c.id = l.categoria_id
      WHERE l.factura_id = b.id AND c.area = @area)`);
    params.push({ name: 'area', type: sql.VarChar(4), value: filtros.area });
  }
  if (conEstado && filtros.estado) {
    condiciones.push('b.situacion = @estado');
    params.push({ name: 'estado', type: sql.VarChar(10), value: filtros.estado });
  }
  return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', params };
};

const AREAS_SELECT = `
  CASE WHEN EXISTS (SELECT 1 FROM dbo.COM_FACTURA_LINEAS l JOIN dbo.COM_CATEGORIAS c ON c.id = l.categoria_id WHERE l.factura_id = b.id AND c.area = 'ST') THEN 1 ELSE 0 END AS area_st,
  CASE WHEN EXISTS (SELECT 1 FROM dbo.COM_FACTURA_LINEAS l JOIN dbo.COM_CATEGORIAS c ON c.id = l.categoria_id WHERE l.factura_id = b.id AND c.area = 'CAL') THEN 1 ELSE 0 END AS area_cal,
  CASE WHEN EXISTS (SELECT 1 FROM dbo.COM_FACTURA_LINEAS l JOIN dbo.COM_CATEGORIAS c ON c.id = l.categoria_id WHERE l.factura_id = b.id AND c.area = 'VENT') THEN 1 ELSE 0 END AS area_vent`;

const areasDe = (row) => [row.area_st && 'ST', row.area_cal && 'CAL', row.area_vent && 'VENT'].filter(Boolean);

const mapFacturaFila = (row, hoy) => {
  const fechaEmision = row.fecha_texto;
  const cobro = domain.cobroDe({
    estado: row.estado, monto: Number(row.monto), pagado: Number(row.pagado), fechaEmision, plazoDias: row.plazo_dias,
  }, hoy);
  return {
    id: row.id,
    gestion: row.gestion,
    numero: row.numero,
    fechaEmision,
    tipo: row.tipo,
    clienteCodigo: row.cliente_codigo || null,
    razonSocial: row.razon_social,
    nit: row.nit || null,
    monto: Number(row.monto),
    pagado: Number(row.pagado),
    areas: areasDe(row),
    origen: row.origen,
    ...cobro,
  };
};

/** Cotizaciones y responsables de las facturas de la página (una consulta). */
const complementos = async (ids) => {
  if (!ids.length) return { referencias: new Map(), personas: new Map() };
  const params = ids.map((id, index) => ({ name: `id${index}`, type: sql.Int, value: id }));
  const lista = params.map(param => `@${param.name}`).join(', ');
  const [refs, personas] = await Promise.all([
    run(`SELECT factura_id, tipo, valor FROM dbo.COM_FACTURA_REFERENCIAS WHERE factura_id IN (${lista}) ORDER BY id`, params),
    run(`SELECT factura_id, nombre, porcentaje FROM dbo.COM_FACTURA_PERSONAS WHERE rol = 'RESPONSABLE' AND factura_id IN (${lista}) ORDER BY id`, params),
  ]);
  const agrupar = (rows, map) => rows.reduce((acc, row) => {
    const lista2 = acc.get(row.factura_id) || [];
    lista2.push(map(row));
    acc.set(row.factura_id, lista2);
    return acc;
  }, new Map());
  return {
    referencias: agrupar(refs.filter(row => row.tipo.startsWith('COTIZACION')), row => row.valor),
    personas: agrupar(personas, row => row.nombre),
  };
};

const listFacturas = async (filtros, { now = new Date() } = {}) => {
  const hoy = domain.hoyLaPaz(now);
  const { where, params } = buildFacturasWhere(filtros);
  const sinEstado = buildFacturasWhere(filtros, { conEstado: false });
  const offset = (filtros.page - 1) * filtros.pageSize;

  const [filas, resumen] = await Promise.all([
    run(`${PAGADO_CTE}
      SELECT b.id, b.gestion, b.numero, CONVERT(varchar(10), b.fecha_emision, 23) AS fecha_texto, b.tipo, b.cliente_codigo,
        b.razon_social, b.nit, b.monto, b.pagado, b.estado, b.origen, b.plazo_dias, ${AREAS_SELECT},
        COUNT(*) OVER () AS total
      FROM base b ${where}
      ORDER BY b.fecha_emision DESC, b.numero DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    [...params, { name: 'offset', type: sql.Int, value: offset }, { name: 'pageSize', type: sql.Int, value: filtros.pageSize }]),
    run(`${PAGADO_CTE}
      SELECT b.situacion, COUNT(*) AS facturas, SUM(b.monto) AS monto, SUM(b.pagado) AS pagado
      FROM base b ${sinEstado.where}
      GROUP BY b.situacion`, sinEstado.params),
  ]);

  const extra = await complementos(filas.map(row => row.id));
  const items = filas.map(row => ({
    ...mapFacturaFila(row, hoy),
    cotizaciones: extra.referencias.get(row.id) || [],
    responsables: extra.personas.get(row.id) || [],
  }));
  const porEstado = Object.fromEntries(domain.ESTADOS.map(estado => [estado, 0]));
  let facturado = 0;
  let cobrado = 0;
  for (const row of resumen) {
    porEstado[row.situacion] = row.facturas;
    if (row.situacion !== 'anulada') {
      facturado += domain.centavos(row.monto);
      cobrado += domain.centavos(row.pagado);
    }
  }
  return {
    items,
    total: filas[0]?.total ?? 0,
    page: filtros.page,
    pageSize: filtros.pageSize,
    resumen: {
      estados: porEstado,
      facturado: domain.bolivianos(facturado),
      cobrado: domain.bolivianos(cobrado),
      saldo: domain.bolivianos(facturado - cobrado),
    },
  };
};

const mapHistorial = (row) => {
  let detalle = null;
  try { detalle = row.detalle ? JSON.parse(row.detalle) : null; } catch { detalle = null; }
  return {
    id: row.id,
    accion: row.accion,
    detalle,
    motivo: row.motivo || null,
    usuario: row.usuario,
    nombre: row.nombre || null,
    fecha: row.fecha_texto,
  };
};

const leerHistorial = (entidad, id, request) => run(
  `SELECT id, accion, detalle, motivo, usuario, nombre, CONVERT(varchar(19), fecha, 126) AS fecha_texto
   FROM dbo.COM_HISTORIAL WHERE entidad = @entidad AND entidad_id = @id ORDER BY id`,
  [
    { name: 'entidad', type: sql.VarChar(10), value: entidad },
    { name: 'id', type: sql.NVarChar(20), value: String(id) },
  ],
  request,
).then(rows => rows.map(mapHistorial));

const getFactura = async (id, { now = new Date() } = {}) => {
  const hoy = domain.hoyLaPaz(now);
  const param = [{ name: 'id', type: sql.Int, value: id }];
  const [cabecera] = await run(`${PAGADO_CTE}
    SELECT b.id, b.gestion, b.numero, CONVERT(varchar(10), b.fecha_emision, 23) AS fecha_texto, b.tipo, b.cliente_codigo,
      b.razon_social, b.nit, b.monto, b.pagado, b.estado, b.origen, b.origen_ref, b.observacion, b.plazo_dias,
      b.anulada_motivo, b.anulada_por, b.anulada_nombre, CONVERT(varchar(19), b.anulada_en, 126) AS anulada_texto,
      b.creado_por, b.creado_nombre, CONVERT(varchar(19), b.creado_en, 126) AS creado_texto,
      dc.razonsocial AS cliente_razon, dc.cliente AS cliente_nombre, dc.rubro AS cliente_rubro, ${AREAS_SELECT}
    FROM base b
    LEFT JOIN DATA_CLIENTES dc ON LTRIM(RTRIM(dc.codigo_cliente)) = b.cliente_codigo
    WHERE b.id = @id`, param);
  if (!cabecera) throw httpError(404, 'La factura no existe.');

  const [lineas, referencias, personas, pagos, eventos] = await Promise.all([
    run(`SELECT l.id, l.orden, l.monto, l.cantidad, l.regional, l.costo, l.nota_salida,
          c.id AS categoria_id, c.codigo, c.nombre, c.area, c.subarea, c.regla_margen, c.comisiona, c.vigente, c.orden AS categoria_orden
        FROM dbo.COM_FACTURA_LINEAS l JOIN dbo.COM_CATEGORIAS c ON c.id = l.categoria_id
        WHERE l.factura_id = @id ORDER BY l.orden`, param),
    run('SELECT id, tipo, valor FROM dbo.COM_FACTURA_REFERENCIAS WHERE factura_id = @id ORDER BY id', param),
    run('SELECT id, rol, usuario_id, nombre, porcentaje FROM dbo.COM_FACTURA_PERSONAS WHERE factura_id = @id ORDER BY id', param),
    run(`SELECT p.id, CONVERT(varchar(10), p.fecha, 23) AS fecha_texto, p.monto AS pago_monto, p.medio, p.referencia, p.verificacion,
          p.estado, a.monto AS aplicado
        FROM dbo.COM_PAGO_APLICACIONES a JOIN dbo.COM_PAGOS p ON p.id = a.pago_id
        WHERE a.factura_id = @id ORDER BY p.fecha, p.id`, param),
    leerHistorial('FACTURA', id),
  ]);

  return {
    ...mapFacturaFila(cabecera, hoy),
    origenRef: cabecera.origen_ref || null,
    observacion: cabecera.observacion || null,
    plazoDias: numero(cabecera.plazo_dias),
    cliente: cabecera.cliente_codigo ? {
      codigo: cabecera.cliente_codigo,
      razonSocial: cabecera.cliente_razon || null,
      nombre: cabecera.cliente_nombre || null,
      rubro: cabecera.cliente_rubro || null,
    } : null,
    anulacion: cabecera.estado === 'ANULADA' ? {
      motivo: cabecera.anulada_motivo, usuario: cabecera.anulada_por, nombre: cabecera.anulada_nombre, fecha: cabecera.anulada_texto,
    } : null,
    creado: { usuario: cabecera.creado_por, nombre: cabecera.creado_nombre || null, fecha: cabecera.creado_texto },
    lineas: lineas.map((row) => {
      const margen = domain.margenLinea({ regla: row.regla_margen, monto: Number(row.monto), costo: numero(row.costo) });
      return {
        id: row.id,
        orden: row.orden,
        monto: Number(row.monto),
        cantidad: numero(row.cantidad),
        regional: row.regional || null,
        costo: numero(row.costo),
        notaSalida: row.nota_salida || null,
        categoria: mapCategoria({ ...row, id: row.categoria_id, orden: row.categoria_orden }),
        neto: domain.redondear(margen.neto),
        margen: domain.redondear(margen.margen),
        margenPorcentaje: margen.porcentaje === null ? null : Math.round(margen.porcentaje * 10) / 10,
      };
    }),
    referencias: referencias.map(row => ({ id: row.id, tipo: row.tipo, valor: row.valor })),
    personas: personas.map(row => ({
      id: row.id, rol: row.rol, usuarioId: numero(row.usuario_id), nombre: row.nombre, porcentaje: numero(row.porcentaje),
    })),
    pagos: pagos.map(row => ({
      id: row.id,
      fecha: row.fecha_texto,
      monto: Number(row.pago_monto),
      aplicado: Number(row.aplicado),
      medio: row.medio,
      referencia: row.referencia || null,
      verificacion: row.verificacion || null,
      estado: row.estado,
    })),
    historial: eventos,
  };
};

/** Cliente de DataMET por su código (o 400 si no existe). */
const leerCliente = async (codigo, request) => {
  const [row] = await run(
    `SELECT TOP (1) LTRIM(RTRIM(codigo_cliente)) AS codigo, razonsocial, cliente, nit
     FROM DATA_CLIENTES WHERE LTRIM(RTRIM(codigo_cliente)) = @codigo`,
    [{ name: 'codigo', type: sql.NVarChar(20), value: codigo }],
    request,
  );
  return row || null;
};

const insertarFactura = async (newRequest, { factura, plan, usuario, nombre, origen = 'MANUAL', origenRef = null, anulacion = null }) => {
  const [{ id }] = await run(
    `INSERT INTO dbo.COM_FACTURAS
       (gestion, numero, fecha_emision, tipo, cliente_codigo, razon_social, nit, monto, observacion, estado,
        anulada_motivo, anulada_por, anulada_nombre, anulada_en, origen, origen_ref, creado_por, creado_nombre)
     OUTPUT INSERTED.id
     VALUES (@gestion, @numero, @fecha, @tipo, @cliente, @razon, @nit, @monto, @observacion, @estado,
        @anuladaMotivo, @anuladaPor, @anuladaNombre, CASE WHEN @estado = 'ANULADA' THEN SYSUTCDATETIME() END,
        @origen, @origenRef, @usuario, @nombre)`,
    [
      { name: 'gestion', type: sql.SmallInt, value: plan.gestion },
      { name: 'numero', type: sql.Int, value: factura.numero },
      { name: 'fecha', type: sql.Date, value: factura.fechaEmision },
      { name: 'tipo', type: sql.VarChar(10), value: plan.tipo },
      { name: 'cliente', type: sql.NVarChar(20), value: factura.clienteCodigo },
      { name: 'razon', type: sql.NVarChar(255), value: factura.razonSocial },
      { name: 'nit', type: sql.NVarChar(20), value: factura.nit },
      { name: 'monto', type: sql.Decimal(14, 2), value: factura.monto },
      { name: 'observacion', type: sql.NVarChar(1000), value: factura.observacion },
      { name: 'estado', type: sql.VarChar(10), value: anulacion ? 'ANULADA' : 'VIGENTE' },
      { name: 'anuladaMotivo', type: sql.NVarChar(300), value: anulacion?.motivo ?? null },
      { name: 'anuladaPor', type: sql.NVarChar(50), value: anulacion ? usuario : null },
      { name: 'anuladaNombre', type: sql.NVarChar(120), value: anulacion ? nombre : null },
      { name: 'origen', type: sql.VarChar(10), value: origen },
      { name: 'origenRef', type: sql.NVarChar(120), value: origenRef },
      { name: 'usuario', type: sql.NVarChar(50), value: usuario },
      { name: 'nombre', type: sql.NVarChar(120), value: nombre },
    ],
    newRequest(),
  );

  for (const linea of plan.lineas) {
    await run(
      `INSERT INTO dbo.COM_FACTURA_LINEAS (factura_id, categoria_id, orden, monto, cantidad, regional, costo, nota_salida)
       VALUES (@factura, @categoria, @orden, @monto, @cantidad, @regional, @costo, @nota)`,
      [
        { name: 'factura', type: sql.Int, value: id },
        { name: 'categoria', type: sql.Int, value: linea.categoria.id },
        { name: 'orden', type: sql.Int, value: linea.orden },
        { name: 'monto', type: sql.Decimal(14, 2), value: linea.monto },
        { name: 'cantidad', type: sql.Int, value: linea.cantidad ?? null },
        { name: 'regional', type: sql.VarChar(3), value: linea.regional ?? null },
        { name: 'costo', type: sql.Decimal(14, 2), value: linea.costo ?? null },
        { name: 'nota', type: sql.NVarChar(60), value: linea.notaSalida ?? null },
      ],
      newRequest(),
    );
  }
  for (const referencia of factura.referencias) {
    await run(
      'INSERT INTO dbo.COM_FACTURA_REFERENCIAS (factura_id, tipo, valor) VALUES (@factura, @tipo, @valor)',
      [
        { name: 'factura', type: sql.Int, value: id },
        { name: 'tipo', type: sql.VarChar(20), value: referencia.tipo },
        { name: 'valor', type: sql.NVarChar(80), value: referencia.valor },
      ],
      newRequest(),
    );
  }
  for (const persona of factura.personas) {
    await run(
      `INSERT INTO dbo.COM_FACTURA_PERSONAS (factura_id, rol, usuario_id, nombre, porcentaje)
       VALUES (@factura, @rol, @usuarioId, @nombre, @porcentaje)`,
      [
        { name: 'factura', type: sql.Int, value: id },
        { name: 'rol', type: sql.VarChar(12), value: persona.rol },
        { name: 'usuarioId', type: sql.Int, value: persona.usuarioId ?? null },
        { name: 'nombre', type: sql.NVarChar(120), value: persona.nombre },
        { name: 'porcentaje', type: sql.Decimal(5, 2), value: persona.porcentaje ?? null },
      ],
      newRequest(),
    );
  }
  return id;
};

/** Número que sigue al último registrado en la gestión (una sugerencia: se puede cambiar). */
const siguienteNumero = async (gestion) => {
  const [row] = await run(
    'SELECT ISNULL(MAX(numero), 0) + 1 AS siguiente FROM dbo.COM_FACTURAS WHERE gestion = @gestion',
    [{ name: 'gestion', type: sql.SmallInt, value: gestion }],
  );
  return { gestion, numero: row.siguiente };
};

/** Registra una factura con sus líneas, referencias y personas, en una transacción. */
const crearFactura = async (factura, user) => {
  const usuario = usuarioDe(user);
  const nombre = await nombreDe(usuario);
  const id = await withTransaction(async (newRequest) => {
    const categorias = await listCategorias(newRequest());
    if (factura.clienteCodigo && !(await leerCliente(factura.clienteCodigo, newRequest()))) {
      throw httpError(400, `El cliente ${factura.clienteCodigo} no existe en DataMET.`);
    }
    const existentes = await run(
      `SELECT gestion, numero FROM dbo.COM_FACTURAS WITH (UPDLOCK, HOLDLOCK)
       WHERE gestion = @gestion AND numero = @numero`,
      [
        { name: 'gestion', type: sql.SmallInt, value: domain.gestionDe(factura.fechaEmision) },
        { name: 'numero', type: sql.Int, value: factura.numero },
      ],
      newRequest(),
    );
    const plan = domain.planFactura(factura, { categorias, existentes });
    const nuevaId = await insertarFactura(newRequest, { factura, plan, usuario, nombre });
    await historial(newRequest, {
      entidad: 'FACTURA',
      entidadId: nuevaId,
      accion: 'REGISTRO',
      detalle: { numero: factura.numero, gestion: plan.gestion, monto: factura.monto, lineas: plan.lineas.length },
      usuario,
      nombre,
    });
    return nuevaId;
  });
  return getFactura(id);
};

/** Anula una factura vigente sin pagos vigentes aplicados. */
const anularFactura = async (id, { motivo }, user) => {
  const usuario = usuarioDe(user);
  const nombre = await nombreDe(usuario);
  await withTransaction(async (newRequest) => {
    const [factura] = await run(
      'SELECT id, numero, estado FROM dbo.COM_FACTURAS WITH (UPDLOCK, HOLDLOCK) WHERE id = @id',
      [{ name: 'id', type: sql.Int, value: id }],
      newRequest(),
    );
    if (!factura) throw httpError(404, 'La factura no existe.');
    if (factura.estado === 'ANULADA') throw httpError(409, `La factura N.º ${factura.numero} ya está anulada.`);
    const [{ pagos }] = await run(
      `SELECT COUNT(*) AS pagos FROM dbo.COM_PAGO_APLICACIONES a JOIN dbo.COM_PAGOS p ON p.id = a.pago_id
       WHERE a.factura_id = @id AND p.estado = 'VIGENTE'`,
      [{ name: 'id', type: sql.Int, value: id }],
      newRequest(),
    );
    if (pagos > 0) {
      throw httpError(409, `La factura N.º ${factura.numero} tiene ${pagos === 1 ? 'un pago aplicado' : `${pagos} pagos aplicados`}: anula primero ${pagos === 1 ? 'ese pago' : 'esos pagos'}.`);
    }
    await run(
      `UPDATE dbo.COM_FACTURAS SET estado = 'ANULADA', anulada_motivo = @motivo, anulada_por = @usuario,
         anulada_nombre = @nombre, anulada_en = SYSUTCDATETIME()
       WHERE id = @id AND estado = 'VIGENTE'`,
      [
        { name: 'id', type: sql.Int, value: id },
        { name: 'motivo', type: sql.NVarChar(300), value: motivo },
        { name: 'usuario', type: sql.NVarChar(50), value: usuario },
        { name: 'nombre', type: sql.NVarChar(120), value: nombre },
      ],
      newRequest(),
    );
    await historial(newRequest, { entidad: 'FACTURA', entidadId: id, accion: 'ANULACION', motivo, usuario, nombre });
  });
  return getFactura(id);
};

// ─── Pagos ────────────────────────────────────────────────────────────────

const PAGOS_BASE = `
  WITH aplicado AS (
    SELECT pago_id, SUM(monto) AS aplicado, COUNT(*) AS facturas FROM dbo.COM_PAGO_APLICACIONES GROUP BY pago_id
  ),
  base AS (
    SELECT p.*, ISNULL(a.aplicado, 0) AS aplicado, ISNULL(a.facturas, 0) AS facturas
    FROM dbo.COM_PAGOS p LEFT JOIN aplicado a ON a.pago_id = p.id
  )`;

const buildPagosWhere = (filtros) => {
  const condiciones = [];
  const params = [];
  if (filtros.q) {
    const q = filtros.q.trim();
    condiciones.push(`(b.referencia LIKE @like OR b.verificacion LIKE @like OR b.observacion LIKE @like OR b.cliente_codigo = @q
      OR EXISTS (SELECT 1 FROM dbo.COM_PAGO_APLICACIONES a JOIN dbo.COM_FACTURAS f ON f.id = a.factura_id
        WHERE a.pago_id = b.id AND (CAST(f.numero AS varchar(12)) = @q OR f.razon_social LIKE @like)))`);
    params.push(
      { name: 'like', type: sql.NVarChar(100), value: `%${q}%` },
      { name: 'q', type: sql.NVarChar(80), value: q },
    );
  }
  if (filtros.cliente) {
    condiciones.push('b.cliente_codigo = @cliente');
    params.push({ name: 'cliente', type: sql.NVarChar(20), value: filtros.cliente });
  }
  if (filtros.desde) {
    condiciones.push('b.fecha >= @desde');
    params.push({ name: 'desde', type: sql.Date, value: filtros.desde });
  }
  if (filtros.hasta) {
    condiciones.push('b.fecha <= @hasta');
    params.push({ name: 'hasta', type: sql.Date, value: filtros.hasta });
  }
  if (filtros.estado === 'vigente') condiciones.push("b.estado = 'VIGENTE'");
  if (filtros.estado === 'anulado') condiciones.push("b.estado = 'ANULADO'");
  if (filtros.estado === 'sin_aplicar') condiciones.push("b.estado = 'VIGENTE' AND b.aplicado < b.monto");
  return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', params };
};

const mapPago = (row) => ({
  id: row.id,
  fecha: row.fecha_texto,
  monto: Number(row.monto),
  medio: row.medio,
  clienteCodigo: row.cliente_codigo || null,
  referencia: row.referencia || null,
  verificacion: row.verificacion || null,
  observacion: row.observacion || null,
  estado: row.estado === 'ANULADO' ? 'anulado' : 'vigente',
  aplicado: Number(row.aplicado),
  sinAplicar: row.estado === 'ANULADO' ? 0 : domain.bolivianos(domain.centavos(row.monto) - domain.centavos(row.aplicado)),
  origen: row.origen,
});

const listPagos = async (filtros) => {
  const { where, params } = buildPagosWhere(filtros);
  const offset = (filtros.page - 1) * filtros.pageSize;
  const filas = await run(`${PAGOS_BASE}
    SELECT b.id, CONVERT(varchar(10), b.fecha, 23) AS fecha_texto, b.monto, b.medio, b.cliente_codigo, b.referencia,
      b.verificacion, b.observacion, b.estado, b.origen, b.aplicado, b.facturas,
      COUNT(*) OVER () AS total,
      SUM(CASE WHEN b.estado = 'VIGENTE' THEN b.monto ELSE 0 END) OVER () AS total_cobrado,
      SUM(CASE WHEN b.estado = 'VIGENTE' THEN b.monto - b.aplicado ELSE 0 END) OVER () AS total_sin_aplicar
    FROM base b ${where}
    ORDER BY b.fecha DESC, b.id DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
  [...params, { name: 'offset', type: sql.Int, value: offset }, { name: 'pageSize', type: sql.Int, value: filtros.pageSize }]);

  const ids = filas.map(row => row.id);
  let aplicaciones = [];
  if (ids.length) {
    const p = ids.map((id, index) => ({ name: `p${index}`, type: sql.Int, value: id }));
    aplicaciones = await run(
      `SELECT a.pago_id, a.factura_id, a.monto, f.numero, f.gestion, f.razon_social
       FROM dbo.COM_PAGO_APLICACIONES a JOIN dbo.COM_FACTURAS f ON f.id = a.factura_id
       WHERE a.pago_id IN (${p.map(x => `@${x.name}`).join(', ')}) ORDER BY a.id`,
      p,
    );
  }
  const porPago = aplicaciones.reduce((acc, row) => {
    const lista = acc.get(row.pago_id) || [];
    lista.push({ facturaId: row.factura_id, numero: row.numero, gestion: row.gestion, razonSocial: row.razon_social, monto: Number(row.monto) });
    acc.set(row.pago_id, lista);
    return acc;
  }, new Map());
  return {
    items: filas.map(row => ({ ...mapPago(row), aplicaciones: porPago.get(row.id) || [] })),
    total: filas[0]?.total ?? 0,
    page: filtros.page,
    pageSize: filtros.pageSize,
    resumen: {
      cobrado: Number(filas[0]?.total_cobrado ?? 0),
      sinAplicar: Number(filas[0]?.total_sin_aplicar ?? 0),
    },
  };
};

const getPago = async (id) => {
  const [row] = await run(`${PAGOS_BASE}
    SELECT b.*, CONVERT(varchar(10), b.fecha, 23) AS fecha_texto,
      CONVERT(varchar(19), b.creado_en, 126) AS creado_texto, CONVERT(varchar(19), b.anulado_en, 126) AS anulado_texto
    FROM base b WHERE b.id = @id`, [{ name: 'id', type: sql.Int, value: id }]);
  if (!row) throw httpError(404, 'El pago no existe.');
  const [aplicaciones, eventos] = await Promise.all([
    run(`SELECT a.factura_id, a.monto, f.numero, f.gestion, f.razon_social, f.monto AS factura_monto
         FROM dbo.COM_PAGO_APLICACIONES a JOIN dbo.COM_FACTURAS f ON f.id = a.factura_id
         WHERE a.pago_id = @id ORDER BY a.id`, [{ name: 'id', type: sql.Int, value: id }]),
    leerHistorial('PAGO', id),
  ]);
  return {
    ...mapPago(row),
    origenRef: row.origen_ref || null,
    creado: { usuario: row.creado_por, nombre: row.creado_nombre || null, fecha: row.creado_texto },
    anulacion: row.estado === 'ANULADO'
      ? { motivo: row.anulado_motivo, usuario: row.anulado_por, nombre: row.anulado_nombre, fecha: row.anulado_texto }
      : null,
    aplicaciones: aplicaciones.map(a => ({
      facturaId: a.factura_id, numero: a.numero, gestion: a.gestion, razonSocial: a.razon_social, monto: Number(a.monto), facturaMonto: Number(a.factura_monto),
    })),
    historial: eventos,
  };
};

/** Facturas de un pago, bloqueadas en la transacción, con lo ya pagado. */
const facturasParaPago = async (ids, newRequest) => {
  if (!ids.length) return [];
  const params = ids.map((id, index) => ({ name: `f${index}`, type: sql.Int, value: id }));
  return run(
    `SELECT f.id, f.numero, f.monto, f.estado, f.cliente_codigo,
       ISNULL((SELECT SUM(a.monto) FROM dbo.COM_PAGO_APLICACIONES a JOIN dbo.COM_PAGOS p ON p.id = a.pago_id
               WHERE a.factura_id = f.id AND p.estado = 'VIGENTE'), 0) AS pagado
     FROM dbo.COM_FACTURAS f WITH (UPDLOCK, HOLDLOCK)
     WHERE f.id IN (${params.map(p => `@${p.name}`).join(', ')})`,
    params,
    newRequest(),
  );
};

const insertarPago = async (newRequest, { pago, plan, usuario, nombre, origen = 'MANUAL', origenRef = null }) => {
  const [{ id }] = await run(
    `INSERT INTO dbo.COM_PAGOS (fecha, monto, medio, cliente_codigo, referencia, verificacion, observacion, origen, origen_ref, creado_por, creado_nombre)
     OUTPUT INSERTED.id
     VALUES (@fecha, @monto, @medio, @cliente, @referencia, @verificacion, @observacion, @origen, @origenRef, @usuario, @nombre)`,
    [
      { name: 'fecha', type: sql.Date, value: pago.fecha },
      { name: 'monto', type: sql.Decimal(14, 2), value: pago.monto },
      { name: 'medio', type: sql.VarChar(15), value: pago.medio },
      { name: 'cliente', type: sql.NVarChar(20), value: pago.clienteCodigo ?? null },
      { name: 'referencia', type: sql.NVarChar(120), value: pago.referencia ?? null },
      { name: 'verificacion', type: sql.NVarChar(120), value: pago.verificacion ?? null },
      { name: 'observacion', type: sql.NVarChar(1000), value: pago.observacion ?? null },
      { name: 'origen', type: sql.VarChar(10), value: origen },
      { name: 'origenRef', type: sql.NVarChar(120), value: origenRef },
      { name: 'usuario', type: sql.NVarChar(50), value: usuario },
      { name: 'nombre', type: sql.NVarChar(120), value: nombre },
    ],
    newRequest(),
  );
  for (const aplicacion of plan.aplicaciones) {
    await run(
      'INSERT INTO dbo.COM_PAGO_APLICACIONES (pago_id, factura_id, monto) VALUES (@pago, @factura, @monto)',
      [
        { name: 'pago', type: sql.Int, value: id },
        { name: 'factura', type: sql.Int, value: aplicacion.facturaId },
        { name: 'monto', type: sql.Decimal(14, 2), value: aplicacion.monto },
      ],
      newRequest(),
    );
  }
  return id;
};

/** Registra un pago y lo aplica a sus facturas; lo que sobra queda sin aplicar. */
const crearPago = async (pago, user) => {
  const usuario = usuarioDe(user);
  const nombre = await nombreDe(usuario);
  const id = await withTransaction(async (newRequest) => {
    const facturas = await facturasParaPago(pago.aplicaciones.map(a => a.facturaId), newRequest);
    const plan = domain.planPago(pago, { facturas });
    const clientes = [...new Set(facturas.map(f => f.cliente_codigo).filter(Boolean))];
    const datos = { ...pago, clienteCodigo: pago.clienteCodigo || (clientes.length === 1 ? clientes[0] : null) };
    const nuevoId = await insertarPago(newRequest, { pago: datos, plan, usuario, nombre });
    await historial(newRequest, {
      entidad: 'PAGO', entidadId: nuevoId, accion: 'REGISTRO',
      detalle: { monto: pago.monto, aplicado: domain.bolivianos(domain.centavos(pago.monto) - domain.centavos(plan.sinAplicar)), facturas: plan.aplicaciones.length },
      usuario, nombre,
    });
    for (const aplicacion of plan.aplicaciones) {
      await historial(newRequest, {
        entidad: 'FACTURA', entidadId: aplicacion.facturaId, accion: 'ACTUALIZACION',
        detalle: { pago: nuevoId, aplicado: aplicacion.monto }, usuario, nombre,
      });
    }
    return nuevoId;
  });
  return getPago(id);
};

const anularPago = async (id, { motivo }, user) => {
  const usuario = usuarioDe(user);
  const nombre = await nombreDe(usuario);
  await withTransaction(async (newRequest) => {
    const [pago] = await run(
      'SELECT id, estado FROM dbo.COM_PAGOS WITH (UPDLOCK, HOLDLOCK) WHERE id = @id',
      [{ name: 'id', type: sql.Int, value: id }],
      newRequest(),
    );
    if (!pago) throw httpError(404, 'El pago no existe.');
    if (pago.estado === 'ANULADO') throw httpError(409, 'El pago ya está anulado.');
    await run(
      `UPDATE dbo.COM_PAGOS SET estado = 'ANULADO', anulado_motivo = @motivo, anulado_por = @usuario,
         anulado_nombre = @nombre, anulado_en = SYSUTCDATETIME()
       WHERE id = @id AND estado = 'VIGENTE'`,
      [
        { name: 'id', type: sql.Int, value: id },
        { name: 'motivo', type: sql.NVarChar(300), value: motivo },
        { name: 'usuario', type: sql.NVarChar(50), value: usuario },
        { name: 'nombre', type: sql.NVarChar(120), value: nombre },
      ],
      newRequest(),
    );
    await historial(newRequest, { entidad: 'PAGO', entidadId: id, accion: 'ANULACION', motivo, usuario, nombre });
    const facturas = await run(
      'SELECT factura_id, monto FROM dbo.COM_PAGO_APLICACIONES WHERE pago_id = @id',
      [{ name: 'id', type: sql.Int, value: id }],
      newRequest(),
    );
    for (const factura of facturas) {
      await historial(newRequest, {
        entidad: 'FACTURA', entidadId: factura.factura_id, accion: 'ACTUALIZACION',
        detalle: { pagoAnulado: id, monto: Number(factura.monto) }, motivo, usuario, nombre,
      });
    }
  });
  return getPago(id);
};

// ─── Cobranza ─────────────────────────────────────────────────────────────

/**
 * Cuentas por cobrar a hoy: facturas vigentes con saldo, por tramo de mora y
 * por cliente, y lo cobrado que todavía no se aplicó a ninguna factura.
 */
const cobranza = async (filtros, { now = new Date() } = {}) => {
  const hoy = domain.hoyLaPaz(now);
  const condiciones = ["b.estado = 'VIGENTE'", 'b.pagado < b.monto'];
  const params = [];
  if (filtros.cliente) {
    condiciones.push('b.cliente_codigo = @cliente');
    params.push({ name: 'cliente', type: sql.NVarChar(20), value: filtros.cliente });
  }
  if (filtros.q) {
    condiciones.push('(b.razon_social LIKE @like OR b.cliente_codigo = @q OR CAST(b.numero AS varchar(12)) = @q)');
    params.push({ name: 'like', type: sql.NVarChar(100), value: `%${filtros.q}%` }, { name: 'q', type: sql.NVarChar(80), value: filtros.q });
  }
  const [filas, anticipos] = await Promise.all([
    run(`${PAGADO_CTE}
      SELECT b.id, b.gestion, b.numero, CONVERT(varchar(10), b.fecha_emision, 23) AS fecha_texto, b.tipo, b.cliente_codigo,
        b.razon_social, b.nit, b.monto, b.pagado, b.estado, b.origen, b.plazo_dias, ${AREAS_SELECT}
      FROM base b WHERE ${condiciones.join(' AND ')}
      ORDER BY b.fecha_emision, b.numero`, params),
    run(`${PAGOS_BASE}
      SELECT COUNT(*) AS pagos, ISNULL(SUM(b.monto - b.aplicado), 0) AS saldo
      FROM base b WHERE b.estado = 'VIGENTE' AND b.aplicado < b.monto`),
  ]);
  const extra = await complementos(filas.map(row => row.id));
  const facturas = filas
    .map(row => ({ ...mapFacturaFila(row, hoy), responsables: extra.personas.get(row.id) || [] }))
    .sort((a, b) => b.diasMora - a.diasMora || b.saldo - a.saldo);
  return {
    hoy,
    resumen: domain.resumenCobranza(facturas),
    facturas,
    anticipos: { pagos: anticipos[0]?.pagos ?? 0, saldo: Number(anticipos[0]?.saldo ?? 0) },
  };
};

// ─── Ficha de facturación del cliente ─────────────────────────────────────

const getCliente = async (codigo, { now = new Date() } = {}) => {
  const cliente = await leerCliente(codigo);
  if (!cliente) throw httpError(404, 'El cliente no existe en DataMET.');
  const [ficha] = await run(
    `SELECT plazo_dias, correos, recepcion, observacion, actualizado_por, CONVERT(varchar(19), actualizado_en, 126) AS actualizado_texto
     FROM dbo.COM_CLIENTES WHERE cliente_codigo = @codigo`,
    [{ name: 'codigo', type: sql.NVarChar(20), value: codigo }],
  );
  const cobro = await cobranza({ cliente: codigo }, { now });
  return {
    codigo: cliente.codigo,
    razonSocial: cliente.razonsocial || cliente.cliente,
    nombre: cliente.cliente || cliente.razonsocial,
    nit: cliente.nit && String(cliente.nit).trim() !== '0' ? String(cliente.nit).trim() : null,
    ficha: {
      plazoDias: numero(ficha?.plazo_dias),
      correos: ficha?.correos ? ficha.correos.split(';').filter(Boolean) : [],
      recepcion: ficha?.recepcion || null,
      observacion: ficha?.observacion || null,
      actualizado: ficha ? { usuario: ficha.actualizado_por, fecha: ficha.actualizado_texto } : null,
    },
    cobranza: { saldo: cobro.resumen.total, facturas: cobro.facturas },
  };
};

const guardarCliente = async (codigo, datos, user) => {
  const usuario = usuarioDe(user);
  const nombre = await nombreDe(usuario);
  await withTransaction(async (newRequest) => {
    if (!(await leerCliente(codigo, newRequest()))) throw httpError(404, 'El cliente no existe en DataMET.');
    const [antes] = await run(
      'SELECT plazo_dias, correos, recepcion, observacion FROM dbo.COM_CLIENTES WITH (UPDLOCK, HOLDLOCK) WHERE cliente_codigo = @codigo',
      [{ name: 'codigo', type: sql.NVarChar(20), value: codigo }],
      newRequest(),
    );
    const params = [
      { name: 'codigo', type: sql.NVarChar(20), value: codigo },
      { name: 'plazo', type: sql.Int, value: datos.plazoDias },
      { name: 'correos', type: sql.NVarChar(500), value: datos.correos.length ? datos.correos.join(';') : null },
      { name: 'recepcion', type: sql.NVarChar(200), value: datos.recepcion },
      { name: 'observacion', type: sql.NVarChar(500), value: datos.observacion },
      { name: 'usuario', type: sql.NVarChar(50), value: usuario },
    ];
    await run(antes
      ? `UPDATE dbo.COM_CLIENTES SET plazo_dias = @plazo, correos = @correos, recepcion = @recepcion, observacion = @observacion,
           actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME() WHERE cliente_codigo = @codigo`
      : `INSERT INTO dbo.COM_CLIENTES (cliente_codigo, plazo_dias, correos, recepcion, observacion, actualizado_por)
         VALUES (@codigo, @plazo, @correos, @recepcion, @observacion, @usuario)`, params, newRequest());
    await historial(newRequest, {
      entidad: 'CLIENTE', entidadId: codigo, accion: 'ACTUALIZACION',
      detalle: {
        antes: antes ? { plazoDias: numero(antes.plazo_dias), correos: antes.correos, recepcion: antes.recepcion, observacion: antes.observacion } : null,
        despues: { plazoDias: datos.plazoDias, correos: datos.correos.join(';') || null, recepcion: datos.recepcion, observacion: datos.observacion },
      },
      usuario, nombre,
    });
  });
  return getCliente(codigo);
};

module.exports = {
  anularFactura,
  anularPago,
  buildFacturasWhere,
  buildPagosWhere,
  buscarClientes,
  cobranza,
  crearFactura,
  crearPago,
  getCliente,
  getFactura,
  getPago,
  guardarCliente,
  historial,
  insertarFactura,
  insertarPago,
  listCategorias,
  listFacturas,
  listPagos,
  listPersonal,
  mapFacturaFila,
  nombreDe,
  notReady,
  run,
  siguienteNumero,
};
