/**
 * Carga inicial de los puntos de ensayo acordados de cada instrumento de
 * cliente (migración 017) desde sus dos fuentes anteriores:
 *
 *   - ICLI: tabla de Access que el libro F-VMET-02-7.2 copia en su hoja ICLI
 *     (carga de excentricidad, 3 de repetibilidad y 12 de error; sin fecha).
 *   - DATA_SERVICIOS_LEC: cargas por instrumento y SECA, con fecha.
 *
 * Para cada instrumento gana la más reciente. ICLI no tiene fecha: se toma la
 * del libro (`--fecha-icli`, por defecto la de su última modificación).
 *
 *   node scripts/puntos-acordados-importar.js "<libro .xlsm>"                     → solo muestra el plan
 *   node scripts/puntos-acordados-importar.js "<libro .xlsm>" --aplicar --usuario <usuario>
 *
 * Nunca pisa los puntos que ya estén en DataMET+.
 */
const { connectDB, getPool, sql } = require('../src/config/db');
const { leerLibro, leerZip } = require('./patrones-importar-excel');
const { normalizarCodigo } = require('../src/services/calibration.fuente');
const { importarPuntos } = require('../src/services/calibration.puntos');

const UNIDADES = ['mg', 'g', 'kg', 't'];
const COLUMNAS_ERROR = ['P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA'];

const argumento = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : null;
};

