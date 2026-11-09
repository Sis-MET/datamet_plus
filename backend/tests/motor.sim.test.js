// Evidencia de validación del motor de cálculo (NB/ISO/IEC 17025, 7.11.6):
// ejemplos del Apéndice G de la Guía SIM MWG7/cg-01 (2009), la traducción de
// EURAMET cg-18 v2.0 que también declara el laboratorio.
//
// La guía combina valores ya redondeados a la cifra que imprime y toma 100
// grados de libertad para las componentes tipo B (nota 10 de G1); el motor no
// redondea en el camino y usa ν = ∞ para ellas, como EURAMET v4 (Anexo H).
// Por eso cada ejemplo comprueba primero las componentes al redondeo de la
// guía y después la combinación con la convención de la guía.
const test = require('node:test');
const assert = require('node:assert/strict');
const motor = require('../src/services/calibracion/motor');

const cerca = (actual, esperado, tolerancia, mensaje) => {
  const rel = Math.abs(actual - esperado) / Math.max(Math.abs(esperado), 1e-30);
  assert.ok(rel <= tolerancia, `${mensaje}: ${actual} frente a ${esperado} (diferencia relativa ${rel.toExponential(2)})`);
};
const redondear = (x, decimales) => Math.round(x * 10 ** decimales) / 10 ** decimales;
const fuente = (componentes, nombre) => componentes.find(c => c.fuente === nombre)?.u ?? 0;
// Las componentes tipo B con 100 grados de libertad, como en la guía.
const conNuB100 = componentes => componentes.map(c => (Number.isFinite(c.nu) ? c : { ...c, nu: 100 }));

// ─── G1: 200 g, d = 0,1 mg ─────────────────────────────────────────────────
// Pesas E2 por su valor nominal (u = emp/√3, 7.1.2-3), deriva D = emp/3 y
// balanza ajustada justo antes de calibrar (empuje por 7.1.2-5c).

const G1 = {
  d: 0.0001,
  repetibilidad: [100.0002, 99.9999, 100.0001, 100.0000, 100.0002, 100.0002],
  excentricidad: [100.0005, 100.0003, 100.0004, 100.0006, 100.0004],
  emp: { 10: 0.00006, 20: 0.00008, 50: 0.0001, 100: 0.00016, 200: 0.0003 },
  // Indicación, pesas y lo que publica la guía en G1.3 (mg).
  puntos: [
    { I: 30.0001, piezas: [10, 20], E: 0.1, mc: 0.08, mD: 0.03, mB: 0.02, uE: 0.165, nu: 12, k: 2.23, U: 0.37 },
    { I: 60.0003, piezas: [10, 50], E: 0.3, mc: 0.09, mD: 0.03, mB: 0.02, uE: 0.170, nu: 14, k: 2.20, U: 0.37 },
    { I: 100.0004, piezas: [100], E: 0.4, mc: 0.09, mD: 0.03, mB: 0.02, uE: 0.170, nu: 14, k: 2.20, U: 0.37 },
    { I: 150.0006, piezas: [50, 100], E: 0.6, mc: 0.15, mD: 0.05, mB: 0.04, uE: 0.215, nu: 34, k: 2.08, U: 0.45 },
    { I: 200.0009, piezas: [200], E: 0.9, mc: 0.17, mD: 0.06, mB: 0.04, uE: 0.232, nu: 44, k: 2.06, U: 0.48 },
  ],
};
const pesaG1 = n => ({ nominal: n, correccion: null, U: G1.emp[n] / 3, k: 2, emp: G1.emp[n], clase: 'E2' });
const mg = x => redondear(x * 1000, 2); // g → mg con dos decimales, como la tabla

const presupuestoG1 = (punto) => {
  const rep = motor.repetibilidad(G1.repetibilidad);
  const referencia = motor.masaReferencia(punto.piezas.map(pesaG1), { unidad: 'g', empuje: '5c', kD: 1 });
  // Todas las cargas al centro: la excentricidad no cuenta (G1.3).
  const componentesI = motor.componentesIndicacion(punto.I, { d0: G1.d, dI: G1.d, s: rep.s, nuS: rep.nu, uRelEcc: 0 });
  return { rep, referencia, componentesI, r: motor.errorEnPunto({ indicacion: punto.I, componentesI, referencia }) };
};

