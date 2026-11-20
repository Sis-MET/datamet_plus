/**
 * Escritura mínima de un libro .xlsx (ZIP + XML de SpreadsheetML) sin
 * dependencias: hojas con encabezado en negrita fijo, filtro, ancho de
 * columnas y formatos de bolivianos, enteros, porcentaje y fecha. Las
 * celdas de texto van en línea (sin tabla de textos compartidos). La lee
 * utils/xlsx.js y la abre Excel o LibreOffice.
 *
 * crearLibro([{ nombre, columnas: [{ titulo, tipo, ancho }], filas: [[…]] }]) → Buffer
 * tipo: texto (por omisión) | bs | entero | numero | porcentaje (fracción: 0.25) | fecha ('2026-11-20').
 */
const zlib = require('node:zlib');

// ─── ZIP ────────────────────────────────────────────────────────────────────

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** ZIP con deflate de [{ nombre, datos }]. Fecha fija: el mismo contenido da el mismo archivo. */
const zip = (archivos) => {
  const locales = [];
  const centrales = [];
  let offset = 0;
  const FECHA = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01, solo para cumplir el formato.
  for (const { nombre, datos } of archivos) {
    const nombreBuf = Buffer.from(nombre, 'utf8');
    const crudo = Buffer.isBuffer(datos) ? datos : Buffer.from(datos, 'utf8');
    const comprimido = zlib.deflateRawSync(crudo);
    const crc = crc32(crudo);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(FECHA, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(crudo.length, 22);
    local.writeUInt16LE(nombreBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, nombreBuf, comprimido);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(FECHA, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(crudo.length, 24);
    central.writeUInt16LE(nombreBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrales.push(central, nombreBuf);
    offset += 30 + nombreBuf.length + comprimido.length;
  }
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, directorio, fin]);
};

// ─── SpreadsheetML ──────────────────────────────────────────────────────────

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// Sin caracteres de control que invalidan el XML.
// eslint-disable-next-line no-control-regex
const escapar = (v) => String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const columna = (i) => {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** Serie de Excel (días desde 1899-12-30) de «2026-11-20». */
const serieFecha = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  return Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - Date.UTC(1899, 11, 30)) / 86400000);
};

// Estilos (cellXfs): 0 normal, 1 encabezado, 2 bolivianos, 3 fecha, 4 entero, 5 porcentaje, 6 número.
const ESTILO = { encabezado: 1, bs: 2, fecha: 3, entero: 4, porcentaje: 5, numero: 6 };

const ESTILOS = `${XML}<styleSheet xmlns="${NS}">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0EFEB"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const celda = (ref, valor, tipo) => {
  if (valor === null || valor === undefined || valor === '') return '';
  if (tipo === 'fecha') {
    const serie = serieFecha(valor);
    return serie === null ? '' : `<c r="${ref}" s="${ESTILO.fecha}"><v>${serie}</v></c>`;
  }
  if (['bs', 'entero', 'porcentaje', 'numero'].includes(tipo)) {
    const n = Number(valor);
    return Number.isFinite(n) ? `<c r="${ref}" s="${ESTILO[tipo]}"><v>${n}</v></c>` : '';
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`;
};

const hojaXml = ({ columnas, filas }) => {
  const ultima = columna(Math.max(0, columnas.length - 1));
  const anchos = columnas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho || 14}" customWidth="1"/>`).join('');
  const encabezado = `<row r="1">${columnas.map((c, i) => `<c r="${columna(i)}1" t="inlineStr" s="${ESTILO.encabezado}"><is><t>${escapar(c.titulo)}</t></is></c>`).join('')}</row>`;
  const cuerpo = filas.map((fila, f) => `<row r="${f + 2}">${columnas.map((c, i) => celda(`${columna(i)}${f + 2}`, fila[i], c.tipo)).join('')}</row>`).join('');
  return `${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}">`
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<cols>${anchos}</cols><sheetData>${encabezado}${cuerpo}</sheetData>`
    + (filas.length ? `<autoFilter ref="A1:${ultima}${filas.length + 1}"/>` : '')
    + '</worksheet>';
};

/** Nombre de hoja válido para Excel: sin []:*?/\ y de hasta 31 caracteres, sin repetir. */
const nombresDeHoja = (hojas) => {
  const usados = new Set();
  return hojas.map((h, i) => {
    let base = String(h.nombre || `Hoja ${i + 1}`).replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || `Hoja ${i + 1}`;
    let nombre = base;
    for (let n = 2; usados.has(nombre.toLowerCase()); n += 1) nombre = `${base.slice(0, 28)} ${n}`;
    usados.add(nombre.toLowerCase());
    return nombre;
  });
};

const crearLibro = (hojas) => {
  if (!hojas.length) throw new Error('El libro necesita al menos una hoja.');
  const nombres = nombresDeHoja(hojas);
  const archivos = [
    {
      nombre: '[Content_Types].xml',
      datos: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
        + '</Types>',
    },
    {
      nombre: '_rels/.rels',
      datos: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '</Relationships>',
    },
    {
      nombre: 'xl/workbook.xml',
      datos: `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets>`
        + nombres.map((n, i) => `<sheet name="${escapar(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
        + '</sheets></workbook>',
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      datos: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
        + `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
        + '</Relationships>',
    },
    { nombre: 'xl/styles.xml', datos: ESTILOS },
    ...hojas.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, datos: hojaXml(h) })),
  ];
  return zip(archivos);
};

module.exports = { crearLibro, crc32, serieFecha, columna };
