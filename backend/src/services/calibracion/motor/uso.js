/**
 * Incertidumbre de una pesada en uso, incertidumbre global y pesada mínima
 * (EURAMET cg-18 v4.0, 7.4, 7.5, Anexo C y Anexo G).
 *
 * Es información adicional para el usuario: no forma parte del certificado
 * (8.4 y 7.4) y va en un anexo separado, a pedido del cliente. Usa datos de
 * la calibración (d, s, excentricidad, u(E) por punto) y supuestos del lugar
 * de uso que fija la configuración del método (ΔT, coeficiente de
 * temperatura), que se declaran en el anexo.
 */
const { empVerificacion } = require('./tolerancia');

const RAIZ_3 = Math.sqrt(3);
const RAIZ_12 = Math.sqrt(12);
const RHO_0 = 1.2;
const RHO_C = 8000;

// Rango de temperatura de aprobación de la R76 (3.9.2.2) por clase, en K.
const DELTA_T_APROBACION = { I: 5, II: 15, III: 30, IIII: 30 };

/**
 * Ajuste u²(E) = A + B·I² por mínimos cuadrados (forma agrupada 7.1.3-2:
 * α² + β²·I²), con A y B no negativos. puntos: [{ I, u }].
 */
const ajusteUE = (puntos) => {
  const validos = puntos.filter(p => Number.isFinite(p.I) && p.u > 0);
  if (!validos.length) return { A: 0, B: 0 };
  if (validos.length === 1) {
    const [p] = validos;
    return p.I ? { A: 0, B: (p.u * p.u) / (p.I * p.I) } : { A: p.u * p.u, B: 0 };
  }
  const xs = validos.map(p => p.I * p.I);
  const ys = validos.map(p => p.u * p.u);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  let B = sxx > 0 ? xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx : 0;
  let A = my - B * mx;
  if (B < 0) { B = 0; A = my; }
  if (A < 0) {
    A = 0;
    const sx2 = xs.reduce((a, x) => a + x * x, 0);
    B = sx2 > 0 ? xs.reduce((a, x, i) => a + x * ys[i], 0) / sx2 : 0;
  }
  return { A, B };
};

/**
 * Recta por el origen E = a1·R ponderada por 1/u²(E) (C2.2-16a–b):
 * a1 = Σp·I·E / Σp·I², u²(a1) = 1/Σp·I². puntos: [{ I, E, u }].
 */
const pendienteOrigen = (puntos) => {
  const validos = puntos.filter(p => Number.isFinite(p.I) && Number.isFinite(p.E) && p.u > 0 && p.I !== 0);
  if (!validos.length) return { a1: 0, u: 0 };
  let sIE = 0;
  let sII = 0;
  for (const p of validos) {
    const peso = 1 / (p.u * p.u);
    sIE += peso * p.I * p.E;
    sII += peso * p.I * p.I;
  }
  return { a1: sIE / sII, u: Math.sqrt(1 / sII) };
};

/**
 * Coeficiente de temperatura KT (7.4.3-1). Sin el del fabricante, el límite
 * de la R76 para la clase: KT ≤ emp(Max)/(Max·ΔT de aprobación), por un
 * factor (1 si está aprobado; 3 a 10 si no). null si no hay clase.
 */
const coeficienteTemperatura = ({ kT = null, clase, max, e, factor = 1 }) => {
  if (kT != null) return { kT, origen: 'CONFIGURACION' };
  const deltaT = DELTA_T_APROBACION[clase];
  const emp = clase ? empVerificacion({ carga: max, clase, e }) : null;
  if (!deltaT || !(emp > 0) || !(max > 0)) return { kT: null, origen: null };
  return { kT: (factor * emp) / (max * deltaT), origen: 'R76' };
};