test('G1: repetibilidad, excentricidad y componentes al redondeo de la guía (7.1.1, 7.1.2)', () => {
  const rep = motor.repetibilidad(G1.repetibilidad);
  assert.equal(mg(rep.s), 0.13);
  assert.equal(rep.nu, 5);
  const ecc = motor.excentricidad({ posiciones: G1.excentricidad.map(indicacion => ({ indicacion, retorno: 0 })), carga: 100 });
  cerca(ecc.maxima, 0.0002, 1e-6, '|ΔIecc|máx');
  for (const punto of G1.puntos) {
    const { componentesI, referencia, r } = presupuestoG1(punto);
    const nombre = `G1 ${punto.I} g`;
    assert.equal(mg(fuente(componentesI, 'redondeoCero')), 0.03, `${nombre} d0/√12`);
    assert.equal(mg(fuente(componentesI, 'redondeoCarga')), 0.03, `${nombre} dI/√12`);
    assert.equal(mg(fuente(referencia.componentes, 'certificado')), punto.mc, `${nombre} u(δmc)`);
    assert.equal(mg(fuente(referencia.componentes, 'deriva')), punto.mD, `${nombre} u(δmD)`);
    assert.equal(mg(fuente(referencia.componentes, 'empuje')), punto.mB, `${nombre} u(δmB)`);
    cerca(r.error * 1000, punto.E, 1e-6, `${nombre} E`);
  }
});

test('G1: u(E), νeff, k y U con la convención de la guía (7.1.3, B3-1)', () => {
  for (const punto of G1.puntos) {
    const { componentesI, referencia, r } = presupuestoG1(punto);
    const nombre = `G1 ${punto.I} g`;
    // La guía redondea cada componente a la centésima de mg y u(I) a 0,14 mg.
    const s = mg(fuente(componentesI, 'repetibilidad'));
    const tipoB = [
      mg(fuente(componentesI, 'redondeoCero')), mg(fuente(componentesI, 'redondeoCarga')),
      mg(fuente(referencia.componentes, 'certificado')), mg(fuente(referencia.componentes, 'deriva')), mg(fuente(referencia.componentes, 'empuje')),
    ];
    const uI = redondear(Math.sqrt(s ** 2 + tipoB[0] ** 2 + tipoB[1] ** 2), 2);
    assert.equal(uI, 0.14, `${nombre} u(I)`);
    const uE = Math.sqrt(uI ** 2 + tipoB.slice(2).reduce((suma, u) => suma + u * u, 0));
    cerca(uE, punto.uE, 4e-3, `${nombre} u(E)`);
    // νeff con ν = 5 para s y 100 para las tipo B (nota 10); la guía arrastra el redondeo de u(E).
    const nu = uE ** 4 / (s ** 4 / 5 + tipoB.reduce((suma, u) => suma + u ** 4 / 100, 0));
    assert.ok(Math.abs(Math.floor(nu) - punto.nu) <= 1, `${nombre} νeff ${nu} frente a ${punto.nu}`);
    assert.equal(motor.factorCobertura(nu), punto.k, `${nombre} k`);
    assert.equal(redondear(motor.factorCobertura(nu) * uE, 2), punto.U, `${nombre} U`);
    // Sin redondear en el camino, el motor da una U algo menor (a lo sumo un 4,5 %).
    assert.ok(r.U * 1000 <= punto.U && r.U * 1000 >= punto.U * 0.955, `${nombre} U del motor ${r.U * 1000}`);
  }
});

test('G1: recta por el origen y términos de la pesada en uso (C2.2-16, 7.4)', () => {
  // E y u(E) de la guía en g.
  const puntos = G1.puntos.map(p => ({ I: Math.round(p.I), E: p.E / 1000, u: p.uE / 1000 }));
  const { a1, u } = motor.pendienteOrigen(puntos);
  cerca(a1, 4.27e-6, 2e-3, 'a1');
  cerca(u, 0.76e-6, 2e-3, 'u(a1)');
  // ±1 K (ΔT = 2 K) y TC = 1,5×10⁻⁶/K; cargas no siempre centradas (efecto completo, 7.4.4-10).
  const rep = motor.repetibilidad(G1.repetibilidad);
  const uso = motor.incertidumbreEnUso({
    rangos: [{ max: 200, d: G1.d }], d0: G1.d, puntos, s: rep.s, eccMaxima: 0.0002, eccCarga: 100,
    configuracion: { k: 2, deltaT: 2, kT: 1.5e-6 },
  });
  cerca(uso.terminos.urelTemp, 0.87e-6, 5e-3, 'ŵ(Rtemp)');
  cerca(uso.terminos.urelEcc, 1.15e-6, 5e-3, 'ŵ(Recc)');
});

