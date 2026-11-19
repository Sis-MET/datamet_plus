/**
 * Carga inicial de Comercial desde el libro «2026 FACTURACION metrica.xlsx».
 *
 *   node scripts/comercial-importar-excel.js "<libro .xlsx>"                       → solo muestra el plan
 *   node scripts/comercial-importar-excel.js "<libro .xlsx>" --aplicar --usuario <usuario>
 *   … --detalle                                                                     → lista cada aviso y error
 *
 * Lee la hoja FACTURAS 2026 (sin abrir Excel) y la hoja NIT CORREOS (NIT y
 * correos de facturación). Por cada factura registra sus líneas por categoría,
 * cotizaciones, nota de salida, personas y pagos (cada casilla PAGO 1 a 4 es
 * un pago aplicado a su factura). Las filas «ANULADO» quedan como facturas
 * anuladas. Lo que ya está registrado (mismo número y gestión) se salta, así
 * que se puede volver a ejecutar. Sin la migración 034 solo muestra el plan,
 * con el catálogo de categorías de la migración.
 *
 * Cada factura se guarda en su propia transacción, con su historial
 * («IMPORTACION», con la fila del Excel) a nombre del usuario indicado.
 */
const fs = require('node:fs');
const path = require('node:path');
const { connectDB, getPool, sql } = require('../src/config/db');
const { withTransaction } = require('../src/services/calibration.db');
const comercial = require('../src/services/comercial.service');
const domain = require('../src/services/comercial.domain');
const { parse } = require('../src/services/comercial.validation');
const { claveCliente, normalizar, planImportacion, HOJA } = require('../src/services/comercial.importacion');
const { leerLibro } = require('../src/utils/xlsx');

const MIGRACION = path.join(__dirname, '../src/config/migrations/034_comercial.sql');

