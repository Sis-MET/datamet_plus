const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const transacciones = require('../src/services/calibration.db');

// Endpoints de Gestión de permisos y de los tiempos de servicio con la
// aplicación real (sesión, reglas de área y permisos) sobre una base simulada.
const PERSONAL = [
  { id: 22, usuario: 'Barrau', nombre: 'Jhonatan Barrau', area: 'Administración', cargo: 'Auxiliar de Sistemas', acceso_cron: 3 },
  { id: 11, usuario: 'Telleria', nombre: 'Ramiro Telleria', area: 'Administración', cargo: 'Jefe de Area', acceso_cron: 2 },
  { id: 12, usuario: 'Dorado', nombre: 'Richard Dorado', area: 'Administración', cargo: 'Jefe de Area', acceso_cron: 2 },
  { id: 2, usuario: 'Delgado', nombre: 'Edgar Delgado', area: 'Comercial', cargo: 'Jefe de Area', acceso_cron: 2 },
  { id: 3, usuario: 'Rojas', nombre: 'Ana Rojas', area: 'Comercial', cargo: 'Auxiliar Comercial', acceso_cron: 2 },
  { id: 8, usuario: 'Velasquez', nombre: 'Jose Velasquez', area: 'Soporte Técnico', cargo: 'Jefe de Area', acceso_cron: 2 },
  { id: 9, usuario: 'Paz', nombre: 'Bruno Paz', area: 'Calibración', cargo: 'Técnico', acceso_cron: 2 },
].map(persona => ({ ...persona, estado: 'ACTIVO', acceso: '' }));

let concesiones;
let historial;
const reiniciar = () => {
  concesiones = [
    { id: 1, permiso: 'tiempos.soporte.ver', usuario_id: null, area: null, cargo: 'jefe de area', concedido_por: 'migración 029', concedido_en: '2026-11-13T15:00:00', revocado_en: null },
    { id: 2, permiso: 'tiempos.calibracion.ver', usuario_id: null, area: null, cargo: 'jefe de area', concedido_por: 'migración 029', concedido_en: '2026-11-13T15:00:00', revocado_en: null },
  ];
  historial = [];
};

class Request {
  constructor() { this.params = {}; }
  input(nombre, _tipo, valor) { this.params[nombre] = valor; return this; }
  async query(texto) {
    const p = this.params;
    const filas = rows => ({ recordset: structuredClone(rows), rowsAffected: [rows.length] });
    if (texto.includes('FROM DATA_USERS')) {
      return filas(texto.includes('WHERE id = @id') ? PERSONAL.filter(persona => persona.id === p.id) : PERSONAL);
    }
    if (texto.includes('INSERT INTO dbo.APP_PERMISOS_CONCESIONES')) {
      const id = concesiones.length + 1;
      concesiones.push({ id, permiso: p.permiso, usuario_id: p.usuarioId, area: p.area, cargo: p.cargo, concedido_por: p.usuario, revocado_en: null });
      return filas([{ id }]);
    }
    if (texto.includes('UPDATE dbo.APP_PERMISOS_CONCESIONES')) {
      const fila = concesiones.find(c => c.id === p.id && !c.revocado_en);
      if (fila) fila.revocado_en = '2026-11-13T17:00:00';
      return { recordset: [], rowsAffected: [fila ? 1 : 0] };
    }
    if (texto.includes('INSERT INTO dbo.APP_PERMISOS_HISTORIAL')) {
      historial.push({ ...p });
      return filas([]);
    }
    if (texto.includes('FROM dbo.APP_PERMISOS_HISTORIAL')) return filas([]);
    if (texto.includes('FROM dbo.APP_PERMISOS_CONCESIONES')) {
      return filas(concesiones.filter(c => !c.revocado_en && (!p.permiso || c.permiso === p.permiso)));
    }
    throw new Error(`Consulta no simulada: ${texto}`);
  }
}
db.getPool = () => ({ request: () => new Request() });
transacciones.withTransaction = async trabajo => trabajo(() => new Request());

const app = require('../src/app');
const { generateToken } = require('../src/utils/jwt.utils');

const servir = async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, cerrar: () => new Promise(resolve => server.close(resolve)) };
};

const como = (id) => {
  const persona = PERSONAL.find(item => item.id === id);
  return { Authorization: `Bearer ${generateToken({ id, usuario: persona.usuario, acceso_cron: persona.acceso_cron })}` };
};

