/**
 * PDF con una imagen JPEG por hoja A4: así el archivo guardado es idéntico a
 * la vista previa (mismas hojas, fuentes y colores). Se arma a mano porque
 * solo necesita catálogo, páginas, imágenes y la tabla de referencias.
 */

/** Hoja A4 en puntos PDF (1/72 de pulgada). */
export const A4_PUNTOS = { ancho: 595.28, alto: 841.89 };

const codificar = (texto) => new TextEncoder().encode(texto);

/** Texto del diccionario Info en UTF-16BE (acepta tildes y eñes). */
function cadenaPdf(valor) {
  const texto = String(valor ?? '');
  let hex = 'FEFF';
  for (let i = 0; i < texto.length; i += 1) hex += texto.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

const dosDigitos = (n) => String(n).padStart(2, '0');

/** Fecha PDF: D:AAAAMMDDHHmmSS. */
export function fechaPdf(fecha = new Date()) {
  return `D:${fecha.getFullYear()}${dosDigitos(fecha.getMonth() + 1)}${dosDigitos(fecha.getDate())}`
    + `${dosDigitos(fecha.getHours())}${dosDigitos(fecha.getMinutes())}${dosDigitos(fecha.getSeconds())}`;
}

const numero = (valor) => Number(valor.toFixed(2)).toString();

/**
 * Arma el PDF.
 * @param {{ jpeg: Uint8Array, ancho: number, alto: number }[]} paginas
 *   JPEG de cada hoja con su tamaño en píxeles.
 * @param {{ titulo?: string, autor?: string, fecha?: Date, palabrasClave?: string }} info
 *   `palabrasClave`: texto ASCII para /Keywords (el certificado de calibración
 *   lleva ahí la huella de su emisión, para reconocer el PDF firmado).
 * @returns {Uint8Array}
 */
export function pdfDeImagenes(paginas, { titulo = '', autor = '', fecha = new Date(), palabrasClave = '' } = {}) {
  if (!paginas.length) throw new Error('El PDF necesita al menos una hoja.');
  const partes = [];
  const offsets = [];
  let largo = 0;
  const agregar = (bytes) => {
    partes.push(bytes);
    largo += bytes.length;
  };
  const objeto = (id, ...contenido) => {
    offsets[id] = largo;
    agregar(codificar(`${id} 0 obj\n`));
    contenido.forEach(parte => agregar(typeof parte === 'string' ? codificar(parte) : parte));
    agregar(codificar('\nendobj\n'));
  };

  // Cabecera con bytes binarios: los lectores tratan el archivo como binario.
  agregar(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const idPagina = (indice) => 4 + indice * 3;
  const total = 3 + paginas.length * 3;
  const { ancho, alto } = A4_PUNTOS;

  objeto(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objeto(2, `<< /Type /Pages /Kids [${paginas.map((_, i) => `${idPagina(i)} 0 R`).join(' ')}] /Count ${paginas.length} >>`);
  const claves = String(palabrasClave).replace(/[^A-Za-z0-9+ ._-]/g, '');
  objeto(3, `<< /Title ${cadenaPdf(titulo)} /Author ${cadenaPdf(autor)} /Creator (DataMET+) /Producer (DataMET+)`
    + `${claves ? ` /Keywords (${claves})` : ''} /CreationDate (${fechaPdf(fecha)}) >>`);

  paginas.forEach((pagina, i) => {
    const id = idPagina(i);
    const dibujo = `q ${numero(ancho)} 0 0 ${numero(alto)} 0 0 cm /Im0 Do Q`;
    objeto(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${numero(ancho)} ${numero(alto)}]`
      + ` /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`);
    objeto(id + 1, `<< /Length ${dibujo.length} >>\nstream\n${dibujo}\nendstream`);
    objeto(
      id + 2,
      `<< /Type /XObject /Subtype /Image /Width ${pagina.ancho} /Height ${pagina.alto} /ColorSpace /DeviceRGB`
        + ` /BitsPerComponent 8 /Filter /DCTDecode /Length ${pagina.jpeg.length} >>\nstream\n`,
      pagina.jpeg,
      '\nendstream',
    );
  });

  const inicioXref = largo;
  let xref = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= total; id += 1) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  agregar(codificar(`${xref}trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`));

  const pdf = new Uint8Array(largo);
  let posicion = 0;
  for (const parte of partes) {
    pdf.set(parte, posicion);
    posicion += parte.length;
  }
  return pdf;
}

/** Bytes de una imagen en data URL (base64). */
export function bytesDeDataUrl(dataUrl) {
  const base64 = String(dataUrl).split(',')[1] || '';
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
