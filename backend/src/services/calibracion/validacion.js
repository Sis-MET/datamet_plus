/**
 * Validación del motor de cálculo (NB/ISO/IEC 17025, 7.11.2 y 7.11.6): los
 * ejemplos publicados de EURAMET cg-18 v4.0 (Anexo H), de la Guía SIM
 * MWG7/cg-01 (Apéndice G) y la tabla G.2 de la GUM, recalculados con el motor
 * que corre en el servidor. Cada fila compara el valor de la guía con el del
 * motor según un criterio declarado. Las pruebas automáticas usan los mismos
 * datos (tests/motor.euramet.test.js, tests/motor.sim.test.js) y la pantalla
 * Calibración › Certificados › Validación muestra el resultado.
 *
 * Solo transcribe los datos de entrada y los valores publicados de los
 * ejemplos, no texto de las guías.
 */
const motor = require('./motor');

// ─── Datos de los ejemplos ─────────────────────────────────────────────────

/** EURAMET H1: 220 g, d = 0,1 mg (opción 1, 7.1.2-5d, kD = 1,25). */
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
  puntos: [
    { I: 0, piezas: [], uI: 0.000118, uE: 0.000118, nu: 4, k: 2.87, U: 0.00034 },
    { I: 50.0004, piezas: [50], uI: 0.000124, uE: 0.000465, nu: 1104, k: 2.0, U: 0.00093 },
    { I: 100.0006, piezas: [100], uI: 0.000134, uE: 0.000900, nu: 15538, k: 2.0, U: 0.00180 },
    { I: 150.0009, piezas: [100, 50], uI: 0.000149, uE: 0.001340, nu: 76345, k: 2.0, U: 0.00268 },
    { I: 220.0014, piezas: [200, 20], uI: 0.000175, uE: 0.001971, nu: 357098, k: 2.0, U: 0.00394 },
  ],
};

/** EURAMET H2: 60 kg multi-escalón (opción 1), pesas F2 nominales, D = emp/2. */
const H2 = {
  d0: 2,
  pesa: (kg, emp) => ({ nominal: kg * 1000, correccion: null, U: emp / 3, k: 2, emp, clase: 'F2' }),
  uRelEcc: 5 / (2 * 20000 * Math.sqrt(3)),
  puntos: [
    { I: 0, piezas: [], dI: 2, s: 1.095, uI: 1.238, uMref: 0, uE: 1.238, nu: 6, k: 2.52, U: 3.120 },
    { I: 10000, piezas: [[10, 0.16]], dI: 2, s: 1.095, uI: 1.545, uMref: 0.151, uE: 1.552, nu: 16, k: 2.17, U: 3.369 },
    { I: 19995, piezas: [[20, 0.3]], dI: 5, s: 2.739, uI: 3.464, uMref: 0.290, uE: 3.476, nu: 10, k: 2.28, U: 7.926 },
    { I: 39990, piezas: [[20, 0.3], [20, 0.3]], dI: 10, s: 2.739, uI: 4.950, uMref: 0.581, uE: 4.984, nu: 43, k: 2.06, U: 10.266 },
  ],
};

/** Guía SIM G1: 200 g, d = 0,1 mg; E2 nominales, D = emp/3, ajuste justo antes (5c). */
const G1 = {
  d: 0.0001,
  repetibilidad: [100.0002, 99.9999, 100.0001, 100.0000, 100.0002, 100.0002],
  excentricidad: [100.0005, 100.0003, 100.0004, 100.0006, 100.0004],
  emp: { 10: 0.00006, 20: 0.00008, 50: 0.0001, 100: 0.00016, 200: 0.0003 },
  puntos: [
    { I: 30.0001, piezas: [10, 20], E: 0.1, mc: 0.08, mD: 0.03, mB: 0.02, uE: 0.165, nu: 12, k: 2.23, U: 0.37 },
    { I: 60.0003, piezas: [10, 50], E: 0.3, mc: 0.09, mD: 0.03, mB: 0.02, uE: 0.170, nu: 14, k: 2.20, U: 0.37 },
    { I: 100.0004, piezas: [100], E: 0.4, mc: 0.09, mD: 0.03, mB: 0.02, uE: 0.170, nu: 14, k: 2.20, U: 0.37 },
    { I: 150.0006, piezas: [50, 100], E: 0.6, mc: 0.15, mD: 0.05, mB: 0.04, uE: 0.215, nu: 34, k: 2.08, U: 0.45 },
    { I: 200.0009, piezas: [200], E: 0.9, mc: 0.17, mD: 0.06, mB: 0.04, uE: 0.232, nu: 44, k: 2.06, U: 0.48 },
  ],
};
G1.pesa = n => ({ nominal: n, correccion: null, U: G1.emp[n] / 3, k: 2, emp: G1.emp[n], clase: 'E2' });