const numero = (valor) => {
  const n = Number(String(valor ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Number(n.toPrecision(12)) : null;
};

/** Sin repetidos, en el orden en que vienen (ICLI y LEC traen «21, 21, 21…»). */
const unicas = (lista) => [...new Set(lista)];

const unidadDe = (valor) => {
  const texto = String(valor ?? '').trim().toLowerCase();
  return UNIDADES.includes(texto) ? texto : null;
};

/** Fecha de la última modificación del libro (docProps/core.xml). */
const fechaDelLibro = (archivo) => {
  const texto = leerZip(archivo)('docProps/core.xml') || '';
  const match = texto.match(/<dcterms:modified[^>]*>(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

/** Hoja ICLI → Map(código → puntos), con los problemas encontrados. */
const leerIcli = (archivo, fecha) => {
  const hoja = leerLibro(archivo)('ICLI');
  const puntos = new Map();
  const problemas = { sinCodigo: 0, codigosInvalidos: [], duplicados: [], sinCargas: 0, sinUnidad: 0 };
  for (const [fila, x] of hoja) {
    if (fila < 2) continue;
    if (!x.AB) {
      problemas.sinCodigo += 1;
      continue;
    }
    const codigo = normalizarCodigo(x.AB);
    if (!codigo) {
      problemas.codigosInvalidos.push(String(x.AB).trim());
      continue;
    }
    const item = {
      codMetrica: codigo,
      unidad: unidadDe(x.I),
      origen: 'ICLI',
      origenRef: 'Access ICLI',
      origenFecha: fecha,
      excentricidad: numero(x.L),
      repetibilidad: unicas(['M', 'N', 'O'].map(col => numero(x[col])).filter(Boolean)),
      errores: unicas(COLUMNAS_ERROR.map(col => numero(x[col])).filter(Boolean)),
    };
    if (!item.excentricidad && !item.repetibilidad.length && !item.errores.length) {
      problemas.sinCargas += 1;
      continue;
    }
    if (!item.unidad) problemas.sinUnidad += 1;
    if (puntos.has(codigo)) problemas.duplicados.push(codigo);
    puntos.set(codigo, item);
  }
  return { puntos, problemas, filas: hoja.size - 1 };
};

/** Última fila de DATA_SERVICIOS_LEC por instrumento. */
const leerLec = async () => {
  const result = await getPool().request().query(`
    SELECT l.*, CONVERT(varchar(10), l.reg_fecha, 23) AS fecha
    FROM (
      SELECT t.*, ROW_NUMBER() OVER (PARTITION BY t.cod_metrica ORDER BY t.reg_fecha DESC, t.seca DESC) AS rn
      FROM dbo.DATA_SERVICIOS_LEC t
    ) l WHERE l.rn = 1
  `);
  // Unidad: la del instrumento en DATA_EQUIPOS_BALANZAS (LEC no la guarda).
  const unidades = await getPool().request().query('SELECT cod_metrica, unidad FROM dbo.DATA_EQUIPOS_BALANZAS');
  const unidadPor = new Map(unidades.recordset.map(row => [normalizarCodigo(row.cod_metrica), unidadDe(row.unidad)]));
  const puntos = new Map();
  for (const row of result.recordset) {
    const codigo = normalizarCodigo(row.cod_metrica);
    if (!codigo) continue;
    const item = {
      codMetrica: codigo,
      unidad: unidadPor.get(codigo) || null,
      origen: 'LEC',
      origenRef: String(row.seca || '').trim() || null,
      origenFecha: row.fecha,
      excentricidad: numero(row.exc),
      repetibilidad: unicas(Array.from({ length: 30 }, (_, i) => numero(row[`rep${i + 1}`])).filter(Boolean)).slice(0, 3),
      errores: unicas(Array.from({ length: 60 }, (_, i) => numero(row[`lin${i + 1}`])).filter(Boolean)),
    };
    if (item.excentricidad || item.repetibilidad.length || item.errores.length) puntos.set(codigo, item);
  }
  return puntos;
};

const mismasCargas = (a, b) => JSON.stringify([a.excentricidad, a.repetibilidad, a.errores])
  === JSON.stringify([b.excentricidad, b.repetibilidad, b.errores]);

const main = async () => {
  const archivo = process.argv.slice(2).find(a => !a.startsWith('--') && a !== argumento('usuario') && a !== argumento('fecha-icli'));
  const aplicar = process.argv.includes('--aplicar');
  const usuario = argumento('usuario');
  if (!archivo) throw new Error('Indica la ruta del libro .xlsm (su hoja ICLI).');
  if (aplicar && !usuario) throw new Error('Con --aplicar indica --usuario <usuario de DataMET>: quedará en el historial.');
  const fechaIcli = argumento('fecha-icli') || fechaDelLibro(archivo);
  if (!fechaIcli || !/^\d{4}-\d{2}-\d{2}$/.test(fechaIcli)) throw new Error('No se pudo saber la fecha de ICLI: indícala con --fecha-icli AAAA-MM-DD.');

  const icli = leerIcli(archivo, fechaIcli);
  await connectDB();
  const tabla = await getPool().request().query("SELECT OBJECT_ID('dbo.CAL_PUNTOS_ACORDADOS', 'U') AS id");
  if (aplicar && tabla.recordset[0].id == null) throw new Error('La base no tiene la migración 017: aplícala antes de cargar.');
  const lec = await leerLec();
  const existentes = tabla.recordset[0].id == null ? new Set()
    : new Set((await getPool().request().query('SELECT cod_metrica FROM dbo.CAL_PUNTOS_ACORDADOS')).recordset.map(r => r.cod_metrica));

  // Para cada instrumento, la fuente más reciente.
  const elegidos = new Map();
  let ganaIcli = 0;
  let ganaLec = 0;
  let distintas = 0;
  for (const codigo of new Set([...icli.puntos.keys(), ...lec.keys()])) {
    const deIcli = icli.puntos.get(codigo);
    const deLec = lec.get(codigo);
    let elegido = deIcli || deLec;
    if (deIcli && deLec) {
      if (!mismasCargas(deIcli, deLec)) distintas += 1;
      elegido = deLec.origenFecha > fechaIcli ? deLec : deIcli;
      if (elegido === deLec) ganaLec += 1;
      else ganaIcli += 1;
      // LEC no trae unidad propia: si gana, toma la de ICLI cuando el instrumento no la tiene.
      if (elegido === deLec && !elegido.unidad) elegido = { ...elegido, unidad: deIcli.unidad };
    }
    elegidos.set(codigo, elegido);
  }

  const nuevos = [...elegidos.values()].filter(p => !existentes.has(p.codMetrica));
  console.log(`\nICLI (${fechaIcli}): ${icli.filas} filas, ${icli.puntos.size} instrumentos con cargas.`);
  console.log(`  sin código Métrica: ${icli.problemas.sinCodigo}; códigos inválidos: ${icli.problemas.codigosInvalidos.length}`
    + `${icli.problemas.codigosInvalidos.length ? ` (${icli.problemas.codigosInvalidos.slice(0, 5).join(', ')}…)` : ''}`);
  console.log(`  repetidos (queda la última fila): ${icli.problemas.duplicados.length}; sin cargas: ${icli.problemas.sinCargas}; sin unidad: ${icli.problemas.sinUnidad}`);
  console.log(`DATA_SERVICIOS_LEC: ${lec.size} instrumentos (última fila de cada uno).`);
  console.log(`En ambas: ${ganaIcli + ganaLec} (cargas distintas en ${distintas}); gana ICLI en ${ganaIcli}, LEC en ${ganaLec}.`);
  console.log(`Total: ${elegidos.size} instrumentos; ya en DataMET+: ${elegidos.size - nuevos.length}; por cargar: ${nuevos.length}`
    + ` (${nuevos.filter(p => !p.unidad).length} sin unidad).`);

  if (!aplicar) {
    console.log('\nSolo se mostró el plan. Para cargar: --aplicar --usuario <usuario>.');
    return;
  }
  let cargados = 0;
  for (const puntos of nuevos) {
    if (await importarPuntos(puntos, { usuario })) cargados += 1;
  }
  console.log(`\nCargados ${cargados} instrumentos a nombre de ${usuario}.`);
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => sql.close().catch(() => {}));
}

module.exports = { leerIcli, mismasCargas };
