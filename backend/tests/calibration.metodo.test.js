// Configuración del método por versiones (fase 6): contenido, validación,
// diferencias y el flujo borrador → aprobación con la base simulada.
const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/db');
const transacciones = require('../src/services/calibration.db');
const aprobadores = require('../src/services/calibration.aprobadores');
const motor = require('../src/services/calibracion/motor');
const { densidadSupuesta } = require('../src/services/calibracion/motor/referencia');

// ─── Base simulada ──────────────────────────────────────────────────────────
let base;
const reiniciar = () => { base = { versiones: [], historial: [] }; };
reiniciar();
const ahora = () => '2026-11-09T15:00:00';
class Request {
  constructor() { this.p = {}; }
  input(nombre, _tipo, valor) { this.p[nombre] = valor; return this; }
  async query(q) {
    const r = filas => ({ recordset: structuredClone(filas) });
    const porId = () => base.versiones.find(v => v.id === this.p.id);
    if (q.includes('IF NOT EXISTS (SELECT 1 FROM dbo.CAL_METODO_VERSIONES')) {
      if (base.versiones.length) return r([]);
      base.versiones.push({ id: 1, version: 1, estado: 'VIGENTE', base: null, contenido: this.p.contenido, revision: 1, motivo: this.p.motivo, creado_por: 'SISTEMA', creado_nombre: 'DataMET+', creado_en: ahora() });
      return r([{ id: 1 }]);
    }
    if (q.includes('creado_nombre') && q.includes('FROM dbo.CAL_METODO_VERSIONES')) return r([...base.versiones].sort((a, b) => b.version - a.version));
    if (q.includes('FROM dbo.CAL_METODO_HISTORIAL h JOIN')) {
      return r(base.historial.map(h => ({ ...h, version: base.versiones.find(v => v.id === h.version_id).version })).reverse());
    }
    if (q.includes('INSERT INTO dbo.CAL_METODO_HISTORIAL')) {
      base.historial.push({ id: base.historial.length + 1, version_id: this.p.id, accion: this.p.accion, detalle: this.p.detalle, motivo: this.p.motivo, usuario: this.p.usuario, usuario_nombre: this.p.nombre, fecha: ahora() });
      return r([]);
    }
    if (q.includes('INSERT INTO dbo.CAL_METODO_VERSIONES')) {
      const id = base.versiones.length + 1;
      base.versiones.push({ id, version: this.p.version, estado: 'BORRADOR', base: this.p.base, contenido: this.p.contenido, revision: 1, motivo: this.p.motivo, creado_por: this.p.usuario, creado_nombre: this.p.nombre, creado_en: ahora() });
      return r([{ id }]);
    }
    if (q.includes('SET contenido = @contenido')) {
      Object.assign(porId(), { contenido: this.p.contenido, revision: porId().revision + 1, modificado_por: this.p.usuario, modificado_en: ahora() });
      return r([]);
    }
    if (q.includes("SET estado = 'DESCARTADA'")) { porId().estado = 'DESCARTADA'; return r([]); }
    if (q.includes("SET estado = 'REEMPLAZADA'")) {
      base.versiones.filter(v => v.estado === 'VIGENTE').forEach(v => Object.assign(v, { estado: 'REEMPLAZADA', vigente_hasta: ahora() }));
      return r([]);
    }
    if (q.includes("SET estado = 'VIGENTE'")) {
      assert.equal(base.versiones.filter(v => v.estado === 'VIGENTE').length, 0, 'solo una vigente');
      Object.assign(porId(), { estado: 'VIGENTE', aprobado_por: this.p.usuario, aprobado_nombre: this.p.nombre, aprobado_en: ahora(), vigente_desde: ahora() });
      return r([]);
    }
    if (q.includes('SET aprobado_por = @usuario')) {
      Object.assign(porId(), { aprobado_por: this.p.usuario, aprobado_nombre: this.p.nombre, aprobado_en: ahora() });
      return r([]);
    }
    if (q.includes("WHERE estado = 'VIGENTE'")) return r(base.versiones.filter(v => v.estado === 'VIGENTE'));
    if (q.includes('WHERE version = @version')) {
      return r(base.versiones.filter(v => v.version === this.p.version && ['VIGENTE', 'REEMPLAZADA'].includes(v.estado)));
    }
    throw new Error(`SQL inesperado: ${q}`);
  }
}
db.getPool = () => ({ request: () => new Request() });
transacciones.withTransaction = async (fn) => {
  const antes = structuredClone(base);
  try { return await fn(() => new Request()); } catch (error) { base = antes; throw error; }
};
const PERSONAS = {
  jefe: { usuario: 'jefe', nombre: 'Jefe QA', jefe: true, revisor: true, editor: true },
  tecnica: { usuario: 'tecnica', nombre: 'Técnica QA', jefe: false, revisor: false, editor: true },
  comercial: { usuario: 'comercial', nombre: 'Comercial', jefe: false, revisor: false, editor: false },
};
aprobadores.personaCalibracion = async user => PERSONAS[user.usuario];
const metodo = require('../src/services/calibration.metodo');

