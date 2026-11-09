// Libro de certificados emitidos: agrupación por n.º y estado del certificado.
const test = require('node:test');
const assert = require('node:assert/strict');
const { agruparEmitidos, anioDe } = require('../src/services/calibration.emitidos');

const fila = (datos) => ({
  id: 1, numero: '0051-C01-30-26', emision: 1, estado: 'EMITIDO', archivo_nombre: 'X.pdf', motivo: null,
  autorizado_por: 'jefe', autorizado_nombre: 'Jefe QA', autorizado_en: '2026-11-03T13:00:00', firma_fecha: '2026-11-04',
  firma_detectada: 1, emitido_en: '2026-11-04T13:00:00', anulado_motivo: null, codigo_registro: 'SRV-1',
  cliente: 'CLIENTE S.A.', tipo: 'BALANZA', marca: 'OHAUS', modelo: 'PA214', serie: 'S1', id_instrumento: '0051-11-035',
  max: '600', unidad: 'g', fecha_calibracion: '2026-11-02', ...datos,
});

test('año del certificado por su número', () => {
  assert.equal(anioDe('0051-C01-30-26'), 2026);
  assert.equal(anioDe('sin año'), null);
});

test('agrupa por n.º: vigente, reemisión por firmar, por firmar y anulado', () => {
  const certificados = agruparEmitidos([
    // Emitido el 01, reemitido el 02 (vigente) y autorizado el 03 sin firmar.
    fila({ id: 1, emision: 1, estado: 'REEMPLAZADO' }),
    fila({ id: 2, emision: 2, estado: 'EMITIDO', motivo: 'Corrección de la razón social', cliente: 'CLIENTE CORREGIDO S.A.' }),
    fila({ id: 5, emision: 3, estado: 'AUTORIZADO', firma_fecha: null, firma_detectada: null, emitido_en: null, motivo: 'Otra corrección', cliente: 'OTRO NOMBRE' }),
    // Solo autorizado.
    fila({ id: 3, numero: '0052-C02-01-26', emision: 1, estado: 'AUTORIZADO', firma_fecha: null, firma_detectada: null, emitido_en: null, codigo_registro: 'SRV-2' }),
    // Autorización anulada antes de firmar.
    fila({ id: 4, numero: '0053-C01-02-25', emision: 1, estado: 'ANULADO', anulado_motivo: 'PDF con error', codigo_registro: 'SRV-3' }),
  ]);
  assert.deepEqual(certificados.map(c => [c.numero, c.estado]), [
    ['0052-C02-01-26', 'POR_FIRMAR'], ['0051-C01-30-26', 'VIGENTE'], ['0053-C01-02-25', 'ANULADO'],
  ]);
  const reemitido = certificados.find(c => c.numero === '0051-C01-30-26');
  assert.equal(reemitido.vigente, 2);
  assert.equal(reemitido.reemisionPorFirmar, true);
  // Se muestran los datos de la emisión firmada, no los de la reemisión sin firmar.
  assert.equal(reemitido.cliente, 'CLIENTE CORREGIDO S.A.');
  assert.deepEqual(reemitido.emisiones.map(e => e.estado), ['REEMPLAZADO', 'EMITIDO', 'AUTORIZADO']);
  assert.equal(reemitido.emisiones[0].autorizadoEn, '2026-11-03T13:00:00Z');
  assert.equal(certificados.find(c => c.estado === 'ANULADO').emisiones[0].anuladoMotivo, 'PDF con error');
  assert.equal(reemitido.instrumento.id, '0051-11-035');
});
