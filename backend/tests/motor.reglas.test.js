// Reglas de cálculo que el laboratorio elige en la configuración del método
// (Calibración › Método de cálculo) y evaluación USP ⟨41⟩ del anexo. Cada
// opción se compara con su cálculo a mano; las de omisión reproducen la
// versión 1 (motor.euramet, motor.sim y motor.servicio).
const test = require('node:test');
const assert = require('node:assert/strict');
const motor = require('../src/services/calibracion/motor');
const { calcularServicio, reglasDe } = require('../src/services/calibracion/motor/servicio');
const { modeloDeFila } = require('../src/services/calibration.fuente');
const { empR111 } = require('../src/services/calibration.patrones');

const cerca = (actual, esperado, tolerancia = 1e-12) => assert.ok(Math.abs(actual - esperado) <= tolerancia, `${actual} ≠ ${esperado}`);

test('s de repetibilidad: la de los dos ensayos que encierran la carga o la mayor de todos', () => {
  const ensayos = [{ carga: 100, s: 0.5, nu: 4 }, { carga: 500, s: 0.2, nu: 4 }, { carga: 1000, s: 0.8, nu: 2 }];
  assert.equal(motor.repetibilidadPara(50, ensayos).s, 0.5);
  assert.equal(motor.repetibilidadPara(300, ensayos).s, 0.5);
  assert.equal(motor.repetibilidadPara(700, ensayos, 'ENCIERRAN').s, 0.8);
  // La del libro: la mayor en todo el rango, también en cargas bajas.
  assert.equal(motor.repetibilidadPara(50, ensayos, 'MAYOR').s, 0.8);
  assert.equal(motor.repetibilidadPara(300, ensayos, 'MAYOR').nu, 2);
  // Con s iguales, la de menos lecturas.
  assert.equal(motor.repetibilidadPara(10, [{ carga: 10, s: 0.3, nu: 9 }, { carga: 20, s: 0.3, nu: 4 }], 'MAYOR').nu, 4);
});

test('factor de cobertura: t de Student con la probabilidad elegida o k fijo', () => {
  // GUM, tabla G.2 al 95 %.
  const al95 = { 1: 12.71, 2: 4.3, 4: 2.78, 10: 2.23, 20: 2.09, 50: 2.01 };
  for (const [nu, t] of Object.entries(al95)) assert.equal(motor.factorCobertura(Number(nu), { probabilidad: 0.95 }), t);
  assert.equal(motor.factorCobertura(Infinity, { probabilidad: 0.95 }), 1.96);
  // Por omisión, 95,45 % (decisión 2).
  assert.equal(motor.factorCobertura(4), 2.87);
  assert.equal(motor.factorCobertura(4, { metodo: 'FIJO', k: 2 }), 2);
  assert.equal(motor.factorCobertura(Infinity, { metodo: 'FIJO', k: 2.5 }), 2.5);
});

test('redondeo de U: cifras significativas y sentido', () => {
  assert.deepEqual(motor.redondearIncertidumbre(0.000931), { valor: 0.00094, decimales: 5 });
  assert.deepEqual(motor.redondearIncertidumbre(0.000931, { cifras: 2, sentido: 'CERCANO' }), { valor: 0.00093, decimales: 5 });
  assert.deepEqual(motor.redondearIncertidumbre(0.000935, { cifras: 2, sentido: 'CERCANO' }), { valor: 0.00094, decimales: 5 });
  assert.deepEqual(motor.redondearIncertidumbre(0.000931, { cifras: 1 }), { valor: 0.001, decimales: 3 });
  assert.deepEqual(motor.redondearIncertidumbre(0.000931, { cifras: 1, sentido: 'CERCANO' }), { valor: 0.0009, decimales: 4 });
  assert.deepEqual(motor.redondearIncertidumbre(0.0009312, { cifras: 3 }), { valor: 0.000932, decimales: 6 });
  // Al subir de 99 pasa a la década siguiente.
  assert.deepEqual(motor.redondearIncertidumbre(0.00995), { valor: 0.01, decimales: 3 });
  assert.deepEqual(motor.redondearIncertidumbre(9.96, { cifras: 2, sentido: 'CERCANO' }), { valor: 10, decimales: 0 });
});