const jefe = { id: 1, usuario: 'jefe' };
const tecnica = { id: 2, usuario: 'tecnica' };
const comercial = { id: 3, usuario: 'comercial' };
const estado = n => e => e.statusCode === n;

// ─── Contenido ─────────────────────────────────────────────────────────────

test('la versión 1 reproduce la configuración con la que se validó el motor', () => {
  const contenido = metodo.validarContenido(metodo.contenidoInicial());
  const configuracion = metodo.configuracionMotor(1, contenido);
  assert.deepEqual(configuracion, structuredClone(motor.CONFIGURACION_V1));
});

test('validación: dice qué valor está mal; ordena y quita repetidos de las series', () => {
  const contenido = metodo.contenidoInicial();
  assert.throws(() => metodo.validarContenido({ ...contenido, parametros: { ...contenido.parametros, kD: 5 } }),
    e => e.statusCode === 400 && /parametros\.kD/.test(e.message) && /como máximo 3/.test(e.message));
  assert.throws(() => metodo.validarContenido({ ...contenido, textos: { ...contenido.textos, metodo: '  ' } }), /textos\.metodo.*vacío/);
  assert.throws(() => metodo.validarContenido({ ...contenido, parametros: { ...contenido.parametros, empuje: '5d' } }), /5a o 7\.1\.2-5b/);
  const enUso = { ...contenido.parametros.enUso, fracciones: [0.5, 0.1, 0.5, 1] };
  const valido = metodo.validarContenido({ ...contenido, parametros: { ...contenido.parametros, enUso } });
  assert.deepEqual(valido.parametros.enUso.fracciones, [0.1, 0.5, 1]);
});

test('completar: lo guardado manda y lo nuevo del código entra con su valor inicial', () => {
  const guardado = metodo.contenidoInicial();
  guardado.parametros.kD = 2;
  delete guardado.parametros.densidades;
  delete guardado.textos.datosCliente;
  const completo = metodo.completar(guardado);
  assert.equal(completo.parametros.kD, 2);
  assert.deepEqual(completo.parametros.densidades, metodo.contenidoInicial().parametros.densidades);
  assert.equal(completo.textos.datosCliente, metodo.contenidoInicial().textos.datosCliente);
});

test('el criterio de aptitud de las pesas: R111 en las versiones anteriores y SUMA_EMP si el laboratorio lo elige', () => {
  // Una versión guardada antes de la regla queda con la R111, como se calculaba entonces.
  const anterior = metodo.contenidoInicial();
  delete anterior.parametros.pesas;
  assert.deepEqual(metodo.completar(anterior).parametros.pesas, { aptitud: 'R111' });
  // El laboratorio elige su criterio en una versión nueva; solo se aceptan las opciones programadas.
  const nueva = structuredClone(metodo.contenidoInicial());
  nueva.parametros.pesas.aptitud = 'SUMA_EMP';
  assert.equal(metodo.validarContenido(nueva).parametros.pesas.aptitud, 'SUMA_EMP');
  nueva.parametros.pesas.aptitud = 'UN_MEDIO';
  assert.throws(() => metodo.validarContenido(nueva), /criterio de aptitud de las pesas/);
});

test('diferencias por ruta entre dos versiones', () => {
  const antes = metodo.contenidoInicial();
  const despues = structuredClone(antes);
  despues.parametros.kD = 1.5;
  despues.parametros.densidades[2].rho = 7960;
  despues.textos.pruebas.push('Nueva frase.');
  assert.deepEqual(metodo.diferencias(antes, despues), [
    { ruta: 'parametros.kD', antes: 1, despues: 1.5 },
    { ruta: 'parametros.densidades[2].rho', antes: 7950, despues: 7960 },
    { ruta: 'textos.pruebas[3]', antes: null, despues: 'Nueva frase.' },
  ]);
});

