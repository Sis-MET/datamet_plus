// Evidencia de validación del motor de cálculo (NB/ISO/IEC 17025, 7.11.6):
// ejemplos de EURAMET cg-18 v4.0 Anexo H y casos por ecuación.
const test = require('node:test');
const assert = require('node:assert/strict');
const motor = require('../src/services/calibracion/motor');

const cerca = (actual, esperado, tolerancia, mensaje) => {
  const rel = Math.abs(actual - esperado) / Math.max(Math.abs(esperado), 1e-30);
  assert.ok(rel <= tolerancia, `${mensaje}: ${actual} frente a ${esperado} (diferencia relativa ${rel.toExponential(2)})`);
};

// ─── GUM Tabla G.2 y redondeo ──────────────────────────────────────────────

test('GUM G.2: t de Student al 95,45 %', () => {
  const tabla = { 1: 13.97, 2: 4.53, 3: 3.31, 4: 2.87, 5: 2.65, 6: 2.52, 7: 2.43, 8: 2.37, 9: 2.32, 10: 2.28, 12: 2.23, 20: 2.13, 50: 2.05 };
  for (const [nu, t] of Object.entries(tabla)) assert.equal(motor.factorCobertura(Number(nu)), t, `ν = ${nu}`);
  // ν no entero se trunca (G.6.4); infinito da la normal.
  assert.equal(motor.factorCobertura(4.9), 2.87);
  assert.equal(motor.factorCobertura(Infinity), 2);
  assert.equal(motor.factorCobertura(1e6), 2);
});

test('GUM G.2b: grados efectivos por Welch-Satterthwaite', () => {
  // Solo la repetibilidad (ν = 4) y un redondeo (ν infinito): H1 sin carga.
  cerca(motor.gradosEfectivos([{ u: 0.000114, nu: 4 }, { u: 0.0001 / Math.sqrt(12), nu: Infinity }]), 4.53, 1e-2, 'νeff');
  assert.equal(motor.gradosEfectivos([{ u: 1, nu: Infinity }]), Infinity);
});

test('decisión 3: U con dos cifras significativas hacia arriba', () => {
  assert.deepEqual(motor.redondearIncertidumbre(0.0003375), { valor: 0.00034, decimales: 5 });
  assert.deepEqual(motor.redondearIncertidumbre(0.00093036), { valor: 0.00094, decimales: 5 });
  assert.deepEqual(motor.redondearIncertidumbre(0.00093), { valor: 0.00093, decimales: 5 });
  assert.deepEqual(motor.redondearIncertidumbre(0.0995), { valor: 0.1, decimales: 2 });
  assert.deepEqual(motor.redondearIncertidumbre(12.01), { valor: 13, decimales: 0 });
  assert.equal(motor.redondearA(0.00065, 4), 0.0007);
  assert.equal(motor.redondearA(-0.00065, 4), -0.0007);
});

// ─── Densidad del aire ─────────────────────────────────────────────────────

test('A1.1: CIPM-2007 coincide con la fórmula aproximada dentro de 2,4×10⁻⁴', () => {
  for (const c of [
    { t: 20, hr: 50, p: 1013.25 }, { t: 15, hr: 50, p: 650 }, { t: 22, hr: 40, p: 960 },
    { t: 25, hr: 80, p: 600 }, { t: 16, hr: 20, p: 1100 }, { t: 27, hr: 30, p: 750 },
  ]) {
    cerca(motor.densidadCIPM2007(c), motor.densidadAproximada(c), motor.U_REL_APROXIMADA, JSON.stringify(c));
  }
  // La Paz (≈ 650 hPa): lejos de 1,2 kg/m³.
  cerca(motor.densidadCIPM2007({ t: 15, hr: 50, p: 650 }), 0.7822, 1e-3, 'La Paz');
});

test('decisión 5: u del aire con la U del termohigrómetro y la variación inicio-fin', () => {
  // U/k y la variación como rectangular de ancho completo (EURAMET A2).
  cerca(motor.incertidumbreLectura({ U: 0.4, k: 2, inicio: 19, fin: 21 }), Math.sqrt(0.2 ** 2 + (2 / Math.sqrt(12)) ** 2), 1e-12, 'u(t)');
  const aire = motor.aireDeCalibracion({
    inicio: { t: 19.5, hr: 45, p: 650.2 }, fin: { t: 20.5, hr: 47, p: 650.0 },
    certificado: { t: { U: 0.3, k: 2 }, hr: { U: 2.5, k: 2 }, p: { U: 0.5, k: 2 } },
  });
  assert.deepEqual(aire.condiciones, { t: 20, hr: 46, p: 650.1 });
  assert.ok(aire.u / aire.rho > 5e-4 && aire.u / aire.rho < 3e-3, `u relativa ${aire.u / aire.rho}`);
  assert.throws(() => motor.aireDeCalibracion({ inicio: { t: 20 }, fin: {} }), /Faltan/);
});

// ─── Masa de referencia ────────────────────────────────────────────────────

