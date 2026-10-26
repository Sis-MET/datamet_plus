const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const db = require('../src/config/db');

// La sesión vigente y la comprobación de área usan este doble; no se abre una
// conexión SQL.
const tecnico = { id: 1, usuario: 'tecnico', estado: 'ACTIVO', acceso_cron: 1, area: 'Soporte Técnico' };
db.getPool = () => ({ request: () => ({ input() { return this; }, async query() { return { recordset: [tecnico] }; } }) });
const { generateToken } = require('../src/utils/jwt.utils');
const documentos = require('../src/services/soporte.documentos');
const router = require('../src/routes/soporte.routes');

test('las rutas autentican, reciben PDF binario y entregan el archivo sin publicar el directorio', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'datamet-documentos-http-'));
  let row;
  const repo = {
    autorizar: async user => user,
    contexto: async (_tipo, _codigo, user) => user,
    transaccion: async fn => fn(() => ({})),
    ubicacion: async () => row,
    insertar: async value => { row = { ...value, guardado_en: new Date() }; return row; },
    listar: async () => row ? [row] : [],
    buscar: async id => row?.id === id ? row : null,
  };
  const servicio = documentos.crearServicio({ raiz: root, repositorio: repo });
  const originales = {};
  for (const method of ['carpetas', 'guardar', 'listar', 'abrir']) { originales[method] = documentos[method]; documentos[method] = servicio[method]; }
  const app = express();
  app.use(express.json());
  app.use('/api/soporte', router);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}/api/soporte`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    Object.assign(documentos, originales);
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('datamet-documentos-http-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const auth = { Authorization: `Bearer ${generateToken({ id: 1, usuario: 'tecnico', acceso_cron: 1 })}` };
  assert.equal((await fetch(`${base}/documentos/carpetas`)).status, 401);
  assert.equal((await fetch(`${base}/informes/MPR/ST-001/documentos`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: '%PDF-1.4\n%%EOF' })).status, 401);
  const listado = await fetch(`${base}/documentos/carpetas`, { headers: auth });
  assert.equal(listado.status, 200);
  assert.deepEqual((await listado.json()).data.carpetas, []);
  const pdf = Buffer.from('%PDF-1.4\nHTTP de prueba\n%%EOF\n');
  const query = new URLSearchParams({ carpeta: '', nombre: "Informe - gestión O'Connor (2026).pdf", version: '1', revision: '0', borrador: 'false' });
  const borrador = new URLSearchParams(query); borrador.set('borrador', 'true');
  assert.equal((await fetch(`${base}/informes/MPR/ST-001/documentos?${borrador}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/pdf' }, body: pdf })).status, 409);
  const guardado = await fetch(`${base}/informes/MPR/ST-001/documentos?${query}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/pdf' }, body: pdf });
  assert.equal(guardado.status, 201);
  const id = (await guardado.json()).data.id;
  assert.equal((await fetch(`${base}/documentos/${id}/pdf`)).status, 401);
  const lectura = await fetch(`${base}/documentos/${id}/pdf`, { headers: auth });
  assert.equal(lectura.headers.get('content-type'), 'application/pdf');
  assert.match(lectura.headers.get('content-disposition'), /^inline;/);
  assert.match(lectura.headers.get('content-disposition'), /gesti%C3%B3n%20O%27Connor%20%282026%29\.pdf/);
  assert.equal(lectura.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(Buffer.from(await lectura.arrayBuffer()), pdf);
  const invalid = await fetch(`${base}/documentos/carpetas?carpeta=..`, { headers: auth });
  assert.equal(invalid.status, 400);
  const ajeno = await fetch(`${base}/documentos/00000000-0000-4000-8000-000000000000/pdf`, { headers: auth });
  assert.equal(ajeno.status, 404);
});
