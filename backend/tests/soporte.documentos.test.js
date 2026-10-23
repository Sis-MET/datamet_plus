const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { crearArchivo, carpetaRelativa, nombrePdf, validarPdf, MAX_PDF_BYTES } = require('../src/services/soporte.archivos');
const { crearServicio } = require('../src/services/soporte.documentos');

const pdf = Buffer.from('%PDF-1.4\nDocumento de prueba\n%%EOF\n');
const user = { usuario: 'tecnico', nombre: 'Técnico', autorizado: true };
const meta = (extra = {}) => ({ carpeta: 'Cliente A/2026', nombre: 'Informe.pdf', revision: '0', borrador: 'false', version: '1', ...extra });
const status = expected => e => e.statusCode === expected;

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'datamet-documentos-'));
  t.after(async () => {
    // El borrado recursivo queda limitado al directorio temporal de esta prueba.
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('datamet-documentos-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(root, 'Cliente A', '2026'), { recursive: true });
  await fs.mkdir(path.join(root, 'Cliente B', '2027'), { recursive: true });
  let rows = [];
  let rechazarRegistro = false;
  const autorizar = async actor => {
    if (!actor?.autorizado) throw Object.assign(new Error('Sin permiso'), { statusCode: 403 });
    return actor;
  };
  const repositorio = {
    autorizar,
    contexto: async (_tipo, _codigo, actor, datos) => {
      await autorizar(actor);
      if (datos?.version !== undefined && datos.version !== 1) throw Object.assign(new Error('Versión obsoleta'), { statusCode: 409 });
      return actor;
    },
    transaccion: async action => action(() => ({})),
    ubicacion: async hash => rows.find(row => row.ubicacion_huella === hash),
    listar: async (tipo, codigo) => rows.filter(row => row.tipo === tipo && row.codigo_registro === codigo),
    buscar: async id => rows.find(row => row.id === id),
    insertar: async row => {
      if (rechazarRegistro) throw new Error('SQL no disponible');
      const completo = { ...row, guardado_en: new Date() };
      rows.push(completo);
      return completo;
    },
  };
  return { root, servicio: crearServicio({ raiz: root, repositorio }), repositorio,
    fallarRegistro: value => { rechazarRegistro = value; }, rows: () => rows };
}

test('el técnico elige cualquier carpeta existente y abre exactamente el PDF registrado', async t => {
  const { servicio, root } = await fixture(t);
  assert.deepEqual((await servicio.carpetas('', user)).carpetas.map(c => c.nombre), ['Cliente A', 'Cliente B']);
  const destino = await servicio.carpetas('Cliente B', user);
  assert.equal(destino.carpetas[0].ruta, 'Cliente B/2027');
  const documento = await servicio.guardar('MPR', 'ST-001', meta({ carpeta: 'Cliente B/2027' }), pdf, user);
  assert.equal(documento.carpeta, 'Cliente B/2027');
  assert.equal(documento.borrador, false);
  assert.equal(documento.guardadoPor.usuario, user.usuario);
  assert.deepEqual(await fs.readFile(path.join(root, 'Cliente B', '2027', 'Informe.pdf')), pdf);
  assert.deepEqual((await servicio.abrir(documento.id, user)).contenido, pdf);
  assert.equal((await servicio.listar('MPR', 'ST-001', user)).documentos.length, 1);
  assert.equal((await servicio.listar('MPR', 'OTRO', user)).documentos.length, 0);
});

test('no sobrescribe otro PDF y cada revisión puede conservar una ubicación distinta', async t => {
  const { servicio, root } = await fixture(t);
  const anterior = await servicio.guardar('MPR', 'ST-001', meta(), pdf, user);
  const distinto = Buffer.from('%PDF-1.4\nDocumento diferente\n%%EOF\n');
  await assert.rejects(servicio.guardar('MPR', 'ST-001', meta(), distinto, user), status(409));
  assert.deepEqual(await fs.readFile(path.join(root, 'Cliente A', '2026', 'Informe.pdf')), pdf);
  const revision = await servicio.guardar('MPR', 'ST-001', meta({ carpeta: 'Cliente B/2027', borrador: 'false', revision: '1' }), distinto, user);
  assert.notEqual(anterior.id, revision.id);
  assert.equal(revision.revision, 1);
  assert.deepEqual((await servicio.abrir(anterior.id, user)).contenido, pdf);
});

test('rechaza archivar un borrador sin escribir archivos ni registrar documentos', async t => {
  const { servicio, root, rows } = await fixture(t);
  await assert.rejects(servicio.guardar('MPR', 'ST-001', meta({ borrador: 'true' }), pdf, user), status(409));
  assert.equal(rows().length, 0);
  assert.deepEqual(await fs.readdir(path.join(root, 'Cliente A', '2026')), []);
});

test('un reintento completa el registro sin perder el PDF escrito ni duplicar referencias', async t => {
  const { servicio, fallarRegistro, root, rows } = await fixture(t);
  fallarRegistro(true);
  await assert.rejects(servicio.guardar('MPR', 'ST-001', meta(), pdf, user), e => e.statusCode === 503 && /se escribió/.test(e.message));
  assert.deepEqual(await fs.readFile(path.join(root, 'Cliente A', '2026', 'Informe.pdf')), pdf);
  fallarRegistro(false);
  const documento = await servicio.guardar('MPR', 'ST-001', meta(), pdf, user);
  const repetido = await servicio.guardar('MPR', 'ST-001', meta(), pdf, user);
  assert.equal(repetido.id, documento.id);
  assert.equal(rows().length, 1);
  await assert.rejects(servicio.guardar('MPR', 'OTRO', meta(), pdf, user), status(409));
});

test('rechaza rutas fuera de la raíz, nombres de Windows y documentos inválidos', async t => {
  const { servicio } = await fixture(t);
  for (const ruta of ['../', '../privado', 'Cliente A/../Cliente B', 'C:/Windows', 'Cliente A\\2026', '/Cliente A', 'Cliente A/', 'Cliente A/2026.']) {
    assert.throws(() => carpetaRelativa(ruta), status(400));
    await assert.rejects(servicio.carpetas(ruta, user), status(400));
  }
  for (const nombre of ['../otro.pdf', 'C:archivo.pdf', 'CON.pdf', 'LPT1.pdf', 'informe.txt', 'archivo.pdf ', 'a\nb.pdf']) assert.throws(() => nombrePdf(nombre), status(400));
  assert.throws(() => validarPdf(Buffer.from('No es un PDF')), status(400));
  assert.throws(() => validarPdf(Buffer.alloc(MAX_PDF_BYTES + 1)), status(400));
  await assert.rejects(servicio.guardar('MPR', 'ST-001', meta({ version: '2' }), pdf, user), status(409));
});

test('un acceso directo a otra carpeta no permite escapar del archivo del área', async t => {
  const { servicio, root } = await fixture(t);
  await fs.symlink(path.dirname(root), path.join(root, 'Fuera'), 'junction');
  assert.ok(!(await servicio.carpetas('', user)).carpetas.some(c => c.nombre === 'Fuera'));
  await assert.rejects(servicio.carpetas('Fuera', user), status(400));
  await assert.rejects(servicio.guardar('MPR', 'ST-001', meta({ carpeta: 'Fuera' }), pdf, user), status(400));
});

test('controla permisos, borrados y cambios externos antes de entregar el PDF', async t => {
  const { servicio, root, repositorio } = await fixture(t);
  const sinPermiso = { autorizado: false };
  await assert.rejects(servicio.carpetas('', sinPermiso), status(403));
  await assert.rejects(servicio.guardar('MPR', 'ST-001', meta(), pdf, sinPermiso), status(403));
  const documento = await servicio.guardar('MPR', 'ST-001', meta(), pdf, user);
  await assert.rejects(servicio.abrir(documento.id, sinPermiso), status(403));
  await fs.writeFile(path.join(root, 'Cliente A', '2026', 'Informe.pdf'), 'modificado externamente');
  await assert.rejects(servicio.abrir(documento.id, user), status(409));
  await fs.unlink(path.join(root, 'Cliente A', '2026', 'Informe.pdf'));
  await assert.rejects(servicio.abrir(documento.id, user), status(404));
  await assert.rejects(servicio.carpetas('No existe', user), status(404));
  const sinConfigurar = crearServicio({ raiz: '', repositorio });
  assert.deepEqual(await sinConfigurar.listar('MPR', 'ST-001', user), { configurado: false, documentos: [] });
  await assert.rejects(sinConfigurar.carpetas('', user), status(503));
  await assert.rejects(crearArchivo(path.join(root, 'no-existe')).listar(), status(503));
});
