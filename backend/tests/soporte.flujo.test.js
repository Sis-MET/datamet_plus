const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const transacciones = require('../src/services/calibration.db');
const redaccion = require('../src/services/soporte.redaccion');

// Doble de persistencia: ejecuta los servicios reales, sin conectarse a la
// base operativa. Conserva versiones, copias e historial y revierte errores.
let almacen;
let personal;
let fuente;
class Request {
  constructor() { this.params = {}; }
  input(nombre, _tipo, valor) { this.params[nombre] = valor; return this; }
  async query(sql) {
    const p = this.params;
    const result = rows => ({ recordset: structuredClone(rows) });
    if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) return result(Object.keys(fuente).map(campo => ({
      COLUMN_NAME: campo, DATA_TYPE: campo === 'cap_max1' ? 'decimal' : 'nvarchar', CHARACTER_MAXIMUM_LENGTH: 4000,
    })));
    if (sql.includes('FROM DATA_USERS')) return result(sql.includes('WHERE id =')
      ? (personal.activo ? [personal] : []) : [{ usuario: 'tecnico', nombre: 'Técnico' }, { usuario: 'jefe', nombre: 'Jefe' }]);
    if (sql.includes('DATA_SERVICIOS_DATOS_')) return result([fuente]);
    if (sql.includes('INSERT INTO dbo.ST_INFORMES_HISTORIAL')) { almacen.historial.push({ ...p, accion: p.accion }); return result([]); }
    if (sql.includes('INSERT INTO dbo.ST_INFORMES_REVISIONES')) {
      almacen.copias.push({ revision: p.revision, fuente: p.fuente, datos: p.datos, fotos: p.fotos,
        motivo: p.motivo, emitido_por: p.por, emitido_en: new Date() });
      return result([]);
    }
    if (sql.includes('FROM dbo.ST_INFORMES_REVISIONES')) return result(almacen.copias.filter(c => p.revisionCopia == null || c.revision === p.revisionCopia));
    if (sql.includes('FROM dbo.ST_INFORMES_FOTOS')) return result([]);
    if (sql.includes('FROM dbo.ST_INFORMES_HISTORIAL')) return result([]);
    if (sql.includes('INSERT INTO dbo.ST_INFORMES ')) {
      almacen.informe = { id: 1, tipo: p.tipo, codigo_registro: p.codigo, numero: p.numero, datos: p.datos,
        estado: p.estado, revision: 0, version: 1, validacion_estado: 'BORRADOR' };
      return result([almacen.informe]);
    }
    if (sql.includes('UPDATE dbo.ST_INFORMES')) {
      const informe = almacen.informe;
      const campos = ['estado', 'validacion_estado', 'validacion_huella', 'validacion_enviada_por', 'validacion_enviada_en',
        'validacion_resuelta_por', 'validacion_resuelta_en', 'validacion_observacion', 'revision_motivo', 'revision_abierta_por',
        'revision_abierta_en', 'revision', 'datos', 'emitido_por', 'emitido_en'];
      for (const campo of campos) {
        const valor = new RegExp(`\\b${campo} = (NULL|'[^']*'|@\\w+|SYSUTCDATETIME\\(\\))`).exec(sql)?.[1];
        if (valor) informe[campo] = valor === 'NULL' ? null : valor.startsWith('@') ? p[valor.slice(1)]
          : valor.startsWith("'") ? valor.slice(1, -1) : new Date();
      }
      if (sql.includes('version = version + 1')) informe.version++;
      return result([]);
    }
    if (sql.includes('FROM dbo.ST_INFORMES')) return result(almacen.informe ? [almacen.informe] : []);
    throw new Error(`Consulta no simulada: ${sql}`);
  }
}
db.getPool = () => ({ request: () => new Request() });
transacciones.withTransaction = async trabajo => {
  const antes = structuredClone(almacen);
  try { return await trabajo(() => new Request()); }
  catch (error) { almacen = antes; throw error; }
};
const informes = require('../src/services/soporte.informes');
const usuario = { id: 1, usuario: 'tecnico', acceso_cron: 1 };
const jefe = { id: 2, usuario: 'jefe', acceso_cron: 1 };
const tecnico = () => { personal = { area: 'Soporte Técnico', cargo: 'Técnico', nombre: 'Técnico', activo: true }; };
const responsable = () => { personal = { area: 'Soporte Técnico', cargo: 'Jefe de Area', nombre: 'Jefe', activo: true }; };
const reset = () => {
  almacen = { informe: null, copias: [], historial: [] };
  fuente = { codigo_registro: 'ST-001', otst: 'OT-001', cod_metrica: '001-001', cap_max1: 300,
    comentario_general: 'Se verificó el equipo.', cliente: 'Cliente de prueba' };
  tecnico();
};
const version = () => ({ version: almacen.informe?.version ?? null });
const aprobar = async () => {
  responsable();
  await informes.resolverValidacion('MPR', 'ST-001', { ...version(), decision: 'APROBAR', observacion: null }, jefe);
  tecnico();
};