test('excentricidad: método 3 resta el retorno a cero; método 1 no', () => {
  const posiciones = [{ indicacion: 100, retorno: 0 }, { indicacion: 100.3, retorno: 0.1 }, { indicacion: 99.8, retorno: -0.1 }];
  const m3 = motor.excentricidad({ posiciones, carga: 100 });
  const m1 = motor.excentricidad({ posiciones, carga: 100, metodo: 'METODO_1' });
  assert.deepEqual(m3.diferencias.map(d => Number(d.toFixed(6))), [0.2, -0.1]);
  assert.deepEqual(m1.diferencias.map(d => Number(d.toFixed(6))), [0.3, -0.2]);
  cerca(m1.uRel, 0.3 / (2 * 100 * Math.sqrt(3)));
});

test('emp en servicio con el factor del método y banda de guarda de la regla conservadora', () => {
  // Clase III, e = 1, 600 e → emp de verificación 1 e.
  assert.equal(motor.empEnServicio({ carga: 600, clase: 'III', e: 1 }), 2);
  assert.equal(motor.empEnServicio({ carga: 600, clase: 'III', e: 1 }, 1), 1);
  assert.equal(motor.empEnServicio({ carga: 600, clase: 'III', e: 1 }, 1.5), 1.5);
  const base = { error: 0.5, U: 0.4, k: 2, tolerancia: 1, regla: 'CONSERVADORA' };
  assert.equal(motor.conformidad(base).conforme, true); // 0,5 + 0,4 ≤ 1
  assert.equal(motor.conformidad({ ...base, bandaGuarda: 1.5 }).conforme, false); // 0,5 + 0,6 > 1
  assert.equal(motor.conformidad({ ...base, bandaGuarda: 0 }).conforme, true);
  cerca(motor.conformidad({ ...base, bandaGuarda: 0.5 }).margen, 0.3);
});

test('clase sugerida: Tabla 3 de la R76 o solo por n, como el libro', () => {
  // 50 g con e = 0,01 g: n = 5 000 → la Tabla 3 admite la II; por n, la III.
  const rangos = [{ max: 50, d: 0.01, e: 0.01 }];
  assert.equal(motor.claseSugerida(rangos, 1).valor, 'II');
  const porN = motor.claseSugerida(rangos, 1, 'POR_N');
  assert.deepEqual(porN, { valor: 'III', n: 5000, e: 0.01, enTabla: false, regla: 'POR_N' });
});

test('densidad del aire con la fórmula elegida', () => {
  const lecturas = { inicio: { t: 18, hr: 40, p: 650 }, fin: { t: 20, hr: 44, p: 652 } };
  const cipm = motor.aireDeCalibracion(lecturas);
  const aprox = motor.aireDeCalibracion({ ...lecturas, formula: 'APROXIMADA' });
  assert.equal(cipm.formula, 'CIPM-2007');
  assert.equal(aprox.formula, 'APROXIMADA');
  cerca(aprox.rho, motor.densidadAproximada({ t: 19, hr: 42, p: 651 }));
  cerca(cipm.rho, motor.densidadCIPM2007({ t: 19, hr: 42, p: 651 }));
  // La incertidumbre de la fórmula aproximada es mayor.
  assert.ok(aprox.u > cipm.u);
  cerca(motor.densidadAire({ t: 19, hr: 42, p: 651 }, 'APROXIMADA'), aprox.rho);
});

test('las reglas por omisión son las de la versión 1', () => {
  assert.deepEqual(reglasDe(motor.CONFIGURACION_V1), reglasDe({}));
  assert.deepEqual(reglasDe({}), {
    repetibilidad: 'ENCIERRAN',
    cobertura: { metodo: 'T_STUDENT', probabilidad: 0.9545, k: 2 },
    redondeo: { cifras: 2, sentido: 'ARRIBA' },
    aire: 'CIPM-2007',
    excentricidad: 'METODO_3',
    bandaGuarda: 1,
    riesgoUmbral: 0.05,
    riesgo: 'DOS_COLAS',
    presentacion: { decimales: 'POR_U', k: 'DOS_DECIMALES' },
    factorEmp: 2,
    claseSugerida: 'TABLA_3',
  });
});

// ─── Un servicio con otras reglas ──────────────────────────────────────────

