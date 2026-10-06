const test = require('node:test');
const assert = require('node:assert/strict');
const {
  conflictingAuthor,
  describeEventChanges,
  describePlanChanges,
  eventView,
} = require('../src/services/calibration.history');
const { parse } = require('../src/services/calibration.validation');

test('describe el cambio de una fecha con valores legibles', () => {
  const antes = { estado: 'REALIZADO', fechaRealizada: '2026-05-02', resultado: 'CONFORME', registroRef: 'RV-01' };
  const despues = { ...antes, resultado: 'NO_CONFORME', observaciones: 'Desviación en la pesa de 5 kg' };
  assert.equal(
    describeEventChanges(antes, despues),
    'Resultado: Conforme → No conforme; Observaciones: — → «Desviación en la pesa de 5 kg»'
  );
  // Una fecha sin guardar cuenta como programada.
  assert.equal(describeEventChanges(null, { estado: 'EN_PROCESO' }), 'Estado: Programada → En proceso');
  assert.equal(describeEventChanges(antes, { ...antes }), '');
  assert.deepEqual(eventView(null), {
    estado: 'PROGRAMADO', fechaReprogramada: null, fechaRealizada: null, resultado: null, registroRef: null, observaciones: null,
  });
});

test('describe los cambios del plan con sí/no y fechas', () => {
  assert.equal(
    describePlanChanges(
      { activo: true, frecuencia_meses: 6, fecha_inicio: null, alerta_correo: true },
      { activo: false, frecuencia_meses: 4, fecha_inicio: '2026-02-16', alerta_correo: true }
    ),
    'En el plan: Sí → No; Frecuencia (meses): 6 → 4; Desde: — → 16/02/2026'
  );
});

test('quien registró o corrigió no puede revisar', () => {
  assert.equal(conflictingAuthor(['mgutierrez', 'MGC'], ['MGC', null]), 'MGC');
  assert.equal(conflictingAuthor(['mgutierrez', 'MGC'], ['jortiz', 'JOR']), null);
  assert.equal(conflictingAuthor(['jortiz'], [' JORTIZ ']), ' JORTIZ ');
  assert.equal(conflictingAuthor(['jortiz'], [null, undefined]), null);
});

test('una verificación realizada exige resultado y hoja de datos', () => {
  const base = { serie: 'VER-3', fechaProgramada: '2026-05-01', estado: 'REALIZADO', fechaRealizada: '2026-05-02' };
  assert.throws(() => parse('evento', { ...base, registroRef: 'RV-01' }), /resultado de la verificación/);
  assert.throws(() => parse('evento', { ...base, resultado: 'CONFORME' }), /hoja o el archivo/);
  const ok = parse('evento', { ...base, resultado: 'CONFORME', registroRef: ' RV-01 ', motivo: 'Resultado mal cargado' });
  assert.equal(ok.registroRef, 'RV-01');
  assert.equal(ok.motivo, 'Resultado mal cargado');
  // Actividades y calibraciones no la piden.
  assert.equal(parse('evento', { ...base, serie: 'ACT-3' }).estado, 'REALIZADO');
});

test('corregir un certificado exige el motivo', () => {
  const certificado = { numero: 'LP-CC-M-0332-2025', fecha: '2025-08-25', periodoDias: 365, ente: 'IBMETRO' };
  assert.throws(() => parse('certificadoCorreccion', certificado), /motivo de la corrección/);
  assert.equal(parse('certificadoCorreccion', { ...certificado, motivo: 'Número mal copiado' }).motivo, 'Número mal copiado');
  assert.equal(parse('certificadoRevision', {}).observaciones, null);
});
