/**
 * Comercial ↔ Bitrix24 (fase 2): copia de solo lectura de las negociaciones
 * y empresas del CRM en las tablas COM_BITRIX_* (migración 035), sus enlaces
 * con las facturas por cotización, la equivalencia de responsables con
 * DATA_USERS y la factura que se propone desde una negociación.
 *
 * No escribe nada en Bitrix24. La primera sincronización copia las
 * negociaciones creadas desde BITRIX_SYNC_DESDE; las siguientes, solo lo
 * modificado desde la anterior (con 10 minutos de margen).
 */
const { sql } = require('../config/db');
const { withTransaction } = require('./calibration.db');
const { createBitrixClient } = require('./bitrix.client');
const { leerConfigBitrix } = require('./comercial.bitrix.config');
const dom = require('./comercial.bitrix.domain');
const comercial = require('./comercial.service');
const { normalizar } = require('./comercial.importacion');
const { httpError } = require('./comercial.domain');

const PAGINA_MS = 300;
const MARGEN_MS = 10 * 60 * 1000;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const notReady = (error) => {
  const message = error?.message || '';
  if ((error?.number === 208 || /Invalid object name/i.test(message)) && /COM_BITRIX_/i.test(message)) {
    return httpError(503, 'Falta aplicar la migración 035 (pnpm migrate en backend): Comercial todavía no tiene la copia de Bitrix24.');
  }
  return null;
};

const run = async (...args) => {
  try {
    return await comercial.run(...args);
  } catch (error) {
    throw notReady(error) || error;
  }
};

let configCache = null;
const config = () => {
  if (!configCache) configCache = leerConfigBitrix(process.env);
  return configCache;
};

let clienteCache = null;
const cliente = () => {
  const c = config();
  if (!c.configurado) {
    throw httpError(503, c.error
      ? `La integración con Bitrix24 está mal configurada: ${c.error}`
      : 'Falta el webhook de Bitrix24 (BITRIX_WEBHOOK_URL en backend/.env).');
  }
  if (!clienteCache) {
    clienteCache = createBitrixClient({
      webhookUrl: c.webhookUrl, webhookSecret: c.webhookSecret, timeoutMs: 30000, rateLimitRetries: 5, rateLimitDelayMs: 1500,
      logger: { warn: (m) => console.warn(m), log: () => {} },
    });
  }
  return clienteCache;
};

/** Para las pruebas: reemplaza la configuración y el cliente. */
const _configurar = ({ cfg, client } = {}) => {
  configCache = cfg ?? null;
  clienteCache = client ?? null;
};

const resultado = (body) => body?.result;

/** Todas las páginas de un método de lista (50 por página). */
const todas = async (client, metodo, params) => {
  const filas = [];
  let start = 0;
  do {
    const body = await client.call(metodo, { ...params, start });
    const lista = Array.isArray(body.result) ? body.result : (body.result?.items || []);
    filas.push(...lista);
    start = body.next;
    if (start) await sleep(PAGINA_MS);
  } while (start);
  return filas;
};

// ─── Lectura de Bitrix24 ───────────────────────────────────────────────────

const leerMetadatos = async (client) => {
  const cats = resultado(await client.call('crm.category.list', { entityTypeId: 2 }));
  const categorias = Array.isArray(cats) ? cats : (cats?.categories || []);
  const embudos = new Map(categorias.map(c => [Number(c.id), c.name]));
  if (!embudos.has(0)) embudos.set(0, 'General');
  const etapas = new Map();
  for (const id of embudos.keys()) {
    const lista = resultado(await client.call('crm.status.list', { filter: { ENTITY_ID: id ? `DEAL_STAGE_${id}` : 'DEAL_STAGE' } })) || [];
    for (const estado of lista) etapas.set(String(estado.STATUS_ID), { nombre: estado.NAME, semantica: dom.semanticaDe(estado) });
  }
  const campos = dom.resolverCampos(resultado(await client.call('crm.deal.fields', {})));
  const camposEmpresa = dom.resolverCampos(resultado(await client.call('crm.company.fields', {})), { codigo: dom.CAMPO_CODIGO_EMPRESA });
  return { embudos, etapas, campos, campoCodigoEmpresa: camposEmpresa.mapa.codigo };
};

const SELECT_NEGOCIACION = ['ID', 'CATEGORY_ID', 'STAGE_ID', 'TITLE', 'OPPORTUNITY', 'CURRENCY_ID', 'ASSIGNED_BY_ID', 'COMPANY_ID',
  'DATE_CREATE', 'DATE_MODIFY', 'CLOSEDATE'];

