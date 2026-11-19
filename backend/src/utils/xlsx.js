/**
 * Lectura mínima de un libro .xlsx/.xlsm (ZIP + XML) sin abrir Excel ni
 * ejecutar macros: valores de las celdas de una hoja, con los textos
 * compartidos resueltos. Las fórmulas se leen por su último valor calculado.
 * Es el mismo método que scripts/patrones-importar-excel.js.
 */
const fs = require('node:fs');
const zlib = require('node:zlib');

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
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&amp;/g, '&');

/**
 * Abre el libro y devuelve `hoja(nombre)`: un Map fila → { columna: valor }
 * con los valores como texto (los números, como los guarda Excel).
 */
const leerLibro = (archivo) => {
  const leer = leerZip(archivo);
  const compartidas = [...(leer('xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => xmlTexto(t[1])).join(''));
  const rels = new Map([...leer('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)]
    .map(m => [m[1], m[2]]));
  const hojas = new Map([...leer('xl/workbook.xml').matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)]
    .map(m => [xmlTexto(m[1]), `xl/${rels.get(m[2]).replace(/^\/?xl\//, '')}`]));

  const hoja = (nombre) => {
    const ruta = hojas.get(nombre);
    const xml = ruta ? leer(ruta) : null;
    if (!xml) throw new Error(`El libro no tiene la hoja «${nombre}».`);
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
  hoja.nombres = () => [...hojas.keys()];
  return hoja;
};

/** Número de serie de Excel (días desde 1899-12-30) a fecha 2026-11-19. */
const fechaExcel = (valor) => {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 1) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000).toISOString().slice(0, 10);
};

module.exports = { fechaExcel, leerLibro, leerZip, xmlTexto };