/**
 * U(W) = k·√(αW² + βW²·R²) (7.5.1-2b) y su aproximación lineal en el rango
 * [0, max]: U(W) ≈ U(0) + C·R (7.5.2-3d), con Ugl ≈ U(0) + C·R + |a1·R|
 * (7.5.2-3e). La cuerda queda por encima de la curva: es conservadora.
 */
const linealizar = ({ alfa2, beta2, k = 2, max, a1 = 0 }) => {
  const U = (R) => k * Math.sqrt(alfa2 + beta2 * R * R);
  const U0 = U(0);
  const C = max > 0 ? (U(max) - U0) / max : 0;
  return { U, U0, C, Ugl: (R) => U0 + C * R + Math.abs(a1 * R) };
};

/**
 * Incertidumbre en uso por rango.
 * datos: {
 *   rangos: [{ max, d, e }] (de menor a mayor), d0,
 *   puntos: [{ I, E, u }] (del ensayo de error),
 *   s: desviación de una lectura (la mayor de la repetibilidad),
 *   eccMaxima, eccCarga (ΔIecc máx y su carga),
 *   clase, configuracion: { k, deltaT, kT, factorKT },
 * }
 * Devuelve { k, deltaT, kT, origenKT, a1, rangos: [{ max, d, U0, C, U(R), Ugl(R) }] }.
 */
const incertidumbreEnUso = ({ rangos, d0, puntos, s = 0, eccMaxima = 0, eccCarga = 0, clase = null, configuracion = {} }) => {
  const k = configuracion.k ?? 2;
  const deltaT = configuracion.deltaT ?? 5;
  const { A, B } = ajusteUE(puntos);
  const { a1 } = pendienteOrigen(puntos);
  const mayor = rangos[rangos.length - 1];
  const { kT, origen } = coeficienteTemperatura({
    kT: configuracion.kT ?? null, clase, max: mayor?.max, e: mayor?.e || mayor?.d, factor: configuracion.factorKT ?? 1,
  });

  // Términos proporcionales (urel), comunes a todos los rangos.
  const urelEcc = eccCarga > 0 ? Math.abs(eccMaxima) / (eccCarga * RAIZ_3) : 0; // 7.4.4-10 (efecto completo en uso)
  const urelTemp = kT ? (kT * deltaT) / RAIZ_12 : 0; // 7.4.3-1
  const urelEmpuje = Math.sqrt(1.07e-4 + 1.33e-6 * deltaT * deltaT) * (RHO_0 / RHO_C); // 7.4.3-4
  const beta2 = urelEcc ** 2 + B + urelTemp ** 2 + urelEmpuje ** 2;

  const porRango = rangos.map((rango) => {
    // u²(W) = αW² + βW²·R² (7.4.5-1a/b, 7.4.5-2), con s de una lectura (7.4.1-4).
    const alfa2 = (d0 * d0) / 12 + (rango.d * rango.d) / 12 + s * s + A;
    const { U, U0, C, Ugl } = linealizar({ alfa2, beta2, k, max: rango.max, a1 });
    return {
      max: rango.max,
      d: rango.d,
      U0,
      C,
      alfa: Math.sqrt(alfa2),
      beta: Math.sqrt(beta2),
      U,
      Ugl,
    };
  });
  return {
    k, deltaT, kT, origenKT: origen, a1,
    terminos: { urelEcc, urelTemp, urelEmpuje, A, B },
    rangos: porRango,
  };
};

/**
 * Pesada mínima con factor de seguridad (G-9): Rmin = αgl·SF / (Req − βgl·SF),
 * con Ugl ≈ αgl + βgl·R. null si la exactitud pedida no se alcanza.
 */
const pesadaMinima = ({ alfaGl, betaGl, exactitud, factor = 1 }) => {
  const denominador = exactitud - betaGl * factor;
  if (!(denominador > 0)) return null;
  return (alfaGl * factor) / denominador;
};

module.exports = {
  DELTA_T_APROBACION, ajusteUE, coeficienteTemperatura, incertidumbreEnUso, linealizar, pendienteOrigen, pesadaMinima,
};