const leerNegociaciones = (client, meta, { desde, creadasDesde }) => {
  const filter = desde ? { '>DATE_MODIFY': desde.toISOString() } : { '>=DATE_CREATE': creadasDesde };
  const select = [...SELECT_NEGOCIACION, ...Object.values(meta.campos.mapa).filter(Boolean)];
  return todas(client, 'crm.deal.list', { filter, select, order: { ID: 'ASC' } });
};

const leerEmpresas = async (client, meta, { desde }) => {
  const filtro = desde ? { '>DATE_MODIFY': desde.toISOString() } : {};
  const select = ['ID', 'TITLE', ...(meta.campoCodigoEmpresa ? [meta.campoCodigoEmpresa] : [])];
  const empresas = await todas(client, 'crm.company.list', { filter: filtro, select, order: { ID: 'ASC' } });
  const requisitos = await todas(client, 'crm.requisite.list', {
    filter: { ENTITY_TYPE_ID: 4, ...filtro }, select: ['ENTITY_ID', 'RQ_VAT_ID', 'RQ_INN'], order: { ID: 'ASC' },
  });
  const nits = new Map();
  for (const r of requisitos) {
    const nit = String(r.RQ_VAT_ID || r.RQ_INN || '').replace(/\D/g, '');
    if (nit && !nits.has(Number(r.ENTITY_ID))) nits.set(Number(r.ENTITY_ID), nit);
  }
  return empresas.map(e => ({
    id: Number(e.ID),
    titulo: e.TITLE ? String(e.TITLE).slice(0, 255) : null,
    codigo: meta.campoCodigoEmpresa && e[meta.campoCodigoEmpresa] ? String(e[meta.campoCodigoEmpresa]).trim().slice(0, 50) || null : null,
    nit: nits.get(Number(e.ID))?.slice(0, 20) || null,
  }));
};

// ─── Escritura de la copia ─────────────────────────────────────────────────

const guardarEmpresa = (empresa) => run(
  `MERGE dbo.COM_BITRIX_EMPRESAS AS t
   USING (SELECT @id AS empresa_id) AS s ON t.empresa_id = s.empresa_id
   WHEN MATCHED THEN UPDATE SET titulo = @titulo, codigo = @codigo, nit = COALESCE(@nit, t.nit), sincronizada_en = SYSUTCDATETIME()
   WHEN NOT MATCHED THEN INSERT (empresa_id, titulo, codigo, nit) VALUES (@id, @titulo, @codigo, @nit);`,
  [
    { name: 'id', type: sql.Int, value: empresa.id },
    { name: 'titulo', type: sql.NVarChar(255), value: empresa.titulo },
    { name: 'codigo', type: sql.NVarChar(50), value: empresa.codigo },
    { name: 'nit', type: sql.NVarChar(20), value: empresa.nit },
  ],
);

const COLUMNAS = [
  ['embudo_id', sql.Int], ['embudo', sql.NVarChar(100)], ['etapa_id', sql.VarChar(50)], ['etapa', sql.NVarChar(100)],
  ['etapa_fase', sql.VarChar(10)], ['titulo', sql.NVarChar(255)], ['monto', sql.Decimal(14, 2)], ['moneda', sql.VarChar(3)],
  ['responsable_id', sql.Int], ['empresa_id', sql.Int], ['cotizacion', sql.NVarChar(400)], ['regional', sql.VarChar(3)],
  ['ciudad', sql.NVarChar(120)], ['num_balanzas', sql.Int], ['num_pesas', sql.Int], ['sub_area', sql.VarChar(10)],
  ['tipos_servicio', sql.NVarChar(400)], ['tecnico', sql.NVarChar(120)], ['apoyo', sql.NVarChar(400)], ['nota_salida', sql.NVarChar(200)],
  ['orden_compra', sql.NVarChar(200)], ['condiciones', sql.NVarChar(400)], ['mes_facturar', sql.NVarChar(60)], ['facturado', sql.Bit],
  ['creada', sql.DateTime2], ['modificada', sql.DateTime2], ['cierre', sql.Date],
];

const guardarNegociacion = ({ fila, cotizaciones }) => withTransaction(async (newRequest) => {
  const params = [{ name: 'deal_id', type: sql.Int, value: fila.deal_id }, ...COLUMNAS.map(([c, type]) => ({ name: c, type, value: fila[c] ?? null }))];
  await run(
    `MERGE dbo.COM_BITRIX_NEGOCIACIONES AS t
     USING (SELECT @deal_id AS deal_id) AS s ON t.deal_id = s.deal_id
     WHEN MATCHED THEN UPDATE SET ${COLUMNAS.map(([c]) => `${c} = @${c}`).join(', ')}, sincronizada_en = SYSUTCDATETIME()
     WHEN NOT MATCHED THEN INSERT (deal_id, ${COLUMNAS.map(([c]) => c).join(', ')})
       VALUES (@deal_id, ${COLUMNAS.map(([c]) => `@${c}`).join(', ')});`,
    params,
    newRequest(),
  );
  await run('DELETE FROM dbo.COM_BITRIX_COTIZACIONES WHERE deal_id = @id', [{ name: 'id', type: sql.Int, value: fila.deal_id }], newRequest());
  for (const c of cotizaciones) {
    await run(
      'INSERT INTO dbo.COM_BITRIX_COTIZACIONES (deal_id, codigo, clave, campo) VALUES (@id, @codigo, @clave, @campo)',
      [
        { name: 'id', type: sql.Int, value: fila.deal_id },
        { name: 'codigo', type: sql.NVarChar(60), value: c.codigo.slice(0, 60) },
        { name: 'clave', type: sql.NVarChar(60), value: c.clave.slice(0, 60) },
        { name: 'campo', type: sql.VarChar(25), value: c.campo || null },
      ],
      newRequest(),
    );
  }
});