test('la tabla de densidades de la configuración decide la densidad supuesta', () => {
  assert.deepEqual(densidadSupuesta('Acero inoxidable'), { rho: 7950, u: 70 });
  assert.deepEqual(densidadSupuesta('Fundición gris'), { rho: 7100, u: 300 });
  assert.deepEqual(densidadSupuesta('LATÓN'), { rho: 8400, u: 85 });
  const propia = [{ material: 'Inoxidable', claves: ['inox'], rho: 7960, u: 50 }];
  assert.deepEqual(densidadSupuesta('acero INOX 316', propia), { rho: 7960, u: 50 });
  assert.equal(densidadSupuesta('aluminio', propia), null);
  // La masa de referencia usa la tabla que recibe.
  const pieza = { nominal: 1000, correccion: 0, U: 0.001, k: 2, emp: 0.005, material: 'Inoxidable', clase: 'F1' };
  const aire = { rho: 0.78, u: 0.002 };
  const conTabla = motor.masaReferencia([pieza], { unidad: 'g', aire, empuje: '5a', densidades: propia });
  assert.equal(conTabla.piezas[0].densidad.rho, 7960);
});

// ─── Flujo ─────────────────────────────────────────────────────────────────

test('versión inicial, borrador, edición, aprobación por el jefe y versiones que se conservan', async () => {
  reiniciar();
  metodo.limpiarCache();
  // Sin versiones rige la inicial; al abrir la pantalla se crea la 1, sin aprobar.
  assert.equal((await metodo.configuracionVigente()).version, 1);
  metodo.limpiarCache();
  let pantalla = await metodo.getMetodo(jefe);
  assert.equal(pantalla.vigente.version, 1);
  assert.equal(pantalla.vigente.inicial, true);
  assert.equal(pantalla.porAprobar, 1);
  assert.equal(pantalla.permisos.aprobar, true);
  assert.equal((await metodo.getMetodo(tecnica)).permisos.motivoAprobar, 'Solo el jefe de Calibración aprueba la configuración del método.');

  // El jefe aprueba la inicial: queda firmada, sigue siendo la 1.
  await metodo.aprobar(jefe, { revision: 1 });
  pantalla = await metodo.getMetodo(jefe);
  assert.equal(pantalla.vigente.aprobadoPor, 'Jefe QA');
  assert.equal(pantalla.porAprobar, null);

  // Solo el personal de Calibración redacta; un borrador a la vez.
  await assert.rejects(metodo.crearBorrador(comercial, { motivo: 'x' }), estado(403));
  assert.deepEqual(await metodo.crearBorrador(tecnica, { motivo: 'Convección con 4 K a 30 min' }), { version: 2 });
  await assert.rejects(metodo.crearBorrador(tecnica, { motivo: 'otra' }), estado(409));

  // Edita: se valida, se controla la revisión y queda el detalle en el historial.
  const contenido = structuredClone(metodo.contenidoInicial());
  contenido.parametros.conveccion.porEstabilizacion[0].deltaT = 4;
  contenido.textos.metodo = 'Comparación con pesas patrón, procedimiento P-VMET-02-7.2 (rev. 3).';
  await assert.rejects(metodo.guardarBorrador(tecnica, { revision: 1, contenido: { ...contenido, parametros: { ...contenido.parametros, kD: 9 } } }), estado(400));
  assert.deepEqual(await metodo.guardarBorrador(tecnica, { revision: 1, contenido, motivo: 'Ensayo del laboratorio' }), { version: 2, revision: 2, cambios: 2 });
  await assert.rejects(metodo.guardarBorrador(tecnica, { revision: 1, contenido }), estado(409));
  pantalla = await metodo.getMetodo(jefe);
  assert.equal(pantalla.borrador.version, 2);
  assert.deepEqual(pantalla.borrador.diferencias.map(d => d.ruta), ['parametros.conveccion.porEstabilizacion[0].deltaT', 'textos.metodo']);
  assert.equal(pantalla.historial.find(h => h.accion === 'EDICION').cambios.length, 2);
  assert.equal(pantalla.permisos.aprobar, true);

  // Aprobar exige la revisión que se revisó.
  await assert.rejects(metodo.aprobar(jefe, { revision: 1 }), estado(409));
  await metodo.aprobar(jefe, { revision: 2, motivo: 'Revisado' });
  pantalla = await metodo.getMetodo(jefe);
  assert.equal(pantalla.vigente.version, 2);
  assert.equal(pantalla.versiones.find(v => v.version === 1).estado, 'REEMPLAZADA');

  // El cálculo usa la vigente; un registro aprobado con la 1 la conserva.
  const vigente = await metodo.configuracionVigente();
  assert.equal(vigente.version, 2);
  assert.equal(vigente.motor.conveccion.deltaTPorEstabilizacion['MAYOR A 30 MINUTOS'], 4);
  assert.match(vigente.textos.metodo, /rev\. 3/);
  const v1 = await metodo.configuracionDe(1);
  assert.equal(v1.motor.conveccion.deltaTPorEstabilizacion['MAYOR A 30 MINUTOS'], 3);
  await assert.rejects(metodo.configuracionDe(7), estado(409));
});