test('flujo real de servicios: envío, observaciones, aprobación, emisión y nueva aprobación por revisión', async () => {
  reset();
  await assert.rejects(informes.emitirInforme('MPR', 'ST-001', version(), usuario), /debe aprobar/);
  await informes.enviarValidacion('MPR', 'ST-001', version(), usuario);
  assert.equal(almacen.informe.validacion_estado, 'PENDIENTE');
  // El JWT no puede atribuirse el cargo: manda el personal consultado en BD.
  await assert.rejects(informes.resolverValidacion('MPR', 'ST-001', { ...version(), decision: 'APROBAR' }, { ...usuario, cargo: 'Jefe de Area', acceso_cron: 3 }), e => e.statusCode === 403);
  personal = { area: 'Sistemas', cargo: 'Jefe de Area', activo: true };
  await assert.rejects(informes.resolverValidacion('MPR', 'ST-001', { ...version(), decision: 'APROBAR' }, { ...usuario, acceso_cron: 3 }), e => e.statusCode === 403);
  responsable(); personal.activo = false;
  await assert.rejects(informes.resolverValidacion('MPR', 'ST-001', { ...version(), decision: 'APROBAR' }, jefe), e => e.statusCode === 403);
  tecnico();
  await assert.rejects(informes.guardarCambios('MPR', 'ST-001', { ...version(), cambios: { comentario_general: 'Cambio' } }, usuario), /Retire la validación/);
  await assert.rejects(informes.agregarFoto('MPR', 'ST-001', {}, usuario), /Retire la validación/);
  responsable();
  await informes.resolverValidacion('MPR', 'ST-001', { ...version(), decision: 'OBSERVAR', observacion: 'Precisar el trabajo realizado.' }, jefe);
  tecnico();
  await informes.guardarCambios('MPR', 'ST-001', { ...version(), cambios: { comentario_general: 'Se realizó limpieza.' } }, usuario);
  await informes.enviarValidacion('MPR', 'ST-001', version(), usuario);
  const anterior = version();
  await aprobar();
  await assert.rejects(informes.emitirInforme('MPR', 'ST-001', anterior, usuario), e => e.statusCode === 409);
  await informes.emitirInforme('MPR', 'ST-001', version(), usuario);
  assert.equal(almacen.informe.estado, 'EMITIDO');
  assert.equal(almacen.copias.length, 1);
  fuente.cap_max1 = 600;
  assert.equal((await informes.getInforme('MPR', 'ST-001', usuario)).fuente.cap_max1, 300);
  await informes.abrirRevision('MPR', 'ST-001', { ...version(), motivo: 'Corrección solicitada por el cliente' }, usuario);
  assert.equal(almacen.informe.validacion_estado, 'BORRADOR');
  await assert.rejects(informes.reemitirInforme('MPR', 'ST-001', version(), usuario), /debe aprobar/);
  await informes.enviarValidacion('MPR', 'ST-001', version(), usuario);
  await aprobar();
  await informes.reemitirInforme('MPR', 'ST-001', version(), usuario);
  assert.equal(almacen.informe.revision, 1);
  assert.equal(almacen.copias.length, 2);
  assert.ok(almacen.historial.some(h => h.accion === 'VALIDACION_OBSERVADA'));
  assert.equal(almacen.historial.filter(h => h.accion === 'VALIDACION_APROBADA').length, 2);
});

test('una reposición de ServiceMET invalida la aprobación; retirar obliga a reenviar', async () => {
  reset();
  await informes.enviarValidacion('MPR', 'ST-001', version(), usuario);
  fuente.cap_max1 = 600;
  responsable();
  await assert.rejects(informes.resolverValidacion('MPR', 'ST-001', { ...version(), decision: 'APROBAR' }, jefe), /cambiaron desde el envío/);
  tecnico();
  await informes.retirarValidacion('MPR', 'ST-001', version(), usuario);
  await informes.enviarValidacion('MPR', 'ST-001', version(), usuario);
  await aprobar();
  fuente.cap_max1 = 900;
  await assert.rejects(informes.emitirInforme('MPR', 'ST-001', version(), usuario), /cambiaron desde el envío/);
  await informes.retirarValidacion('MPR', 'ST-001', version(), usuario);
  await assert.rejects(informes.emitirInforme('MPR', 'ST-001', version(), usuario), /debe aprobar/);
});

test('la IA recibe la fuente, correcciones persistidas y cambios locales validados', async () => {
  reset();
  await informes.guardarCambios('MPR', 'ST-001', { ...version(), cambios: { comentario_general: 'Limpieza de plataforma.' } }, usuario);
  const original = redaccion.mejorarRedaccion;
  redaccion.mejorarRedaccion = async args => args;
  try {
    const resultado = await informes.sugerirRedaccion({ tipo: 'MPR', codigo: 'ST-001', ...version(),
      campo: 'comentario_general', seccion: 'Observaciones', texto: 'Se efectuó limpieza.', cambios: { cap_max1: '600' } }, usuario);
    assert.equal(resultado.datos.cap_max1, 600);
    assert.equal(resultado.datos.cliente, fuente.cliente);
    assert.equal(resultado.datos.comentario_general, 'Se efectuó limpieza.');
    await assert.rejects(informes.sugerirRedaccion({ tipo: 'MPR', codigo: 'ST-001', ...version(), campo: 'comentario_general',
      seccion: 'Observaciones', texto: 'Limpieza', cambios: { cod_metrica: 'OTRO' } }, usuario), /no se puede editar/);
  } finally { redaccion.mejorarRedaccion = original; }
});
