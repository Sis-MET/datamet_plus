import { describe, expect, it } from 'vitest';
import { bytesDeDataUrl, fechaPdf, pdfDeImagenes } from './pdf';

// Un JPEG de mentira basta: el PDF no lo decodifica, solo lo incrusta.
const jpeg = (n) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, n, 0x10, 0x20, 0xff, 0xd9]);
const latin1 = (bytes) => Array.from(bytes, b => String.fromCharCode(b)).join('');

describe('PDF de las hojas del informe', () => {
  const paginas = [
    { jpeg: jpeg(1), ancho: 2480, alto: 3508 },
    { jpeg: jpeg(2), ancho: 2480, alto: 3508 },
  ];
  const pdf = pdfDeImagenes(paginas, { titulo: 'IMPR-26-0036-51-S01-004-MIN. MANQUIRI', autor: 'Métrica Ltda.', fecha: new Date(2026, 9, 21, 9, 5, 7) });
  const texto = latin1(pdf);

  it('tiene la cabecera, una página A4 por hoja y el cierre', () => {
    expect(texto.startsWith('%PDF-1.4\n')).toBe(true);
    expect(texto).toContain('/Type /Pages /Kids [4 0 R 7 0 R] /Count 2');
    expect(texto.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(texto).toContain('/MediaBox [0 0 595.28 841.89]');
    expect(texto).toContain('q 595.28 0 0 841.89 0 0 cm /Im0 Do Q');
    expect(texto.endsWith('%%EOF\n')).toBe(true);
  });

  it('la tabla de referencias apunta a cada objeto', () => {
    const inicio = Number(texto.match(/startxref\n(\d+)\n/)[1]);
    expect(texto.slice(inicio, inicio + 4)).toBe('xref');
    const entradas = texto.slice(inicio).split('\n').slice(3, 3 + 9);
    entradas.forEach((linea, i) => {
      expect(linea).toMatch(/^\d{10} 00000 n $/);
      const offset = Number(linea.slice(0, 10));
      expect(texto.startsWith(`${i + 1} 0 obj\n`, offset)).toBe(true);
    });
    expect(texto).toContain('trailer\n<< /Size 10 /Root 1 0 R /Info 3 0 R >>');
  });

  it('incrusta cada JPEG completo con su tamaño', () => {
    expect(texto).toContain('/Width 2480 /Height 3508 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length 9 >>');
    expect(texto).toContain(`stream\n${latin1(jpeg(1))}\nendstream`);
    expect(texto).toContain(`stream\n${latin1(jpeg(2))}\nendstream`);
  });

  it('guarda el título y el autor con tildes, y la fecha', () => {
    // «é» es U+00E9.
    expect(texto).toContain('/Author <FEFF004D00E9007400720069006300610020004C007400640061002E>');
    expect(texto).toContain('/Title <FEFF0049004D00500052');
    expect(texto).toContain('/CreationDate (D:20261021090507)');
    expect(fechaPdf(new Date(2026, 0, 2, 3, 4, 5))).toBe('D:20260102030405');
  });

  it('exige al menos una hoja y lee data URLs', () => {
    expect(() => pdfDeImagenes([])).toThrow();
    expect(Array.from(bytesDeDataUrl('data:image/jpeg;base64,/9j/'))).toEqual([0xff, 0xd8, 0xff]);
  });
});