test('quien redacta o edita no aprueba; el borrador se puede descartar', async () => {
  reiniciar();
  metodo.limpiarCache();
  await metodo.getMetodo(jefe);
  await metodo.aprobar(jefe, { revision: 1 });
  await metodo.crearBorrador(tecnica, { motivo: 'Cambio de textos' });
  const contenido = structuredClone(metodo.contenidoInicial());
  contenido.textos.repetibilidad = 'La desviación estándar es de una sola lectura.';
  // El jefe edita el borrador de la técnica: ya no puede aprobarlo.
  await metodo.guardarBorrador(jefe, { revision: 1, contenido });
  const pantalla = await metodo.getMetodo(jefe);
  assert.equal(pantalla.permisos.aprobar, false);
  assert.match(pantalla.permisos.motivoAprobar, /quien la redacta no la aprueba/);
  await assert.rejects(metodo.aprobar(jefe, { revision: 2 }), estado(403));
  // Se descarta: queda en el historial y la vigente sigue siendo la 1.
  await metodo.descartarBorrador(tecnica, { motivo: 'Se redacta de nuevo' });
  const despues = await metodo.getMetodo(jefe);
  assert.equal(despues.borrador, null);
  assert.equal(despues.vigente.version, 1);
  assert.equal(despues.versiones.find(v => v.version === 2).estado, 'DESCARTADA');
  assert.equal(despues.historial[0].accion, 'DESCARTE');
  // La siguiente versión no reutiliza el número de la descartada.
  assert.deepEqual(await metodo.crearBorrador(tecnica, { motivo: 'De nuevo' }), { version: 3 });
});

test('reglas de cálculo: opciones conocidas y valores dentro de sus límites', () => {
  const contenido = metodo.contenidoInicial();
  const con = parametros => ({ ...contenido, parametros: { ...contenido.parametros, ...parametros } });
  const valido = metodo.validarContenido(con({
    repetibilidad: { regla: 'MAYOR' },
    cobertura: { metodo: 'FIJO', probabilidad: 0.95, k: 2 },
    redondeoU: { cifras: 1, sentido: 'CERCANO' },
    aire: { formula: 'APROXIMADA' },
    excentricidad: { metodo: 'METODO_1' },
    conformidad: { bandaGuarda: 0.5, riesgoUmbral: 0.1 },
    empServicio: { factor: 1 },
    claseSugerida: { regla: 'POR_N' },
    usp: { tolerancia: 0.0005, cargaEvaluacion: 0.1, sMinimaEnD: 0.41, factorS: 2, divisorPesas: 3 },
  }));
  const motorConf = metodo.configuracionMotor(4, valido);
  assert.equal(motorConf.repetibilidad.regla, 'MAYOR');
  assert.deepEqual(motorConf.cobertura, { metodo: 'FIJO', probabilidad: 0.95, k: 2 });
  assert.equal(motorConf.usp.tolerancia, 0.0005);
  assert.throws(() => metodo.validarContenido(con({ repetibilidad: { regla: 'MEDIA' } })), /parametros\.repetibilidad\.regla/);
  assert.throws(() => metodo.validarContenido(con({ redondeoU: { cifras: 2.5, sentido: 'ARRIBA' } })), /1, 2 o 3/);
  assert.throws(() => metodo.validarContenido(con({ cobertura: { metodo: 'T_STUDENT', probabilidad: 0.5, k: 2 } })), /al menos 0\.9/);
  assert.throws(() => metodo.validarContenido(con({ empServicio: { factor: 5 } })), /como máximo 3/);
  // Una versión guardada antes de las reglas las recibe con el valor que reproduce su cálculo.
  const viejo = metodo.contenidoInicial();
  for (const clave of ['repetibilidad', 'cobertura', 'redondeoU', 'aire', 'excentricidad', 'conformidad', 'empServicio', 'claseSugerida', 'usp']) delete viejo.parametros[clave];
  assert.deepEqual(metodo.configuracionMotor(1, metodo.completar(viejo)), structuredClone(motor.CONFIGURACION_V1));
});