/**
 * Recalcula qué negociación corresponde a qué factura vigente (por la
 * referencia «Negociación de Bitrix24» o por la cotización). Devuelve cuántos
 * enlaces hay.
 */
const reconstruirEnlaces = async () => {
  const [cotizaciones, referencias, fases] = await Promise.all([
    run('SELECT deal_id, clave FROM dbo.COM_BITRIX_COTIZACIONES'),
    run(`SELECT r.factura_id, r.tipo, r.valor FROM dbo.COM_FACTURA_REFERENCIAS r
         JOIN dbo.COM_FACTURAS f ON f.id = r.factura_id AND f.estado = 'VIGENTE'
         WHERE r.tipo LIKE 'COTIZACION%' OR r.tipo = 'BITRIX'`),
    run('SELECT deal_id, etapa_fase FROM dbo.COM_BITRIX_NEGOCIACIONES'),
  ]);
  const enlaces = dom.enlazar({
    cotizaciones: cotizaciones.map(c => ({ dealId: c.deal_id, clave: c.clave })),
    referencias: referencias.map(r => ({ facturaId: r.factura_id, tipo: r.tipo, valor: r.valor })),
    fases: new Map(fases.map(f => [f.deal_id, f.etapa_fase])),
  });
  await withTransaction(async (newRequest) => {
    await run('DELETE FROM dbo.COM_BITRIX_ENLACES', [], newRequest());
    for (let i = 0; i < enlaces.length; i += 500) {
      const lote = enlaces.slice(i, i + 500);
      const params = lote.flatMap((e, j) => [
        { name: `d${j}`, type: sql.Int, value: e.dealId },
        { name: `f${j}`, type: sql.Int, value: e.facturaId },
        { name: `p${j}`, type: sql.VarChar(12), value: e.por },
      ]);
      await run(
        `INSERT INTO dbo.COM_BITRIX_ENLACES (deal_id, factura_id, por) VALUES ${lote.map((_, j) => `(@d${j}, @f${j}, @p${j})`).join(', ')}`,
        params,
        newRequest(),
      );
    }
  });
  return enlaces.length;
};

/** Personal de DATA_USERS con sus formas de nombre, para reconocer nombres de Bitrix24. */
const personalConClaves = async () => (await run(
  'SELECT id, nombre1, nombre2, apellido1, apellido2 FROM DATA_USERS',
)).map((row) => {
  const [n1, n2, a1, a2] = [row.nombre1, row.nombre2, row.apellido1, row.apellido2].map(v => normalizar(v));
  const claves = new Set([`${n1} ${a1}`, `${n1} ${n2} ${a1}`, `${n1} ${a1} ${a2}`, `${n1} ${n2} ${a1} ${a2}`, `${n2} ${a1}`]
    .map(c => c.replace(/\s+/g, ' ').trim()).filter(c => c.split(' ').length >= 2));
  return { id: row.id, nombre: [row.nombre1, row.apellido1].map(v => String(v || '').trim()).filter(Boolean).join(' '), claves: [...claves] };
});

const buscadorDePersonas = (personal) => {
  const mapa = new Map();
  for (const p of personal) for (const c of p.claves) mapa.set(c, [...(mapa.get(c) || []), p]);
  return (nombre) => {
    const lista = mapa.get(normalizar(nombre));
    return lista?.length === 1 ? lista[0] : null;
  };
};

/**
 * Agrega los responsables nuevos, intenta leer su nombre (si el webhook
 * tiene el permiso «user») y recalcula la persona sugerida. No cambia una
 * equivalencia ya confirmada.
 */
