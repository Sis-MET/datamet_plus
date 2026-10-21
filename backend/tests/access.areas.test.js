const test = require('node:test');
const assert = require('node:assert/strict');
const { esSistemas, mensajeSinAcceso, permiteArea } = require('../src/services/access.areas');
const { requireArea } = require('../src/middleware/area.middleware');

test('cada apartado lo usa su área, y Sistemas (nivel 3) entra a todos', () => {
  assert.equal(permiteArea('calibracion', { area: 'Calibración', acceso_cron: 2 }), true);
  assert.equal(permiteArea('calibracion', { area: ' CALIBRACION ', acceso_cron: '2' }), true);
  assert.equal(permiteArea('calibracion', { area: 'Soporte Técnico', acceso_cron: 2 }), false);
  assert.equal(permiteArea('soporte', { area: 'Soporte Técnico', acceso_cron: 2 }), true);
  assert.equal(permiteArea('soporte', { area: 'Calibración', acceso_cron: 2 }), false);
  assert.equal(permiteArea('soporte', { area: 'Comercial', acceso_cron: 2 }), false);
  assert.equal(permiteArea('soporte', { area: 'Administración', acceso_cron: 3 }), true);
  assert.equal(permiteArea('calibracion', { area: null, acceso_cron: '3' }), true);
  assert.equal(permiteArea('soporte', {}), false);
  assert.throws(() => permiteArea('compras', { area: 'Compras' }), /Apartado desconocido/);
  assert.equal(esSistemas({ acceso_cron: '3' }), true);
  assert.equal(esSistemas({ acceso_cron: 2 }), false);
});

const llamar = async (modulo, user) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let siguiente = false;
  await requireArea(modulo)({ user }, res, () => { siguiente = true; });
  return { siguiente, res };
};

test('el middleware deja pasar a Sistemas y bloquea a quien no es del área', async () => {
  const sistemas = await llamar('soporte', { id: 'Barrau', acceso_cron: '3' });
  assert.equal(sistemas.siguiente, true);

  // Sin un id numérico no hay usuario activo que consultar: se bloquea.
  const otro = await llamar('calibracion', { id: 'qa', acceso_cron: '2' });
  assert.equal(otro.siguiente, false);
  assert.equal(otro.res.statusCode, 403);
  assert.equal(otro.res.body.code, 'AREA_ACCESS_DENIED');
  assert.equal(otro.res.body.message, mensajeSinAcceso('calibracion'));
  assert.match(otro.res.body.message, /área de Calibración/);
});