const fila = (extra = {}) => ({
  codigo_registro: 'REGLAS-1', seca: '0103-31-C05-26', n_reca: '5', personal: 'Usuario',
  fecha_servicio: new Date('2026-07-23T00:00:00Z'), unidades: 'g',
  cap_max1: 600, d1: 0.01, e1: 0.1, dec1: 2,
  equipo1: 'F1-TEST', equipo6: 'TH-TEST',
  hora: new Date('1970-01-01T11:00:00Z'), hri: 50, ti: 20, patmi: 650,
  hora_fin: new Date('1970-01-01T12:00:00Z'), hri_fin: 52, ti_fin: 21, patmi_fin: 649.8,
  tipo_plataforma: 'Cuadrada', puntos_ind: 'Cuadrada 5F', carga: 200,
  posicion1: 1, indicacion1: 200, retorno1: 0, posicion2: 2, indicacion2: 200.02, retorno2: 0.01,
  posicion3: 3, indicacion3: 200, retorno3: 0, posicion4: 4, indicacion4: 199.99, retorno4: 0, posicion5: 5, indicacion5: 200, retorno5: 0,
  repetibilidad1: 10, indicacion1_1: 10, indicacion1_2: 10, indicacion1_3: 10, indicacion1_4: 10, indicacion1_5: 10,
  repetibilidad2: 500, indicacion2_1: 500, indicacion2_2: 500.02, indicacion2_3: 499.99, indicacion2_4: 500.01, indicacion2_5: 500,
  metodo: 'Ascenso sin evaluar ceros', metodo_carga: 'Sin método',
  lin1: 10, ind1: 10, lin2: 50, ind2: 50.01, lin3: 200, ind3: 200.01, lin4: 500, ind4: 500.02, lin5: 600, ind5: 600.03,
  emp: 'Sí', indicar: 0, factor: 0, regla_aceptacion: 'Conservadora',
  ...extra,
});

const datos = (configuracion) => ({
  juegos: [{ codigo: 'F1-TEST', clase: 'F1', piezas: [], verificado: true }],
  termohigrometro: null,
  empR111,
  claseInstrumento: 'II',
  configuracion,
});

test('servicio: la s mayor sube U en las cargas bajas; k fijo, banda y factor del emp', () => {
  const { modelo } = modeloDeFila(fila());
  const v1 = calcularServicio(modelo, datos(motor.CONFIGURACION_V1));
  assert.equal(v1.calculado, true);
  assert.deepEqual(v1.reglas, reglasDe({}));
  const libro = calcularServicio(modelo, datos({ ...motor.CONFIGURACION_V1, version: 9, repetibilidad: { regla: 'MAYOR' } }));
  const [p10v1, , , p500v1] = v1.puntos;
  const [p10, , , p500] = libro.puntos;
  // En 10 g la s de su ensayo es 0; con la regla del libro entra la de 500 g.
  assert.ok(p10.u > p10v1.u, `${p10.u} > ${p10v1.u}`);
  cerca(p500.u, p500v1.u);
  assert.equal(libro.reglas.repetibilidad, 'MAYOR');
  assert.equal(libro.configuracion, 9);

  const fijo = calcularServicio(modelo, datos({ ...motor.CONFIGURACION_V1, cobertura: { metodo: 'FIJO', probabilidad: 0.9545, k: 2 } }));
  assert.ok(fijo.puntos.every(p => p.k === 2));

  const emp1 = calcularServicio(modelo, datos({ ...motor.CONFIGURACION_V1, empServicio: { factor: 1 } }));
  v1.puntos.forEach((p, i) => cerca(emp1.puntos[i].tolerancia, p.tolerancia / 2));

  const banda = calcularServicio(modelo, datos({ ...motor.CONFIGURACION_V1, conformidad: { bandaGuarda: 0, riesgoUmbral: 0.05 } }));
  v1.puntos.forEach((p, i) => cerca(banda.puntos[i].conformidad.margen, p.conformidad.margen + p.U));
});

test('presentación por el rango: el error con los decimales del rango y U con uno más', () => {
  const base = { error: -0.10123, U: 0.0812, k: 2, presentacion: { decimales: 'POR_RANGO' }, decimalesRango: 1 };
  assert.deepEqual(motor.presentar({ ...base, redondeo: { cifras: 2, sentido: 'CERCANO' } }), { error: -0.1, U: 0.08, decimales: 1, decimalesU: 2, k: 2 });
  // Hacia arriba nunca declara una U menor que la calculada.
  assert.equal(motor.presentar({ ...base, redondeo: { cifras: 2, sentido: 'ARRIBA' } }).U, 0.09);
  // Una U menor que el último decimal no queda en cero.
  assert.equal(motor.redondearUA(0.004, 2, 'CERCANO'), 0.01);
  // Los decimales del rango: los de ServiceMET o, si faltan, los de d.
  assert.equal(motor.decimalesDeRango({ d: 0.1, decimales: 1 }), 1);
  assert.equal(motor.decimalesDeRango({ d: 0.005 }), 3);
  assert.equal(motor.decimalesDeRango({ d: 1, decimales: 0 }), 0);
  // Por la incertidumbre (versión 1), como antes.
  assert.deepEqual(
    motor.presentar({ error: -0.10123, U: 0.0812, k: 2, redondeo: { cifras: 2, sentido: 'ARRIBA' } }),
    { error: -0.101, U: 0.082, decimales: 3, decimalesU: 3, k: 2 }
  );
});

