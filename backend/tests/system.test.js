const test = require('node:test');
const assert = require('node:assert/strict');
const { fingerprint, routeOf } = require('../src/services/system.failures');
const { mapCambio } = require('../src/services/system.changes');
const { parse } = require('../src/services/system.validation');

test('agrupa las repeticiones de una falla aunque cambien los ids', () => {
  const a = fingerprint({ origen: 'SERVIDOR', ruta: 'GET /api/calibracion/equipos/:id/historial', mensaje: 'Timeout en la consulta 1520' });
  const b = fingerprint({ origen: 'SERVIDOR', ruta: 'GET /api/calibracion/equipos/:id/historial', mensaje: 'Timeout en la consulta 1987' });
  const c = fingerprint({ origen: 'TAREA', ruta: 'GET /api/calibracion/equipos/:id/historial', mensaje: 'Timeout en la consulta 1520' });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 40);
});

test('la ruta se guarda sin consulta ni ids', () => {
  assert.equal(routeOf({ method: 'PUT', originalUrl: '/api/calibracion/equipos/23/datos?x=1' }), 'PUT /api/calibracion/equipos/:id/datos');
  assert.equal(routeOf(null), null);
});

const fila = (overrides = {}) => ({
  id: 1, codigo: 'CC-2026-019', version: '2.7.0', titulo: 'Cambio', tipo: 'MEJORA', descripcion: 'x',
  estado: 'REGISTRADO', validacion: null, validacion_resultado: null, aprobado_por: null,
  implementado_en: null, a_posteriori: false, ...overrides,
});

test('el flujo de un cambio habilita cada paso en su momento', () => {
  assert.deepEqual(mapCambio(fila()).acciones, { editar: true, validar: true, aprobar: false, implementar: false });
  assert.equal(mapCambio(fila({ estado: 'VALIDADO', validacion_resultado: 'CONFORME' })).acciones.aprobar, true);
  assert.equal(mapCambio(fila({ validacion_resultado: 'NO_CONFORME' })).acciones.aprobar, false);
  assert.deepEqual(
    mapCambio(fila({ estado: 'APROBADO', validacion_resultado: 'CONFORME', aprobado_por: 'jefe' })).acciones,
    { editar: false, validar: false, aprobar: false, implementar: true }
  );
  assert.equal(mapCambio(fila({ estado: 'RECHAZADO', aprobado_por: 'jefe' })).acciones.editar, false);
  // Un cambio en uso registrado a posteriori: se valida, se aprueba y se le completa la fecha.
  const enUso = mapCambio(fila({ estado: 'IMPLEMENTADO', a_posteriori: true }));
  assert.deepEqual(enUso.acciones, { editar: true, validar: true, aprobar: false, implementar: true });
});

test('cerrar una falla exige la acción inmediata y la correctiva', () => {
  assert.throws(() => parse('atencionFalla', { estado: 'CERRADA', accionInmediata: 'Se reinició el servicio' }), /acción correctiva/);
  assert.throws(() => parse('atencionFalla', { estado: 'DESCARTADA' }), /motivo/);
  const cerrada = parse('atencionFalla', { estado: 'CERRADA', accionInmediata: 'Se reinició', accionCorrectiva: 'Se amplió el tiempo de espera' });
  assert.equal(cerrada.cambioId, null);
});

test('una falla manual usa la hora de Bolivia y no puede estar en el futuro', () => {
  const falla = parse('fallaManual', { mensaje: 'Servidor caído', ocurrida: '2026-10-06T08:30' });
  assert.equal(falla.ocurrida, '2026-10-06T12:30:00.000Z');
  assert.throws(() => parse('fallaManual', { mensaje: 'x', ocurrida: '2999-01-01T00:00' }), /futuro/);
  assert.throws(() => parse('aprobacionCambio', { decision: 'RECHAZAR' }), /por qué se rechaza/);
});