/** Guía SIM G2: 60 kg multi-intervalo (12/30/60 kg; d = 2/5/10 g), M1 nominales, D = emp/2. */
const G2 = {
  d0: 2,
  s1: [9998, 10000, 9998, 10000, 10000],
  s2: [29995, 30000, 29995, 29995, 30000],
  pesa: kg => ({ nominal: kg * 1000, correccion: null, U: (0.05 * kg) / 3, k: 2, emp: 0.05 * kg, clase: 'M1', densidad: 7950, uDensidad: 70 }),
  // El empuje es insignificante en la guía: 7.1.2-5a al aire de referencia con su u(ρa).
  opciones: { unidad: 'g', empuje: '5a', aire: { rho: 1.2, u: 0.0207 }, kD: 1.5 },
  puntos: [
    { I: 10000, piezas: [10], dI: 2, s: 's1', uI: 1.37, uE: 1.41, nu: 10, k: 2.28, U: 3.2 },
    { I: 24995, piezas: [20, 5], dI: 5, s: 's2', uI: 3.15, uE: 3.25, nu: 7, k: 2.43, U: 7.9 },
    { I: 39990, piezas: [20, 20], dI: 10, s: 's2', uI: 4.02, uE: 4.22, nu: 21, k: 2.13, U: 9.0 },
    { I: 59990, piezas: [20, 20, 20], dI: 10, s: 's2', uI: 4.02, uE: 4.46, nu: 26, k: 2.10, U: 9.4 },
    { I: 9998, piezas: [10], dI: 2, s: 's1', uI: 1.37, uE: 1.41, nu: 10, k: 2.28, U: 3.2 },
    { I: 19995, piezas: [20], dI: 5, s: 's2', uI: 3.15, uE: 3.22, nu: 7, k: 2.43, U: 7.8 },
  ],
};

// ─── Criterios ─────────────────────────────────────────────────────────────

const redondear = (x, decimales) => Math.round(x * 10 ** decimales) / 10 ** decimales;
const fuente = (componentes, nombre) => componentes.find(c => c.fuente === nombre)?.u ?? 0;
const conNuB100 = componentes => componentes.map(c => (Number.isFinite(c.nu) ? c : { ...c, nu: 100 }));

/** Dentro de una tolerancia relativa. */
const relativa = (magnitud, motorValor, guia, tolerancia, unidad = '') => ({
  magnitud, unidad, guia, motor: motorValor, criterio: `±${String(Number((tolerancia * 100).toPrecision(3))).replace('.', ',')} %`,
  ok: Math.abs(motorValor - guia) <= Math.abs(guia) * tolerancia + 1e-15,
});
/** Igual (enteros, k impreso, o el valor redondeado como lo imprime la guía). */
const igual = (magnitud, motorValor, guia, unidad = '', criterio = 'igual') => ({
  magnitud, unidad, guia, motor: motorValor, criterio, ok: motorValor === guia,
});
/** Dentro de una diferencia absoluta. */
const absoluta = (magnitud, motorValor, guia, diferencia, unidad = '', criterio = `±${diferencia}`) => ({
  magnitud, unidad, guia, motor: motorValor, criterio, ok: Math.abs(motorValor - guia) <= diferencia + 1e-12,
});

// ─── Casos ─────────────────────────────────────────────────────────────────

