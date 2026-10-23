const test = require('node:test');
const assert = require('node:assert/strict');
const { puedeAprobar, huella, exigirAprobado, exigirEditable } = require('../src/services/soporte.aprobacion');
const { parse } = require('../src/services/soporte.validation');
const { datosPesaje } = require('../src/services/soporte.equipo');

test('solo el cargo exacto del jefe de Soporte concede aprobación, sin excepciones por nivel', () => {
  for (const cargo of ['Jefe de Area', ' Jefe de Área ', 'JEFE DE AREA']) assert.equal(puedeAprobar({ area: 'Soporte Técnico', cargo }), true);
  for (const cargo of ['Técnico', 'Auxiliar', 'Jefe de Area suplente', '']) assert.equal(puedeAprobar({ area: 'Soporte Técnico', cargo, acceso_cron: 3 }), false);
  assert.equal(puedeAprobar({ area: 'Sistemas', cargo: 'Jefe de Area', acceso_cron: 3 }), false);
});

test('la aprobación corresponde exactamente a la fuente, las correcciones y las fotografías revisadas', () => {
  const actual = { fuente: { cap_max1: 300, d1: 0.1 }, datos: { comentario_general: 'Verificado' }, fotos: [{ id: 1, orden: 1, descripcion: 'Placa' }] };
  const informe = { validacion_estado: 'APROBADO', validacion_huella: huella(actual) };
  assert.doesNotThrow(() => exigirAprobado(informe, actual));
  assert.equal(huella(actual), huella({ ...actual, fuente: { d1: 0.1, cap_max1: 300 } }));
  for (const alterado of [{ ...actual, fuente: { ...actual.fuente, d1: 1 } }, { ...actual, datos: {} }, { ...actual, fotos: [] }]) {
    assert.throws(() => exigirAprobado(informe, alterado), e => e.statusCode === 409);
  }
  for (const estado of ['BORRADOR', 'PENDIENTE', 'OBSERVADO']) assert.throws(() => exigirAprobado({ ...informe, validacion_estado: estado }, actual), /aprobar/);
  assert.throws(() => exigirEditable({ estado: 'BORRADOR', validacion_estado: 'APROBADO' }), /Retire/);
  assert.throws(() => exigirEditable({ estado: 'EN_REVISION', validacion_estado: 'PENDIENTE' }), /Retire/);
  assert.doesNotThrow(() => exigirEditable({ estado: 'BORRADOR', validacion_estado: 'OBSERVADO' }));
});

test('devolver un informe requiere observaciones y no acepta decisiones desconocidas', () => {
  assert.throws(() => parse('resolverValidacion', { version: 2, decision: 'OBSERVAR' }), /correcciones/);
  assert.equal(parse('resolverValidacion', { version: 2, decision: 'OBSERVAR', observacion: 'Corregir la serie del equipo' }).decision, 'OBSERVAR');
  assert.throws(() => parse('resolverValidacion', { version: 2, decision: 'EMITIR' }));
});

test('rangos de pesaje: capacidad, división y verificación, sin interpretar ceros como rangos activos', () => {
  assert.deepEqual(datosPesaje({ cap_max1: '300', d1: '0,05', e1: 0.1, cap_max2: 0, cap_max3: null, unidades: ' kg ' }), {
    unidades: 'kg', rangos: [{ numero: 1, capacidad: 300, division: 0.05, verificacion: 0.1 }], tipoRango: 'Rango único', capacidadMaxima: 300,
  });
  assert.equal(datosPesaje({ cap_max1: 150, cap_max2: 300 }).tipoRango, 'Doble rango');
  assert.equal(datosPesaje({ cap_max1: 150, cap_max2: 300, cap_max3: 600 }).tipoRango, 'Triple rango');
  assert.equal(datosPesaje({ d2: 0.1 }).tipoRango, 'Rangos incompletos');
  assert.equal(datosPesaje({}).tipoRango, null);
});
