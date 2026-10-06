const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checkNewCertificate,
  describeChanges,
  expiryDate,
  normalizeCode,
} = require('../src/services/calibration.equipment');
const { parse } = require('../src/services/calibration.validation');

test('compara códigos sin espacios de no separación ni mayúsculas', () => {
  assert.equal(normalizeCode('f1-202\u00a0'), 'F1-202');
  assert.equal(normalizeCode('  M1-1-05XX '), 'M1-1-05XX');
});

test('el vencimiento es emisión más la vigencia en días', () => {
  assert.equal(expiryDate('2026-06-11', 730), '2028-06-10');
  assert.equal(expiryDate('2026-01-22', 183), '2026-07-24');
  assert.equal(expiryDate('2026-01-22', 0), null);
});

test('un certificado nuevo debe ser posterior al vigente y no futuro', () => {
  const vigente = { certFecha: '2025-08-25' };
  assert.equal(checkNewCertificate(vigente, { fecha: '2026-08-20' }, '2026-10-06'), null);
  assert.match(checkNewCertificate(vigente, { fecha: '2025-08-25' }, '2026-10-06'), /posterior a la del certificado vigente \(25\/08\/2025\)/);
  assert.match(checkNewCertificate(vigente, { fecha: '2026-10-07' }, '2026-10-06'), /posterior a hoy/);
  assert.equal(checkNewCertificate(null, { fecha: '2026-10-06' }, '2026-10-06'), null);
});

test('resume solo los campos que cambiaron', () => {
  const labels = { codigo: 'Código', planta: 'Planta', observaciones: 'Observaciones' };
  assert.equal(
    describeChanges({ codigo: 'F1-202', planta: 'La Paz', observaciones: null }, { codigo: 'F1-202', planta: 'Santa Cruz', observaciones: '' }, labels),
    'Planta: La Paz → Santa Cruz'
  );
  assert.equal(describeChanges({ codigo: 'A' }, { codigo: 'A' }, labels), '');
});

test('valida el alta de un equipo y su certificado inicial', () => {
  const alta = parse('equipoAlta', {
    codigo: ' e2-010\u00a0',
    instrumento: 'Pesas Patron',
    planta: 'La Paz',
    certificado: { numero: 'LP-CC-M-0500-2026', fecha: '2026-09-30', periodoDias: 365, ente: 'IBMETRO' },
  });
  assert.equal(alta.codigo, 'E2-010');
  assert.equal(alta.observaciones, null);
  assert.equal(alta.certificado.periodoDias, 365);
  assert.equal(parse('equipoAlta', { codigo: 'X', instrumento: 'Y', planta: 'Z' }).certificado, null);
  assert.throws(() => parse('equipoAlta', { codigo: '  ', instrumento: 'Y', planta: 'Z' }), /código/);
  assert.throws(() => parse('certificado', { numero: 'A', fecha: '2026-01-01', periodoDias: 0, ente: 'B' }), /al menos un día/);
});

test('la baja exige motivo; la reactivación no', () => {
  assert.throws(() => parse('estadoEquipo', { activo: false }), /motivo de la baja/);
  assert.deepEqual(parse('estadoEquipo', { activo: true }), { activo: true, motivo: null });
  assert.equal(parse('estadoEquipo', { activo: false, motivo: 'Pesa dañada' }).motivo, 'Pesa dañada');
});