test('G1: linealización de U(W), incertidumbre global y pesada mínima (7.5.2-3d/e, G-9)', () => {
  // u²(W) = 0,0178 mg² + 4,0×10⁻¹²·R² (G1.4.2), en g.
  const g = motor.linealizar({ alfa2: 0.0178e-6, beta2: 4.0e-12, k: 2, max: 200, a1: 4.27e-6 });
  assert.equal(mg(g.U0), 0.27);
  cerca(g.C, 2.88e-6, 2e-3, 'pendiente de U(W)');
  cerca(g.Ugl(200) - g.Ugl(100), 7.15e-6 * 100, 2e-3, 'pendiente de Ugl');
  // «Tolerancia de 1 % para R ≥ 30 mg y de 0,1 % para R ≥ 280 mg» (G1.4.3), con Ugl ≈ 0,27 mg + 7,15×10⁻⁶·R.
  const minima = exactitud => motor.pesadaMinima({ alfaGl: 0.27e-3, betaGl: 7.15e-6, exactitud });
  assert.equal(Math.ceil(minima(0.01) * 100) / 100, 0.03);
  assert.equal(Math.ceil(minima(0.001) * 100) / 100, 0.28);
});

// ─── G2: 60 kg multi-intervalo (12/30/60 kg; d = 2/5/10 g) ─────────────────
// Pesas M1 de acero por su valor nominal (50 mg/kg), deriva D = emp/2. El
// empuje es insignificante (nota 14): se modela con 7.1.2-5a al aire de
// referencia y la u(ρa) de la guía.

const G2 = {
  d0: 2,
  s1: [9998, 10000, 9998, 10000, 10000],
  s2: [29995, 30000, 29995, 29995, 30000],
  pesa: kg => ({ nominal: kg * 1000, correccion: null, U: (0.05 * kg) / 3, k: 2, emp: 0.05 * kg, clase: 'M1', densidad: 7950, uDensidad: 70 }),
  opciones: { unidad: 'g', empuje: '5a', aire: { rho: 1.2, u: 0.0207 }, kD: 1.5 },
  // Indicación (g), pesas (kg), d y lo que publica la guía en G2.3 (g).
  puntos: [
    { I: 10000, piezas: [10], dI: 2, s: 's1', uI: 1.37, uE: 1.41, nu: 10, k: 2.28, U: 3.2 },
    { I: 24995, piezas: [20, 5], dI: 5, s: 's2', uI: 3.15, uE: 3.25, nu: 7, k: 2.43, U: 7.9 },
    { I: 39990, piezas: [20, 20], dI: 10, s: 's2', uI: 4.02, uE: 4.22, nu: 21, k: 2.13, U: 9.0 },
    { I: 59990, piezas: [20, 20, 20], dI: 10, s: 's2', uI: 4.02, uE: 4.46, nu: 26, k: 2.10, U: 9.4 },
    // Netas, con 25 kg tarados: la carga de tara no entra en mref y d es el del valor neto.
    { I: 9998, piezas: [10], dI: 2, s: 's1', uI: 1.37, uE: 1.41, nu: 10, k: 2.28, U: 3.2 },
    { I: 19995, piezas: [20], dI: 5, s: 's2', uI: 3.15, uE: 3.22, nu: 7, k: 2.43, U: 7.8 },
  ],
};

test('G2: repetibilidad por intervalo y error con u(E), νeff, k y U por punto', () => {
  const rep = { s1: motor.repetibilidad(G2.s1), s2: motor.repetibilidad(G2.s2) };
  assert.equal(redondear(rep.s1.s, 2), 1.1);
  assert.equal(redondear(rep.s2.s, 2), 2.74);
  for (const punto of G2.puntos) {
    const { s, nu } = rep[punto.s];
    const referencia = motor.masaReferencia(punto.piezas.map(G2.pesa), G2.opciones);
    const componentesI = motor.componentesIndicacion(punto.I, { d0: G2.d0, dI: punto.dI, s, nuS: nu, uRelEcc: 0 });
    const r = motor.errorEnPunto({ indicacion: punto.I, componentesI, referencia });
    const nombre = `G2 ${punto.I} g`;
    assert.equal(redondear(r.uIndicacion, 2), punto.uI, `${nombre} u(I)`);
    assert.equal(redondear(fuente(referencia.componentes, 'certificado'), 2), redondear(0.05 * punto.piezas.reduce((a, b) => a + b, 0) / Math.sqrt(3), 2), `${nombre} u(δmc)`);
    cerca(r.u, punto.uE, 5e-3, `${nombre} u(E)`);
    // Con ν = 100 para las tipo B (como la guía), νeff y k coinciden.
    const nuEff = motor.gradosEfectivos(conNuB100(r.componentes));
    assert.equal(Math.floor(nuEff), punto.nu, `${nombre} νeff`);
    assert.equal(motor.factorCobertura(nuEff), punto.k, `${nombre} k`);
    assert.equal(redondear(punto.k * r.u, 1), punto.U, `${nombre} U`);
    // Con ν = ∞ (motor), k baja a lo sumo 0,01 y U queda dentro del 1 %.
    assert.ok(r.k <= punto.k && r.k >= punto.k - 0.011, `${nombre} k del motor ${r.k}`);
    cerca(r.U, punto.U, 1e-2, `${nombre} U del motor`);
  }
});

