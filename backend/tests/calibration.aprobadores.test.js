const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const transacciones = require('../src/services/calibration.db');
const { parse } = require('../src/services/soporte.validation');

let datos;
class Request {
  constructor() { this.p = {}; }
  input(key, _tipo, value) { this.p[key] = value; return this; }
  async query(query) {
    const result = rows => ({ recordset: structuredClone(rows) });
    assert.doesNotMatch(query, /ST_APROBADORES/); // cada área con sus tablas
    if (query.includes('AS delegado')) {
      const fila = datos.personal.find(row => row.estado === 'ACTIVO' && row.id === this.p.id);
      return result(fila ? [{ ...fila, delegado: datos.ids.includes(fila.id) ? 1 : 0 }] : []);
    }
    if (query.includes('FROM DATA_USERS')) return result(datos.personal.filter(row => row.estado === 'ACTIVO' && (!query.includes('WHERE id =') || row.id === this.p.id)));
    if (query.includes('DELETE FROM dbo.CAL_APROBADORES')) {
      datos.ids = [...query.matchAll(/\(@(id\d+), @usuario\)/g)].map(([, nombre]) => this.p[nombre]);
      return result([]);
    }
    if (query.includes('UPDATE dbo.CAL_APROBADORES_AJUSTES')) {
      datos.ajustes = { version: this.p.version, actualizado_por: this.p.usuario, actualizado_en: '2026-11-06T12:00:00Z' };
      datos.historial.push({ ...this.p }); return result([]);
    }
    if (query.includes('FROM dbo.CAL_APROBADORES_AJUSTES')) return result([datos.ajustes]);
    if (query.includes('FROM dbo.CAL_APROBADORES')) return result(datos.ids.map(usuario_id => ({ usuario_id })));
    throw new Error(`SQL inesperado: ${query}`);
  }
}
db.getPool = () => ({ request: () => new Request() });
transacciones.withTransaction = async fn => {
  const antes = structuredClone(datos);
  try { return await fn(() => new Request()); } catch (error) { datos = antes; throw error; }
};
const service = require('../src/services/calibration.aprobadores');
const { permisosDe } = require('../src/services/calibration.registros');

const reset = () => {
  datos = { ids: [], ajustes: { version: 1 }, historial: [], personal: [
    { id: 1, usuario: 'vallejos', nombre: 'Jefe QA', area: 'Calibración', cargo: 'Jefe de Área', estado: 'ACTIVO' },
    { id: 2, usuario: 'ortuno', nombre: 'Ing. QA', area: 'CALIBRACION', cargo: 'Ingeniero', estado: 'ACTIVO' },
    { id: 3, usuario: 'garcia', nombre: 'Téc. QA', area: 'Calibración', cargo: 'Técnico', estado: 'ACTIVO' },
    { id: 4, usuario: 'sistemas', area: 'Sistemas', cargo: 'Jefe de Area', estado: 'ACTIVO' },
    { id: 5, usuario: 'soporte', area: 'Soporte Técnico', cargo: 'Técnico', estado: 'ACTIVO' },
  ] };
};
const body = (ids, version = datos.ajustes.version) => parse('aprobadores', { version, aprobadores: ids });
const codigo = n => e => e.statusCode === n;
const usuario = id => ({ id, usuario: datos.personal.find(p => p.id === id).usuario, acceso_cron: id === 4 ? '3' : '1' });

test('el jefe de Calibración designa aprobadores de su área, con versión e historial', async () => {
  reset();
  const inicial = await service.obtener(usuario(1));
  assert.deepEqual(inicial.personal.map(p => p.id).sort(), [1, 2, 3]);
  assert.equal(inicial.personal[0].esJefe, true);
  const nuevo = await service.guardar(body([2]), usuario(1));
  assert.equal(nuevo.version, 2);
  assert.deepEqual(nuevo.aprobadores, [2]);
  assert.deepEqual(JSON.parse(datos.historial[0].nuevos), [2]);
  // Personal de otra área, el jefe o una versión vieja no se aceptan.
  await assert.rejects(service.guardar(body([5]), usuario(1)), codigo(400));
  await assert.rejects(service.guardar(body([1]), usuario(1)), codigo(400));
  await assert.rejects(service.guardar(body([3], 1), usuario(1)), codigo(409));
  // Solo el jefe de Calibración configura: ni Sistemas ni otro jefe.
  await assert.rejects(service.obtener(usuario(4)), codigo(403));
  await assert.rejects(service.obtener(usuario(2)), codigo(403));
});

test('quién revisa: el jefe y sus aprobadores; Sistemas elabora pero no revisa', async () => {
  reset();
  datos.ids = [2];
  const jefe = await service.personaCalibracion(usuario(1));
  const aprobador = await service.personaCalibracion(usuario(2));
  const tecnico = await service.personaCalibracion(usuario(3));
  const sistemas = await service.personaCalibracion(usuario(4));
  const otraArea = await service.personaCalibracion(usuario(5));
  assert.deepEqual([jefe.jefe, jefe.revisor, jefe.editor], [true, true, true]);
  assert.deepEqual([aprobador.jefe, aprobador.revisor, aprobador.editor], [false, true, true]);
  assert.deepEqual([tecnico.revisor, tecnico.editor], [false, true]);
  assert.deepEqual([sistemas.revisor, sistemas.editor], [false, true]);
  assert.deepEqual([otraArea.revisor, otraArea.editor], [false, false]);
  // Un aprobador que pasa a otra área deja de revisar aunque siga en la lista.
  datos.personal[1].area = 'Soporte Técnico';
  assert.equal((await service.personaCalibracion(usuario(2))).revisor, false);

  const enRevision = { estado: 'EN_REVISION', enviado_por: 'garcia' };
  assert.equal(permisosDe(aprobador, enRevision).revisar, true);
  assert.equal(permisosDe(aprobador, enRevision).retirar, true);
  assert.equal(permisosDe(aprobador, { estado: 'APROBADO' }).reabrir, false);
  assert.equal(permisosDe(jefe, { estado: 'APROBADO' }).reabrir, true);
  assert.equal(permisosDe(tecnico, enRevision).revisar, false);
});