const actualizarUsuarios = async (client) => {
  await run(`INSERT INTO dbo.COM_BITRIX_USUARIOS (bitrix_id)
    SELECT DISTINCT n.responsable_id FROM dbo.COM_BITRIX_NEGOCIACIONES n
    WHERE n.responsable_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.COM_BITRIX_USUARIOS u WHERE u.bitrix_id = n.responsable_id)`);
  const usuarios = await run('SELECT bitrix_id, nombre, usuario_id FROM dbo.COM_BITRIX_USUARIOS');
  const nombres = new Map();
  if (client) {
    for (const u of usuarios.filter(x => !x.nombre)) {
      try {
        const lista = resultado(await client.call('user.get', { ID: u.bitrix_id })) || [];
        const n = lista[0] ? [lista[0].NAME, lista[0].LAST_NAME].map(x => String(x || '').trim()).filter(Boolean).join(' ') : '';
        if (n) nombres.set(u.bitrix_id, n.slice(0, 120));
      } catch {
        break; // Sin permiso «user»: los nombres salen de las facturas.
      }
    }
  }
  const [enlaces, responsables, personas, personal] = await Promise.all([
    run('SELECT deal_id, factura_id FROM dbo.COM_BITRIX_ENLACES'),
    run('SELECT deal_id, responsable_id FROM dbo.COM_BITRIX_NEGOCIACIONES WHERE responsable_id IS NOT NULL'),
    run("SELECT factura_id, rol, usuario_id FROM dbo.COM_FACTURA_PERSONAS WHERE rol = 'RESPONSABLE'"),
    personalConClaves(),
  ]);
  const porFactura = new Map();
  for (const p of personas) porFactura.set(p.factura_id, [...(porFactura.get(p.factura_id) || []), { rol: p.rol, usuarioId: p.usuario_id }]);
  const sugerencias = dom.sugerirUsuarios({
    enlaces: enlaces.map(e => ({ dealId: e.deal_id, facturaId: e.factura_id })),
    responsables: new Map(responsables.map(r => [r.deal_id, r.responsable_id])),
    personas: porFactura,
  });
  const buscar = buscadorDePersonas(personal);
  for (const u of usuarios) {
    const nombre = nombres.get(u.bitrix_id) || u.nombre || null;
    let sugerencia = sugerencias.get(u.bitrix_id) || null;
    if (!sugerencia && nombre) {
      const p = buscar(nombre);
      if (p) sugerencia = { usuarioId: p.id, motivo: 'Mismo nombre en Bitrix24 y en DataMET' };
    }
    await run(
      'UPDATE dbo.COM_BITRIX_USUARIOS SET nombre = @nombre, sugerido_id = @sugerido, sugerencia = @motivo WHERE bitrix_id = @id',
      [
        { name: 'id', type: sql.Int, value: u.bitrix_id },
        { name: 'nombre', type: sql.NVarChar(120), value: nombre },
        { name: 'sugerido', type: sql.Int, value: sugerencia?.usuarioId ?? null },
        { name: 'motivo', type: sql.NVarChar(200), value: sugerencia?.motivo ?? null },
      ],
    );
  }
  return usuarios.length;
};

// ─── Sincronización ────────────────────────────────────────────────────────

let enCurso = null;

/**
 * Sincroniza la copia. `completa` vuelve a leer todo desde BITRIX_SYNC_DESDE.
 * Si ya hay una en curso en este proceso, devuelve esa misma.
 */
const sincronizar = ({ por = 'automática', completa = false } = {}) => {
  if (enCurso) return enCurso;
  const c = config();
  const client = cliente();
  enCurso = (async () => {
    const [ultima] = await run("SELECT TOP (1) inicio FROM dbo.COM_BITRIX_SINCRONIZACIONES WHERE estado = 'OK' ORDER BY id DESC");
    const tipo = completa || !ultima ? 'COMPLETA' : 'CAMBIOS';
    const desde = tipo === 'CAMBIOS' ? new Date(new Date(ultima.inicio).getTime() - MARGEN_MS) : null;
    const [{ id }] = await run(
      `INSERT INTO dbo.COM_BITRIX_SINCRONIZACIONES (tipo, desde, estado, por) OUTPUT INSERTED.id VALUES (@tipo, @desde, 'EN_CURSO', @por)`,
      [
        { name: 'tipo', type: sql.VarChar(10), value: tipo },
        { name: 'desde', type: sql.DateTime2, value: desde },
        { name: 'por', type: sql.NVarChar(50), value: String(por).slice(0, 50) },
      ],
    );
    try {
      const meta = await leerMetadatos(client);
      const empresas = await leerEmpresas(client, meta, { desde });
      for (const e of empresas) await guardarEmpresa(e);
      const deals = await leerNegociaciones(client, meta, { desde, creadasDesde: c.desde });
      for (const deal of deals) await guardarNegociacion(dom.mapNegociacion(deal, meta));
      const enlaces = await reconstruirEnlaces();
      await actualizarUsuarios(client);
      await run(
        `UPDATE dbo.COM_BITRIX_SINCRONIZACIONES SET estado = 'OK', fin = SYSUTCDATETIME(), negociaciones = @n, empresas = @e, enlaces = @l WHERE id = @id`,
        [
          { name: 'id', type: sql.Int, value: id },
          { name: 'n', type: sql.Int, value: deals.length },
          { name: 'e', type: sql.Int, value: empresas.length },
          { name: 'l', type: sql.Int, value: enlaces },
        ],
      );
      return { id, tipo, negociaciones: deals.length, empresas: empresas.length, enlaces };
    } catch (error) {
      await run(
        `UPDATE dbo.COM_BITRIX_SINCRONIZACIONES SET estado = 'ERROR', fin = SYSUTCDATETIME(), error = @error WHERE id = @id`,
        [{ name: 'id', type: sql.Int, value: id }, { name: 'error', type: sql.NVarChar(1000), value: String(error.message).slice(0, 1000) }],
      ).catch(() => {});
      throw error;
    }
  })().finally(() => { enCurso = null; });
  return enCurso;
};

