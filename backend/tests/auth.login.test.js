const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const { verifyToken } = require('../src/utils/jwt.utils');

let usuarios = [];
class Request {
  constructor() { this.p = {}; }
  input(key, _tipo, value) { this.p[key] = value; return this; }
  async query(query) {
    assert.match(query, /FROM DATA_USERS/);
    assert.doesNotMatch(query, /SELECT \*/);
    const fila = usuarios.find(u => u.usuario.toLowerCase() === String(this.p.usuario).toLowerCase());
    return { recordset: fila ? [structuredClone(fila)] : [] };
  }
}
db.getPool = () => ({ request: () => new Request() });
const { loginUser, mismaClave } = require('../src/services/auth.service');

usuarios = [
  { id: 1, usuario: 'activo', pass: 'Clave#1', nombre1: 'Ana', apellido1: 'Paz', cargo: 'Técnico', area: 'Soporte Técnico', acceso: 'X', acceso_cron: 2, estado: 'ACTIVO' },
  { id: 2, usuario: 'baja', pass: 'Clave#2', nombre1: 'Luis', apellido1: 'Rojas', cargo: 'Técnico', area: 'Calibración', acceso: 'X', acceso_cron: 2, estado: 'DESACTIVADO' },
  { id: 3, usuario: 'sinacceso', pass: 'Clave#3', nombre1: 'Eva', apellido1: 'Luna', cargo: '', area: '', acceso: '', acceso_cron: 0, estado: 'ACTIVO' },
];
const rechazo = codigo => error => error.statusCode === codigo;

test('mismaClave distingue la contraseña exacta', () => {
  assert.equal(mismaClave('Clave#1', 'Clave#1'), true);
  assert.equal(mismaClave('Clave#1', 'clave#1'), false);
  assert.equal(mismaClave('Clave#1', 'Clave#1 '), false);
  assert.equal(mismaClave(null, ''), false);
  assert.equal(mismaClave('Clave#1', undefined), false);
});

test('un usuario activo inicia sesión y recibe su token', async () => {
  const { user, token } = await loginUser({ usuario: 'activo', pass: 'Clave#1', ip: '10.0.0.1' });
  assert.equal(user.usuario, 'activo');
  assert.equal(user.area, 'Soporte Técnico');
  const payload = verifyToken(token);
  assert.equal(payload.id, 1);
  assert.equal(payload.acceso_cron, 2);
});

test('un usuario desactivado no entra aunque la contraseña sea correcta', async () => {
  await assert.rejects(loginUser({ usuario: 'baja', pass: 'Clave#2', ip: '10.0.0.2' }), (error) => {
    assert.equal(error.statusCode, 403);
    assert.match(error.message, /desactivado/);
    return true;
  });
});

test('un perfil sin acceso a la aplicación no entra', async () => {
  await assert.rejects(loginUser({ usuario: 'sinacceso', pass: 'Clave#3', ip: '10.0.0.3' }), (error) => {
    assert.equal(error.statusCode, 403);
    assert.match(error.message, /no tiene los permisos/);
    return true;
  });
});

test('3 contraseñas erróneas bloquean al usuario en ese equipo, no en otro', async () => {
  const ip = '10.0.0.4';
  for (let i = 0; i < 3; i += 1) {
    await assert.rejects(loginUser({ usuario: 'activo', pass: 'mal', ip }), rechazo(401));
  }
  await assert.rejects(loginUser({ usuario: 'activo', pass: 'Clave#1', ip }), rechazo(429));
  const { user } = await loginUser({ usuario: 'activo', pass: 'Clave#1', ip: '10.0.0.5' });
  assert.equal(user.usuario, 'activo');
});

test('un usuario inexistente responde igual que una contraseña errónea', async () => {
  await assert.rejects(loginUser({ usuario: 'nadie', pass: 'x', ip: '10.0.0.6' }), (error) => {
    assert.equal(error.statusCode, 401);
    assert.equal(error.message, 'Credenciales inválidas');
    return true;
  });
});
