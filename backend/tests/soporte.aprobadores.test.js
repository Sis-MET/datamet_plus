const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const transacciones = require('../src/services/calibration.db');
const { parse } = require('../src/services/soporte.validation');
let datos;
const jefe = { id: 1, usuario: 'jefe' };
class Request {
  constructor() { this.p = {}; }
  input(key, _tipo, value) { this.p[key] = value; return this; }
  async query(query) {
    const result = rows => ({ recordset: structuredClone(rows) });
    if (query.includes('FROM DATA_USERS')) return result(datos.personal.filter(row => row.estado === 'ACTIVO' && (!query.includes('WHERE id =') || row.id === this.p.id)));
    if (query.includes('DELETE FROM dbo.ST_APROBADORES')) {
      // Sin OPENJSON: la base trabaja con nivel de compatibilidad 110.
      assert.doesNotMatch(query, /OPENJSON/);
      const ids = [...query.matchAll(/\(@(id\d+), @usuario\)/g)].map(([, nombre]) => this.p[nombre]);
      datos.ids = ids; return result([]);
    }
    if (query.includes('UPDATE dbo.ST_APROBADORES_AJUSTES')) {
      datos.ajustes = { version: this.p.version, actualizado_por: this.p.usuario, actualizado_en: '2026-10-23T12:00:00Z' };
      datos.historial.push({ ...this.p }); return result([]);
    }
    if (query.includes('FROM dbo.ST_APROBADORES_AJUSTES')) return result([datos.ajustes]);
    if (query.includes('FROM dbo.ST_APROBADORES')) return result(datos.ids.map(usuario_id => ({ usuario_id })));
    throw new Error(`SQL inesperado: ${query}`);
  }
}
db.getPool = () => ({ request: () => new Request() });
transacciones.withTransaction = async fn => {
  const antes = structuredClone(datos);
  try { return await fn(() => new Request()); } catch (error) { datos = antes; throw error; }
};
const service = require('../src/services/soporte.aprobadores');
const reset = () => {
  datos = { ids: [], ajustes: { version: 1 }, historial: [], personal: [
    { id: 1, usuario: 'jefe', nombre: 'Jefe QA', area: 'Soporte Técnico', cargo: 'Jefe de Area', estado: 'ACTIVO' },
    { id: 2, usuario: 'tecnico1', nombre: 'Ana QA', area: 'Soporte Técnico', cargo: 'Técnico', estado: 'ACTIVO' },
    { id: 3, usuario: 'tecnico2', nombre: 'Luis QA', area: 'Soporte Técnico', cargo: 'Técnico', estado: 'ACTIVO' },
    { id: 4, usuario: 'sistemas', area: 'Sistemas', cargo: 'Jefe de Area', estado: 'ACTIVO' },
    { id: 5, usuario: 'baja', area: 'Soporte Técnico', cargo: 'Técnico', estado: 'INACTIVO' },
  ] };
};
const body = (ids, version = datos.ajustes.version) => parse('aprobadores', { version, aprobadores: ids });
const codigo = n => e => e.statusCode === n;

test('el jefe designa varios aprobadores, revoca y conserva un historial versionado', async () => {
  reset();
  const inicial = await service.obtener(jefe);
  assert.deepEqual(inicial.personal.map(row => row.id).sort(), [1, 2, 3]);
  assert.equal(inicial.personal[0].esJefe, true);
  assert.equal(inicial.personal[0].autorizado, true);
  const nuevo = await service.guardar(body([2, 3]), jefe);
  assert.equal(nuevo.version, 2); assert.deepEqual(nuevo.aprobadores.sort(), [2, 3]);
  assert.equal(datos.historial[0].usuario, 'jefe');
  assert.deepEqual(JSON.parse(datos.historial[0].nuevos), [2, 3]);
  await service.guardar(body([3, 2]), jefe);
  assert.equal(datos.historial.length, 1); // Guardar lo mismo no genera eventos falsos.
  await assert.rejects(service.guardar(body([], 1), jefe), codigo(409));
  assert.deepEqual(datos.ids, [2, 3]);
  await service.guardar(body([]), jefe);
  assert.deepEqual(datos.ids, []); assert.equal(datos.historial.length, 2);
  assert.equal((await service.obtener(jefe)).personal[0].autorizado, true);
});

test('ni un técnico delegado ni Sistemas pueden configurar; manda el personal vigente de la BD', async () => {
  reset(); datos.ids = [2];
  for (const actor of [{ id: 2, cargo: 'Jefe de Area' }, { id: 4, acceso_cron: 3 }, { id: 5 }, {}]) {
    await assert.rejects(service.obtener(actor), codigo(403));
    await assert.rejects(service.guardar(body([3]), actor), codigo(403));
  }
  datos.personal[0].estado = 'INACTIVO';
  await assert.rejects(service.guardar(body([3]), jefe), codigo(403));
  assert.deepEqual(datos.ids, [2]); assert.equal(datos.historial.length, 0);
});

test('no acepta personal externo, dado de baja, inexistente ni delega nuevamente al jefe', async () => {
  reset();
  for (const id of [1, 4, 5, 999]) await assert.rejects(service.guardar(body([2, id]), jefe), codigo(400));
  assert.deepEqual(datos.ids, []); assert.equal(datos.historial.length, 0);
  datos.ids = [5];
  assert.deepEqual((await service.obtener(jefe)).aprobadores, []);
  await service.guardar(body([3]), jefe);
  assert.deepEqual(JSON.parse(datos.historial[0].anteriores), [5]);
});