/** Inicia una sincronización sin esperarla (para la pantalla). */
const sincronizarEnSegundoPlano = ({ por, completa }) => {
  const yaEnCurso = Boolean(enCurso);
  sincronizar({ por, completa }).catch(error => console.warn(`Sincronización con Bitrix24: ${error.message}`));
  return { iniciada: !yaEnCurso, enCurso: true };
};

// ─── Consultas ─────────────────────────────────────────────────────────────

const SITUACION_CTE = `
  WITH enl AS (SELECT deal_id, COUNT(*) AS facturas FROM dbo.COM_BITRIX_ENLACES GROUP BY deal_id),
  s AS (
    SELECT n.*, ISNULL(enl.facturas, 0) AS facturas,
      e.titulo AS empresa, e.codigo AS empresa_codigo, e.nit AS empresa_nit,
      CASE
        WHEN ISNULL(enl.facturas, 0) > 0 AND n.etapa_fase IN ('FACTURAR', 'PERDIDA') THEN 'etapa_desactualizada'
        WHEN ISNULL(enl.facturas, 0) > 0 THEN 'con_factura'
        WHEN n.etapa_fase = 'FACTURAR' THEN 'por_facturar'
        WHEN n.etapa_fase = 'COBRO' THEN 'sin_registrar'
        ELSE 'sin_factura'
      END AS situacion
    FROM dbo.COM_BITRIX_NEGOCIACIONES n
    LEFT JOIN enl ON enl.deal_id = n.deal_id
    LEFT JOIN dbo.COM_BITRIX_EMPRESAS e ON e.empresa_id = n.empresa_id
  )`;

const SITUACIONES = ['por_facturar', 'sin_registrar', 'etapa_desactualizada', 'con_factura', 'sin_factura'];

const buildNegociacionesWhere = (filtros, { conSituacion = true } = {}) => {
  const condiciones = [];
  const params = [];
  if (filtros.q) {
    const q = filtros.q.trim();
    condiciones.push(`(s.titulo LIKE @like OR s.empresa LIKE @like OR s.empresa_codigo LIKE @like OR CAST(s.deal_id AS varchar(12)) = @q
      OR EXISTS (SELECT 1 FROM dbo.COM_BITRIX_COTIZACIONES c WHERE c.deal_id = s.deal_id AND c.codigo LIKE @like))`);
    params.push({ name: 'like', type: sql.NVarChar(100), value: `%${q}%` }, { name: 'q', type: sql.NVarChar(80), value: q });
  }
  if (filtros.embudo !== undefined && filtros.embudo !== null) {
    condiciones.push('s.embudo_id = @embudo');
    params.push({ name: 'embudo', type: sql.Int, value: filtros.embudo });
  }
  if (conSituacion && filtros.situacion) {
    condiciones.push('s.situacion = @situacion');
    params.push({ name: 'situacion', type: sql.VarChar(25), value: filtros.situacion });
  }
  return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', params };
};

const nombreResponsable = `CASE WHEN du.id IS NOT NULL THEN LTRIM(RTRIM(CONCAT(du.nombre1, ' ', du.apellido1))) ELSE bu.nombre END`;

const mapFila = (row) => ({
  dealId: row.deal_id,
  embudoId: row.embudo_id,
  embudo: row.embudo,
  etapa: row.etapa,
  fase: row.etapa_fase,
  situacion: row.situacion,
  titulo: row.titulo,
  monto: row.monto === null ? null : Number(row.monto),
  moneda: row.moneda,
  responsableId: row.responsable_id,
  responsable: row.responsable_nombre || null,
  empresa: row.empresa || null,
  empresaCodigo: row.empresa_codigo || null,
  cotizacion: row.cotizacion || null,
  regional: row.regional || null,
  modificada: row.modificada_texto || null,
  facturas: [],
});

