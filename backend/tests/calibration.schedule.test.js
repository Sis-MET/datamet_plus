const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addMonths,
  buildOccurrences,
  activeAlerts,
  certificateStatus,
  todayLocal,
  verificationDates,
} = require('../src/services/calibration.schedule');

const ajustes = { alertaDias: 30, alertaFrecuencia: 'SEMANAL', alertaCorreo: true };
const equipo = (overrides = {}) => ({
  id: 1,
  codigo: 'F1-202',
  instrumento: 'Pesas Patron',
  certificado: 'LP-CC-M-0001-2025',
  certFecha: '2025-08-25',
  periodoDias: 365,
  planta: 'La Paz',
  ...overrides,
});
const plan = (input) => buildOccurrences({
  equipos: [],
  programas: [],
  eventos: [],
  desde: '2026-01-01',
  hasta: '2026-12-31',
  hoy: '2026-10-06',
  ajustes,
  ...input,
});

test('suma meses sin desbordar al mes siguiente', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(addMonths('2026-03-15', -4), '2025-11-15');
});

test('la fecha local usa la hora de Bolivia', () => {
  // 02:00 UTC del 7 de octubre todavía es 6 de octubre en La Paz.
  assert.equal(todayLocal(new Date('2026-10-07T02:00:00Z')), '2026-10-06');
});

test('la calibración vence al cumplirse el periodo del certificado en días', () => {
  const status = certificateStatus(equipo(), '2026-10-06', 30);
  assert.equal(status.vence, '2026-08-25');
  assert.equal(status.vigencia, 'VENCIDO');
  assert.equal(status.diasParaVencer, -42);
});

test('incluye la emisión del certificado y la recalibración del año', () => {
  const occurrences = plan({
    equipos: [equipo({ certFecha: '2026-02-10', periodoDias: 183 })],
    hasta: '2027-03-31',
  });
  assert.deepEqual(occurrences.map(o => [o.fecha, o.origen, o.situacion, o.proyectado]), [
    ['2026-02-10', 'CERTIFICADO', 'REALIZADO', false],
    ['2026-08-12', 'PLAN', 'VENCIDO', false],
    // Depende de que la calibración de agosto se haga: es una proyección.
    ['2027-02-11', 'PLAN', 'PROGRAMADO', true],
  ]);
});

test('marca como próxima la fecha que entra en la ventana de alerta', () => {
  // La emisión (2025) queda fuera del año consultado.
  const [proxima] = plan({ equipos: [equipo({ certFecha: '2025-10-20' })] });
  assert.equal(proxima.fecha, '2026-10-20');
  assert.equal(proxima.situacion, 'PROXIMO');
  assert.equal(proxima.diasRestantes, 14);
});

test('la verificación interna se repite dentro de cada ciclo de calibración', () => {
  const dates = verificationDates(
    equipo({ certFecha: '2026-06-11', periodoDias: 730 }),
    { frecuenciaMeses: 6, fechaInicio: null },
    '2028-12-31'
  );
  assert.deepEqual(dates.map(d => d.fecha), [
    '2026-12-11', '2027-06-11', '2027-12-11',
    // El ciclo siguiente parte de la recalibración del 2028-06-10.
    '2028-12-10',
  ]);
  assert.deepEqual(dates.map(d => d.ciclo), [0, 0, 0, 1]);
});

test('no programa una verificación encima de la recalibración', () => {
  const dates = verificationDates(
    equipo({ certFecha: '2026-01-10', periodoDias: 365 }),
    { frecuenciaMeses: 6, fechaInicio: null },
    '2026-12-31'
  );
  assert.deepEqual(dates.map(d => d.fecha), ['2026-07-10']);
});

test('con fecha de inicio la verificación sigue una serie fija', () => {
  const occurrences = plan({
    equipos: [equipo()],
    programas: [{
      id: 7, tipo: 'VERIFICACION', equipoId: 1, frecuenciaMeses: 4, fechaInicio: '2026-03-15', activo: true,
    }],
  }).filter(o => o.tipo === 'VERIFICACION');
  assert.deepEqual(occurrences.map(o => o.fecha), ['2026-03-15', '2026-07-15', '2026-11-15']);
  assert.ok(occurrences.every(o => !o.proyectado));
});

test('las actividades únicas y periódicas usan su propia alerta', () => {
  const occurrences = plan({
    programas: [
      {
        id: 3, tipo: 'ACTIVIDAD', titulo: 'Revisar política de calidad', frecuenciaMeses: 0,
        fechaInicio: '2026-10-20', activo: true, alertaDias: 7, alertaFrecuencia: 'DIARIA',
      },
      {
        id: 4, tipo: 'ACTIVIDAD', titulo: 'Documentos legales - Fundaempresa', frecuenciaMeses: 6,
        fechaInicio: '2026-01-05', activo: true,
      },
    ],
  });
  const unica = occurrences.find(o => o.serie === 'ACT-3');
  assert.equal(unica.situacion, 'PROGRAMADO');
  assert.deepEqual(unica.alerta, { dias: 7, frecuencia: 'DIARIA', correo: true });
  assert.deepEqual(occurrences.filter(o => o.serie === 'ACT-4').map(o => o.fecha), ['2026-01-05', '2026-07-05']);
});

test('aplica los cambios guardados y reprograma entre años', () => {
  const occurrences = plan({
    desde: '2027-01-01',
    hasta: '2027-12-31',
    programas: [{ id: 9, tipo: 'ACTIVIDAD', titulo: 'Auditoría', frecuenciaMeses: 12, fechaInicio: '2026-12-20', activo: true }],
    eventos: [{
      serie: 'ACT-9', fechaProgramada: '2026-12-20', fechaReprogramada: '2027-01-08', estado: 'PROGRAMADO',
    }],
  });
  assert.deepEqual(occurrences.map(o => [o.fechaProgramada, o.fecha]), [
    ['2026-12-20', '2027-01-08'],
    ['2027-12-20', '2027-12-20'],
  ]);
});

test('una calibración hecha en el módulo se une al certificado que llega después', () => {
  const occurrences = plan({
    equipos: [equipo({ certFecha: '2026-08-20', certificado: 'LP-NUEVO' })],
    eventos: [{
      serie: 'CAL-1', fechaProgramada: '2026-08-25', fechaRealizada: '2026-08-20', estado: 'REALIZADO',
    }],
  });
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].certificado, 'LP-NUEVO');
  assert.equal(occurrences[0].fecha, '2026-08-20');
});

test('excluye la calibración de un equipo desactivado en el plan', () => {
  const occurrences = plan({
    equipos: [equipo()],
    programas: [{ id: 2, tipo: 'CALIBRACION', equipoId: 1, activo: false }],
  });
  assert.equal(occurrences.length, 0);
});

test('las alertas activas omiten proyecciones y series sin alertas', () => {
  const occurrences = plan({
    equipos: [equipo({ certFecha: '2025-10-20' }), equipo({ id: 2, certFecha: '2025-10-25' })],
    programas: [{ id: 5, tipo: 'CALIBRACION', equipoId: 2, activo: true, alertaFrecuencia: 'NINGUNA' }],
  });
  assert.deepEqual(activeAlerts(occurrences).map(o => o.serie), ['CAL-1']);
});