const casoGum = () => {
  const tabla = { 1: 13.97, 2: 4.53, 3: 3.31, 4: 2.87, 5: 2.65, 6: 2.52, 7: 2.43, 8: 2.37, 9: 2.32, 10: 2.28, 12: 2.23, 20: 2.13, 50: 2.05 };
  return {
    id: 'gum-g2',
    fuente: 'ISO/IEC Guide 98-3 (GUM), tabla G.2',
    titulo: 't de Student al 95,45 %',
    nota: 'k para cada número de grados de libertad, redondeado a dos decimales como se imprime.',
    filas: [
      ...Object.entries(tabla).map(([nu, t]) => igual(`k para ν = ${nu}`, motor.factorCobertura(Number(nu)), t)),
      igual('k para ν = ∞', motor.factorCobertura(Infinity), 2),
    ],
  };
};

const casoAire = () => {
  const condiciones = [
    { t: 20, hr: 50, p: 1013.25 }, { t: 15, hr: 50, p: 650 }, { t: 22, hr: 40, p: 960 },
    { t: 25, hr: 80, p: 600 }, { t: 16, hr: 20, p: 1100 }, { t: 27, hr: 30, p: 750 },
  ];
  return {
    id: 'euramet-a1',
    fuente: 'EURAMET cg-18 v4.0, A1.1',
    titulo: 'Densidad del aire: CIPM-2007 frente a la fórmula aproximada',
    nota: 'La fórmula aproximada de la guía coincide con CIPM-2007 dentro de su incertidumbre relativa (2,4·10⁻⁴); en el altiplano el aire queda lejos de 1,2 kg/m³.',
    filas: [
      ...condiciones.map(c => relativa(`ρa con ${c.t} °C, ${c.hr} %, ${c.p} hPa`, motor.densidadCIPM2007(c), motor.densidadAproximada(c), motor.U_REL_APROXIMADA, 'kg/m³')),
      relativa('ρa en La Paz (15 °C, 50 %, 650 hPa)', motor.densidadCIPM2007({ t: 15, hr: 50, p: 650 }), 0.7822, 1e-3, 'kg/m³'),
    ],
  };
};

const casoH1 = () => {
  const rep = motor.repetibilidad(H1.repetibilidad);
  const ecc = motor.excentricidad({ posiciones: H1.excentricidad.map(indicacion => ({ indicacion, retorno: 0 })), carga: 100 });
  const filas = [
    relativa('s (repetibilidad)', rep.s, 0.000114, 5e-3, 'g'),
    relativa('|ΔIecc|máx', ecc.maxima, 0.0002, 1e-6, 'g'),
  ];
  for (const punto of H1.puntos) {
    const referencia = motor.masaReferencia(punto.piezas.map(n => H1.pesas[n]), { unidad: 'g', empuje: '5d', kD: 1.25 });
    const componentesI = motor.componentesIndicacion(punto.I, { d0: H1.d, dI: H1.d, s: rep.s, nuS: rep.nu, uRelEcc: ecc.uRel });
    const r = motor.errorEnPunto({ indicacion: punto.I, componentesI, referencia });
    const en = `en ${punto.I} g`;
    filas.push(
      relativa(`u(I) ${en}`, r.uIndicacion, punto.uI, 1e-2, 'g'),
      relativa(`u(E) ${en}`, r.u, punto.uE, 1e-2, 'g'),
      punto.nu < 10 ? igual(`νeff ${en}`, Math.floor(r.nuEff), punto.nu, '', 'igual (truncado)') : relativa(`νeff ${en}`, r.nuEff, punto.nu, 3e-2),
      igual(`k ${en}`, r.k, punto.k),
      relativa(`U ${en}`, r.U, punto.U, 1.5e-2, 'g'),
    );
  }
  return {
    id: 'euramet-h1',
    fuente: 'EURAMET cg-18 v4.0, Anexo H1',
    titulo: 'Balanza de 220 g, d = 0,1 mg',
    nota: 'Opción 1 de la guía (empuje por 7.1.2-5d, deriva kD = 1,25). La guía imprime U con tres cifras; el motor no redondea en el camino.',
    filas,
  };
};

