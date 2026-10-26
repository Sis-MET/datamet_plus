const test = require('node:test');
const assert = require('node:assert/strict');
const { crearLimitador } = require('../src/services/auth.attempts');

const reloj = (inicio = 1_000_000) => {
  let t = inicio;
  return { now: () => t, avanzar: ms => { t += ms; } };
};
const bloqueado = (fn) => {
  try { fn(); return null; } catch (error) { return error; }
};

test('3 fallos bloquean al usuario solo desde ese equipo, durante 60 s', () => {
  const { now, avanzar } = reloj();
  const limitador = crearLimitador({ now });
  const desdeA = { usuario: 'jperez', ip: '192.168.1.20' };
  const desdeB = { usuario: 'jperez', ip: '192.168.1.30' };

  limitador.fallo(desdeA);
  limitador.fallo(desdeA);
  assert.equal(bloqueado(() => limitador.verificar(desdeA)), null);
  limitador.fallo(desdeA);

  const error = bloqueado(() => limitador.verificar(desdeA));
  assert.equal(error.statusCode, 429);
  assert.equal(error.remainingSecs, 60);
  assert.match(error.message, /Cuenta bloqueada/);
  // El dueño de la cuenta sigue entrando desde su equipo.
  assert.equal(bloqueado(() => limitador.verificar(desdeB)), null);
  // Mayúsculas y espacios no esquivan el bloqueo.
  assert.ok(bloqueado(() => limitador.verificar({ usuario: ' JPerez ', ip: '192.168.1.20' })));

  avanzar(60 * 1000);
  assert.equal(bloqueado(() => limitador.verificar(desdeA)), null);
  // Vencido el bloqueo, vuelve a tener 3 intentos.
  limitador.fallo(desdeA);
  assert.equal(bloqueado(() => limitador.verificar(desdeA)), null);
});

test('un ingreso correcto olvida los fallos de ese usuario', () => {
  const { now } = reloj();
  const limitador = crearLimitador({ now });
  const intento = { usuario: 'ana', ip: '10.8.0.5' };
  limitador.fallo(intento);
  limitador.fallo(intento);
  limitador.exito(intento);
  limitador.fallo(intento);
  limitador.fallo(intento);
  assert.equal(bloqueado(() => limitador.verificar(intento)), null);
});

test('20 fallos desde un equipo, con cualquier usuario, bloquean el equipo 15 min', () => {
  const { now, avanzar } = reloj();
  const limitador = crearLimitador({ now });
  const ip = '10.8.0.9';
  for (let i = 0; i < 19; i += 1) limitador.fallo({ usuario: `usuario${i}`, ip });
  assert.equal(bloqueado(() => limitador.verificar({ usuario: 'otro', ip })), null);
  limitador.fallo({ usuario: 'usuario19', ip });

  const error = bloqueado(() => limitador.verificar({ usuario: 'otro', ip }));
  assert.equal(error.statusCode, 429);
  assert.equal(error.remainingSecs, 15 * 60);
  assert.match(error.message, /desde este equipo.*15 minutos/);
  assert.equal(bloqueado(() => limitador.verificar({ usuario: 'otro', ip: '10.8.0.10' })), null);

  avanzar(15 * 60 * 1000);
  assert.equal(bloqueado(() => limitador.verificar({ usuario: 'otro', ip })), null);
});

test('los fallos de un equipo se cuentan en ventanas de 15 min', () => {
  const { now, avanzar } = reloj();
  const limitador = crearLimitador({ now });
  const ip = '10.8.0.11';
  for (let i = 0; i < 19; i += 1) limitador.fallo({ usuario: `u${i}`, ip });
  avanzar(15 * 60 * 1000);
  limitador.fallo({ usuario: 'u19', ip });
  assert.equal(bloqueado(() => limitador.verificar({ usuario: 'otro', ip })), null);
});
