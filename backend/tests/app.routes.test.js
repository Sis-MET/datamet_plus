const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const env = require('../src/config/env');
const app = require('../src/app');
const { errorHandler } = require('../src/middleware/error.middleware');

const servir = async (aplicacion) => {
  const server = aplicacion.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, cerrar: () => new Promise(resolve => server.close(resolve)) };
};

test('clientes y equipos exigen sesión', async (t) => {
  const { base, cerrar } = await servir(app);
  t.after(cerrar);
  for (const ruta of ['/api/clientes', '/api/clientes/search?q=a', '/api/clientes/0121/plantas', '/api/equipos/search?q=', '/api/equipos/ABC-1']) {
    const res = await fetch(base + ruta);
    assert.equal(res.status, 401, ruta);
    const body = await res.json();
    assert.equal(body.code, 'SESSION_INVALID', ruta);
  }
});

test('una ruta de la API inexistente responde 404 en JSON, también con GET', async (t) => {
  const { base, cerrar } = await servir(app);
  t.after(cerrar);
  for (const [method, ruta] of [['GET', '/api/no-existe'], ['GET', '/api/test'], ['POST', '/api/no-existe'], ['GET', '/api']]) {
    const res = await fetch(base + ruta, { method });
    assert.equal(res.status, 404, `${method} ${ruta}`);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.equal((await res.json()).success, false);
  }
});

test('el login valida el cuerpo antes de consultar la base', async (t) => {
  const { base, cerrar } = await servir(app);
  t.after(cerrar);
  for (const body of [{}, { usuario: 'a' }, { usuario: ['a'], pass: 'b' }, { usuario: 'a', pass: { $ne: '' } }]) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test('los errores inesperados no muestran su detalle fuera de desarrollo', async (t) => {
  const prueba = express();
  prueba.get('/sql', () => { throw Object.assign(new Error("Invalid column name 'pass'."), { number: 207 }); });
  prueba.get('/conflicto', () => { throw Object.assign(new Error('El RIM ya fue anulado.'), { statusCode: 409 }); });
  prueba.use(errorHandler);
  const { base, cerrar } = await servir(prueba);
  const entorno = env.nodeEnv;
  t.after(async () => { env.nodeEnv = entorno; await cerrar(); });

  env.nodeEnv = 'production';
  let res = await fetch(`${base}/sql`);
  assert.equal(res.status, 500);
  let body = await res.json();
  assert.equal(body.message, 'Error interno del servidor');
  assert.equal(body.stack, undefined);

  res = await fetch(`${base}/conflicto`);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).message, 'El RIM ya fue anulado.');

  env.nodeEnv = 'development';
  res = await fetch(`${base}/sql`);
  body = await res.json();
  assert.equal(body.message, "Invalid column name 'pass'.");
  assert.ok(body.stack);
});