const casoH2 = () => {
  const filas = [];
  for (const punto of H2.puntos) {
    const referencia = motor.masaReferencia(punto.piezas.map(([kg, emp]) => H2.pesa(kg, emp)), { unidad: 'g', empuje: '5d', kD: 1.5 });
    const componentesI = motor.componentesIndicacion(punto.I, { d0: H2.d0, dI: punto.dI, s: punto.s, nuS: 4, uRelEcc: H2.uRelEcc });
    const r = motor.errorEnPunto({ indicacion: punto.I, componentesI, referencia });
    const en = `en ${punto.I} g`;
    filas.push(relativa(`u(I) ${en}`, r.uIndicacion, punto.uI, 2e-3, 'g'));
    if (punto.uMref) filas.push(relativa(`u(mref) ${en}`, referencia.u, punto.uMref, 1e-2, 'g'));
    filas.push(
      relativa(`u(E) ${en}`, r.u, punto.uE, 2e-3, 'g'),
      igual(`νeff ${en}`, Math.floor(r.nuEff), punto.nu, '', 'igual (truncado)'),
      igual(`k ${en}`, r.k, punto.k),
      relativa(`U ${en}`, r.U, punto.U, 3e-3, 'g'),
    );
  }
  const u60 = motor.componentesIndicacion(59990, { d0: H2.d0, dI: 10, s: 2.739, nuS: 4, uRelEcc: H2.uRelEcc });
  filas.push(relativa('u(I) en 60 000 g', Math.sqrt(u60.reduce((s, c) => s + c.u * c.u, 0)), 5.909, 2e-3, 'g'));
  return {
    id: 'euramet-h2',
    fuente: 'EURAMET cg-18 v4.0, Anexo H2',
    titulo: 'Báscula de 60 kg multi-escalón (2 / 5 / 10 g)',
    nota: 'Opción 1: pesas F2 por su valor nominal (u = emp/√3), deriva D = emp/2, empuje por 7.1.2-5d y s constante por escalón.',
    filas,
  };
};

const casoH3 = () => {
  const pesas = Array.from({ length: 10 }, () => ({ nominal: 1000, correccion: null, U: null, k: 2, emp: 0.05, clase: 'M1' }));
  const mref = motor.masaReferencia(pesas, { unidad: 'kg', empuje: '5d', kD: 1 });
  const lt2 = motor.cargaSustitucion({ mref: 10000, uMref: mref.u, diferencias: [0], uIndicaciones: [7.97], parcial: { mref: 10000, u: mref.u } });
  const lt3 = motor.cargaSustitucion({ mref: 10000, uMref: mref.u, diferencias: [0, 10], uIndicaciones: [7.97, 10.82] });
  return {
    id: 'euramet-h3',
    fuente: 'EURAMET cg-18 v4.0, Anexo H3',
    titulo: 'Báscula de 30 t con cargas de sustitución',
    nota: 'Se usan las u(I) de la guía: incluyen la deriva bajo carga (7.4.4-7), que el motor no agrega porque ServiceMET no registra tiempos de carga.',
    filas: [
      relativa('u(mref), 10 pesas M1 de 1 000 kg', mref.u, 0.44, 1e-2, 'kg'),
      relativa('u(LT2), 7.1.2-15b', lt2.u, 11.28, 3e-3, 'kg'),
      relativa('u(E) en 20 000 kg', Math.sqrt(10.82 ** 2 + lt2.u ** 2), 15.64, 3e-3, 'kg'),
      igual('LT3 (n·mref + ΣΔI)', lt3.valor, 30010, 'kg'),
      relativa('u(E) en 30 000 kg', Math.sqrt(14.38 ** 2 + lt3.u ** 2), 23.85, 3e-3, 'kg'),
    ],
  };
};

const mg = x => redondear(x * 1000, 2);

