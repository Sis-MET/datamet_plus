const test = require('node:test');
const assert = require('node:assert/strict');
const {
  analizarFirma, anioDe, contieneMarca, marcaPdf, siguienteEmision,
} = require('../src/services/calibration.emision');

const HUELLA = 'a'.repeat(32) + '0123456789abcdef'.repeat(2);
const pdf = (...partes) => Buffer.from(['%PDF-1.4', ...partes, '%%EOF'].join('\n'), 'latin1');

test('firma digital: diccionario de firma y fecha /M cerca de /ByteRange', () => {
  const firmado = pdf(
    `3 0 obj << /Keywords (${marcaPdf(HUELLA)}) /ModDate (D:20261201000000) >> endobj`,
    '9 0 obj << /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /M (D:20261107153012-04\'00\')',
    '/ByteRange [0 100 200 300] /Contents <3082> >> endobj',
  );
  assert.deepEqual(analizarFirma(firmado), { firmado: true, fecha: '2026-11-07' });
  // Sin firma: el PDF que se descargó para firmar.
  assert.deepEqual(analizarFirma(pdf('1 0 obj << /Type /Catalog >> endobj')), { firmado: false, fecha: null });
  // Firma sin fecha legible.
  assert.deepEqual(analizarFirma(pdf('<< /Type /Sig /ByteRange [0 1 2 3] >>')), { firmado: true, fecha: null });
  // Dos firmas: vale la más reciente.
  const doble = pdf('<< /Type /Sig /M (D:20261105) /ByteRange [0 1 2 3] >>', '<< /Type /Sig /M (D:20261108) /ByteRange [0 1 2 3] >>');
  assert.equal(analizarFirma(doble).fecha, '2026-11-08');
});

test('el PDF firmado lleva la huella de la emisión, tal cual o en UTF-16', () => {
  assert.equal(contieneMarca(pdf(`<< /Keywords (${marcaPdf(HUELLA)}) >>`), HUELLA), true);
  const utf16 = [...HUELLA].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('').toUpperCase();
  assert.equal(contieneMarca(pdf(`<< /Keywords <FEFF${utf16}> >>`), HUELLA), true);
  assert.equal(contieneMarca(pdf('<< /Keywords (DataMET+ otra) >>'), HUELLA), false);
});

test('carpeta del año y numeración de las reemisiones', () => {
  assert.equal(anioDe('0051-C01-30-26'), '2026');
  assert.equal(anioDe('sin año'), null);
  assert.deepEqual(siguienteEmision([], null), { emision: 1, numero: null, revisiones: [], reemplaza: null });
  // Una anulada antes de firmar no cuenta como emitida, pero ocupa su número de emisión.
  const anulada = [{ numero: 'N-01-26', emision: 1, estado: 'ANULADO' }];
  assert.equal(siguienteEmision(anulada, null).emision, 1);
  const emitidas = [
    { numero: 'N-01-26', emision: 1, estado: 'REEMPLAZADO', firmaFecha: '2026-11-07', motivo: null },
    { numero: 'N-01-26', emision: 2, estado: 'EMITIDO', firmaFecha: '2026-11-20', motivo: 'Cambio de la razón social.' },
  ];
  const tercera = siguienteEmision(emitidas, 'Error en la serie.');
  assert.equal(tercera.emision, 3);
  assert.equal(tercera.numero, 'N-01-26');
  assert.deepEqual(tercera.revisiones, [
    { emision: '01', fecha: '2026-11-07', motivo: 'Emisión original.' },
    { emision: '02', fecha: '2026-11-20', motivo: 'Cambio de la razón social.' },
    { emision: '03', fecha: null, motivo: 'Error en la serie.' },
  ]);
  assert.equal(tercera.reemplaza, 'Esta emisión 03 reemplaza a la emisión 02, firmada el 2026-11-20.');
});
