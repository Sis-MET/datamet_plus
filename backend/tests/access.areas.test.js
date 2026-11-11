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

test('Comercial solo consulta Soporte técnico; Calibración sigue cerrada', () => {
  const { nivelDeArea, permiteConsulta } = require('../src/services/access.areas');
  assert.equal(permiteConsulta('soporte', { area: 'Comercial' }), true);
  assert.equal(permiteConsulta('soporte', { area: ' COMERCIAL ' }), true);
  assert.equal(permiteConsulta('soporte', { area: 'Calibración' }), false);
  assert.equal(permiteConsulta('soporte', { area: null }), false);
  assert.equal(permiteConsulta('calibracion', { area: 'Comercial' }), false);
  assert.equal(nivelDeArea('soporte', { area: 'Comercial', acceso_cron: 2 }), 'consulta');
  assert.equal(nivelDeArea('soporte', { area: 'Soporte Técnico', acceso_cron: 2 }), 'area');
  // Sistemas usa el apartado completo aunque su área sea otra.
  assert.equal(nivelDeArea('soporte', { area: 'Comercial', acceso_cron: 3 }), 'area');
  assert.equal(nivelDeArea('calibracion', { area: 'Comercial', acceso_cron: 2 }), null);
  assert.equal(nivelDeArea('soporte', { area: 'Gerencia', acceso_cron: 2 }), null);
  assert.throws(() => permiteConsulta('compras', { area: 'Comercial' }), /Apartado desconocido/);
});

test('soloArea deja pasar al área y rechaza a quien entró a consultar', () => {
  const { soloArea } = require('../src/middleware/area.middleware');
  const respuesta = () => ({
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  let siguiente = 0;
  const area = respuesta();
  soloArea('soporte')({ accesoArea: 'area' }, area, () => { siguiente += 1; });
  assert.equal(siguiente, 1);
  for (const accesoArea of ['consulta', undefined]) {
    const res = respuesta();
    soloArea('soporte')({ accesoArea }, res, () => { siguiente += 1; });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'AREA_ACCESS_DENIED');
    assert.match(res.body.message, /solo consulta/);
  }
  assert.equal(siguiente, 1);
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
  const conConsulta = { user: { id: 'Barrau', acceso_cron: '3' } };
  await requireArea('soporte', { consulta: true })(conConsulta, {}, () => {});
  assert.equal(conConsulta.accesoArea, 'area');

  // Sin un id numérico no hay usuario activo que consultar: se bloquea.
  const otro = await llamar('calibracion', { id: 'qa', acceso_cron: '2' });
  assert.equal(otro.siguiente, false);
  assert.equal(otro.res.statusCode, 403);
  assert.equal(otro.res.body.code, 'AREA_ACCESS_DENIED');
  assert.equal(otro.res.body.message, mensajeSinAcceso('calibracion'));
  assert.match(otro.res.body.message, /área de Calibración/);
});