test('7.1.2-4: corrección por empuje de 1 kg de acero inoxidable en La Paz', () => {
  // ρa = 0,78: δmB = −1000 g·(0,78 − 1,2)·(1/7950 − 1/8000) = +0,330 mg.
  cerca(motor.correccionEmpuje(1000, 0.78, 7950), 0.000330, 2e-3, 'δmB');
  assert.equal(Math.abs(motor.correccionEmpuje(1000, 1.2, 7950)), 0);
});

test('7.1.2-5a y 5b: incertidumbre del empuje', () => {
  const base = { mN: 1000, rhoA: 0.78, uRhoA: 0.003, rho: 7950, uRho: 70 };
  const a = motor.incertidumbreEmpuje(base);
  const esperado = 1000 * Math.sqrt((0.003 * (1 / 7950 - 1 / 8000)) ** 2 + (0.42 ** 2) * 70 ** 2 / 7950 ** 4);
  cerca(a, esperado, 1e-12, '5a');
  // Con ρa1 parecido a ρa (pesas calibradas en el mismo lugar) baja mucho el término de la densidad.
  const b = motor.incertidumbreEmpuje({ ...base, rhoA1: 0.78 });
  assert.ok(b < a, '5b < 5a en altura');
});

test('7.1.2-5d: cotas de H1 (pesas E2 no ajustadas)', () => {
  cerca(motor.cotaEmpuje('5d', { mN: 50, emp: 0.0001 }), 0.000447, 2e-3, '50 g');
  cerca(motor.cotaEmpuje('5d', { mN: 100, emp: 0.00016 }), 0.000889, 2e-3, '100 g');
  cerca(motor.cotaEmpuje('5e', { mN: 50, emp: 0.0001, deltaT: 5 }), 0.000103, 2e-2, '5e, 50 g');
});

test('Anexo F: convección, cota de la tabla F2.1', () => {
  assert.equal(motor.conveccionMg(1, 5), 1.09);
  assert.equal(motor.conveccionMg(0.8, 4), 1.09); // fila de 1 kg y columna de 5 K
  assert.equal(motor.conveccionMg(1, 0), 0);
});

// ─── Ejemplo H1 de EURAMET (220 g, d = 0,1 mg) ─────────────────────────────

const H1 = {
  d: 0.0001,
  repetibilidad: [100.0006, 100.0003, 100.0005, 100.0004, 100.0005],
  excentricidad: [100.0006, 100.0004, 100.0005, 100.0007, 100.0005],
  pesas: {
    20: { nominal: 20, correccion: 0, U: 0.000024, k: 2, emp: 0.00008, clase: 'E2', densidad: 8000, uDensidad: 0 },
    50: { nominal: 50, correccion: 0, U: 0.00003, k: 2, emp: 0.0001, clase: 'E2', densidad: 8000, uDensidad: 0 },
    100: { nominal: 100, correccion: -0.0001, U: 0.00005, k: 2, emp: 0.00016, clase: 'E2', densidad: 8000, uDensidad: 0 },
    200: { nominal: 200, correccion: 0.0001, U: 0.0001, k: 2, emp: 0.0003, clase: 'E2', densidad: 8000, uDensidad: 0 },
  },
  // Carga, indicación, piezas y lo que publica la guía (opción 1).
  puntos: [
    { I: 0, piezas: [], uI: 0.000118, uE: 0.000118, nu: 4, k: 2.87, U: 0.00034 },
    { I: 50.0004, piezas: [50], uI: 0.000124, uE: 0.000465, nu: 1104, k: 2.0, U: 0.00093 },
    { I: 100.0006, piezas: [100], uI: 0.000134, uE: 0.000900, nu: 15538, k: 2.0, U: 0.00180 },
    { I: 150.0009, piezas: [100, 50], uI: 0.000149, uE: 0.001340, nu: 76345, k: 2.0, U: 0.00268 },
    { I: 220.0014, piezas: [200, 20], uI: 0.000175, uE: 0.001971, nu: 357098, k: 2.0, U: 0.00394 },
  ],
};

test('H1: repetibilidad (6.1-1) y excentricidad (6.3, 7.1.1-11)', () => {
  const rep = motor.repetibilidad(H1.repetibilidad);
  cerca(rep.s, 0.000114, 5e-3, 's');
  assert.equal(rep.nu, 4);
  const ecc = motor.excentricidad({ posiciones: H1.excentricidad.map(indicacion => ({ indicacion, retorno: 0 })), carga: 100 });
  cerca(ecc.maxima, 0.0002, 1e-6, '|ΔIecc|máx');
  cerca(ecc.uRel, 0.0002 / (2 * 100 * Math.sqrt(3)), 1e-9, 'urel');
});