const casoG1 = () => {
  const rep = motor.repetibilidad(G1.repetibilidad);
  const ecc = motor.excentricidad({ posiciones: G1.excentricidad.map(indicacion => ({ indicacion, retorno: 0 })), carga: 100 });
  const filas = [
    igual('s (al centésimo de mg)', mg(rep.s), 0.13, 'mg'),
    relativa('|ΔIecc|máx', ecc.maxima, 0.0002, 1e-6, 'g'),
  ];
  for (const punto of G1.puntos) {
    const referencia = motor.masaReferencia(punto.piezas.map(G1.pesa), { unidad: 'g', empuje: '5c', kD: 1 });
    const componentesI = motor.componentesIndicacion(punto.I, { d0: G1.d, dI: G1.d, s: rep.s, nuS: rep.nu, uRelEcc: 0 });
    const r = motor.errorEnPunto({ indicacion: punto.I, componentesI, referencia });
    const en = `en ${Math.round(punto.I)} g`;
    // Como la guía: cada componente al centésimo de mg y u(I) a 0,14 mg.
    const s = mg(fuente(componentesI, 'repetibilidad'));
    const tipoB = [
      mg(fuente(componentesI, 'redondeoCero')), mg(fuente(componentesI, 'redondeoCarga')),
      mg(fuente(referencia.componentes, 'certificado')), mg(fuente(referencia.componentes, 'deriva')), mg(fuente(referencia.componentes, 'empuje')),
    ];
    const uI = redondear(Math.sqrt(s ** 2 + tipoB[0] ** 2 + tipoB[1] ** 2), 2);
    const uE = Math.sqrt(uI ** 2 + tipoB.slice(2).reduce((suma, u) => suma + u * u, 0));
    const nu = uE ** 4 / (s ** 4 / 5 + tipoB.reduce((suma, u) => suma + u ** 4 / 100, 0));
    filas.push(
      igual(`u(δmc) ${en}`, tipoB[2], punto.mc, 'mg', 'igual al centésimo'),
      igual(`u(δmD) ${en}`, tipoB[3], punto.mD, 'mg', 'igual al centésimo'),
      igual(`u(δmB) ${en}`, tipoB[4], punto.mB, 'mg', 'igual al centésimo'),
      relativa(`E ${en}`, r.error * 1000, punto.E, 1e-6, 'mg'),
      relativa(`u(E) ${en}`, uE, punto.uE, 4e-3, 'mg'),
      absoluta(`νeff ${en}`, Math.floor(nu), punto.nu, 1, '', '±1'),
      igual(`k ${en}`, motor.factorCobertura(nu), punto.k),
      igual(`U ${en}`, redondear(motor.factorCobertura(nu) * uE, 2), punto.U, 'mg', 'igual al centésimo'),
    );
  }
  const puntos = G1.puntos.map(p => ({ I: Math.round(p.I), E: p.E / 1000, u: p.uE / 1000 }));
  const recta = motor.pendienteOrigen(puntos);
  const uso = motor.incertidumbreEnUso({
    rangos: [{ max: 200, d: G1.d }], d0: G1.d, puntos, s: rep.s, eccMaxima: 0.0002, eccCarga: 100, configuracion: { k: 2, deltaT: 2, kT: 1.5e-6 },
  });
  const g = motor.linealizar({ alfa2: 0.0178e-6, beta2: 4.0e-12, k: 2, max: 200, a1: 4.27e-6 });
  const minima = exactitud => motor.pesadaMinima({ alfaGl: 0.27e-3, betaGl: 7.15e-6, exactitud });
  filas.push(
    relativa('a1 (recta por el origen)', recta.a1, 4.27e-6, 2e-3),
    relativa('u(a1)', recta.u, 0.76e-6, 2e-3),
    relativa('ŵ(Rtemp) con ±1 K', uso.terminos.urelTemp, 0.87e-6, 5e-3),
    relativa('ŵ(Recc)', uso.terminos.urelEcc, 1.15e-6, 5e-3),
    igual('U(W = 0)', mg(g.U0), 0.27, 'mg', 'igual al centésimo'),
    relativa('pendiente de U(W)', g.C, 2.88e-6, 2e-3),
    relativa('pendiente de Ugl(W)', (g.Ugl(200) - g.Ugl(100)) / 100, 7.15e-6, 2e-3),
    igual('pesada mínima al 1 %', Math.ceil(minima(0.01) * 100) / 100, 0.03, 'g', 'igual (a 10 mg)'),
    igual('pesada mínima al 0,1 %', Math.ceil(minima(0.001) * 100) / 100, 0.28, 'g', 'igual (a 10 mg)'),
  );
  return {
    id: 'sim-g1',
    fuente: 'Guía SIM MWG7/cg-01 (2009), G1',
    titulo: 'Balanza de 200 g, d = 0,1 mg',
    nota: 'La guía combina valores ya redondeados al centésimo de mg y toma 100 grados de libertad para las componentes tipo B; se compara con esa convención. Sin redondear en el camino, la U del motor queda hasta 4,5 % menor.',
    filas,
  };
};

