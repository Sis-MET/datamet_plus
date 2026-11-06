/**
 * Carga inicial de los patrones desde el libro F-VMET-02-7.2 (fase 1 de los
 * certificados de calibración).
 *
 *   node scripts/patrones-importar-excel.js "<libro .xlsm>"                     → solo muestra el plan
 *   node scripts/patrones-importar-excel.js "<libro .xlsm>" --aplicar --usuario <usuario>
 *
 * Lee del libro (sin abrir Excel ni ejecutar macros):
 *   EQPE2        material y clase de cada juego de pesas;
 *   VALORES      piezas de cada juego con su densidad (kg/m³) y su U (k = 2);
 *   EQUI_VIGENTE certificado de cada juego: corrección (D_), U (U_) y aptitud
 *                (APTO_) por valor nominal, en µg, y condiciones ambientales.
 *
 * Solo toca los juegos que ya existen en el gestor de equipos y que aún no
 * tienen piezas. Los valores se cargan solo si el certificado del libro es el
 * vigente en DataMET+; si no, se informa para registrar antes el certificado
 * nuevo. Lo cargado queda «transcrito por» el usuario indicado y pendiente de
 * que otra persona lo verifique contra el PDF (NB/ISO/IEC 17025, 7.11.6).
 */
const fs = require('node:fs');
const zlib = require('node:zlib');
const { connectDB, getPool, sql } = require('../src/config/db');
const { EQUIPO_SELECT, mapEquipo } = require('../src/services/calibration.db');
const { parse } = require('../src/services/calibration.validation');
const { getPatron, savePatron, claseSugerida, formatNominal } = require('../src/services/calibration.patrones');

// ─── Lectura del .xlsm (ZIP + XML) ─────────────────────────────────────────

const leerZip = (archivo) => {
  const buf = fs.readFileSync(archivo);
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error('El archivo no es un libro de Excel (.xlsx/.xlsm).');
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entradas = new Map();
  for (let i = 0; i < total; i += 1) {
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const nLen = buf.readUInt16LE(p + 28);
    const xLen = buf.readUInt16LE(p + 30);
    const cLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + nLen);
    entradas.set(nombre, { metodo, comprimido, local });
    p += 46 + nLen + xLen + cLen;
  }
  return (nombre) => {
    const e = entradas.get(nombre);
    if (!e) return null;
    const inicio = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28);
    const datos = buf.subarray(inicio, inicio + e.comprimido);
    return (e.metodo === 8 ? zlib.inflateRawSync(datos) : datos).toString('utf8');
  };
};

