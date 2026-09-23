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

test('permite anular una fila y crear otra del mismo recurso en un lote', () => {
  const result = validateScheduleBatch({
    date: '2026-08-17',
    assignments: [
      { resource: 'TECNICO_1', payload: { rowId: 10 } },
      { resource: 'TECNICO_1', payload: { tipo_tarea: 'Visita' } },
    ],
  });
  assert.equal(result.length, 2);
});

test('acepta fechas distintas por asignación dentro del lote', () => {
  const result = validateScheduleBatch({
    date: '2026-08-17',
    assignments: [
      { resource: 'TECNICO_1', payload: {} },
      { date: '2026-08-18', resource: 'TECNICO_1', payload: {} },
    ],
  });
  assert.deepEqual(result.map(item => item.date), ['2026-08-17', '2026-08-18']);
});

test('solo conserva grupo_id con formato UUID', () => {
  const valid = validateScheduleInput({
    date: '2026-08-17', resource: 'T', payload: { grupo_id: '3F2504E0-4F89-41D3-9A0C-0305E82C3301' },
  });
  const invalid = validateScheduleInput({
    date: '2026-08-17', resource: 'T', payload: { grupo_id: "x'; DROP" },
  });
  assert.equal(valid.payload.grupo_id, '3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  assert.equal(invalid.payload.grupo_id, '');
});

test('rechaza texto largo en vez de truncar datos silenciosamente', () => {
  assert.throws(() => validateScheduleInput({
    date: '2026-08-17',
    resource: 'TECNICO_1',
    payload: { tipo_tarea: 'x'.repeat(101) },
  }), /máximo de 100/);
});