const casoG2 = () => {
  const rep = { s1: motor.repetibilidad(G2.s1), s2: motor.repetibilidad(G2.s2) };
  const filas = [
    igual('s del primer intervalo', redondear(rep.s1.s, 2), 1.1, 'g', 'igual al centésimo'),
    igual('s del segundo y tercero', redondear(rep.s2.s, 2), 2.74, 'g', 'igual al centésimo'),
  ];
  for (const punto of G2.puntos) {
    const { s, nu } = rep[punto.s];
    const referencia = motor.masaReferencia(punto.piezas.map(G2.pesa), G2.opciones);
    const componentesI = motor.componentesIndicacion(punto.I, { d0: G2.d0, dI: punto.dI, s, nuS: nu, uRelEcc: 0 });
    const r = motor.errorEnPunto({ indicacion: punto.I, componentesI, referencia });
    const nuEff = motor.gradosEfectivos(conNuB100(r.componentes));
    const en = `en ${punto.I} g`;
    filas.push(
      igual(`u(I) ${en}`, redondear(r.uIndicacion, 2), punto.uI, 'g', 'igual al centésimo'),
      relativa(`u(E) ${en}`, r.u, punto.uE, 5e-3, 'g'),
      igual(`νeff ${en} (ν tipo B = 100)`, Math.floor(nuEff), punto.nu, '', 'igual (truncado)'),
      igual(`k ${en}`, motor.factorCobertura(nuEff), punto.k),
      relativa(`U ${en}`, r.U, punto.U, 1e-2, 'g'),
    );
  }
  const puntos = G2.puntos.map((p, i) => ({ I: [10000, 25000, 40000, 60000, 10000, 20000][i], E: [0, -5, -10, -10, -2, -5][i], u: p.uE }));
  const cuatro = motor.pendienteOrigen(puntos.slice(0, 4));
  const seis = motor.pendienteOrigen(puntos);
  filas.push(
    relativa('a1 con 4 indicaciones', cuatro.a1, -1.69e-4, 4e-3),
    relativa('u(a1) con 4 indicaciones', cuatro.u, 5.13e-5, 2e-3),
    relativa('a1 con 6 indicaciones', seis.a1, -1.79e-4, 4e-3),
    relativa('u(a1) con 6 indicaciones', seis.u, 4.62e-5, 2e-3),
  );
  return {
    id: 'sim-g2',
    fuente: 'Guía SIM MWG7/cg-01 (2009), G2',
    titulo: 'Báscula de 60 kg multi-intervalo (2 / 5 / 10 g)',
    nota: 'Pesas M1 por su valor nominal y deriva D = emp/2; el empuje es insignificante. νeff y k con 100 grados de libertad para las tipo B, como la guía; con ν = ∞ (como EURAMET v4) k baja a lo sumo 0,01.',
    filas,
  };
};

