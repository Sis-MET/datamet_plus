// Estado de los patrones para los certificados: qué falta hoy y en cuántos
// servicios dejó el cálculo provisional.
const test = require('node:test');
const assert = require('node:assert/strict');
const { estadoActual, estadoPatrones, provisionalEn } = require('../src/services/calibration.patrones.estado');

const HOY = '2026-11-09';
const cert = (datos) => ({ id: 1, numero: 'LP-CCM-0182-2026', fecha: '2026-05-05', vence: '2027-05-05', anulado: false, revisadoPor: 'otra', transcrito: true, ...datos });

test('lo que falta hoy, en orden', () => {
  const equipo = { id: 7, codigo: 'F1-101', instrumento: 'Juego de pesas', estado: 'ACTIVO', certificados: [cert()] };
  assert.deepEqual(estadoActual({ equipo, config: { tipo: 'PESAS' }, piezas: 12, hoy: HOY }).faltan, []);
  assert.deepEqual(estadoActual({ equipo, config: { tipo: 'PESAS' }, piezas: 0, hoy: HOY }).faltan, ['SIN_PIEZAS']);
  assert.deepEqual(estadoActual({ equipo: { ...equipo, certificados: [cert({ revisadoPor: null })] }, config: { tipo: 'PESAS' }, piezas: 3, hoy: HOY }).faltan, ['SIN_VERIFICAR']);
  assert.deepEqual(estadoActual({ equipo: { ...equipo, certificados: [cert({ transcrito: false, revisadoPor: null })] }, config: null, piezas: 0, hoy: HOY }).faltan,
    ['SIN_TIPO', 'SIN_PIEZAS', 'SIN_VALORES']);
  // Vencido: sin certificado vigente hoy.
  assert.deepEqual(estadoActual({ equipo: { ...equipo, certificados: [cert({ vence: '2026-06-01' })] }, config: { tipo: 'PESAS' }, piezas: 3, hoy: HOY }).faltan, ['SIN_CERTIFICADO']);
  // Un termohigrómetro no necesita piezas.
  assert.deepEqual(estadoActual({ equipo: { ...equipo, instrumento: 'Termohigrómetro' }, config: { tipo: 'AMBIENTE' }, piezas: 0, hoy: HOY }).faltan, []);
  assert.deepEqual(estadoActual({ equipo: null, tipoUso: 'PESAS', hoy: HOY }).faltan, ['NO_EXISTE']);
});

test('provisional en un servicio según el estado de ese día', () => {
  assert.equal(provisionalEn({ estado: 'VIGENTE', valores: 'VERIFICADOS', uso: 'PESAS' }, 5), false);
  assert.equal(provisionalEn({ estado: 'VIGENTE', valores: 'VERIFICADOS', uso: 'PESAS' }, 0), true);
  assert.equal(provisionalEn({ estado: 'VIGENTE', valores: 'SIN_VERIFICAR', uso: 'AMBIENTE' }, 0), true);
  assert.equal(provisionalEn({ estado: 'NO_EXISTE', valores: null, uso: 'PESAS' }, 0), true);
});

test('une el uso con el gestor y ordena por lo que más servicios deja provisionales', () => {
  const patrones = new Map([
    ['F1-101', { id: 1, codigo: 'F1-101', instrumento: 'Juego de pesas', estado: 'ACTIVO', certificados: [cert()] }],
    ['M1-202', { id: 2, codigo: 'M1-202', instrumento: 'Juego de pesas', estado: 'ACTIVO', certificados: [cert({ revisadoPor: null })] }],
    ['TH-01', { id: 3, codigo: 'TH-01', instrumento: 'Termohigrómetro', estado: 'ACTIVO', certificados: [cert()] }],
    ['E2-001', { id: 4, codigo: 'E2-001', instrumento: 'Juego de pesas', estado: 'ACTIVO', certificados: [] }],
  ]);
  const p = (codigo, uso, equipoId, valores = 'VERIFICADOS', estado = 'VIGENTE') => ({ codigo, uso, equipoId, valores, estado });
  const usos = [
    { codigo: 'S1', fecha: '2026-10-01', patrones: [p('F1-101', 'PESAS', 1), p('TH-01', 'AMBIENTE', 3)] },
    { codigo: 'S2', fecha: '2026-10-05', patrones: [p('M1-202', 'PESAS', 2, 'SIN_VERIFICAR'), p('TH-01', 'AMBIENTE', 3)] },
    { codigo: 'S3', fecha: '2026-10-07', patrones: [p('M1-202', 'PESAS', 2, 'SIN_VERIFICAR'), p('X-99', 'PESAS', null, null, 'NO_EXISTE')] },
  ];
  const configurados = new Map([[1, { tipo: 'PESAS', clase: 'F1' }], [2, { tipo: 'PESAS', clase: 'M1' }], [3, { tipo: 'AMBIENTE' }], [4, { tipo: 'PESAS', clase: 'E2' }]]);
  const piezas = new Map([[1, 12], [2, 8]]);
  const r = estadoPatrones({ usos, patrones, configurados, piezas, hoy: HOY });
  assert.deepEqual(r.patrones.map(x => [x.codigo, x.listo, x.uso.provisionales, x.uso.servicios]), [
    ['M1-202', false, 2, 2], ['X-99', false, 1, 1], ['E2-001', false, 0, 0], ['TH-01', true, 0, 2], ['F1-101', true, 0, 1],
  ]);
  assert.deepEqual(r.resumen, { patrones: 5, listos: 2, servicios: 3, serviciosProvisionales: 2 });
  assert.equal(r.patrones.find(x => x.codigo === 'TH-01').ultimo, undefined);
  assert.equal(r.patrones.find(x => x.codigo === 'TH-01').uso.ultimo, '2026-10-05');
  assert.deepEqual(r.patrones.find(x => x.codigo === 'E2-001').faltan.map(f => f.codigo), ['SIN_PIEZAS', 'SIN_CERTIFICADO']);
  assert.equal(r.patrones.find(x => x.codigo === 'X-99').faltan[0].texto, 'Darlo de alta en el gestor de equipos');
});