test('servicio: con decimales por el rango, el error lleva los del rango y U uno más', () => {
  const { modelo } = modeloDeFila(fila());
  const porRango = calcularServicio(modelo, datos({ ...motor.CONFIGURACION_V1, presentacion: { decimales: 'POR_RANGO', k: 'SIN_DECIMALES' } }));
  // El rango declara 2 decimales (dec1).
  assert.ok(porRango.puntos.every(p => p.presentacion.decimales === 2 && p.presentacion.decimalesU === 3));
  assert.equal(porRango.reglas.presentacion.k, 'SIN_DECIMALES');
  // El cálculo no cambia: solo cómo se informa.
  const v1 = calcularServicio(modelo, datos(motor.CONFIGURACION_V1));
  porRango.puntos.forEach((p, i) => cerca(p.U, v1.puntos[i].U));
});

test('riesgo como la planilla: 1 − Φ((T − |E|)/U) con el error y la U que se informan', () => {
  const planilla = (error, U, tolerancia) => motor.conformidad({
    error, U, k: 2, tolerancia, regla: 'SIMPLE', metodoRiesgo: 'PLANILLA', presentado: { error, U },
  }).riesgo;
  // INBOLPACK, CAS 200 kg (0060-11-003), como la planilla: E = 0,0 y U = 0,08 kg.
  assert.equal((planilla(0, 0.08, 0.1) * 100).toFixed(2), '10.56'); // EMP 0,1 kg
  assert.equal((planilla(0, 0.08, 0.2) * 100).toFixed(2), '0.62'); // EMP 0,2 kg: «< 5,00»
  assert.equal((planilla(-0.1, 0.08, 0.2) * 100).toFixed(2), '10.56'); // 150 y 200 kg
  // Con la regla de la versión 1 (dos colas, u = U/k) el mismo punto queda bajo 5 %.
  assert.ok(motor.conformidad({ error: 0, U: 0.08, k: 2, tolerancia: 0.1, regla: 'SIMPLE' }).riesgo < 0.05);
  // El riesgo no cambia la decisión.
  assert.equal(motor.conformidad({ error: 0, U: 0.08, k: 2, tolerancia: 0.1, regla: 'SIMPLE', metodoRiesgo: 'PLANILLA' }).conforme, true);
});

test('no conforme: el riesgo es el de falso rechazo, la probabilidad de estar dentro', () => {
  const planilla = (error, U, tolerancia, regla = 'SIMPLE') => motor.conformidad({
    error, U, k: 2, tolerancia, regla, metodoRiesgo: 'PLANILLA', presentado: { error, U },
  });
  // GRUPO ALCOS (0051-11-008), 35 000 g: E = 0,5 g, U = 0,36 g, EMP 0,3 g.
  const alcos = planilla(0.5, 0.36, 0.3);
  assert.equal(alcos.conforme, false);
  assert.equal((alcos.fuera * 100).toFixed(2), '71.07');
  assert.equal((alcos.riesgo * 100).toFixed(2), '28.93');
  // DELTA (0089-11-015), 5 000 g con los valores de la planilla: E = −0,02 g, U = 0,023 g, EMP 0,01 g → 33,19 %, como el libro.
  assert.equal((planilla(-0.02, 0.023, 0.01).riesgo * 100).toFixed(2), '33.19');
  // Conforme: sigue siendo la de estar fuera (20 000 g: E = 0,1 g, U = 0,22 g, EMP 0,2 g).
  const conforme = planilla(0.1, 0.22, 0.2);
  assert.equal(conforme.conforme, true);
  assert.equal(conforme.riesgo, conforme.fuera);
  assert.equal((conforme.riesgo * 100).toFixed(2), '32.47');
  // Regla conservadora: no conforme dentro de ±T por la banda de guarda; el riesgo es el de estar dentro.
  const banda = planilla(0.05, 0.08, 0.1, 'CONSERVADORA');
  assert.equal(banda.conforme, false);
  assert.ok(Math.abs(banda.riesgo + banda.fuera - 1) < 1e-12 && banda.riesgo > 0.5);
  // Dos colas (versión 1): igual, 1 − la de estar fuera.
  const dosColas = motor.conformidad({ error: 0.03, U: 0.02, k: 2, tolerancia: 0.02, regla: 'SIMPLE' });
  assert.equal(dosColas.conforme, false);
  assert.ok(Math.abs(dosColas.riesgo - (1 - dosColas.fuera)) < 1e-12 && dosColas.riesgo < 0.5);
});