const casoG3 = () => {
  const rep = motor.repetibilidad([10411, 10414, 10418, 10412, 10418]);
  const pesas = Array.from({ length: 12 }, () => ({ nominal: 500, correccion: null, U: null, k: 2, emp: 0.025, clase: 'M1' }));
  const mref = motor.masaReferencia(pesas, { unidad: 'kg', empuje: '5d' });
  const uMc1 = Math.sqrt(fuente(mref.componentes, 'certificado') ** 2 + fuente(mref.componentes, 'deriva') ** 2 + (7.2e-6 * 6000) ** 2);
  const componentesI = motor.componentesIndicacion(6001, { d0: 1, dI: 1, s: rep.s, nuS: rep.nu, uRelEcc: 6.9e-5 });
  const r = motor.errorEnPunto({ indicacion: 6001, componentesI, referencia: { mref: 6000, u: uMc1, componentes: [{ fuente: 'patron', u: uMc1, nu: Infinity }] } });
  const filas = [
    relativa('s (repetibilidad)', rep.s, 3.3, 1e-2, 'kg'),
    relativa('u(δmc), 12 pesas M1 de 500 kg', fuente(mref.componentes, 'certificado'), 0.173, 2e-3, 'kg'),
    relativa('u(δmD)', fuente(mref.componentes, 'deriva'), 0.173, 2e-3, 'kg'),
    relativa('u(mc1)', uMc1, 0.25, 1e-2, 'kg'),
    igual('u(I) en 6 000 kg', redondear(r.uIndicacion, 2), 3.34, 'kg', 'igual al centésimo'),
    relativa('u(E) en 6 000 kg', r.u, 3.36, 5e-3, 'kg'),
    igual('νeff en 6 000 kg', Math.floor(r.nuEff), 4, '', 'igual (truncado)'),
    igual('k en 6 000 kg', r.k, 2.87),
    igual('U en 6 000 kg', redondear(r.U, 1), 9.6, 'kg', 'igual al décimo'),
  ];
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
    const uE = Math.sqrt(uI[j - 1] ** 2 + lt.u ** 2);
    filas.push(
      relativa(`u(LT${j}), 7.1.2-15a`, lt.u, esperado.uLT, 5e-3, 'kg'),
      relativa(`u(E) en ${6000 * j} kg`, uE, esperado.uE, 5e-3, 'kg'),
      igual(`k para ν = ${esperado.nu}`, motor.factorCobertura(esperado.nu), esperado.k),
      relativa(`U en ${6000 * j} kg`, esperado.k * uE, esperado.U, 6e-3, 'kg'),
    );
  });
  return {
    id: 'sim-g3',
    fuente: 'Guía SIM MWG7/cg-01 (2009), G3',
    titulo: 'Báscula de 30 t con 4 cargas de sustitución',
    nota: 'La guía estima el empuje con la densidad del hierro fundido (7,2·10⁻⁶·mc1) y sus u(I) incluyen la deriva bajo carga; se usan sus valores en esos dos términos.',
    filas,
  };
};

/**
 * Las opciones que el laboratorio elige en la configuración del método
 * (Calibración › Método de cálculo), frente a la tabla G.2 de la GUM, los
 * datos de la Guía SIM G2 y la R76, o su cálculo a mano.
 */
