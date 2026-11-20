/**
 * Comisiones de Comercial (fase 4, migración 037): el cálculo del mes y del
 * año con las reglas vigentes, las versiones de las reglas, el cierre
 * congelado de un mes y su libro de Excel. El cálculo está en
 * comercial.comisiones.domain.
 *
 * Quien tiene `comisiones.comercial.ver` (o `…gestionar`) ve las de todos;
 * los demás, solo las suyas. Cambiar las reglas y cerrar o anular un cierre
 * piden `comisiones.comercial.gestionar`.
 */
const { sql } = require('../config/db');
// Se lee al llamar (como permisos.js), así una prueba puede correr todo en una transacción y deshacerla.
const transacciones = require('./calibration.db');

const withTransaction = (trabajo) => transacciones.withTransaction(trabajo);
const comercial = require('./comercial.service');
const dom = require('./comercial.comisiones.domain');
const { hoyLaPaz, httpError } = require('./comercial.domain');
const { crearLibro } = require('../utils/xlsx-escribir');

const notReady = (error) => {
  const message = error?.message || '';
  if ((error?.number === 208 || /Invalid object name/i.test(message)) && /COM_COMISION_/i.test(message)) {
    return httpError(503, 'Falta aplicar la migración 037 (pnpm migrate en backend): Comercial todavía no tiene las comisiones.');
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

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dos = (n) => String(n).padStart(2, '0');
const finDeMes = (gestion, mes) => new Date(Date.UTC(gestion, mes, 0)).toISOString().slice(0, 10);
const json = (texto, defecto) => {
  try {
    return JSON.parse(texto);
  } catch {
    return defecto;
  }
};

// ─── Reglas ────────────────────────────────────────────────────────────────

const mapRegla = (r) => ({
  id: r.id,
  vigenteDesde: r.vigente_desde_texto,
  base: r.base,
  tramos: json(r.tramos, []),
  categorias: json(r.categorias, []),
  ventaSinCosto: Boolean(r.venta_sin_costo),
  nota: r.nota,
  creado: { usuario: r.creado_por, nombre: r.creado_nombre, fecha: r.creado_texto },
});

const leerReglas = async () => (await run(`
  SELECT id, CONVERT(varchar(10), vigente_desde, 23) AS vigente_desde_texto, base, tramos, categorias, venta_sin_costo, nota,
    creado_por, creado_nombre, CONVERT(varchar(19), creado_en, 126) AS creado_texto
  FROM dbo.COM_COMISION_REGLAS ORDER BY vigente_desde DESC`)).map(mapRegla);

/** Último mes cerrado (para que una regla nueva no cambie lo ya cerrado). */
const ultimoCierre = async () => {
  const [c] = await run("SELECT TOP (1) gestion, mes FROM dbo.COM_COMISION_CIERRES WHERE estado = 'CERRADO' ORDER BY gestion DESC, mes DESC");
  return c ? { gestion: c.gestion, mes: c.mes, fin: finDeMes(c.gestion, c.mes) } : null;
};

const listReglas = async () => {
  const [reglas, categorias, cierre] = await Promise.all([
    leerReglas(),
    comercial.listCategorias(),
    ultimoCierre(),
  ]);
  return {
    reglas,
    vigente: dom.reglaVigente(reglas, hoyLaPaz()),
    categorias: categorias.map(c => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, area: c.area, vigente: c.vigente })),
    // Una versión nueva rige desde el día siguiente al último mes cerrado, o después.
    desdeMinimo: cierre ? new Date(new Date(`${cierre.fin}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10) : null,
  };
};

const crearRegla = async (regla, user) => {
  const problemas = dom.problemasReglas(regla);
  if (problemas.length) throw httpError(400, problemas[0]);
  const [cierre, categorias, existentes] = await Promise.all([
    ultimoCierre(),
    comercial.listCategorias(),
    run('SELECT 1 AS x FROM dbo.COM_COMISION_REGLAS WHERE vigente_desde = @d', [{ name: 'd', type: sql.Date, value: regla.vigenteDesde }]),
  ]);
  if (cierre && regla.vigenteDesde <= cierre.fin) {
    throw httpError(409, `Ya está cerrado ${MESES[cierre.mes - 1]} de ${cierre.gestion}: la versión nueva puede regir desde el día siguiente.`);
  }
  if (existentes.length) throw httpError(409, 'Ya hay una versión de las reglas que rige desde esa fecha.');
  const ids = new Set(categorias.map(c => c.id));
  if (regla.categorias.some(id => !ids.has(id))) throw httpError(400, 'Una de las categorías elegidas no existe.');
  const usuario = String(user?.usuario || '').slice(0, 50) || 'desconocido';
  const nombre = await comercial.nombreDe(usuario);
  const tramos = [...regla.tramos].sort((a, b) => a.desde - b.desde);
  let id;
  await withTransaction(async (newRequest) => {
    [{ id }] = await run(
      `INSERT INTO dbo.COM_COMISION_REGLAS (vigente_desde, base, tramos, categorias, venta_sin_costo, nota, creado_por, creado_nombre)
       OUTPUT INSERTED.id VALUES (@desde, @base, @tramos, @categorias, @sinCosto, @nota, @usuario, @nombre)`,
      [
        { name: 'desde', type: sql.Date, value: regla.vigenteDesde },
        { name: 'base', type: sql.VarChar(5), value: regla.base },
        { name: 'tramos', type: sql.NVarChar(2000), value: JSON.stringify(tramos) },
        { name: 'categorias', type: sql.NVarChar(4000), value: JSON.stringify([...new Set(regla.categorias)].sort((a, b) => a - b)) },
        { name: 'sinCosto', type: sql.Bit, value: regla.ventaSinCosto },
        { name: 'nota', type: sql.NVarChar(300), value: regla.nota },
        { name: 'usuario', type: sql.NVarChar(50), value: usuario },
        { name: 'nombre', type: sql.NVarChar(120), value: nombre },
      ],
      newRequest(),
    );
    await comercial.historial(newRequest, {
      entidad: 'COMISION', entidadId: `regla:${id}`, accion: 'REGISTRO', motivo: regla.nota,
      detalle: { vigenteDesde: regla.vigenteDesde, base: regla.base, tramos, categorias: regla.categorias.length, ventaSinCosto: regla.ventaSinCosto },
      usuario, nombre,
    });
  });
  return listReglas();
};

// ─── Cálculo ───────────────────────────────────────────────────────────────

/** Facturas vigentes emitidas en el rango, con sus líneas y responsables. */
const datos = async (desde, hasta) => {
  const params = [{ name: 'desde', type: sql.Date, value: desde }, { name: 'hasta', type: sql.Date, value: hasta }];
  const rango = "f.estado = 'VIGENTE' AND f.fecha_emision >= @desde AND f.fecha_emision <= @hasta";
  const [facturas, lineas, responsables] = await Promise.all([
    run(`SELECT f.id, f.gestion, f.numero, CONVERT(varchar(10), f.fecha_emision, 23) AS fecha, f.razon_social FROM dbo.COM_FACTURAS f WHERE ${rango}`, params),
    run(`SELECT l.factura_id, l.monto, l.costo, cat.id AS categoria_id, cat.nombre, cat.area, cat.regla_margen
         FROM dbo.COM_FACTURA_LINEAS l JOIN dbo.COM_CATEGORIAS cat ON cat.id = l.categoria_id JOIN dbo.COM_FACTURAS f ON f.id = l.factura_id
         WHERE ${rango} ORDER BY f.fecha_emision, f.numero, l.orden`, params),
    run(`SELECT p.factura_id, p.usuario_id, p.nombre, p.porcentaje FROM dbo.COM_FACTURA_PERSONAS p JOIN dbo.COM_FACTURAS f ON f.id = p.factura_id
         WHERE p.rol = 'RESPONSABLE' AND ${rango}`, params),
  ]);
  return {
    facturas: facturas.map(f => ({ id: f.id, gestion: f.gestion, numero: f.numero, fecha: f.fecha, razonSocial: f.razon_social })),
    lineas: lineas.map(l => ({
      facturaId: l.factura_id, monto: Number(l.monto), costo: l.costo === null ? null : Number(l.costo),
      categoria: { id: l.categoria_id, nombre: l.nombre, area: l.area, regla: l.regla_margen },
    })),
    responsables: responsables.map(r => ({ facturaId: r.factura_id, usuarioId: r.usuario_id, nombre: r.nombre, porcentaje: r.porcentaje === null ? null : Number(r.porcentaje) })),
  };
};

const calcular = async (desde, hasta, reglas) => dom.calcularComisiones({ ...(await datos(desde, hasta)), reglas: reglas || await leerReglas() });

const cierresDe = async (gestion) => (await run(`
  SELECT id, gestion, mes, estado, base_total, comision_total, resumen, reglas, cerrado_por, cerrado_nombre,
    CONVERT(varchar(19), cerrado_en, 126) AS cerrado_texto, anulado_motivo, anulado_por, anulado_nombre, CONVERT(varchar(19), anulado_en, 126) AS anulado_texto
  FROM dbo.COM_COMISION_CIERRES WHERE gestion = @g ORDER BY mes, id`, [{ name: 'g', type: sql.SmallInt, value: gestion }]))
  .map(c => ({
    id: c.id, gestion: c.gestion, mes: c.mes, estado: c.estado, base: Number(c.base_total), comision: Number(c.comision_total),
    resumen: json(c.resumen, { personas: [], totales: {} }), reglas: json(c.reglas, []),
    cerrado: { usuario: c.cerrado_por, nombre: c.cerrado_nombre, fecha: c.cerrado_texto },
    anulado: c.estado === 'ANULADO' ? { usuario: c.anulado_por, nombre: c.anulado_nombre, fecha: c.anulado_texto, motivo: c.anulado_motivo } : null,
  }));

const estadoMes = (gestion, mes, hoy) => {
  const actual = hoy.slice(0, 7);
  const este = `${gestion}-${dos(mes)}`;
  if (este > actual) return 'futuro';
  if (este === actual) return 'en_curso';
  return 'abierto';
};

/**
 * El año: por mes, lo calculado (o lo cerrado, congelado), y el total por
 * responsable. `ctx` = { todos, usuarioId }.
 */
const resumenGestion = async (gestion, ctx) => {
  const hoy = hoyLaPaz();
  const [reglas, cierres, gestiones] = await Promise.all([
    leerReglas(),
    cierresDe(gestion),
    run('SELECT DISTINCT gestion FROM dbo.COM_FACTURAS ORDER BY gestion DESC'),
  ]);
  const d = await datos(`${gestion}-01-01`, `${gestion}-12-31`);
  const personasAnio = new Map();
  const sumarPersona = (p) => {
    const clave = p.usuarioId ? `U:${p.usuarioId}` : `N:${p.nombre}`;
    const x = personasAnio.get(clave) || { usuarioId: p.usuarioId, nombre: p.nombre, base: 0, comision: 0 };
    x.base = Math.round((x.base + p.base) * 100) / 100;
    x.comision = Math.round((x.comision + p.comision) * 100) / 100;
    personasAnio.set(clave, x);
  };
  const meses = [];
  for (let mes = 1; mes <= 12; mes += 1) {
    const cierre = cierres.find(c => c.mes === mes && c.estado === 'CERRADO') || null;
    let estado = cierre ? 'cerrado' : estadoMes(gestion, mes, hoy);
    let calculo;
    if (cierre) calculo = { personas: cierre.resumen.personas || [], totales: cierre.resumen.totales || {} };
    else {
      const prefijo = `${gestion}-${dos(mes)}`;
      const facturas = d.facturas.filter(f => f.fecha.startsWith(prefijo));
      const ids = new Set(facturas.map(f => f.id));
      calculo = dom.calcularComisiones({
        facturas, lineas: d.lineas.filter(l => ids.has(l.facturaId)), responsables: d.responsables.filter(r => ids.has(r.facturaId)), reglas,
      });
      if (estado === 'abierto' && !facturas.length) estado = 'sin_facturas';
    }
    const visible = ctx.todos ? calculo : { personas: calculo.personas.filter(p => p.usuarioId === ctx.usuarioId), totales: null };
    visible.personas.forEach(sumarPersona);
    const propia = visible.personas[0];
    meses.push({
      mes,
      estado,
      base: ctx.todos ? calculo.totales.base || 0 : propia?.base || 0,
      comision: ctx.todos ? calculo.totales.comision || 0 : propia?.comision || 0,
      personas: visible.personas.length,
      porCostear: ctx.todos ? calculo.totales.porCostear || 0 : null,
      sinResponsable: ctx.todos ? calculo.totales.sinResponsable || 0 : null,
      cierre: cierre ? { id: cierre.id, cerrado: cierre.cerrado } : null,
      anulados: cierres.filter(c => c.mes === mes && c.estado === 'ANULADO').length,
    });
  }
  return {
    gestion,
    gestiones: gestiones.map(g => g.gestion),
    meses,
    personas: [...personasAnio.values()].sort((a, b) => b.comision - a.comision),
    total: Math.round(meses.reduce((s, m) => s + Math.round(m.comision * 100), 0)) / 100,
    todos: ctx.todos,
  };
};

/** Un mes: el cierre congelado (y si hoy daría otra cosa) o el cálculo de hoy. */
const detalleMes = async (gestion, mes, ctx) => {
  const [cierres, reglas] = await Promise.all([cierresDe(gestion), leerReglas()]);
  const cierre = cierres.find(c => c.mes === mes && c.estado === 'CERRADO') || null;
  const hoy = await calcular(`${gestion}-${dos(mes)}-01`, finDeMes(gestion, mes), reglas);
  const base = {
    gestion, mes, nombre: `${MESES[mes - 1]} ${gestion}`, estado: cierre ? 'cerrado' : estadoMes(gestion, mes, hoyLaPaz()), todos: ctx.todos,
    historialCierres: cierres.filter(c => c.mes === mes).map(c => ({ id: c.id, estado: c.estado, comision: c.comision, cerrado: c.cerrado, anulado: c.anulado })),
    reglas: reglas.filter(r => hoy.reglas.includes(r.id) || (cierre && cierre.reglas.includes(r.id))).map(r => ({ id: r.id, vigenteDesde: r.vigenteDesde, nota: r.nota })),
  };
  if (!cierre) {
    // `reglas` del cálculo son ids; la respuesta lleva las versiones (base.reglas).
    const { reglas: _ids, ...visible } = ctx.todos ? hoy : dom.soloDe(hoy, ctx.usuarioId);
    return { ...base, cierre: null, ...visible };
  }
  const filas = await run(`
    SELECT usuario_id, nombre, factura_id, gestion, numero, CONVERT(varchar(10), fecha, 23) AS fecha, razon_social, categoria, monto_linea, base,
      margen, tasa, porcentaje, comision, regla_id
    FROM dbo.COM_COMISION_CIERRE_LINEAS WHERE cierre_id = @c ${ctx.todos ? '' : 'AND usuario_id = @u'} ORDER BY fecha, numero, id`,
  [{ name: 'c', type: sql.Int, value: cierre.id }, ...(ctx.todos ? [] : [{ name: 'u', type: sql.Int, value: ctx.usuarioId }])]);
  // Las filas del cierre van por persona; se agrupan por línea como en el cálculo.
  const lineas = [];
  const clave = (f) => `${f.factura_id}|${f.categoria}|${f.monto_linea}|${f.base}`;
  const porClave = new Map();
  for (const f of filas) {
    let l = porClave.get(clave(f));
    if (!l) {
      l = {
        facturaId: f.factura_id, gestion: f.gestion, numero: f.numero, fecha: f.fecha, razonSocial: f.razon_social, categoria: f.categoria,
        montoLinea: Number(f.monto_linea), base: Number(f.base), margen: f.margen === null ? null : Number(f.margen), tasa: Number(f.tasa),
        comision: 0, reglaId: f.regla_id, estado: 'comisiona', personas: [],
      };
      porClave.set(clave(f), l);
      lineas.push(l);
    }
    l.comision = Math.round((l.comision + Number(f.comision)) * 100) / 100;
    l.personas.push({ usuarioId: f.usuario_id, nombre: f.nombre, porcentaje: Number(f.porcentaje), comision: Number(f.comision) });
  }
  const personas = ctx.todos ? cierre.resumen.personas : cierre.resumen.personas.filter(p => p.usuarioId === ctx.usuarioId);
  const congelado = ctx.todos ? cierre.comision : personas[0]?.comision || 0;
  const deHoy = ctx.todos ? hoy.totales.comision : hoy.personas.find(p => p.usuarioId === ctx.usuarioId)?.comision || 0;
  return {
    ...base,
    cierre: { id: cierre.id, cerrado: cierre.cerrado, diferencia: Math.round((deHoy - congelado) * 100) / 100 },
    lineas,
    personas,
    totales: ctx.todos ? cierre.resumen.totales : { base: personas[0]?.base || 0, comision: congelado, sinResponsable: 0, porCostear: 0, lineasPorCostear: 0 },
  };
};

// ─── Cierres ───────────────────────────────────────────────────────────────

const cerrarMes = async (gestion, mes, user) => {
  if (finDeMes(gestion, mes) >= hoyLaPaz()) throw httpError(409, 'Solo se cierra un mes que ya terminó.');
  const yaCerrado = await run("SELECT 1 AS x FROM dbo.COM_COMISION_CIERRES WHERE gestion = @g AND mes = @m AND estado = 'CERRADO'",
    [{ name: 'g', type: sql.SmallInt, value: gestion }, { name: 'm', type: sql.TinyInt, value: mes }]);
  if (yaCerrado.length) throw httpError(409, `${MESES[mes - 1]} de ${gestion} ya está cerrado.`);
  const reglas = await leerReglas();
  const calculo = await calcular(`${gestion}-${dos(mes)}-01`, finDeMes(gestion, mes), reglas);
  const usuario = String(user?.usuario || '').slice(0, 50) || 'desconocido';
  const nombre = await comercial.nombreDe(usuario);
  const filas = calculo.lineas.flatMap(l => l.personas.map(p => ({ ...l, persona: p })));
  let id;
  try {
    await withTransaction(async (newRequest) => {
      [{ id }] = await run(
        `INSERT INTO dbo.COM_COMISION_CIERRES (gestion, mes, estado, base_total, comision_total, resumen, reglas, cerrado_por, cerrado_nombre)
         OUTPUT INSERTED.id VALUES (@g, @m, 'CERRADO', @base, @comision, @resumen, @reglas, @usuario, @nombre)`,
        [
          { name: 'g', type: sql.SmallInt, value: gestion },
          { name: 'm', type: sql.TinyInt, value: mes },
          { name: 'base', type: sql.Decimal(14, 2), value: calculo.totales.base },
          { name: 'comision', type: sql.Decimal(14, 2), value: calculo.totales.comision },
          { name: 'resumen', type: sql.NVarChar(sql.MAX), value: JSON.stringify({ personas: calculo.personas, totales: calculo.totales }) },
          { name: 'reglas', type: sql.NVarChar(200), value: JSON.stringify(calculo.reglas) },
          { name: 'usuario', type: sql.NVarChar(50), value: usuario },
          { name: 'nombre', type: sql.NVarChar(120), value: nombre },
        ],
        newRequest(),
      );
      for (let i = 0; i < filas.length; i += 100) {
        const lote = filas.slice(i, i + 100);
        const params = lote.flatMap((f, j) => [
          { name: `u${j}`, type: sql.Int, value: f.persona.usuarioId },
          { name: `n${j}`, type: sql.NVarChar(120), value: String(f.persona.nombre).slice(0, 120) },
          { name: `f${j}`, type: sql.Int, value: f.facturaId },
          { name: `g${j}`, type: sql.SmallInt, value: f.gestion },
          { name: `nu${j}`, type: sql.Int, value: f.numero },
          { name: `fe${j}`, type: sql.Date, value: f.fecha },
          { name: `r${j}`, type: sql.NVarChar(255), value: String(f.razonSocial).slice(0, 255) },
          { name: `c${j}`, type: sql.NVarChar(160), value: String(f.categoria).slice(0, 160) },
          { name: `ml${j}`, type: sql.Decimal(14, 2), value: f.montoLinea },
          { name: `b${j}`, type: sql.Decimal(14, 2), value: f.base },
          { name: `mg${j}`, type: sql.Decimal(7, 2), value: f.margen },
          { name: `t${j}`, type: sql.Decimal(6, 3), value: f.tasa },
          { name: `p${j}`, type: sql.Decimal(6, 2), value: f.persona.porcentaje },
          { name: `co${j}`, type: sql.Decimal(14, 2), value: f.persona.comision },
          { name: `re${j}`, type: sql.Int, value: f.reglaId },
        ]);
        await run(
          `INSERT INTO dbo.COM_COMISION_CIERRE_LINEAS (cierre_id, usuario_id, nombre, factura_id, gestion, numero, fecha, razon_social, categoria,
             monto_linea, base, margen, tasa, porcentaje, comision, regla_id)
           VALUES ${lote.map((_, j) => `(@cierre, @u${j}, @n${j}, @f${j}, @g${j}, @nu${j}, @fe${j}, @r${j}, @c${j}, @ml${j}, @b${j}, @mg${j}, @t${j}, @p${j}, @co${j}, @re${j})`).join(', ')}`,
          [{ name: 'cierre', type: sql.Int, value: id }, ...params],
          newRequest(),
        );
      }
      await comercial.historial(newRequest, {
        entidad: 'COMISION', entidadId: `cierre:${gestion}-${dos(mes)}`, accion: 'REGISTRO',
        detalle: { cierre: id, comision: calculo.totales.comision, personas: calculo.personas.length, lineas: filas.length, reglas: calculo.reglas }, usuario, nombre,
      });
    });
  } catch (error) {
    if (error?.number === 2601 || error?.number === 2627) throw httpError(409, `${MESES[mes - 1]} de ${gestion} ya está cerrado.`);
    throw error;
  }
  return detalleMes(gestion, mes, { todos: true });
};

const anularCierre = async (id, { motivo }, user) => {
  const usuario = String(user?.usuario || '').slice(0, 50) || 'desconocido';
  const nombre = await comercial.nombreDe(usuario);
  let cierre;
  await withTransaction(async (newRequest) => {
    [cierre] = await run("SELECT id, gestion, mes, estado, comision_total FROM dbo.COM_COMISION_CIERRES WITH (UPDLOCK, HOLDLOCK) WHERE id = @id",
      [{ name: 'id', type: sql.Int, value: id }], newRequest());
    if (!cierre) throw httpError(404, 'Ese cierre no existe.');
    if (cierre.estado !== 'CERRADO') throw httpError(409, 'Ese cierre ya está anulado.');
    await run(
      `UPDATE dbo.COM_COMISION_CIERRES SET estado = 'ANULADO', anulado_motivo = @motivo, anulado_por = @usuario, anulado_nombre = @nombre,
         anulado_en = SYSUTCDATETIME() WHERE id = @id`,
      [
        { name: 'id', type: sql.Int, value: id },
        { name: 'motivo', type: sql.NVarChar(300), value: motivo },
        { name: 'usuario', type: sql.NVarChar(50), value: usuario },
        { name: 'nombre', type: sql.NVarChar(120), value: nombre },
      ],
      newRequest(),
    );
    await comercial.historial(newRequest, {
      entidad: 'COMISION', entidadId: `cierre:${cierre.gestion}-${dos(cierre.mes)}`, accion: 'ANULACION', motivo,
      detalle: { cierre: id, comision: Number(cierre.comision_total) }, usuario, nombre,
    });
  });
  return detalleMes(cierre.gestion, cierre.mes, { todos: true });
};

// ─── Excel ─────────────────────────────────────────────────────────────────

const ESTADOS_LINEA = {
  comisiona: 'Comisiona', bajo_tramo: 'Margen bajo el primer tramo', categoria: 'La categoría no comisiona',
  por_costear: 'Venta sin costo: por costear', sin_responsable: 'Sin responsable', sin_regla: 'Sin reglas vigentes',
};

const excelMes = async (gestion, mes, ctx) => {
  const d = await detalleMes(gestion, mes, ctx);
  const hojas = [
    {
      nombre: 'Comisiones',
      columnas: [{ titulo: 'Responsable', ancho: 30 }, { titulo: 'Facturas', tipo: 'entero', ancho: 10 }, { titulo: 'Base', tipo: 'bs', ancho: 16 },
        { titulo: 'Comisión', tipo: 'bs', ancho: 14 }],
      filas: d.personas.map(p => [p.nombre, p.facturas, p.base, p.comision]),
    },
    {
      nombre: 'Detalle',
      columnas: [
        { titulo: 'Responsable', ancho: 26 }, { titulo: 'N.º', tipo: 'entero', ancho: 8 }, { titulo: 'Emisión', tipo: 'fecha', ancho: 11 },
        { titulo: 'Razón social', ancho: 36 }, { titulo: 'Categoría', ancho: 36 }, { titulo: 'Monto de la línea', tipo: 'bs', ancho: 15 },
        { titulo: 'Base', tipo: 'bs', ancho: 14 }, { titulo: 'Margen %', tipo: 'numero', ancho: 10 }, { titulo: 'Tasa %', tipo: 'numero', ancho: 8 },
        { titulo: 'Su parte %', tipo: 'numero', ancho: 10 }, { titulo: 'Comisión', tipo: 'bs', ancho: 13 },
      ],
      filas: d.lineas.flatMap(l => l.personas.map(p => [p.nombre, l.numero, l.fecha, l.razonSocial, l.categoria, l.montoLinea, l.base, l.margen, l.tasa, p.porcentaje, p.comision])),
    },
  ];
  if (ctx.todos && !d.cierre) {
    hojas.push({
      nombre: 'No comisionan',
      columnas: [{ titulo: 'N.º', tipo: 'entero', ancho: 8 }, { titulo: 'Emisión', tipo: 'fecha', ancho: 11 }, { titulo: 'Razón social', ancho: 36 },
        { titulo: 'Categoría', ancho: 36 }, { titulo: 'Monto', tipo: 'bs', ancho: 14 }, { titulo: 'Motivo', ancho: 32 }],
      filas: d.lineas.filter(l => !l.personas.length).map(l => [l.numero, l.fecha, l.razonSocial, l.categoria, l.montoLinea, ESTADOS_LINEA[l.estado] || l.estado]),
    });
  }
  return { buffer: crearLibro(hojas), nombre: `comisiones-${gestion}-${dos(mes)}${d.cierre ? '-cerrado' : ''}.xlsx` };
};

module.exports = { anularCierre, cerrarMes, crearRegla, detalleMes, excelMes, listReglas, notReady, resumenGestion };