test('H1 opción 1: error, u(E), νeff, k y U por punto (7.1.3, B3-1)', () => {
  const rep = motor.repetibilidad(H1.repetibilidad);
  const ecc = motor.excentricidad({ posiciones: H1.excentricidad.map(indicacion => ({ indicacion, retorno: 0 })), carga: 100 });
  for (const punto of H1.puntos) {
    const referencia = motor.masaReferencia(punto.piezas.map(n => H1.pesas[n]), { unidad: 'g', empuje: '5d', kD: 1.25 });
    const componentesI = motor.componentesIndicacion(punto.I, { d0: H1.d, dI: H1.d, s: rep.s, nuS: rep.nu, uRelEcc: ecc.uRel });
    const r = motor.errorEnPunto({ indicacion: punto.I, componentesI, referencia });
    const nombre = `${punto.I} g`;
    cerca(r.uIndicacion, punto.uI, 1e-2, `${nombre} u(I)`);
    cerca(r.u, punto.uE, 1e-2, `${nombre} u(E)`);
    // La guía imprime νeff truncado cuando es pequeño (GUM G.6.4).
    if (punto.nu < 10) assert.equal(Math.floor(r.nuEff), punto.nu, `${nombre} νeff`);
    else cerca(r.nuEff, punto.nu, 3e-2, `${nombre} νeff`);
    assert.equal(r.k, punto.k, `${nombre} k`);
    // La guía redondea U normalmente; sin redondear coinciden dentro del 1,5 %.
    cerca(r.U, punto.U, 1.5e-2, `${nombre} U`);
    // Redondeada hacia arriba (decisión 3) nunca queda por debajo.
    assert.ok(r.presentacion.U >= punto.U - 1e-12, `${nombre} U redondeada`);
  }
});

test('H1: el error se presenta al decimal de U', () => {
  const referencia = motor.masaReferencia([H1.pesas[100]], { unidad: 'g', empuje: '5d', kD: 1.25 });
  const componentesI = motor.componentesIndicacion(100.0006, { d0: H1.d, dI: H1.d, s: 0.000114, nuS: 4, uRelEcc: 0 });
  const r = motor.errorEnPunto({ indicacion: 100.0006, componentesI, referencia });
  cerca(r.error, 0.0007, 1e-6, 'E');
  assert.equal(r.presentacion.decimales, 4);
  assert.equal(r.presentacion.error, 0.0007);
});

// ─── Repetibilidad por intervalo ───────────────────────────────────────────

test('7.1.1.3: s del mayor de los dos ensayos que encierran la indicación', () => {
  const ensayos = [{ carga: 10, s: 0.02, nu: 2 }, { carga: 500, s: 0.05, nu: 2 }, { carga: 1000, s: 0.03, nu: 2 }];
  assert.equal(motor.repetibilidadPara(5, ensayos).s, 0.02);
  assert.equal(motor.repetibilidadPara(300, ensayos).s, 0.05);
  assert.equal(motor.repetibilidadPara(700, ensayos).s, 0.05);
  assert.equal(motor.repetibilidadPara(1500, ensayos).s, 0.03);
});

// ─── Tolerancia y conformidad ──────────────────────────────────────────────

test('R76 Tabla 6 y 3.5.2: emp en servicio (NB 23001)', () => {
  assert.equal(motor.empEnServicio({ carga: 50, clase: 'III', e: 0.1 }), 0.1); // 500 e → 2 × 0,5 e
  assert.equal(motor.empEnServicio({ carga: 51, clase: 'III', e: 0.1 }), 0.2); // 510 e → 2 × 1 e
  cerca(motor.empEnServicio({ carga: 201, clase: 'III', e: 0.1 }), 0.3, 1e-12, '2010 e'); // 2 × 1,5 e
  assert.equal(motor.empEnServicio({ carga: 100, clase: 'II', e: 0.01 }), 0.02); // 10 000 e: 5 000 < m ≤ 20 000 → 2 × 1 e
  assert.equal(motor.empEnServicio({ carga: 1, clase: 'X', e: 0.1 }), null);
  assert.deepEqual(motor.rangoDeCarga([{ max: 30 }, { max: 60 }], 25), { max: 30 });
  assert.deepEqual(motor.rangoDeCarga([{ max: 30 }, { max: 60 }], 45), { max: 60 });
});

test('decisión 7: regla simple y conservadora, con su riesgo', () => {
  const base = { error: 0.04, U: 0.03, k: 2, tolerancia: 0.06 };
  assert.equal(motor.conformidad({ ...base, regla: 'SIMPLE' }).conforme, true);
  assert.equal(motor.conformidad({ ...base, regla: 'CONSERVADORA' }).conforme, false);
  // Error nulo y T = 2u: riesgo = 2·(1 − Φ(2)) = 4,55 %.
  cerca(motor.conformidad({ error: 0, U: 0.02, k: 2, tolerancia: 0.02, regla: 'SIMPLE' }).riesgo, 0.0455, 1e-2, 'riesgo');
  assert.equal(motor.conformidad({ ...base, regla: 'NINGUNA' }).evaluada, false);
  cerca(motor.toleranciaPorcentaje(500, 0.1), 0.5, 1e-12, '0,1 % de 500');
});