const casoOpciones = () => {
  const s1 = motor.repetibilidad(G2.s1);
  const s2 = motor.repetibilidad(G2.s2);
  const ensayos = [{ carga: 10000, ...s1 }, { carga: 30000, ...s2 }];
  const posiciones = [{ indicacion: 100, retorno: 0 }, { indicacion: 100.3, retorno: 0.1 }, { indicacion: 99.8, retorno: -0.1 }];
  const lecturas = { inicio: { t: 18, hr: 40, p: 650 }, fin: { t: 20, hr: 44, p: 652 } };
  const conservadora = { error: 0.5, U: 0.4, k: 2, tolerancia: 1, regla: 'CONSERVADORA' };
  const usp = motor.evaluarUSP({
    rangos: [{ max: 600, d: 0.01 }], ensayos: [{ carga: 500, s: 0.0115 }], puntos: [], pesadaMinima: { exactitudes: [0.001], factores: [2] },
  });
  return {
    id: 'opciones-metodo',
    fuente: 'GUM tabla G.2; Guía SIM G2; OIML R76 Tablas 3 y 6; cálculo a mano',
    titulo: 'Opciones de la configuración del método',
    nota: 'Cada opción que se puede elegir en Calibración › Método de cálculo, con su resultado esperado. Las opciones por omisión son las de los demás casos.',
    filas: [
      igual('k al 95 % para ν = 4', motor.factorCobertura(4, { probabilidad: 0.95 }), 2.78),
      igual('k al 95 % para ν = 10', motor.factorCobertura(10, { probabilidad: 0.95 }), 2.23),
      igual('k al 95 % para ν = ∞', motor.factorCobertura(Infinity, { probabilidad: 0.95 }), 1.96),
      igual('k fijo (2) con ν = 4', motor.factorCobertura(4, { metodo: 'FIJO', k: 2 }), 2),
      igual('U = 0,000931: 2 cifras hacia arriba', motor.redondearIncertidumbre(0.000931).valor, 0.00094),
      igual('U = 0,000931: 2 cifras al más cercano', motor.redondearIncertidumbre(0.000931, { sentido: 'CERCANO' }).valor, 0.00093),
      igual('U = 0,000931: 1 cifra hacia arriba', motor.redondearIncertidumbre(0.000931, { cifras: 1 }).valor, 0.001),
      relativa('s en 10 000 g, ensayos que encierran (G2)', motor.repetibilidadPara(10000, ensayos).s, 1.095, 1e-3, 'g'),
      relativa('s en 10 000 g, la mayor de todos (G2)', motor.repetibilidadPara(10000, ensayos, 'MAYOR').s, 2.739, 1e-3, 'g'),
      absoluta('ΔIecc máx, método 3 (con retorno)', motor.excentricidad({ posiciones, carga: 100 }).maxima, 0.2, 1e-9, 'g', '±10⁻⁹'),
      absoluta('ΔIecc máx, método 1 (sin retorno)', motor.excentricidad({ posiciones, carga: 100, metodo: 'METODO_1' }).maxima, 0.3, 1e-9, 'g', '±10⁻⁹'),
      igual('emp en servicio, clase III, 600 e, factor 2', motor.empEnServicio({ carga: 600, clase: 'III', e: 1 }), 2, 'e'),
      igual('emp en servicio, clase III, 600 e, factor 1', motor.empEnServicio({ carga: 600, clase: 'III', e: 1 }, 1), 1, 'e'),
      igual('|E| + 1·U ≤ T con E = 0,5, U = 0,4, T = 1', motor.conformidad(conservadora).conforme, true),
      igual('|E| + 1,5·U ≤ T con E = 0,5, U = 0,4, T = 1', motor.conformidad({ ...conservadora, bandaGuarda: 1.5 }).conforme, false),
      igual('Clase de 50 g, e = 0,01 g, por la Tabla 3', motor.claseSugerida([{ max: 50, d: 0.01, e: 0.01 }], 1).valor, 'II'),
      igual('Clase de 50 g, e = 0,01 g, solo por n', motor.claseSugerida([{ max: 50, d: 0.01, e: 0.01 }], 1, 'POR_N').valor, 'III'),
      absoluta('ρa con la fórmula aproximada (19 °C, 42 %, 651 hPa)', motor.aireDeCalibracion({ ...lecturas, formula: 'APROXIMADA' }).rho, motor.densidadAproximada({ t: 19, hr: 42, p: 651 }), 1e-12, 'kg/m³', '±10⁻¹²'),
      absoluta('USP: 2·s/m con s = 0,0115 g y m = 30 g', usp.repetibilidad.valor * 100, (2 * 0.0115 * 100) / 30, 1e-12, '%', '±10⁻¹²'),
      absoluta('USP: peso mínimo con SF = 2 y 0,10 %', usp.pesoMinimo.filas[0].valores[0], 46, 1e-9, 'g', '±10⁻⁹'),
    ],
  };
};

const CASOS = [casoGum, casoAire, casoH1, casoH2, casoH3, casoG1, casoG2, casoG3, casoOpciones];

/** Corre todos los casos con el motor actual. */
const ejecutarValidacion = () => {
  const casos = CASOS.map((caso) => {
    const resultado = caso();
    // k se lee con dos decimales, como lo imprimen las guías.
    const filas = resultado.filas.map(f => (/^k /.test(f.magnitud) ? { ...f, decimales: 2 } : f));
    return { ...resultado, filas, valores: filas.length, aprobados: filas.filter(f => f.ok).length };
  });
  const valores = casos.reduce((suma, c) => suma + c.valores, 0);
  const aprobados = casos.reduce((suma, c) => suma + c.aprobados, 0);
  return { casos, resumen: { casos: casos.length, valores, aprobados, ok: valores === aprobados } };
};

module.exports = { G1, G2, H1, H2, ejecutarValidacion };
