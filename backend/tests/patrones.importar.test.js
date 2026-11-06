const test = require('node:test');
const assert = require('node:assert/strict');
const { columnaDe, identificacionDe, planDeJuego } = require('../scripts/patrones-importar-excel');
const { parse } = require('../src/services/calibration.validation');

/** Fila de EQUI_VIGENTE con sus columnas por nombre. */
const certificado = (numero, columnas, condiciones = {}) => ({
  numero,
  leer: (nombre) => columnas[nombre],
  temperatura: null,
  humedad: null,
  presion: null,
  ...condiciones,
});

const pieza = (columna, nominalMg, identificacion = '') => ({
  columna, nominalMg, identificacion, densidad: 7950, densidadU: 140, densidadK: 2, densidadOrigen: 'SUPUESTA',
});

const libroDe = (codigo, piezas, certificados) => ({
  juegos: new Map([[codigo, { material: 'Acero inoxidable', clase: 'F1' }]]),
  piezas: new Map([[codigo, piezas]]),
  certificados: new Map([[codigo, certificados]]),
});

const sinPiezas = (numero) => ({ piezas: [], certificado: numero ? { numero } : null });

test('columnaDe pasa la etiqueta de VALORES al nombre de columna de EQUI_VIGENTE', () => {
  assert.deepEqual(columnaDe('0.01'), { gramos: 0.01, sufijo: '10mg', duplicado: 1 });
  assert.deepEqual(columnaDe('0,02_2'), { gramos: 0.02, sufijo: '20mg_2', duplicado: 2 });
  assert.deepEqual(columnaDe('2_2'), { gramos: 2, sufijo: '2g_2', duplicado: 2 });
  assert.deepEqual(columnaDe('20000'), { gramos: 20000, sufijo: '20000g', duplicado: 1 });
  assert.equal(columnaDe('VN'), null);
  assert.equal(columnaDe('0'), null);
});

test('identificacionDe deja la marca que distingue a la pieza', () => {
  assert.equal(identificacionDe('Sin marca', 1, 1), '');
  assert.equal(identificacionDe('', 2, 1), '*');
  assert.equal(identificacionDe('(*)', 2, 0.02), '*');
  // Solo repite el valor nominal.
  assert.equal(identificacionDe('2', 1, 2), '');
  assert.equal(identificacionDe('2*', 2, 2), '*');
  // Marcas propias se conservan.
  assert.equal(identificacionDe('1', 1, 0.01), '1');
  assert.equal(identificacionDe('AQT', 1, 500), 'AQT');
});

test('planDeJuego carga piezas y valores del certificado vigente (µg → mg)', () => {
  const libro = libroDe('F1-101', [pieza('1g', 1000), pieza('2g', 2000), pieza('2g_2', 2000, '*')], [
    certificado('LP-CC-M-0182-2026', {
      D_1g: '4', U_1g: '30', APTO_1g: 'APTO',
      D_2g: '31', U_2g: '40', APTO_2g: 'APTO',
      D_2g_2: '40', U_2g_2: '40', APTO_2g_2: 'NO APTO',
    }, { temperatura: 19.7, humedad: 47.2, presion: 655.5 }),
  ]);
  const plan = planDeJuego({ codigo: 'F1-101', equipo: { id: 7 }, patron: sinPiezas('LP-CC-M-0182-2026'), libro });

  assert.deepEqual(plan.notas, []);
  assert.equal(plan.body.clase, 'F1');
  assert.equal(plan.body.piezas.length, 3);
  assert.equal(plan.valores, 3);
  assert.deepEqual(plan.body.certificado.valores[0], {
    nominalMg: 1000, identificacion: '', documento: null, correccionMg: 0.004, uMg: 0.03, k: 2, conforme: true,
  });
  assert.equal(plan.body.certificado.valores[2].conforme, false);
  assert.equal(plan.body.certificado.humedad, 47.2);
  // Lo que arma el script pasa la misma validación que la pantalla.
  assert.doesNotThrow(() => parse('patron', plan.body));
});

test('planDeJuego no toca un juego que ya tiene piezas', () => {
  const libro = libroDe('F1-101', [pieza('1g', 1000)], []);
  const plan = planDeJuego({
    codigo: 'F1-101', equipo: { id: 7 }, patron: { piezas: [{ id: 1 }], certificado: null }, libro,
  });
  assert.equal(plan.body, null);
  assert.match(plan.notas[0], /ya tiene 1 piezas/);
});

test('planDeJuego carga solo piezas si el vigente en DataMET+ es otro certificado', () => {
  const libro = libroDe('F1-202', [pieza('2000000g', 2e9)], [certificado('LP-CC-M-0451-2026', { D_2000000g: '0', U_2000000g: '1' })]);
  const plan = planDeJuego({ codigo: 'F1-202', equipo: { id: 9 }, patron: sinPiezas('LP-CC-M-0331-2025'), libro });
  assert.equal(plan.body.piezas.length, 1);
  assert.equal(plan.body.certificado, undefined);
  assert.match(plan.notas[0], /el vigente en DataMET\+ es LP-CC-M-0331-2025; en el libro: LP-CC-M-0451-2026/);
});

test('planDeJuego no reparte un único valor entre varias pesas iguales', () => {
  const piezas = [pieza('20000g', 2e7, '1'), pieza('20000g', 2e7, '2'), pieza('10000g', 1e7, '1')];
  const libro = libroDe('M1-1-20XX', piezas, [certificado('0000-C03-P1-26', {
    D_20000g: '0', U_20000g: '300000', D_10000g: '0', U_10000g: '150000',
  })]);
  const plan = planDeJuego({ codigo: 'M1-1-20XX', equipo: { id: 3 }, patron: sinPiezas('0000-C03-P1-26'), libro });
  assert.equal(plan.valores, 1);
  assert.equal(plan.body.certificado.valores[0].nominalMg, 1e7);
  assert.match(plan.notas.join(' '), /un solo valor para 2 piezas de 20 kg/);
});

test('planDeJuego deja vacías las condiciones fuera de rango y anota de qué certificado es cada valor', () => {
  const libro = libroDe('M1-1-01XX', [pieza('1000g', 1e6), pieza('500g', 5e5)], [
    certificado('LP-CC-M-0505-2026', { D_1000g: '10', U_1000g: '500' }, { temperatura: 20.4, humedad: 519, presion: 6492 }),
    certificado('LP-CC-M-0506-2026', { D_500g: '5', U_500g: '250' }),
  ]);
  const plan = planDeJuego({
    codigo: 'M1-1-01XX', equipo: { id: 4 }, patron: sinPiezas('LP-CC-M-0505-2026 / LP-CC-M-0506-2026'), libro,
  });
  assert.equal(plan.body.certificado.temperatura, 20.4);
  assert.equal(plan.body.certificado.humedad, null);
  assert.equal(plan.body.certificado.presion, null);
  assert.match(plan.notas.join(' '), /humedad 519, presión 6492/);
  assert.deepEqual(plan.body.certificado.valores.map(v => v.documento), ['LP-CC-M-0505-2026', 'LP-CC-M-0506-2026']);
  assert.doesNotThrow(() => parse('patron', plan.body));
});