test('G2: recta por el origen con 4 y con 6 indicaciones (C2.2-16)', () => {
  const puntos = G2.puntos.map((p, i) => ({ I: [10000, 25000, 40000, 60000, 10000, 20000][i], E: [0, -5, -10, -10, -2, -5][i], u: p.uE }));
  const cuatro = motor.pendienteOrigen(puntos.slice(0, 4));
  cerca(cuatro.a1, -1.69e-4, 4e-3, 'a1 con 4');
  cerca(cuatro.u, 5.13e-5, 2e-3, 'u(a1) con 4');
  const seis = motor.pendienteOrigen(puntos);
  cerca(seis.a1, -1.79e-4, 4e-3, 'a1 con 6');
  cerca(seis.u, 4.62e-5, 2e-3, 'u(a1) con 6');
});

// ─── G3: 30 t, d = 10 kg (dT = 1 kg) con 4 cargas de sustitución ───────────
// Patrón: 12 pesas M1 de 500 kg por su valor nominal (u = emp/√3) y D = emp.
// Se usan las u(I) de la guía: incluyen la deriva bajo carga (G3.5.3), que el
// motor no agrega porque ServiceMET no registra tiempos de carga.

test('G3: patrón, cargas de sustitución y error (7.1.2-3, 7.1.2-11, 7.1.2-15a)', () => {
  const rep = motor.repetibilidad([10411, 10414, 10418, 10412, 10418]);
  cerca(rep.s, 3.3, 1e-2, 's');
  const pesas = Array.from({ length: 12 }, () => ({ nominal: 500, correccion: null, U: null, k: 2, emp: 0.025, clase: 'M1' }));
  const mref = motor.masaReferencia(pesas, { unidad: 'kg', empuje: '5d' });
  cerca(fuente(mref.componentes, 'certificado'), 0.173, 2e-3, 'u(δmc)');
  cerca(fuente(mref.componentes, 'deriva'), 0.173, 2e-3, 'u(δmD)');
  // La guía estima el empuje con la densidad del hierro fundido: 7,2×10⁻⁶·mc1 = 0,043 kg.
  const uMc1 = Math.sqrt(fuente(mref.componentes, 'certificado') ** 2 + fuente(mref.componentes, 'deriva') ** 2 + (7.2e-6 * 6000) ** 2);
  cerca(uMc1, 0.25, 1e-2, 'u(mc1)');

  // 6 000 kg solo con pesas: u(I) con dT = 1 kg y la excentricidad de G3.5.2 (6,9×10⁻⁵·I).
  const componentesI = motor.componentesIndicacion(6001, { d0: 1, dI: 1, s: rep.s, nuS: rep.nu, uRelEcc: 6.9e-5 });
  const r = motor.errorEnPunto({
    indicacion: 6001, componentesI, referencia: { mref: 6000, u: uMc1, componentes: [{ fuente: 'patron', u: uMc1, nu: Infinity }] },
  });
  assert.equal(redondear(r.uIndicacion, 2), 3.34);
  cerca(r.u, 3.36, 5e-3, 'u(E) 6 000 kg');
  assert.equal(Math.floor(r.nuEff), 4);
  assert.equal(r.k, 2.87);
  assert.equal(redondear(r.U, 1), 9.6);

  // LTj = j·mc1 + ΣΔI: u²(LTj) = j²·u²(mc1) + 2·Σu²(I) (7.1.2-15a).
  const uI = [3.34, 3.54, 3.80, 4.14, 4.54];
  const guia = [
    { uLT: 4.76, uE: 5.93, nu: 35, k: 2.07, U: 12.3 },
    { uLT: 6.93, uE: 7.90, nu: 74, k: 2.03, U: 16.0 },
    { uLT: 8.80, uE: 9.74, nu: 100, k: 2.03, U: 19.8 },
    { uLT: 10.62, uE: 11.56, nu: 113, k: 2.02, U: 23.4 },
  ];
  guia.forEach((esperado, i) => {
    const j = i + 2;
    const lt = motor.cargaSustitucion({ mref: 6000, uMref: uMc1, diferencias: Array(j - 1).fill(0), uIndicaciones: uI.slice(0, j - 1) });
    const nombre = `G3 LT${j}`;
    cerca(lt.u, esperado.uLT, 5e-3, `${nombre} u(LT)`);
    const uE = Math.sqrt(uI[j - 1] ** 2 + lt.u ** 2);
    cerca(uE, esperado.uE, 5e-3, `${nombre} u(E)`);
    assert.equal(motor.factorCobertura(esperado.nu), esperado.k, `${nombre} k`);
    cerca(esperado.k * uE, esperado.U, 6e-3, `${nombre} U`);
  });
});