const pedir = async (base, id, ruta, { method = 'GET', body } = {}) => {
  const res = await fetch(base + ruta, {
    method,
    headers: { ...como(id), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json() };
};

test('«mis permisos» responde a todo usuario con sesión y sin sesión pide iniciarla', async (t) => {
  reiniciar();
  const { base, cerrar } = await servir();
  t.after(cerrar);
  assert.equal((await fetch(`${base}/api/sistema/permisos/mios`)).status, 401);
  let res = await pedir(base, 2, '/api/sistema/permisos/mios');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.permisos, ['tiempos.soporte.ver', 'tiempos.calibracion.ver']);
  res = await pedir(base, 9, '/api/sistema/permisos/mios');
  assert.deepEqual(res.body.data, { permisos: [], gestionar: false });
  res = await pedir(base, 22, '/api/sistema/permisos/mios');
  assert.equal(res.body.data.gestionar, true);
});

test('la gestión de permisos solo la abren y modifican Sistemas y el jefe de Sistemas', async (t) => {
  reiniciar();
  const { base, cerrar } = await servir();
  t.after(cerrar);
  for (const [metodo, ruta, body] of [
    ['GET', '/api/sistema/permisos'],
    ['GET', '/api/sistema/permisos/historial'],
    ['POST', '/api/sistema/permisos/concesiones', { permiso: 'tiempos.soporte.ver', tipo: 'PERSONA', usuarioId: 3, motivo: 'x' }],
    ['POST', '/api/sistema/permisos/concesiones/1/revocacion', { motivo: 'x' }],
  ]) {
    for (const id of [11, 2, 8, 3]) {
      const res = await pedir(base, id, ruta, { method: metodo, body });
      assert.equal(res.status, 403, `${metodo} ${ruta} (persona ${id})`);
      assert.equal(res.body.code, 'PERMISO_DENEGADO');
    }
  }
  assert.equal(concesiones.length, 2);
  assert.equal(historial.length, 0);

  let res = await pedir(base, 22, '/api/sistema/permisos');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.personal.some(persona => persona.nombre === 'Ana Rojas' && persona.area === 'Comercial'));
  // El jefe de Sistemas también la abre y su menú lo sabe.
  res = await pedir(base, 12, '/api/sistema/permisos');
  assert.equal(res.status, 200);
  assert.equal((await pedir(base, 12, '/api/sistema/permisos/mios')).body.data.gestionar, true);
  assert.equal((await pedir(base, 11, '/api/sistema/permisos/mios')).body.data.gestionar, false);

  res = await pedir(base, 22, '/api/sistema/permisos/concesiones', { method: 'POST', body: { permiso: 'tiempos.soporte.ver', tipo: 'PERSONA', usuarioId: 3 } });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /por qué se concede/);

  res = await pedir(base, 22, '/api/sistema/permisos/concesiones', {
    method: 'POST', body: { permiso: 'tiempos.soporte.ver', tipo: 'PERSONA', usuarioId: 3, motivo: 'Arma los reportes a los clientes' },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.personal.find(persona => persona.id === 3).permisos.some(p => p.clave === 'tiempos.soporte.ver'));
  assert.equal(historial.length, 1);

  res = await pedir(base, 22, '/api/sistema/permisos/concesiones/3/revocacion', { method: 'POST', body: { motivo: 'Ya no lo necesita' } });
  assert.equal(res.status, 200);
  assert.equal(historial.at(-1).accion, 'REVOCAR');
  res = await pedir(base, 22, '/api/sistema/permisos/concesiones/abc/revocacion', { method: 'POST', body: { motivo: 'x' } });
  assert.equal(res.status, 400);
});

test('los jefes de área de todas las áreas llegan a los tiempos de servicio; el resto recibe 403', async (t) => {
  reiniciar();
  const { base, cerrar } = await servir();
  t.after(cerrar);
  // Sin período el servicio responde 400: la petición pasó la sesión, el área y el permiso.
  for (const ruta of ['/api/soporte/tiempos', '/api/calibracion/tiempos']) {
    for (const id of [11, 2, 8, 22]) {
      const res = await pedir(base, id, ruta);
      assert.equal(res.status, 400, `${ruta} (persona ${id})`);
      assert.match(res.body.message, /fecha|período|desde/i);
    }
    for (const id of [3, 9]) {
      const res = await pedir(base, id, ruta);
      assert.equal(res.status, 403, `${ruta} (persona ${id})`);
      assert.equal(res.body.code, 'PERMISO_DENEGADO');
    }
  }
  // Revocado el permiso, el jefe de Comercial deja de verlos en la siguiente petición.
  concesiones[0].revocado_en = '2026-11-13T18:00:00';
  assert.equal((await pedir(base, 2, '/api/soporte/tiempos')).status, 403);
  assert.equal((await pedir(base, 2, '/api/calibracion/tiempos')).status, 400);
});

test('el permiso de los tiempos no abre el resto del apartado: sigue la regla del área', async (t) => {
  reiniciar();
  const { base, cerrar } = await servir();
  t.after(cerrar);
  let res = await pedir(base, 8, '/api/calibracion/plan');
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'AREA_ACCESS_DENIED');
  res = await pedir(base, 11, '/api/soporte/informes');
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'AREA_ACCESS_DENIED');
  // Comercial consulta, pero lo demás de Soporte sigue cerrado.
  res = await pedir(base, 2, '/api/soporte/avisos');
  assert.equal(res.status, 403);
});