const xmlTexto = (s) => s.replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const leerLibro = (archivo) => {
  const leer = leerZip(archivo);
  const compartidas = [...(leer('xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => xmlTexto(t[1])).join(''));
  const rels = new Map([...leer('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)]
    .map(m => [m[1], m[2]]));
  const hojas = new Map([...leer('xl/workbook.xml').matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)]
    .map(m => [xmlTexto(m[1]), `xl/${rels.get(m[2]).replace(/^\/?xl\//, '')}`]));

  return (nombre) => {
    const xml = leer(hojas.get(nombre));
    if (!xml) throw new Error(`El libro no tiene la hoja ${nombre}.`);
    const filas = new Map();
    for (const m of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, col, fila, attrs, cuerpo = ''] = m;
      const tipo = (attrs.match(/t="([^"]+)"/) || [])[1];
      const v = (cuerpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let valor = v == null ? (cuerpo.includes('<is>') ? xmlTexto(cuerpo) : null) : xmlTexto(v);
      if (tipo === 's' && valor != null) valor = compartidas[Number(valor)];
      if (valor == null || valor === '') continue;
      if (!filas.has(Number(fila))) filas.set(Number(fila), {});
      filas.get(Number(fila))[col] = valor;
    }
    return filas;
  };
};

// ─── Datos del libro ───────────────────────────────────────────────────────

const normalizar = (codigo) => String(codigo ?? '').replace(/\u00a0/g, ' ').trim().toUpperCase();
const numero = (valor) => {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) && String(valor ?? '').trim() !== '' ? n : null;
};

// Densidades supuestas de la OIML R111, Tabla B.7 (U con k = 2).
const SUPUESTAS = [[21400, 150], [8600, 170], [8400, 170], [7950, 140], [7700, 200], [7800, 200], [7700, 400], [7100, 600], [2700, 130]];

/** Etiqueta de VALORES (columna D, en g, «_2» para el duplicado) → sufijo de EQUI_VIGENTE. */
const columnaDe = (etiqueta) => {
  const m = String(etiqueta).trim().match(/^([\d.,Ee+-]+?)(?:_(\d))?$/);
  if (!m) return null;
  const gramos = numero(m[1]);
  if (gramos == null || gramos <= 0) return null;
  const nombre = gramos < 1 ? `${Math.round(gramos * 1000)}mg` : `${Number(gramos.toPrecision(12))}g`;
  return { gramos, sufijo: `${nombre}${m[2] ? `_${m[2]}` : ''}`, duplicado: m[2] ? Number(m[2]) : 1 };
};

/**
 * Marca de la pieza (columna C de VALORES). Si solo repite el valor nominal
 * («2», «2*») queda la marca de duplicado («», «*»), que es lo que distingue
 * a la pieza dentro del juego.
 */
const identificacionDe = (texto, duplicado, gramos) => {
  const limpio = String(texto ?? '').trim();
  if (!limpio || /^sin marca$/i.test(limpio)) return duplicado > 1 ? '*'.repeat(duplicado - 1) : '';
  const parentesis = limpio.match(/^\((\*+)\)$/);
  if (parentesis) return parentesis[1];
  const nominal = limpio.match(/^([\d.,]+)\s*(\**)$/);
  if (nominal && gramos != null && numero(nominal[1]) === gramos) return nominal[2];
  return limpio.slice(0, 20);
};

const datosDelLibro = (archivo) => {
  const hoja = leerLibro(archivo);

  const juegos = new Map();
  for (const [fila, x] of hoja('EQPE2')) {
    if (fila < 2 || !x.B) continue;
    juegos.set(normalizar(x.B), {
      material: x.E ? x.E.trim().toLowerCase().replace(/^./, c => c.toUpperCase()) : null,
      clase: (String(x.I || '').match(/(E1|E2|F1|F2|M1|M2|M3)/) || [])[1] || null,
    });
  }

  const piezas = new Map();
  for (const [fila, x] of hoja('VALORES')) {
    if (fila < 3 || fila > 245 || !x.B || !x.D) continue;
    const codigo = normalizar(x.B);
    const columna = columnaDe(x.D);
    if (!columna) continue;
    const densidad = numero(x.J);
    const densidadU = numero(x.K);
    const supuesta = SUPUESTAS.some(([d, u]) => d === densidad && u === densidadU);
    if (!piezas.has(codigo)) piezas.set(codigo, []);
    piezas.get(codigo).push({
      columna: columna.sufijo,
      nominalMg: Number((columna.gramos * 1000).toPrecision(12)),
      identificacion: identificacionDe(x.C, columna.duplicado, columna.gramos),
      densidad,
      densidadU: densidad != null ? densidadU : null,
      densidadK: densidad != null && densidadU != null ? 2 : null,
      densidadOrigen: densidad != null && supuesta ? 'SUPUESTA' : null,
    });
  }
  // Una identificación repetida en el mismo valor nominal se distingue con «*».
  for (const lista of piezas.values()) {
    const vistas = new Set();
    for (const pieza of lista) {
      while (vistas.has(`${pieza.nominalMg}|${pieza.identificacion}`)) pieza.identificacion = `${pieza.identificacion}*`.slice(-20);
      vistas.add(`${pieza.nominalMg}|${pieza.identificacion}`);
    }
  }

  const ev = hoja('EQUI_VIGENTE');
  const cabecera = ev.get(1) || {};
  const columnaPor = new Map(Object.entries(cabecera).map(([col, nombre]) => [String(nombre).trim(), col]));
  const certificados = new Map();
  for (const [fila, x] of ev) {
    if (fila < 2 || !x.B || !x.A) continue;
    const codigo = normalizar(x.B);
    const leer = (nombre) => x[columnaPor.get(nombre)];
    if (!certificados.has(codigo)) certificados.set(codigo, []);
    certificados.get(codigo).push({
      numero: String(x.A).trim(),
      leer,
      temperatura: numero(leer('TEMPERATURA')),
      humedad: numero(leer('HUMEDAD_RELATIVA')),
      presion: numero(leer('PRESIÓN')),
    });
  }
  return { juegos, piezas, certificados };
};

// ─── Plan ──────────────────────────────────────────────────────────────────

// Mismos límites que la validación del certificado (calibration.validation).
const CONDICIONES = [
  ['temperatura', 'temperatura', v => v >= -10 && v <= 50],
  ['humedad', 'humedad', v => v >= 0 && v <= 100],
  ['presion', 'presión', v => v > 300 && v < 1200],
];

const numerosDe = (texto) => String(texto || '').split('/').map(s => s.trim().toUpperCase()).filter(Boolean);

const planDeJuego = ({ codigo, equipo, patron, libro }) => {
  const piezas = libro.piezas.get(codigo) || [];
  const juego = libro.juegos.get(codigo) || {};
  const plan = { codigo, equipoId: equipo.id, notas: [], body: null, valores: 0 };
  if (patron.piezas.length > 0) {
    plan.notas.push(`ya tiene ${patron.piezas.length} piezas en DataMET+: no se toca`);
    return plan;
  }
  if (piezas.length === 0) {
    plan.notas.push('sin piezas en la hoja VALORES');
    return plan;
  }
  const clase = juego.clase || claseSugerida(codigo);
  const body = {
    tipo: 'PESAS',
    clase,
    piezas: piezas.map(p => ({
      nominalMg: p.nominalMg,
      identificacion: p.identificacion,
      material: juego.material,
      densidad: p.densidad,
      densidadU: p.densidadU,
      densidadK: p.densidadK,
      densidadOrigen: p.densidadOrigen,
      activa: true,
    })),
  };

  const vigentes = numerosDe(patron.certificado?.numero);
  const delLibro = (libro.certificados.get(codigo) || []).filter(c => vigentes.includes(c.numero.toUpperCase()));
  if (!patron.certificado) {
    plan.notas.push('sin certificado vigente en DataMET+: solo piezas');
  } else if (delLibro.length === 0) {
    const enLibro = (libro.certificados.get(codigo) || []).map(c => c.numero).join(', ') || 'ninguno';
    plan.notas.push(`el vigente en DataMET+ es ${patron.certificado.numero}; en el libro: ${enLibro}. Registra antes el certificado nuevo: solo piezas`);
  } else {
    const valores = [];
    const sinCorreccion = [];
    const compartidas = new Map();
    const porColumna = new Map();
    for (const pieza of piezas) porColumna.set(pieza.columna, (porColumna.get(pieza.columna) || 0) + 1);
    for (const pieza of piezas) {
      // Varias piezas con la misma columna (p. ej. 30 pesas de 20 kg): el libro
      // guarda un solo valor y no se sabe a cuál corresponde.
      if (porColumna.get(pieza.columna) > 1) {
        const nombre = formatNominal(pieza.nominalMg);
        compartidas.set(nombre, (compartidas.get(nombre) || 0) + 1);
        continue;
      }
      const filas = delLibro
        .map(c => ({ c, d: numero(c.leer(`D_${pieza.columna}`)), u: numero(c.leer(`U_${pieza.columna}`)), apto: c.leer(`APTO_${pieza.columna}`) }))
        .filter(f => f.d != null && f.u != null);
      if (filas.length !== 1) {
        sinCorreccion.push(formatNominal(pieza.nominalMg) + (pieza.identificacion ? ` ${pieza.identificacion}` : ''));
        continue;
      }
      const [f] = filas;
      valores.push({
        nominalMg: pieza.nominalMg,
        identificacion: pieza.identificacion,
        documento: delLibro.length > 1 ? f.c.numero : null,
        // EQUI_VIGENTE guarda µg.
        correccionMg: f.d / 1000,
        uMg: f.u / 1000,
        k: 2,
        conforme: /^APTO$/i.test(String(f.apto || '').trim()) ? true : /NO\s*APTO/i.test(String(f.apto || '')) ? false : null,
      });
    }
    // Condiciones fuera de rango (p. ej. «519» por «51,9»): se dejan vacías.
    const condiciones = {};
    const malas = [];
    for (const [campo, nombre, enRango] of CONDICIONES) {
      const valor = delLibro[0][campo];
      const valida = valor == null || enRango(valor);
      condiciones[campo] = valida ? valor : null;
      if (!valida) malas.push(`${nombre} ${String(valor).replace('.', ',')}`);
    }
    body.certificado = {
      version: null,
      ...condiciones,
      observaciones: 'Carga inicial desde el libro F-VMET-02-7.2 (EQUI_VIGENTE).',
      valores,
      puntos: [],
    };
    plan.valores = valores.length;
    if (compartidas.size) {
      plan.notas.push(`el libro guarda un solo valor para ${[...compartidas].map(([n, c]) => `${c} piezas de ${n}`).join(', ')}: transcribir del PDF`);
    }
    if (sinCorreccion.length) plan.notas.push(`sin corrección en el libro (transcribir del PDF): ${sinCorreccion.join(', ')}`);
    if (malas.length) plan.notas.push(`condiciones fuera de rango en el libro, se dejan vacías: ${malas.join(', ')}`);
  }
  plan.body = body;
  return plan;
};

// ─── Principal ─────────────────────────────────────────────────────────────

const main = async () => {
  const args = process.argv.slice(2);
  const archivo = args.find(a => !a.startsWith('--'));
  const aplicar = args.includes('--aplicar');
  const usuario = args[args.indexOf('--usuario') + 1];
  if (!archivo) throw new Error('Indica la ruta del libro .xlsm.');
  if (aplicar && (!usuario || usuario.startsWith('--'))) throw new Error('Con --aplicar indica --usuario <usuario de DataMET>: quedará como quien transcribió.');

  const libro = datosDelLibro(archivo);
  await connectDB();
  const tablas = await getPool().request().query("SELECT OBJECT_ID('dbo.CAL_PATRON_PIEZAS', 'U') AS piezas");
  const conMigracion = tablas.recordset[0].piezas != null;
  if (!conMigracion) {
    if (aplicar) throw new Error('La base no tiene la migración 016 (CAL_PATRON_PIEZAS): aplícala antes de cargar.');
    console.log('Aviso: la base no tiene la migración 016; el plan no puede ver si un juego ya tiene piezas.\n');
  }

  const equipos = (await getPool().request().query(EQUIPO_SELECT)).recordset.map(mapEquipo);
  const porCodigo = new Map();
  for (const equipo of equipos) {
    const codigo = normalizar(equipo.codigo);
    porCodigo.set(codigo, [...(porCodigo.get(codigo) || []), equipo]);
  }

  let actor = null;
  if (aplicar) {
    const u = await getPool().request().input('u', sql.NVarChar(50), usuario)
      .query("SELECT TOP 1 id, usuario FROM DATA_USERS WHERE usuario = @u AND estado = 'ACTIVO'");
    if (!u.recordset[0]) throw new Error(`No existe el usuario activo ${usuario}.`);
    actor = u.recordset[0];
  }

  const codigos = [...new Set([...libro.piezas.keys(), ...libro.certificados.keys()])].sort();
  let cargados = 0;
  for (const codigo of codigos) {
    const candidatos = porCodigo.get(codigo) || [];
    const activos = candidatos.filter(e => e.estado === 'ACTIVO');
    if (activos.length !== 1) {
      const motivo = candidatos.length === 0 ? 'no está en el gestor de equipos de DataMET+'
        : activos.length === 0 ? 'está dado de baja en DataMET+'
          : `hay ${activos.length} equipos activos con este código`;
      console.log(`· ${codigo}: ${motivo}`);
      continue;
    }
    const [equipo] = activos;
    const patron = conMigracion ? await getPatron(equipo.id) : {
      piezas: [],
      certificado: equipo.certFecha ? { numero: equipo.certificado } : null,
    };
    const plan = planDeJuego({ codigo, equipo, patron, libro });
    let datos = null;
    if (plan.body) {
      try {
        datos = parse('patron', plan.body);
      } catch (error) {
        plan.notas.push(`no pasa la validación: ${error.message}`);
      }
    }
    const resumen = datos ? `${plan.body.piezas.length} piezas, ${plan.valores} valores, clase ${plan.body.clase || '¿?'}` : 'sin cambios';
    console.log(`${datos ? '✓' : '·'} ${codigo}: ${resumen}${plan.notas.length ? ` — ${plan.notas.join('; ')}` : ''}`);
    if (aplicar && datos) {
      await savePatron(equipo.id, datos, actor);
      cargados += 1;
    }
  }
  console.log(aplicar
    ? `\nCargados ${cargados} juegos a nombre de ${actor.usuario}. Otra persona debe verificar cada uno contra su certificado.`
    : '\nSolo se mostró el plan. Para cargar: --aplicar --usuario <usuario>.');
  await sql.close();
};

if (require.main === module) {
  main().catch(async (error) => {
    console.error(error.message);
    try { await sql.close(); } catch { /* sin conexión abierta */ }
    process.exitCode = 1;
  });
}

module.exports = { columnaDe, identificacionDe, planDeJuego, leerLibro, datosDelLibro };
