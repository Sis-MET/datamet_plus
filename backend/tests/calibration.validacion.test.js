// Evidencia de la validación del motor (migración 022) con la base simulada.
const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/db');
const aprobadores = require('../src/services/calibration.aprobadores');

let filas = [];
class Request {
  constructor() { this.p = {}; }
  input(nombre, _tipo, valor) { this.p[nombre] = valor; return this; }
  async query(q) {
    if (q.includes('INSERT INTO dbo.CAL_VALIDACIONES')) {
      const id = filas.length + 1;
      filas.push({ id, version_app: this.p.version, resultados: this.p.resultados, huella: this.p.huella, casos: this.p.casos, valores: this.p.valores, aprobados: this.p.aprobados, observacion: this.p.observacion, registrado_por: this.p.usuario, registrado_nombre: this.p.nombre, registrado_en: '2026-11-09T18:00:00' });
      return { recordset: [{ id }] };
    }
    if (q.includes('WHERE id = @id')) return { recordset: filas.filter(f => f.id === this.p.id) };
    if (q.includes('FROM dbo.CAL_VALIDACIONES')) return { recordset: [...filas].reverse() };
    throw new Error(`SQL inesperado: ${q}`);
  }
}
db.getPool = () => ({ request: () => new Request() });
const PERSONAS = {
  tecnica: { usuario: 'tecnica', nombre: 'Técnica QA', jefe: false, revisor: false, editor: true },
  comercial: { usuario: 'comercial', nombre: 'Comercial', jefe: false, revisor: false, editor: false },
};
aprobadores.personaCalibracion = async user => PERSONAS[user.usuario];
const validacion = require('../src/services/calibration.validacion');

test('registra la corrida como evidencia de la versión, con su huella', async () => {
  filas = [];
  const antes = await validacion.getValidacion({ version: '2.17.0' }, { usuario: 'tecnica' });
  assert.equal(antes.resumen.ok, true);
  assert.equal(antes.registradaEstaVersion, false);
  assert.equal(antes.permisos.registrar, true);

  await assert.rejects(validacion.registrarEvidencia({ version: '2.17.0' }, { usuario: 'comercial' }), e => e.statusCode === 403);
  await assert.rejects(validacion.registrarEvidencia({ version: 'x' }, { usuario: 'tecnica' }), e => e.statusCode === 400);
  const r = await validacion.registrarEvidencia({ version: '2.17.0', observacion: 'Antes de la puesta en marcha' }, { usuario: 'tecnica' });
  assert.equal(r.valores, r.aprobados);
  assert.match(r.huella, /^[0-9a-f]{64}$/);

  const despues = await validacion.getValidacion({ version: '2.17.0' }, { usuario: 'comercial' });
  assert.equal(despues.registradaEstaVersion, true);
  assert.equal(despues.permisos.registrar, false);
  assert.deepEqual(despues.evidencias.map(e => [e.version, e.ok, e.registradoPor]), [['2.17.0', true, 'Técnica QA']]);

  const evidencia = await validacion.getEvidencia(r.id);
  assert.equal(evidencia.integra, true);
  assert.equal(evidencia.casos.length, antes.casos.length);
  // Si alguien altera los resultados guardados, la huella ya no coincide.
  filas[0].resultados = filas[0].resultados.replace('"ok":true', '"ok":false');
  assert.equal((await validacion.getEvidencia(r.id)).integra, false);
  await assert.rejects(validacion.getEvidencia(99), e => e.statusCode === 404);
});
