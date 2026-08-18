const test = require('node:test');
const assert = require('node:assert/strict');
const { validateScheduleBatch, validateScheduleInput } = require('../src/services/schedule.validation');
const { calculateHourTotal } = require('../src/services/schedule.service');

test('calcula la duración normalizada de la tarea', () => {
  assert.equal(calculateHourTotal('08:30', '10:00'), 1.5);
  assert.equal(calculateHourTotal('10:00', '09:00'), null);
});

test('normaliza y limita los campos del cronograma', () => {
  const result = validateScheduleInput({
    date: '2026-08-17',
    resource: ' TECNICO_1 ',
    payload: { tipo_tarea: ' Visita ', horaInicio: '08:30', horaFin: '09:30' },
  });
  assert.equal(result.resource, 'TECNICO_1');
  assert.equal(result.payload.tipo_tarea, 'Visita');
});

test('rechaza horarios invertidos', () => {
  assert.throws(() => validateScheduleInput({
    date: '2026-08-17',
    resource: 'TECNICO_1',
    payload: { horaInicio: '10:00', horaFin: '09:00' },
  }), /posterior/);
});

test('rechaza recursos duplicados dentro de una operación atómica', () => {
  assert.throws(() => validateScheduleBatch({
    date: '2026-08-17',
    assignments: [
      { resource: 'TECNICO_1', payload: {} },
      { resource: 'TECNICO_1', payload: {} },
    ],
  }), /repetido/);
});

test('rechaza texto largo en vez de truncar datos silenciosamente', () => {
  assert.throws(() => validateScheduleInput({
    date: '2026-08-17',
    resource: 'TECNICO_1',
    payload: { tipo_tarea: 'x'.repeat(101) },
  }), /máximo de 100/);
});