const facturasDe = async (dealIds) => {
  if (!dealIds.length) return new Map();
  const params = dealIds.map((id, i) => ({ name: `d${i}`, type: sql.Int, value: id }));
  const filas = await run(
    `SELECT e.deal_id, e.por, f.id, f.numero, f.gestion, f.monto, CONVERT(varchar(10), f.fecha_emision, 23) AS fecha
     FROM dbo.COM_BITRIX_ENLACES e JOIN dbo.COM_FACTURAS f ON f.id = e.factura_id
     WHERE e.deal_id IN (${params.map(p => `@${p.name}`).join(', ')}) ORDER BY f.fecha_emision, f.numero`,
    params,
  );
  const mapa = new Map();
  for (const f of filas) {
    mapa.set(f.deal_id, [...(mapa.get(f.deal_id) || []), {
      id: f.id, numero: f.numero, gestion: f.gestion, monto: Number(f.monto), fecha: f.fecha, por: f.por,
    }]);
  }
  return mapa;
};

const listNegociaciones = async (filtros) => {
  const { where, params } = buildNegociacionesWhere(filtros);
  const sinSituacion = buildNegociacionesWhere(filtros, { conSituacion: false });
  const offset = (filtros.page - 1) * filtros.pageSize;
  const [filas, resumen, embudos] = await Promise.all([
    run(`${SITUACION_CTE}
      SELECT s.*, CONVERT(varchar(19), s.modificada, 126) AS modificada_texto, ${nombreResponsable} AS responsable_nombre,
        COUNT(*) OVER () AS total
      FROM s
      LEFT JOIN dbo.COM_BITRIX_USUARIOS bu ON bu.bitrix_id = s.responsable_id
      LEFT JOIN DATA_USERS du ON du.id = bu.usuario_id
      ${where}
      ORDER BY CASE s.situacion WHEN 'por_facturar' THEN 0 WHEN 'sin_registrar' THEN 1 WHEN 'etapa_desactualizada' THEN 2 ELSE 3 END,
        s.modificada DESC, s.deal_id DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    [...params, { name: 'offset', type: sql.Int, value: offset }, { name: 'pageSize', type: sql.Int, value: filtros.pageSize }]),
    run(`${SITUACION_CTE} SELECT s.situacion, COUNT(*) AS n, SUM(s.monto) AS monto FROM s ${sinSituacion.where} GROUP BY s.situacion`, sinSituacion.params),
    run('SELECT embudo_id, MAX(embudo) AS embudo, COUNT(*) AS n FROM dbo.COM_BITRIX_NEGOCIACIONES GROUP BY embudo_id ORDER BY COUNT(*) DESC'),
  ]);
  const facturas = await facturasDe(filas.map(f => f.deal_id));
  const situaciones = Object.fromEntries(SITUACIONES.map(s => [s, { negociaciones: 0, monto: 0 }]));
  for (const r of resumen) situaciones[r.situacion] = { negociaciones: r.n, monto: Number(r.monto || 0) };
  return {
    items: filas.map(row => ({ ...mapFila(row), facturas: facturas.get(row.deal_id) || [] })),
    total: filas[0]?.total ?? 0,
    page: filtros.page,
    pageSize: filtros.pageSize,
    resumen: { situaciones },
    embudos: embudos.map(e => ({ id: e.embudo_id, nombre: e.embudo, negociaciones: e.n })),
  };
};

/** Cliente de DataMET de una negociación: por el código de la empresa o el de la cotización. */
const clienteDeNegociacion = async (neg, cotizaciones) => {
  const codigos = [dom.clienteDeEmpresa(neg.empresa_codigo), ...cotizaciones.map(c => dom.clienteDeCotizacion(c.codigo))]
    .filter(Boolean).filter((c, i, a) => a.indexOf(c) === i && c !== '0000');
  if (!codigos.length) return null;
  const params = codigos.map((c, i) => ({ name: `c${i}`, type: sql.NVarChar(20), value: c }));
  const filas = await run(
    `SELECT LTRIM(RTRIM(codigo_cliente)) AS codigo, razonsocial, cliente, nit FROM DATA_CLIENTES
     WHERE LTRIM(RTRIM(codigo_cliente)) IN (${params.map(p => `@${p.name}`).join(', ')})`,
    params,
  );
  const elegido = codigos.map(c => filas.find(f => f.codigo === c)).find(Boolean);
  if (!elegido) return null;
  const nit = elegido.nit && String(elegido.nit).trim() !== '0' ? String(elegido.nit).trim() : null;
  return { codigo: elegido.codigo, razonSocial: elegido.razonsocial || elegido.cliente, nit };
};

const getNegociacion = async (dealId) => {
  const [row] = await run(`${SITUACION_CTE}
    SELECT s.*, CONVERT(varchar(19), s.modificada, 126) AS modificada_texto, CONVERT(varchar(19), s.creada, 126) AS creada_texto,
      CONVERT(varchar(19), s.sincronizada_en, 126) AS sincronizada_texto, ${nombreResponsable} AS responsable_nombre,
      bu.usuario_id AS responsable_usuario_id
    FROM s
    LEFT JOIN dbo.COM_BITRIX_USUARIOS bu ON bu.bitrix_id = s.responsable_id
    LEFT JOIN DATA_USERS du ON du.id = bu.usuario_id
    WHERE s.deal_id = @id`, [{ name: 'id', type: sql.Int, value: dealId }]);
  if (!row) throw httpError(404, 'La negociación no está en la copia de Bitrix24. Sincroniza o revisa el número.');
  const [cotizaciones, facturas, categorias, personal] = await Promise.all([
    run('SELECT codigo, clave, campo FROM dbo.COM_BITRIX_COTIZACIONES WHERE deal_id = @id ORDER BY id', [{ name: 'id', type: sql.Int, value: dealId }]),
    facturasDe([dealId]),
    comercial.listCategorias(),
    personalConClaves(),
  ]);
  const cot = cotizaciones.map(c => ({ codigo: c.codigo, clave: c.clave, campo: c.campo || 'cotizacion' }));
  const clienteDm = await clienteDeNegociacion(row, cot);
  const propuesta = dom.propuestaFactura({ ...row, cotizaciones: cot }, {
    cliente: clienteDm,
    categoriasPorCodigo: new Map(categorias.filter(c => c.vigente).map(c => [c.codigo, c])),
    responsable: row.responsable_usuario_id ? { usuarioId: row.responsable_usuario_id, nombre: row.responsable_nombre } : null,
    buscarPersona: buscadorDePersonas(personal),
    facturas: facturas.get(dealId) || [],
  });
  const portal = config().portal;
  return {
    ...mapFila(row),
    creada: row.creada_texto,
    sincronizada: row.sincronizada_texto,
    empresaNit: row.empresa_nit || null,
    ciudad: row.ciudad,
    numBalanzas: row.num_balanzas,
    numPesas: row.num_pesas,
    subArea: row.sub_area,
    tiposServicio: row.tipos_servicio,
    tecnico: row.tecnico,
    apoyo: row.apoyo,
    notaSalida: row.nota_salida,
    ordenCompra: row.orden_compra,
    condiciones: row.condiciones,
    mesFacturar: row.mes_facturar,
    marcadaFacturada: row.facturado === null ? null : Boolean(row.facturado),
    cotizaciones: cot.map(c => c.codigo),
    facturas: facturas.get(dealId) || [],
    enlace: portal ? `${portal}/crm/deal/details/${dealId}/` : null,
    propuesta,
  };
};

const estado = async () => {
  const c = config();
  const base = {
    configurado: c.configurado,
    errorConfiguracion: c.error,
    automatica: c.configurado && c.sincronizar,
    minutos: c.minutos,
    desde: c.desde,
    portal: c.portal,
    enCurso: Boolean(enCurso),
    tablas: true,
  };
  let ultimas;
  let conteo;
  try {
    [ultimas, conteo] = await Promise.all([
      run(`SELECT TOP (5) id, tipo, estado, negociaciones, empresas, enlaces, error, por,
             CONVERT(varchar(19), inicio, 126) AS inicio, CONVERT(varchar(19), fin, 126) AS fin
           FROM dbo.COM_BITRIX_SINCRONIZACIONES ORDER BY id DESC`),
      run(`SELECT (SELECT COUNT(*) FROM dbo.COM_BITRIX_NEGOCIACIONES) AS negociaciones,
             (SELECT COUNT(DISTINCT factura_id) FROM dbo.COM_BITRIX_ENLACES) AS facturas,
             (SELECT COUNT(*) FROM dbo.COM_BITRIX_USUARIOS WHERE usuario_id IS NULL) AS responsablesSinConfirmar`),
    ]);
  } catch (error) {
    // Sin la migración 035 la pantalla igual muestra cómo está la configuración.
    if (error.statusCode !== 503) throw error;
    return { ...base, tablas: false, aviso: error.message, ultima: null, ultimaCorrecta: null, copia: null };
  }
  const mapa = (r) => (r ? {
    id: r.id, tipo: r.tipo, estado: r.estado, negociaciones: r.negociaciones, empresas: r.empresas, enlaces: r.enlaces,
    error: r.error, por: r.por, inicio: r.inicio, fin: r.fin,
  } : null);
  return {
    ...base,
    ultima: mapa(ultimas[0]),
    ultimaCorrecta: mapa(ultimas.find(u => u.estado === 'OK')),
    copia: conteo[0],
  };
};

const listUsuarios = async () => (await run(`
  SELECT u.bitrix_id, u.nombre, u.usuario_id, u.sugerido_id, u.sugerencia, u.confirmado_por,
    CONVERT(varchar(19), u.confirmado_en, 126) AS confirmado_texto,
    LTRIM(RTRIM(CONCAT(du.nombre1, ' ', du.apellido1))) AS usuario_nombre,
    LTRIM(RTRIM(CONCAT(ds.nombre1, ' ', ds.apellido1))) AS sugerido_nombre,
    (SELECT COUNT(*) FROM dbo.COM_BITRIX_NEGOCIACIONES n WHERE n.responsable_id = u.bitrix_id) AS negociaciones
  FROM dbo.COM_BITRIX_USUARIOS u
  LEFT JOIN DATA_USERS du ON du.id = u.usuario_id
  LEFT JOIN DATA_USERS ds ON ds.id = u.sugerido_id
  ORDER BY negociaciones DESC, u.bitrix_id`)).map(r => ({
  bitrixId: r.bitrix_id,
  nombreBitrix: r.nombre || null,
  usuarioId: r.usuario_id,
  usuario: r.usuario_id ? r.usuario_nombre : null,
  sugeridoId: r.sugerido_id,
  sugerido: r.sugerido_id ? r.sugerido_nombre : null,
  sugerencia: r.sugerencia || null,
  confirmado: r.confirmado_por ? { usuario: r.confirmado_por, fecha: r.confirmado_texto } : null,
  negociaciones: r.negociaciones,
}));

/** Confirma (o quita, con null) la persona de DATA_USERS de un responsable de Bitrix24. */
const confirmarUsuario = async (bitrixId, { usuarioId }, user) => {
  const usuario = String(user?.usuario || '').slice(0, 50) || 'desconocido';
  const nombre = await comercial.nombreDe(usuario);
  await withTransaction(async (newRequest) => {
    const [actual] = await run('SELECT bitrix_id, usuario_id FROM dbo.COM_BITRIX_USUARIOS WITH (UPDLOCK, HOLDLOCK) WHERE bitrix_id = @id',
      [{ name: 'id', type: sql.Int, value: bitrixId }], newRequest());
    if (!actual) throw httpError(404, 'Ese responsable no está en la copia de Bitrix24.');
    if (usuarioId) {
      const [existe] = await run("SELECT id FROM DATA_USERS WHERE id = @u", [{ name: 'u', type: sql.Int, value: usuarioId }], newRequest());
      if (!existe) throw httpError(400, 'La persona elegida no existe en DataMET.');
    }
    await run(
      `UPDATE dbo.COM_BITRIX_USUARIOS SET usuario_id = @u, confirmado_por = @por, confirmado_en = SYSUTCDATETIME() WHERE bitrix_id = @id`,
      [
        { name: 'id', type: sql.Int, value: bitrixId },
        { name: 'u', type: sql.Int, value: usuarioId || null },
        { name: 'por', type: sql.NVarChar(50), value: usuario },
      ],
      newRequest(),
    );
    await comercial.historial(newRequest, {
      entidad: 'BITRIX', entidadId: `usuario:${bitrixId}`, accion: 'ACTUALIZACION',
      detalle: { responsableBitrix: bitrixId, antes: actual.usuario_id, despues: usuarioId || null }, usuario, nombre,
    });
  });
  return (await listUsuarios()).find(u => u.bitrixId === bitrixId);
};

/** Negociaciones enlazadas con una factura, para su ficha. Sin la migración 035, ninguna. */
const negociacionesDeFactura = async (facturaId) => {
  try {
    const filas = await run(
      `SELECT n.deal_id, n.titulo, n.embudo, n.etapa, n.etapa_fase, n.monto, e.por
       FROM dbo.COM_BITRIX_ENLACES e JOIN dbo.COM_BITRIX_NEGOCIACIONES n ON n.deal_id = e.deal_id
       WHERE e.factura_id = @id ORDER BY n.deal_id`,
      [{ name: 'id', type: sql.Int, value: facturaId }],
    );
    const portal = config().portal;
    return filas.map(f => ({
      dealId: f.deal_id, titulo: f.titulo, embudo: f.embudo, etapa: f.etapa, fase: f.etapa_fase,
      monto: f.monto === null ? null : Number(f.monto), por: f.por, enlace: portal ? `${portal}/crm/deal/details/${f.deal_id}/` : null,
    }));
  } catch (error) {
    if (error.statusCode === 503) return [];
    throw error;
  }
};

module.exports = {
  SITUACIONES,
  negociacionesDeFactura,
  _configurar,
  actualizarUsuarios,
  buildNegociacionesWhere,
  config,
  confirmarUsuario,
  estado,
  getNegociacion,
  listNegociaciones,
  listUsuarios,
  notReady,
  reconstruirEnlaces,
  sincronizar,
  sincronizarEnSegundoPlano,
};