// ─── USP ⟨41⟩ ──────────────────────────────────────────────────────────────

test('USP ⟨41⟩: repetibilidad con la s mínima, exactitud, pesas y peso mínimo', () => {
  const rangos = [{ max: 600, d: 0.01 }];
  const ensayos = [{ carga: 10, s: 0 }, { carga: 500, s: 0.0115 }];
  const puntos = [
    { carga: 10, error: 0, uReferencia: 0.0001, presentacion: { error: 0, decimales: 3 } },
    { carga: 50, error: 0.04, uReferencia: 0.0002, presentacion: { error: 0.04, decimales: 3 } },
    { carga: 500, error: 0.6, uReferencia: 0.09, presentacion: { error: 0.6, decimales: 2 } },
  ];
  const r = motor.evaluarUSP({ rangos, ensayos, puntos, pesadaMinima: { exactitudes: [0.001, 0.01], factores: [1, 2] } });
  // m = 5 % de 600 g = 30 g; s = máx(0,0115; 0,41 · 0,01) = 0,0115 g.
  cerca(r.repetibilidad.carga, 30);
  cerca(r.repetibilidad.s, 0.0115);
  cerca(r.repetibilidad.valor, (2 * 0.0115) / 30);
  assert.equal(r.repetibilidad.cumple, true); // 0,077 % ≤ 0,10 %
  cerca(r.repetibilidad.pesoMinimo, 23, 1e-9); // 2 · 0,0115 / 0,001
  // Exactitud entre 30 g y 600 g: 10 g queda fuera.
  assert.deepEqual(r.exactitud.filas.map(f => f.carga), [50, 500]);
  const [f50, f500] = r.exactitud.filas;
  cerca(f50.limite, 0.05);
  assert.equal(f50.cumple, true); // 0,04 ≤ 0,05
  assert.equal(f50.pesasAdecuadas, true); // 0,0004 ≤ 0,0167
  assert.equal(f500.cumple, false); // 0,6 > 0,5
  assert.equal(f500.pesasAdecuadas, false); // 0,18 > 0,167
  // Peso mínimo: 2 · s · SF / exactitud; el que supera Max no sale.
  cerca(r.pesoMinimo.filas[0].valores[0], 23, 1e-9);
  cerca(r.pesoMinimo.filas[0].valores[1], 46, 1e-9);
  cerca(r.pesoMinimo.filas[1].valores[0], 2.3, 1e-9);

  // Repetibilidad perfecta: manda 0,41 d; con otros límites del laboratorio.
  const s0 = motor.evaluarUSP({ rangos, ensayos: [{ carga: 10, s: 0 }], puntos, configuracion: { ...motor.USP_INICIAL, tolerancia: 0.0003, sMinimaEnD: 0.5 } });
  cerca(s0.repetibilidad.s, 0.005);
  cerca(s0.repetibilidad.valor, (2 * 0.005) / 30);
  assert.equal(s0.repetibilidad.cumple, false); // 0,033 % > 0,03 %
  assert.equal(motor.evaluarUSP({ rangos, ensayos: [], puntos }), null);
});

test('USP ⟨41⟩ en el servicio con la configuración del método', () => {
  const { modelo } = modeloDeFila(fila());
  const r = calcularServicio(modelo, datos(motor.CONFIGURACION_V1));
  assert.ok(r.usp);
  cerca(r.usp.repetibilidad.carga, 30);
  assert.deepEqual(r.usp.exactitud.filas.map(f => f.carga), [50, 200, 500, 600]);
  const sinUsp = calcularServicio(modelo, datos({ ...motor.CONFIGURACION_V1, usp: undefined }));
  assert.equal(sinUsp.usp, null);
});