/** Catálogo de la migración 034, para mostrar el plan antes de aplicarla. */
const categoriasDeMigracion = () => {
  const texto = fs.readFileSync(MIGRACION, 'utf8');
  return [...texto.matchAll(/\((\d+), '([^']+)', N'([^']+)', '(\w+)', '(\w+)', '(\w+)', (\d), '(\w+)', N'([^']+)'\)/g)]
    .map(m => ({
      id: Number(m[1]), codigo: m[2], nombre: m[3], area: m[4], subarea: m[5], regla: m[6],
      comisiona: m[7] === '1', vigente: true, excelColumna: m[8], excelEncabezado: m[9],
    }));
};

const tablasListas = async () => {
  const r = await getPool().request().query("SELECT OBJECT_ID('dbo.COM_FACTURAS', 'U') AS id");
  return r.recordset[0].id !== null;
};

const clientesDataMet = async () => (await getPool().request().query(
  `SELECT LTRIM(RTRIM(codigo_cliente)) AS codigo, razonsocial, cliente, nit FROM DATA_CLIENTES`,
)).recordset.map(row => ({
  codigo: row.codigo,
  razonSocial: row.razonsocial,
  nombre: row.cliente,
  nit: row.nit && String(row.nit).trim() !== '0' ? String(row.nit).trim() : null,
}));

/** Personal (activo o no: el Excel nombra a quien ya no está) con sus formas de nombre. */
const personalDataMet = async () => (await getPool().request().query(
  `SELECT id, nombre1, nombre2, apellido1, apellido2, estado FROM DATA_USERS`,
)).recordset.map((row) => {
  const [n1, n2, a1, a2] = [row.nombre1, row.nombre2, row.apellido1, row.apellido2].map(v => normalizar(v));
  const claves = new Set([`${n1} ${a1}`, `${n1} ${n2} ${a1}`, `${n1} ${a1} ${a2}`, `${n1} ${n2} ${a1} ${a2}`, `${n2} ${a1}`]
    .map(c => c.replace(/\s+/g, ' ').trim()).filter(c => c.split(' ').length >= 2));
  return {
    id: row.id,
    nombre: [row.nombre1, row.apellido1].map(v => String(v || '').trim()).filter(Boolean).join(' '),
    claves: [...claves],
  };
});

/** NIT y correos de la hoja NIT CORREOS, por razón social normalizada. */
const hojaNits = (hoja) => {
  const nits = new Map();
  const correos = new Map();
  let filas;
  try { filas = hoja('NIT CORREOS'); } catch { return { nits, correos }; }
  for (const [fila, x] of filas) {
    if (fila < 6 || !x.B) continue;
    const clave = claveCliente(x.B);
    const nit = String(x.C || '').replace(/\.0$/, '').trim();
    if (/^\d{5,15}$/.test(nit) && !nits.has(clave)) nits.set(clave, nit);
    const lista = ['E', 'F', 'G', 'H', 'I', 'J', 'K'].map(c => String(x[c] || '').trim().toLowerCase())
      .filter(c => /^[^@\s;,]+@[^@\s;,]+\.[a-z]{2,}$/.test(c));
    if (lista.length) correos.set(clave, [...new Set(lista)]);
  }
  return { nits, correos };
};

const existentesEnBase = async () => (await getPool().request().query('SELECT gestion, numero FROM dbo.COM_FACTURAS')).recordset;

const formato = (n) => domain.formatoBs(n);

const imprimirPlan = (plan, { detalle, correos }) => {
  const r = plan.resumen;
  console.log(`\nHoja «${plan.hoja}»: ${r.filas} filas con número.`);
  console.log(`  Facturas a registrar: ${r.facturas} (${r.anuladas} anuladas) · ya registradas: ${r.yaRegistradas} · con error: ${r.conError}`);
  console.log(`  Monto vigente: Bs ${formato(r.monto)} en ${r.lineas} líneas`);
  console.log(`  Pagos: ${r.pagos} por Bs ${formato(r.cobrado)}`);
  const vigentes = r.facturas - r.anuladas;
  console.log(`  Cliente de DataMET: ${r.conCliente} de ${vigentes} (${r.clientePorCotizacion} por el código de la cotización) · con NIT: ${r.conNit}`);
  console.log(`  Personas: ${r.personas} (${r.personasReconocidas} reconocidas en DataMET) · referencias: ${r.referencias}`);
  if (correos) console.log(`  Fichas de facturación con correos (hoja NIT CORREOS): ${correos}`);
  if (plan.avisos.length) {
    console.log(`\nAvisos (${plan.avisos.length}):`);
    for (const a of (detalle ? plan.avisos : plan.avisos.slice(0, 12))) console.log(`  · ${a.mensaje}`);
    if (!detalle && plan.avisos.length > 12) console.log(`  … y ${plan.avisos.length - 12} más (--detalle)`);
  }
  if (plan.errores.length) {
    console.log(`\nNo se registran (${plan.errores.length}):`);
    for (const e of (detalle ? plan.errores : plan.errores.slice(0, 20))) console.log(`  · ${e.mensaje}`);
  }
};

const aplicarFactura = async (item, { categorias, usuario, nombre }) => {
  const anulacion = item.anulada ? { motivo: `Anulada en el Excel 2026 (${item.origenRef}).` } : null;
  let factura;
  let plan;
  if (item.anulada) {
    factura = { ...item.factura, observacion: item.factura.observacion, referencias: [], personas: [] };
    plan = { gestion: domain.gestionDe(factura.fechaEmision), tipo: factura.tipo || 'SERVICIO', lineas: [] };
  } else {
    factura = parse('factura', item.factura);
    plan = domain.planFactura(factura, { categorias });
  }
  return withTransaction(async (newRequest) => {
    const id = await comercial.insertarFactura(newRequest, {
      factura, plan, usuario, nombre, origen: 'EXCEL', origenRef: item.origenRef, anulacion,
    });
    await comercial.historial(newRequest, {
      entidad: 'FACTURA', entidadId: id, accion: 'IMPORTACION',
      detalle: { origen: item.origenRef, numero: factura.numero, monto: factura.monto, lineas: plan.lineas.length, pagos: item.pagos.length },
      usuario, nombre,
    });
    for (const pago of item.pagos) {
      const datos = {
        fecha: pago.fecha, monto: pago.monto, medio: pago.medio, clienteCodigo: factura.clienteCodigo,
        referencia: null, verificacion: pago.verificacion, observacion: pago.observacion,
      };
      const pagoId = await comercial.insertarPago(newRequest, {
        pago: datos, plan: { aplicaciones: [{ facturaId: id, monto: pago.monto }] }, usuario, nombre,
        origen: 'EXCEL', origenRef: `${item.origenRef}, pago ${pago.casilla}`,
      });
      await comercial.historial(newRequest, {
        entidad: 'PAGO', entidadId: pagoId, accion: 'IMPORTACION',
        detalle: { origen: `${item.origenRef}, pago ${pago.casilla}`, factura: factura.numero, monto: pago.monto }, usuario, nombre,
      });
    }
    return id;
  });
};

const aplicarCorreos = async (codigo, lista, { usuario, nombre }) => withTransaction(async (newRequest) => {
  const existe = await comercial.run(
    'SELECT 1 AS x FROM dbo.COM_CLIENTES WITH (UPDLOCK, HOLDLOCK) WHERE cliente_codigo = @codigo',
    [{ name: 'codigo', type: sql.NVarChar(20), value: codigo }],
    newRequest(),
  );
  if (existe.length) return false;
  await comercial.run(
    'INSERT INTO dbo.COM_CLIENTES (cliente_codigo, correos, actualizado_por) VALUES (@codigo, @correos, @usuario)',
    [
      { name: 'codigo', type: sql.NVarChar(20), value: codigo },
      { name: 'correos', type: sql.NVarChar(500), value: lista.join(';').slice(0, 500) },
      { name: 'usuario', type: sql.NVarChar(50), value: usuario },
    ],
    newRequest(),
  );
  await comercial.historial(newRequest, {
    entidad: 'CLIENTE', entidadId: codigo, accion: 'IMPORTACION',
    detalle: { origen: 'NIT CORREOS', correos: lista }, usuario, nombre,
  });
  return true;
});

const main = async () => {
  const args = process.argv.slice(2);
  const archivo = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--usuario');
  const aplicar = args.includes('--aplicar');
  const detalle = args.includes('--detalle');
  const usuarioArg = args.includes('--usuario') ? args[args.indexOf('--usuario') + 1] : null;
  if (!archivo) throw new Error('Indica el libro: node scripts/comercial-importar-excel.js "<libro .xlsx>" [--aplicar --usuario <usuario>]');
  if (aplicar && (!usuarioArg || usuarioArg.startsWith('--'))) {
    throw new Error('Con --aplicar indica --usuario <usuario de DataMET>: quedará como quien importó.');
  }

  const hoja = leerLibro(archivo);
  const filas = hoja(HOJA);
  await connectDB();
  const listas = await tablasListas();
  if (aplicar && !listas) throw new Error('Falta aplicar la migración 034 (pnpm migrate) antes de importar.');

  const categorias = listas ? await comercial.listCategorias() : categoriasDeMigracion();
  const clientes = await clientesDataMet();
  const { nits, correos } = hojaNits(hoja);
  const plan = planImportacion(filas, {
    categorias,
    clientes,
    personal: await personalDataMet(),
    nits,
    existentes: listas ? await existentesEnBase() : [],
  });

  // Correos de facturación de los clientes reconocidos (una ficha por cliente).
  const fichas = new Map();
  for (const item of plan.facturas) {
    const codigo = item.factura.clienteCodigo;
    if (!codigo || fichas.has(codigo)) continue;
    const lista = correos.get(claveCliente(item.factura.razonSocial));
    if (lista) fichas.set(codigo, lista);
  }

  if (!listas) console.log('Las tablas de Comercial todavía no existen: el plan usa el catálogo de la migración 034.');
  imprimirPlan(plan, { detalle, correos: fichas.size });

  if (!aplicar) {
    console.log('\nSolo se mostró el plan. Para cargar: --aplicar --usuario <usuario>.');
    return;
  }

  const u = await getPool().request().input('u', sql.NVarChar(50), usuarioArg)
    .query("SELECT TOP 1 usuario FROM DATA_USERS WHERE usuario = @u AND estado = 'ACTIVO'");
  if (!u.recordset[0]) throw new Error(`No existe el usuario activo ${usuarioArg}.`);
  const usuario = u.recordset[0].usuario;
  const nombre = await comercial.nombreDe(usuario);

  let cargadas = 0;
  const fallidas = [];
  for (const item of plan.facturas) {
    try {
      await aplicarFactura(item, { categorias, usuario, nombre });
      cargadas += 1;
      if (cargadas % 50 === 0) console.log(`  … ${cargadas} de ${plan.facturas.length}`);
    } catch (error) {
      fallidas.push(`N.º ${item.factura.numero} (${item.origenRef}): ${error.message}`);
    }
  }
  let conCorreos = 0;
  for (const [codigo, lista] of fichas) {
    if (await aplicarCorreos(codigo, lista, { usuario, nombre })) conCorreos += 1;
  }
  console.log(`\nRegistradas ${cargadas} facturas a nombre de ${usuario}; ${conCorreos} fichas de cliente con correos.`);
  if (fallidas.length) {
    console.log(`No se pudieron registrar ${fallidas.length}:`);
    for (const f of fallidas) console.log(`  · ${f}`);
    process.exitCode = 1;
  }
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await sql.close(); } catch { /* sin conexión abierta */ }
  });
