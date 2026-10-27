const test = require('node:test');
const assert = require('node:assert/strict');
const {
  compareVersions,
  esJefeCalibracion,
  findVersion,
  mapVersion,
  permisosDe,
  situacionTelefono,
} = require('../src/services/calibration.servicemet');
const { parse } = require('../src/services/calibration.validation');

const sistemas = { acceso_cron: '3', area: 'Administración', cargo: 'Auxiliar de Sistemas' };
const jefe = { acceso_cron: 2, area: 'Calibración', cargo: 'Jefe de Area' };
const tecnico = { acceso_cron: '2', area: 'Calibración', cargo: 'Técnico' };

test('solo el jefe de área de Calibración aprueba; Sistemas registra y valida', () => {
  assert.equal(esJefeCalibracion(jefe), true);
  assert.equal(esJefeCalibracion({ area: ' calibracion ', cargo: 'Jefe de  Área' }), true);
  assert.equal(esJefeCalibracion({ area: 'Soporte Técnico', cargo: 'Jefe de Área' }), false);
  assert.equal(esJefeCalibracion(tecnico), false);
  assert.deepEqual(permisosDe(sistemas), { registrar: true, aprobar: false, ponerEnUso: true });
  assert.deepEqual(permisosDe(jefe), { registrar: false, aprobar: true, ponerEnUso: true });
  assert.deepEqual(permisosDe(tecnico), { registrar: false, aprobar: false, ponerEnUso: false });
});

const fila = (overrides = {}) => ({
  id: 1, version: '6.4.1+19', fecha_version: '2026-10-20', commit_ref: '646ec67', clase: 'A', resumen: 'x',
  nuevo: '["Uno","Dos"]', corregido: null, estado: 'REGISTRADA', validacion: null, validacion_resultado: null,
  decidido_por: null, a_posteriori: false, ...overrides,
});

test('cada paso de una versión se habilita en su momento y para quien corresponde', () => {
  assert.deepEqual(mapVersion(fila(), permisosDe(sistemas)).acciones,
    { editar: true, validar: true, decidir: false, aprobar: false, ponerEnUso: false });
  // El jefe puede no aprobarla sin validación, pero aprobarla exige una validación conforme.
  assert.deepEqual(mapVersion(fila(), permisosDe(jefe)).acciones,
    { editar: false, validar: false, decidir: true, aprobar: false, ponerEnUso: false });
  const validada = fila({ estado: 'VALIDADA', validacion: 'ok', validacion_resultado: 'CONFORME' });
  assert.equal(mapVersion(validada, permisosDe(jefe)).acciones.aprobar, true);
  assert.equal(mapVersion(validada, permisosDe(sistemas)).acciones.aprobar, false);
  assert.equal(mapVersion(fila({ validacion_resultado: 'NO_CONFORME' }), permisosDe(jefe)).acciones.aprobar, false);
  const aprobada = fila({ estado: 'APROBADA', validacion_resultado: 'CONFORME', decidido_por: 'jefe' });
  assert.deepEqual(mapVersion(aprobada, permisosDe(sistemas)).acciones,
    { editar: false, validar: false, decidir: false, aprobar: false, ponerEnUso: true });
  assert.equal(mapVersion(aprobada, permisosDe(tecnico)).acciones.ponerEnUso, false);
  assert.equal(mapVersion(fila({ estado: 'RECHAZADA', decidido_por: 'jefe' }), permisosDe(sistemas)).acciones.editar, false);
  // Sin permisos (por ejemplo, un técnico) solo consulta.
  assert.deepEqual(Object.values(mapVersion(fila(), {}).acciones), [false, false, false, false, false]);
});

test('las listas de cambios se leen en JSON o, si vienen como texto, por línea', () => {
  assert.deepEqual(mapVersion(fila()).nuevo, ['Uno', 'Dos']);
  assert.deepEqual(mapVersion(fila({ nuevo: 'Uno\r\nDos\n' })).nuevo, ['Uno', 'Dos']);
  assert.deepEqual(mapVersion(fila({ nuevo: null })).nuevo, []);
});

const versiones = ['6.4.1+19', '6.4.0+18', '6.3.5+17', '6.3.4+16'].map((version, index) => ({ id: index + 1, version, estado: 'REGISTRADA' }));

test('las versiones se ordenan por sus números, build incluido', () => {
  assert.ok(compareVersions('6.4.1+19', '6.4.0+18') > 0);
  assert.ok(compareVersions('6.10.0+20', '6.9.9+30') > 0);
  assert.ok(compareVersions('6.4.1+19', '6.4.1+20') < 0);
  assert.equal(compareVersions('6.4.1+19', '6.4.1+19'), 0);
});

test('la versión de un teléfono se reconoce con o sin build', () => {
  assert.equal(findVersion('6.4.1+19', versiones)?.id, 1);
  assert.equal(findVersion('v6.4.0', versiones)?.id, 2);
  assert.equal(findVersion('6.4.1+18', versiones), null);
  assert.equal(findVersion('9.9.9', versiones), null);
  assert.equal(findVersion('', versiones), null);
  assert.equal(situacionTelefono(null), 'SIN_REGISTRAR');
  assert.equal(situacionTelefono({ estado: 'VALIDADA' }), 'PENDIENTE');
  assert.equal(situacionTelefono({ estado: 'EN_USO' }), 'APROBADA');
  assert.equal(situacionTelefono({ estado: 'APROBADA' }), 'APROBADA');
  assert.equal(situacionTelefono({ estado: 'RECHAZADA' }), 'RECHAZADA');
});

test('una versión se registra con su build, su clase y al menos un cambio', () => {
  const base = { version: '6.4.2+20', fecha: '2026-10-27', clase: 'A', resumen: 'Resumen', nuevo: ['Algo nuevo'] };
  const datos = parse('servicemetVersion', { ...base, commit: 'ABC1234' });
  assert.equal(datos.commit, 'abc1234');
  assert.deepEqual(datos.corregido, []);
  assert.equal(parse('servicemetVersion', { ...base, commit: '' }).commit, null);
  assert.throws(() => parse('servicemetVersion', { ...base, version: '6.4.2' }), /build/);
  assert.throws(() => parse('servicemetVersion', { ...base, commit: 'no-es-hash' }), /hexadecimales/);
  assert.throws(() => parse('servicemetVersion', { ...base, clase: 'D' }), /clase/);
  assert.throws(() => parse('servicemetVersion', { ...base, nuevo: [] }), /al menos un cambio/);
  assert.throws(() => parse('servicemetVersion', { ...base, nuevo: ['  '] }), /vacía/);
});

test('no aprobar una versión exige el motivo', () => {
  assert.throws(() => parse('servicemetDecision', { decision: 'RECHAZAR' }), /por qué no se aprueba/);
  assert.equal(parse('servicemetDecision', { decision: 'APROBAR' }).observaciones, null);
  assert.throws(() => parse('servicemetValidacion', { resultado: 'CONFORME' }), /cómo se validó/);
});
