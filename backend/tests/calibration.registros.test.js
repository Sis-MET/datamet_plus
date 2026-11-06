const test = require('node:test');
const assert = require('node:assert/strict');
const {
  esEditable, huellaDe, permisosDe, planClase, planCorrecciones,
} = require('../src/services/calibration.registros');
const { parse } = require('../src/services/calibration.validation');

const columnas = new Map([
  ['ind3', { tipo: 'decimal', max: null }],
  ['lin3', { tipo: 'decimal', max: null }],
  ['carga', { tipo: 'decimal', max: null }],
  ['personal', { tipo: 'texto', max: 50 }],
  ['n_reca', { tipo: 'texto', max: 50 }],
  ['hora_fin', { tipo: 'hora', max: null }],
  ['seca', { tipo: 'texto', max: 15 }],
  ['codigo_registro', { tipo: 'texto', max: 100 }],
  ['vibracion_foto', { tipo: 'texto', max: 300 }],
]);
const fuente = { ind3: 100.5, lin3: 100, carga: 2, personal: 'Usuario sin datos', n_reca: '5a', hora_fin: '12:40', seca: '0103-31-C05-26' };

test('qué columnas se corrigen: datos de medición sí; identidad, cliente y fotos no', () => {
  assert.equal(esEditable('ind3', columnas.get('ind3')), true);
  assert.equal(esEditable('hora_fin', columnas.get('hora_fin')), true); // en calibración es la hora de las condiciones finales
  assert.equal(esEditable('n_reca', columnas.get('n_reca')), true);
  assert.equal(esEditable('seca', columnas.get('seca')), false);
  assert.equal(esEditable('codigo_registro', columnas.get('codigo_registro')), false);
  assert.equal(esEditable('vibracion_foto', columnas.get('vibracion_foto')), false);
  assert.equal(esEditable('inexistente', undefined), false);
});

test('correcciones por columna: antes → después y vuelta al valor de ServiceMET', () => {
  const primera = planCorrecciones({ fuente, columnas, actuales: {}, entrantes: { ind3: '100,4', carga: 2.5, personal: 'Ing. Jorge Ortuño R.', n_reca: '5' } });
  assert.deepEqual(primera.columnas, { carga: 2.5, ind3: 100.4, n_reca: '5', personal: 'Ing. Jorge Ortuño R.' });
  assert.deepEqual(primera.cambios.find(c => c.campo === 'ind3'), { campo: 'ind3', antes: 100.5, despues: 100.4 });
  // Volver al valor original quita la corrección y deja el cambio en el historial.
  const segunda = planCorrecciones({ fuente, columnas, actuales: primera.columnas, entrantes: { ind3: 100.5, carga: 2.5 } });
  assert.deepEqual(segunda.columnas, { carga: 2.5, n_reca: '5', personal: 'Ing. Jorge Ortuño R.' });
  assert.deepEqual(segunda.cambios, [{ campo: 'ind3', antes: 100.4, despues: 100.5 }]);
  assert.throws(() => planCorrecciones({ fuente, columnas, actuales: {}, entrantes: { seca: 'X' } }), /no se puede corregir/);
  assert.throws(() => planCorrecciones({ fuente, columnas, actuales: {}, entrantes: { ind3: 'abc' } }), /número/);
  assert.throws(() => planCorrecciones({ fuente, columnas, actuales: {}, entrantes: { hora_fin: '25:00' } }), /hora/);
});

test('clase del instrumento con su origen', () => {
  assert.deepEqual(planClase(null, { valor: 'III', origen: 'PLACA' }), {
    clase: { valor: 'III', origen: 'PLACA' },
    cambio: { campo: 'clase', antes: null, despues: 'III (Placa)' },
  });
  assert.equal(planClase({ valor: 'III', origen: 'PLACA' }, { valor: 'III', origen: 'PLACA' }).cambio, null);
  assert.equal(planClase({ valor: 'III', origen: 'PLACA' }, undefined).cambio, null);
  assert.equal(planClase({ valor: 'III', origen: 'PLACA' }, null).clase, null);
  assert.throws(() => planClase(null, { valor: 'III', origen: null }), /de dónde sale/);
});

test('permisos: elabora el personal del área; revisa el jefe y nunca quien lo envió', () => {
  const tecnico = { usuario: 'Ortuño', jefe: false, editor: true };
  const jefe = { usuario: 'Vallejos', jefe: true, editor: true };
  assert.deepEqual(permisosDe(tecnico, null), { editar: true, enviar: true, retirar: false, revisar: false, reabrir: false, motivoRevisar: null });
  const enRevision = { estado: 'EN_REVISION', enviado_por: 'Ortuño' };
  assert.equal(permisosDe(tecnico, enRevision).editar, false);
  assert.equal(permisosDe(tecnico, enRevision).retirar, true);
  assert.equal(permisosDe(tecnico, enRevision).revisar, false);
  assert.equal(permisosDe(jefe, enRevision).revisar, true);
  // Si lo envió el jefe, no puede revisarlo él mismo.
  const propio = permisosDe(jefe, { estado: 'EN_REVISION', enviado_por: 'vallejos' });
  assert.equal(propio.revisar, false);
  assert.match(propio.motivoRevisar, /otra persona/);
  assert.equal(permisosDe(jefe, { estado: 'APROBADO' }).reabrir, true);
  assert.equal(permisosDe(tecnico, { estado: 'APROBADO' }).reabrir, false);
  assert.equal(permisosDe(tecnico, { estado: 'OBSERVADO' }).editar, true);
  assert.equal(permisosDe({ usuario: 'X', jefe: false, editor: false }, null).editar, false);
});

test('huella: cambia si cambia la fila de ServiceMET o una corrección, no por el orden', () => {
  const base = huellaDe({ fuente: { a: 1, b: 2 }, datos: { columnas: { ind3: 1 }, clase: null } });
  assert.equal(base, huellaDe({ fuente: { b: 2, a: 1 }, datos: { clase: null, columnas: { ind3: 1 } } }));
  assert.notEqual(base, huellaDe({ fuente: { a: 1, b: 3 }, datos: { columnas: { ind3: 1 }, clase: null } }));
  assert.notEqual(base, huellaDe({ fuente: { a: 1, b: 2 }, datos: { columnas: { ind3: 2 }, clase: null } }));
});

test('validación de lo que llega al guardar y al revisar', () => {
  assert.deepEqual(parse('registroGuardar', { columnas: { ind3: 1.2 } }), { version: null, columnas: { ind3: 1.2 }, motivo: null });
  assert.equal(parse('registroGuardar', { clase: { valor: 'II', origen: 'CLIENTE' } }).clase.valor, 'II');
  assert.throws(() => parse('registroGuardar', { clase: { valor: 'V', origen: 'PLACA' } }));
  assert.throws(() => parse('registroRevision', { decision: 'OBSERVAR' }), /observación/);
  assert.equal(parse('registroRevision', { decision: 'APROBAR' }).decision, 'APROBAR');
  assert.throws(() => parse('registroReapertura', {}), /reabre/);
});
