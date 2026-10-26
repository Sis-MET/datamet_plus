const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const { crearSesiones, motivoSinAcceso } = require('../src/services/auth.session');
const { crearProtect } = require('../src/middleware/auth.middleware');

const activo = { id: 7, usuario: 'jperez', estado: 'ACTIVO', acceso: 'X', acceso_cron: 2, cargo: 'Jefe de Area', area: 'Calibración' };

test('motivoSinAcceso: solo entra el usuario activo con acceso a la aplicación', () => {
  assert.equal(motivoSinAcceso(activo), null);
  assert.equal(motivoSinAcceso({ ...activo, estado: ' activo ' }), null);
  assert.match(motivoSinAcceso({ ...activo, estado: 'DESACTIVADO' }), /desactivado/);
  assert.match(motivoSinAcceso({ ...activo, estado: null }), /desactivado/);
  assert.match(motivoSinAcceso({ ...activo, acceso_cron: 0 }), /no tiene los permisos/);
  assert.match(motivoSinAcceso({ ...activo, acceso_cron: '0' }), /no tiene los permisos/);
  assert.match(motivoSinAcceso(null), /ya no está registrado/);
});

test('la sesión toma el nivel, cargo y área vigentes de DATA_USERS', async () => {
  const consultas = [];
  const vigente = crearSesiones({ consultar: async (clave) => { consultas.push(clave); return { ...activo, acceso_cron: 3 }; } });
  const datos = await vigente({ id: 7, usuario: 'jperez', acceso_cron: 2, cargo: 'Técnico' });
  assert.deepEqual(datos, { usuario: 'jperez', acceso: 'X', acceso_cron: 3, cargo: 'Jefe de Area', area: 'Calibración' });
  assert.deepEqual(consultas, [{ id: 7, usuario: 'jperez' }]);
});

test('una baja o un cambio de nivel rige en la siguiente petición', async () => {
  let fila = { ...activo };
  const vigente = crearSesiones({ consultar: async () => fila });
  const payload = { id: 7, usuario: 'jperez' };

  assert.equal((await vigente(payload)).acceso_cron, 2);
  fila = { ...activo, acceso_cron: 1 };
  assert.equal((await vigente(payload)).acceso_cron, 1);
  fila = { ...activo, estado: 'DESACTIVADO' };
  assert.equal(await vigente(payload), null);
});

test('rechaza sesiones de usuarios sin acceso o de otra persona', async () => {
  const sesion = fila => crearSesiones({ consultar: async () => fila });
  assert.equal(await sesion({ ...activo, acceso_cron: 0 })({ id: 7, usuario: 'jperez' }), null);
  assert.equal(await sesion(null)({ id: 7, usuario: 'jperez' }), null);
  // El id ahora es de otra persona.
  assert.equal(await sesion({ ...activo, usuario: 'otro' })({ id: 7, usuario: 'jperez' }), null);
  assert.equal(await sesion(activo)({}), null);
  // Tokens antiguos sin id numérico se buscan por usuario.
  const claves = [];
  await crearSesiones({ consultar: async (c) => { claves.push(c); return activo; } })({ id: 'jperez', usuario: 'jperez' });
  assert.deepEqual(claves, [{ id: null, usuario: 'jperez' }]);
});

const llamar = async (protect, authorization) => {
  const req = { headers: authorization ? { authorization } : {} };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let siguiente = false;
  let error = null;
  await protect(req, res, (err) => { if (err) error = err; else siguiente = true; });
  return { req, res, siguiente, error };
};
const token = (payload, opciones = {}) => jwt.sign(payload, env.jwt.secret, { expiresIn: '1h', ...opciones });

test('protect: sin token, con token inválido o vencido responde SESSION_INVALID', async () => {
  const protect = crearProtect({ usuarioVigente: async () => ({ ...activo }) });
  for (const header of [undefined, 'Basic abc', 'Bearer', 'Bearer x.y.z', `Bearer ${token({ id: 7 }, { expiresIn: -10 })}`]) {
    const { res, siguiente } = await llamar(protect, header);
    assert.equal(siguiente, false, header);
    assert.equal(res.statusCode, 401, header);
    assert.equal(res.body.code, 'SESSION_INVALID', header);
  }
});

test('protect: un usuario desactivado no pasa aunque su token siga vigente', async () => {
  const protect = crearProtect({ usuarioVigente: async () => null });
  const { res, siguiente } = await llamar(protect, `Bearer ${token({ id: 7, usuario: 'jperez', acceso_cron: 3 })}`);
  assert.equal(siguiente, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'SESSION_INVALID');
  assert.match(res.body.message, /ya no está activo/);
});

test('protect: req.user lleva el nivel vigente, no el del token', async () => {
  const protect = crearProtect({ usuarioVigente: async () => ({ usuario: 'jperez', acceso: 'X', acceso_cron: 1, cargo: 'Técnico', area: 'Soporte Técnico' }) });
  const { req, siguiente } = await llamar(protect, `Bearer ${token({ id: 7, usuario: 'jperez', acceso_cron: 3, cargo: 'Jefe de Area' })}`);
  assert.equal(siguiente, true);
  assert.equal(req.user.id, 7);
  assert.equal(req.user.acceso_cron, 1);
  assert.equal(req.user.cargo, 'Técnico');
  assert.equal(req.user.area, 'Soporte Técnico');
});

test('protect: si la base falla, el error pasa al manejador', async () => {
  const falla = new Error('Timeout');
  const protect = crearProtect({ usuarioVigente: async () => { throw falla; } });
  const { error, siguiente } = await llamar(protect, `Bearer ${token({ id: 7, usuario: 'jperez' })}`);
  assert.equal(siguiente, false);
  assert.equal(error, falla);
});
