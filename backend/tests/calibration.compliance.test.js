const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ESTADOS,
  PRIORIDADES,
  REQUISITOS,
  evaluateCompliance,
  formatDuration,
} = require('../src/services/calibration.compliance');

const facts = (overrides = {}) => ({
  evaluadoEn: '2026-10-06T14:00:00.000Z',
  version: '2.7.0',
  entorno: {
    modo: 'production',
    node: 'v24.12.0',
    sesionExpira: '8h',
    baseCifrada: false,
    servidorLocal: true,
    https: true,
    correo: true,
  },
  baseDatos: {
    nombre: 'DataMET',
    version: '16.0.1000.6',
    edicion: 'Express Edition (64-bit)',
    recuperacion: 'SIMPLE',
    tamanoMb: 210,
    certificados: true,
    historial: true,
    eventosHistorial: true,
    planHistorial: true,
    revision: true,
    cambios: true,
    fallas: true,
  },
  respaldos: { total: 518, ultimo: '2026-10-06 08:00', horas: 6, ultimos30: 30 },
  migraciones: {
    archivos: ['001', '002', '003', '004', '005', '006', '007'],
    registradas: ['001', '002', '003', '004', '005', '006', '007'],
  },
  equipos: {
    total: 22, activos: 22, sinCertificado: 0, incompletos: 0, sinRegistro: 0,
    vencimientoInconsistente: 0, espaciosInvisibles: 0, idsDuplicados: 0, codigosDuplicados: 0,
  },
  certificados: { total: 22, conAutor: 22, anulados: 0, anuladosConMotivo: 0 },
  historial: { total: 4, modificaciones: 1 },
  eventos: { total: 3, verificaciones: 2, verificacionesSinResultado: 0 },
  programas: { activos: 3, retirados: 1 },
  fallas: { correos: 0 },
  accesos: { activos: 20, editores: 5 },
  revisiones: {
    certVigentes: 22, certPendientes: 0, certAtrasados: 0,
    verRealizadas: 2, verPendientes: 0, verAtrasadas: 0, verSinHoja: 0,
    versionesFechas: 5, versionesPlan: 3,
  },
  cambios: { total: 18, enUsoSinAprobar: 0, pendientes: 0, deVersion: 5, deVersionAprobados: 5 },
  fallasSistema: { abiertas: 0, sinAtender: 0, ultimos90: 2, cerradas: 2 },
  servicemet: {
    instalada: true, total: 9, ultima: { version: '6.4.1+19', estado: 'EN_USO' }, aprobadas: 9,
    anterioresSinDecidir: 0, telefonos: 4, telefonosSinAprobar: 0, versionesSinAprobarEnTelefonos: [],
  },
  patrones: { total: 12, conValores: 8, sinVerificar: 0 },
  ...overrides,
});

const find = (report, id) => report.clausulas.flatMap(clausula => clausula.requisitos).find(requisito => requisito.id === id);

