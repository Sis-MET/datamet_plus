// Incertidumbre en uso, global y pesada mínima (EURAMET cg-18 7.4, 7.5, C, G).
const test = require('node:test');
const assert = require('node:assert/strict');
const motor = require('../src/services/calibracion/motor');
const {
  ajusteUE, coeficienteTemperatura, incertidumbreEnUso, pendienteOrigen, pesadaMinima,
} = require('../src/services/calibracion/motor/uso');

const cerca = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('7.1.3-2: u²(E) = α² + β²·I² por mínimos cuadrados, con α² y β² no negativos', () => {
  const puntos = [0, 50, 100, 150, 220].map(I => ({ I, u: Math.sqrt(1e-8 + 4e-11 * I * I) }));
  const { A, B } = ajusteUE(puntos);
  cerca(A, 1e-8, 1e-15);
  cerca(B, 4e-11, 1e-17);
  // Si la recta saldría con ordenada negativa, se fuerza A = 0.
  const negativa = ajusteUE([{ I: 10, u: 0.0001 }, { I: 20, u: 0.0004 }]);
  assert.equal(negativa.A, 0);
  assert.ok(negativa.B > 0);
});

test('C2.2-16: recta por el origen E = a1·R ponderada por 1/u²', () => {
  const { a1, u } = pendienteOrigen([{ I: 100, E: 0.001, u: 0.0005 }, { I: 200, E: 0.002, u: 0.0005 }]);
  cerca(a1, 1e-5);
  cerca(u, Math.sqrt(1 / ((100 * 100 + 200 * 200) / 0.00000025)));
});

test('7.4.3-1: KT de la R76 por la clase cuando no se conoce el del fabricante', () => {
  // Clase III, Max 6100 g, e 1 g: 6100 e > 2000 e → emp = 1,5 e; ΔT de aprobación 30 K.
  const r = coeficienteTemperatura({ clase: 'III', max: 6100, e: 1 });
  cerca(r.kT, 1.5 / (6100 * 30));
  assert.equal(r.origen, 'R76');
  assert.equal(coeficienteTemperatura({ clase: null, max: 6100, e: 1 }).kT, null);
  assert.equal(coeficienteTemperatura({ kT: 3e-6, clase: 'III', max: 1, e: 1 }).origen, 'CONFIGURACION');
});

test('7.4.5-2 y 7.5.2-3e: U(W) = k·√(αW² + βW²·R²) y Ugl lineal con |a1·R|', () => {
  const puntos = [{ I: 0, E: 0, u: 0.000118 }, { I: 100, E: 0.0007, u: 0.0009 }, { I: 220, E: 0.0013, u: 0.001971 }];
  const r = incertidumbreEnUso({
    rangos: [{ max: 220, d: 0.0001, e: 0.001 }], d0: 0.0001, puntos, s: 0.000114, eccMaxima: 0.0002, eccCarga: 100, clase: 'I', configuracion: motor.CONFIGURACION_V1.enUso,
  });
  const g = r.rangos[0];
  const { A } = ajusteUE(puntos);
  // En R = 0 solo cuentan d0, d, s y la parte absoluta de u(E).
  cerca(g.U0, 2 * Math.sqrt(1e-8 / 12 + 1e-8 / 12 + 0.000114 ** 2 + A));
  // Excentricidad en uso con su efecto completo (7.4.4-10).
  cerca(r.terminos.urelEcc, 0.0002 / (100 * Math.sqrt(3)));
  // Empuje con ΔT = 5 K (7.4.3-4).
  cerca(r.terminos.urelEmpuje, Math.sqrt(1.07e-4 + 1.33e-6 * 25) * (1.2 / 8000));
  assert.ok(g.U(220) > g.U0);
  cerca(g.Ugl(220), g.U0 + g.C * 220 + Math.abs(r.a1 * 220));
});

test('G-9: pesada mínima con factor de seguridad; sin solución si la exactitud no se alcanza', () => {
  cerca(pesadaMinima({ alfaGl: 0.0003, betaGl: 2e-5, exactitud: 0.01, factor: 2 }), (0.0003 * 2) / (0.01 - 2e-5 * 2));
  assert.equal(pesadaMinima({ alfaGl: 0.0003, betaGl: 0.006, exactitud: 0.01, factor: 2 }), null);
});
