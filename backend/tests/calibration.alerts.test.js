const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDigests, decideAlert, renderDigestEmail } = require('../src/services/calibration.alerts');

const occurrence = (overrides = {}) => ({
  serie: 'VER-1',
  tipo: 'VERIFICACION',
  fechaProgramada: '2026-11-05',
  fechaPlan: '2026-11-05',
  situacion: 'PROXIMO',
  diasRestantes: 30,
  proyectado: false,
  codigo: 'F1-202',
  instrumento: 'Pesas Patron',
  responsableId: 10,
  alerta: { dias: 30, frecuencia: 'SEMANAL', correo: true },
  ...overrides,
});

test('avisa al entrar en la ventana y luego una vez por semana', () => {
  const hoy = '2026-10-06';
  assert.equal(decideAlert(occurrence(), [], hoy), 'PREVIO');
  assert.equal(decideAlert(occurrence(), [{ motivo: 'PREVIO', fechaLocal: '2026-10-01' }], hoy), null);
  assert.equal(decideAlert(occurrence(), [{ motivo: 'PREVIO', fechaLocal: '2026-09-29' }], hoy), 'PREVIO');
});

test('la frecuencia única avisa una sola vez antes y una al vencer', () => {
  const unica = { dias: 30, frecuencia: 'UNICA', correo: true };
  const history = [{ motivo: 'PREVIO', fechaLocal: '2026-09-01' }];
  assert.equal(decideAlert(occurrence({ alerta: unica }), history, '2026-10-06'), null);
  assert.equal(
    decideAlert(occurrence({ alerta: unica, situacion: 'VENCIDO', diasRestantes: -2 }), history, '2026-10-06'),
    'VENCIDO'
  );
});

test('el mismo día siempre avisa, salvo que ya se haya enviado hoy', () => {
  const hoy = occurrence({ diasRestantes: 0 });
  assert.equal(decideAlert(hoy, [{ motivo: 'PREVIO', fechaLocal: '2026-10-04' }], '2026-10-06'), 'HOY');
  assert.equal(decideAlert(hoy, [{ motivo: 'PREVIO', fechaLocal: '2026-10-06' }], '2026-10-06'), null);
});

test('no avisa sin correo, sin alertas, en proceso o en proyecciones', () => {
  const hoy = '2026-10-06';
  assert.equal(decideAlert(occurrence({ alerta: { dias: 30, frecuencia: 'SEMANAL', correo: false } }), [], hoy), null);
  assert.equal(decideAlert(occurrence({ alerta: { dias: 30, frecuencia: 'NINGUNA', correo: true } }), [], hoy), null);
  assert.equal(decideAlert(occurrence({ situacion: 'EN_PROCESO' }), [], hoy), null);
  assert.equal(decideAlert(occurrence({ proyectado: true }), [], hoy), null);
});

test('agrupa un correo por destinatario con el responsable y quienes reciben todo', () => {
  const contactos = [
    { id: 1, usuarioId: 10, nombre: 'Responsable', email: 'Resp@Metrica.bo', recibeTodas: false, activo: true },
    { id: 2, usuarioId: 11, nombre: 'Jefa', email: 'jefa@metrica.bo', recibeTodas: true, activo: true },
    { id: 3, usuarioId: 12, nombre: 'Otro', email: 'otro@metrica.bo', recibeTodas: false, activo: true },
    { id: 4, usuarioId: 13, nombre: 'Baja', email: 'baja@metrica.bo', recibeTodas: true, activo: false },
  ];
  const digests = buildDigests({
    alerts: [
      occurrence(),
      occurrence({ serie: 'ACT-2', tipo: 'ACTIVIDAD', titulo: 'Fundaempresa', responsableId: null, situacion: 'VENCIDO', diasRestantes: -3 }),
    ],
    contactos,
    history: [{ serie: 'VER-1', fechaProgramada: '2026-11-05', email: 'resp@metrica.bo', motivo: 'PREVIO', fechaLocal: '2026-10-05' }],
    hoy: '2026-10-06',
  });

  assert.deepEqual(digests.map(d => [d.email, d.items.map(i => i.motivo)]), [
    ['jefa@metrica.bo', ['VENCIDO', 'PREVIO']],
  ]);
});

test('el correo resume vencidas y próximas', () => {
  const email = renderDigestEmail({
    nombre: 'Ana',
    appUrl: 'http://192.168.1.5:3000',
    items: [
      { motivo: 'VENCIDO', occurrence: occurrence({ tipo: 'CALIBRACION', diasRestantes: -4 }) },
      { motivo: 'PREVIO', occurrence: occurrence({ diasRestantes: 12 }) },
    ],
  });
  assert.equal(email.subject, 'Calibración: 1 vencida y 1 próxima');
  assert.match(email.html, /Vencida hace 4 días/);
  assert.match(email.text, /En 12 días/);
});