test('cubre 7.5, 7.11 y 8.4 con requisitos únicos y un resumen que cuadra', () => {
  const report = evaluateCompliance(facts());
  const ids = REQUISITOS.map(requisito => requisito.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(report.clausulas.map(clausula => clausula.id), ['7.5', '7.11', '8.4']);
  assert.equal(report.clausulas.reduce((sum, clausula) => sum + clausula.requisitos.length, 0), REQUISITOS.length);
  assert.equal(ESTADOS.reduce((sum, estado) => sum + report.resumen[estado], 0), report.resumen.total);
  for (const clausula of report.clausulas) {
    assert.ok(clausula.requisitos.length > 0, clausula.id);
    assert.ok(clausula.requisitos.every(requisito => requisito.clausula.startsWith(clausula.id)), clausula.id);
  }
});

test('con las migraciones 006 y 007 los controles de 7.5 y 7.11 se cumplen', () => {
  const report = evaluateCompliance(facts());
  for (const id of ['7.5.1-certificados', '7.5.1-verificaciones', '7.5.1-responsables', '7.5.2-equipos',
    '7.5.2-verificaciones', '7.5.2-plan', '7.11.2-validacion', '7.11.2-cambios', '7.11.2-servicemet', '7.11.3-e', '7.11.6']) {
    assert.equal(find(report, id).estado, 'CUMPLE', id);
  }
  assert.equal(find(report, '8.4.2-respaldo').estado, 'LABORATORIO');
  assert.equal(find(report, '8.4.2-conservacion').estado, 'LABORATORIO');
});

test('las contraseñas en texto plano siguen pendientes y se coordinan con el Jefe de Sistemas', () => {
  const requisito = find(evaluateCompliance(facts()), '7.11.3-a');
  assert.equal(requisito.estado, 'PARCIAL');
  assert.equal(requisito.prioridad, 'ALTA');
  assert.match(requisito.brechas.join(' '), /texto plano.*Jefe de Sistemas/);
  assert.match(requisito.accion, /Jefe de Sistemas/);
});

test('sin las migraciones 006 y 007 los controles nuevos no cumplen', () => {
  const report = evaluateCompliance(facts({
    baseDatos: { ...facts().baseDatos, eventosHistorial: false, planHistorial: false, revision: false, cambios: false, fallas: false },
  }));
  for (const [id, numero] of [['7.5.2-verificaciones', '006'], ['7.5.2-plan', '006'], ['7.5.1-responsables', '006'],
    ['7.11.2-validacion', '007'], ['7.11.2-cambios', '007'], ['7.11.3-e', '007']]) {
    const requisito = find(report, id);
    assert.equal(requisito.estado, 'NO_CUMPLE', id);
    assert.match(requisito.accion, new RegExp(`migración ${numero}`), id);
  }
});

test('sin la migración 005 el historial de equipos no cumple', () => {
  const report = evaluateCompliance(facts({
    baseDatos: { ...facts().baseDatos, certificados: false, historial: false },
  }));
  const requisito = find(report, '7.5.2-equipos');
  assert.equal(requisito.estado, 'NO_CUMPLE');
  assert.equal(requisito.prioridad, 'ALTA');
  assert.match(requisito.accion, /migración 005/);
});

test('los datos en vivo cambian el estado', () => {
  const report = evaluateCompliance(facts({
    equipos: { ...facts().equipos, codigosDuplicados: 1, vencimientoInconsistente: 22, sinRegistro: 6 },
    migraciones: { archivos: ['001', '002', '003', '004', '005', '006', '007'], registradas: ['001', '002'] },
    revisiones: { ...facts().revisiones, certPendientes: 23, certAtrasados: 1, verSinHoja: 2 },
    cambios: { total: 18, enUsoSinAprobar: 13, pendientes: 5, deVersion: 5, deVersionAprobados: 2 },
    fallasSistema: { abiertas: 3, sinAtender: 1, ultimos90: 3, cerradas: 0 },
  }));
  assert.equal(find(report, '7.11.3-d').estado, 'NO_CUMPLE');
  assert.equal(find(report, '8.4.2-identificacion').estado, 'PARCIAL');
  assert.match(find(report, '7.11.3-d').brechas.join(' '), /22 equipos guardan un vencimiento/);

  const responsables = find(report, '7.5.1-responsables');
  assert.equal(responsables.estado, 'PARCIAL');
  assert.match(responsables.notas.join(' '), /22 certificados vigentes aún no tienen revisión/);
  assert.match(responsables.notas.join(' '), /6 equipos cargados/);
  assert.equal(find(report, '7.5.1-verificaciones').estado, 'PARCIAL');

  const cambios = find(report, '7.11.2-cambios');
  assert.equal(cambios.estado, 'PARCIAL');
  assert.match(cambios.brechas.join(' '), /13 cambios en uso/);
  assert.match(cambios.brechas.join(' '), /003, 004, 005, 006, 007/);

  const validacion = find(report, '7.11.2-validacion');
  assert.equal(validacion.estado, 'PARCIAL');
  assert.equal(validacion.prioridad, 'ALTA');
  assert.match(validacion.brechas.join(' '), /2\.7\.0 en uso tiene 3 cambios sin validar o aprobar/);

  assert.equal(find(report, '7.11.3-e').estado, 'PARCIAL');
});

test('los respaldos viejos o ausentes no cumplen y sin permiso queda en manos del laboratorio', () => {
  const viejo = evaluateCompliance(facts({ respaldos: { total: 8, ultimo: '2026-04-17 10:21', horas: 4000, ultimos30: 0 } }));
  assert.equal(find(viejo, '8.4.2-respaldo').estado, 'NO_CUMPLE');
  const atrasado = evaluateCompliance(facts({ respaldos: { total: 40, ultimo: '2026-10-02 08:00', horas: 80, ultimos30: 26 } }));
  assert.equal(find(atrasado, '8.4.2-respaldo').estado, 'PARCIAL');
  const sinPermiso = find(evaluateCompliance(facts({ respaldos: null })), '8.4.2-respaldo');
  assert.equal(sinPermiso.estado, 'LABORATORIO');
  assert.match(sinPermiso.notas.join(' '), /no tiene permiso/);
});

test('si fallan todas las consultas evalúa igual sin romperse', () => {
  const report = evaluateCompliance(facts({
    version: null, baseDatos: null, respaldos: null, migraciones: { archivos: ['001'], registradas: null },
    equipos: null, certificados: null, historial: null, eventos: null, programas: null, fallas: null, accesos: null,
    revisiones: null, cambios: null, fallasSistema: null, servicemet: null, patrones: null,
  }));
  const requisitos = report.clausulas.flatMap(clausula => clausula.requisitos);
  assert.equal(requisitos.length, REQUISITOS.length);
  assert.ok(requisitos.every(requisito => ESTADOS.includes(requisito.estado)));
  assert.ok(requisitos.every(requisito => requisito.datos.every(dato => dato.etiqueta && dato.valor != null)));
  assert.match(find(report, '7.11.3-d').brechas[0], /No se pudo consultar/);
});

test('el plan de acción ordena por prioridad y deja fuera lo que cumple', () => {
  const { acciones } = evaluateCompliance(facts({ cambios: { total: 18, enUsoSinAprobar: 13, pendientes: 5, deVersion: 5, deVersionAprobados: 2 } }));
  assert.ok(acciones.length > 0);
  assert.ok(acciones.every(accion => accion.estado !== 'CUMPLE' && PRIORIDADES.includes(accion.prioridad)));
  const orden = acciones.map(accion => PRIORIDADES.indexOf(accion.prioridad));
  assert.deepEqual(orden, [...orden].sort((a, b) => a - b));
});

test('las versiones de ServiceMET sin aprobar se señalan, y con más urgencia si ya están en los teléfonos', () => {
  const servicemet = facts().servicemet;
  const sinMigracion = find(evaluateCompliance(facts({ servicemet: { instalada: false } })), '7.11.2-servicemet');
  assert.equal(sinMigracion.estado, 'NO_CUMPLE');
  assert.match(sinMigracion.accion, /migración 014/);

  const enTelefonos = find(evaluateCompliance(facts({
    servicemet: {
      ...servicemet, ultima: { version: '6.4.1+19', estado: 'VALIDADA' }, aprobadas: 8,
      telefonosSinAprobar: 2, versionesSinAprobarEnTelefonos: ['6.4.1+19'],
    },
  })), '7.11.2-servicemet');
  assert.equal(enTelefonos.estado, 'PARCIAL');
  assert.equal(enTelefonos.prioridad, 'ALTA');
  assert.match(enTelefonos.brechas.join(' '), /2 teléfonos usan una versión sin aprobar \(6\.4\.1\+19\)/);
  assert.match(enTelefonos.brechas.join(' '), /6\.4\.1\+19, la más reciente, aún no tiene la aprobación del jefe de Calibración/);

  // Solo faltan las anteriores a este control: pendiente, pero sin urgencia.
  const anteriores = find(evaluateCompliance(facts({ servicemet: { ...servicemet, aprobadas: 1, anterioresSinDecidir: 8 } })), '7.11.2-servicemet');
  assert.equal(anteriores.estado, 'PARCIAL');
  assert.equal(anteriores.prioridad, 'BAJA');

  const sinTelefonos = find(evaluateCompliance(facts({ servicemet: { ...servicemet, telefonos: null, telefonosSinAprobar: null } })), '7.11.2-servicemet');
  assert.equal(sinTelefonos.estado, 'CUMPLE');
  assert.match(sinTelefonos.notas.join(' '), /qué versión usa cada teléfono/);
});

test('describe el vencimiento de la sesión en palabras', () => {
  assert.equal(formatDuration('8h'), '8 horas');
  assert.equal(formatDuration('1d'), '1 día');
  assert.equal(formatDuration('3600'), '3600');
  assert.equal(formatDuration(undefined), null);
});

test('7.11.6 muestra los valores de patrones sin verificar sin dejar de cumplir', () => {
  const verificados = find(evaluateCompliance(facts()), '7.11.6');
  assert.equal(verificados.estado, 'CUMPLE');
  assert.match(verificados.evidencias.join(' '), /quien hizo el último cambio/);
  assert.deepEqual(verificados.datos.find(dato => /patrones/i.test(dato.etiqueta)), {
    etiqueta: 'Patrones con valores sin verificar', valor: '0 de 8', tono: 'neutral',
  });

  const pendientes = find(evaluateCompliance(facts({ patrones: { total: 12, conValores: 8, sinVerificar: 3 } })), '7.11.6');
  assert.equal(pendientes.estado, 'CUMPLE');
  assert.match(pendientes.notas.join(' '), /3 patrones tienen valores del certificado sin verificar/);
  assert.equal(pendientes.datos.find(dato => /patrones/i.test(dato.etiqueta)).tono, 'warning');

  // Sin la migración 016 no se menciona.
  const sinMigracion = find(evaluateCompliance(facts({ patrones: null })), '7.11.6');
  assert.ok(!sinMigracion.evidencias.join(' ').includes('termohigrómetros'));
  assert.ok(sinMigracion.datos.every(dato => !/patrones/i.test(dato.etiqueta)));
});
