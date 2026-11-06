/**
 * Estadística del motor de cálculo: factor de cobertura con la t de Student,
 * grados efectivos de libertad y redondeo de la incertidumbre.
 *
 * Referencias: GUM (JCGM 100:2008) G.2, G.4, G.6.4, Tabla G.2 y 7.2.6;
 * EURAMET cg-18 v4.0, 7.3 y Anexo B. Decisiones del laboratorio 2 y 3.
 */

// Probabilidad de cobertura de los certificados (decisión 2; EURAMET 7.3).
const COBERTURA = 0.9545;

// ─── Funciones especiales ──────────────────────────────────────────────────

/** ln Γ(x) por la aproximación de Lanczos (g = 7, n = 9). */
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];
const lnGamma = (x) => {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const z = x - 1;
  let suma = LANCZOS[0];
  for (let i = 1; i < 9; i += 1) suma += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(suma);
};

/** Fracción continua de la beta incompleta (Lentz). */
const fraccionBeta = (a, b, x) => {
  const MIN = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  d = Math.abs(d) < MIN ? MIN : d;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    d = Math.abs(d) < MIN ? MIN : d;
    c = 1 + aa / c;
    c = Math.abs(c) < MIN ? MIN : c;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    d = Math.abs(d) < MIN ? MIN : d;
    c = 1 + aa / c;
    c = Math.abs(c) < MIN ? MIN : c;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return h;
};

/** Beta incompleta regularizada I_x(a, b). */
const betaIncompleta = (x, a, b) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const ln = lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  return x < (a + 1) / (a + b + 2)
    ? (Math.exp(ln) * fraccionBeta(a, b, x)) / a
    : 1 - (Math.exp(ln) * fraccionBeta(b, a, 1 - x)) / b;
};

/** Probabilidad de que una t de Student con ν grados esté entre −t y t. */
const coberturaT = (t, nu) => 1 - betaIncompleta(nu / (nu + t * t), nu / 2, 0.5);

/** Probabilidad de que una normal tipificada esté entre −z y z. */
const erf = (x) => {
  // Serie de Taylor para |x| ≤ 3 (error < 1e-15) y cola asintótica para más.
  const ax = Math.abs(x);
  if (ax > 6) return Math.sign(x);
  if (ax <= 3) {
    let termino = ax;
    let suma = ax;
    for (let n = 1; n < 200; n += 1) {
      termino *= (-ax * ax) / n;
      const aporte = termino / (2 * n + 1);
      suma += aporte;
      if (Math.abs(aporte) < 1e-17) break;
    }
    return Math.sign(x) * (2 / Math.sqrt(Math.PI)) * suma;
  }
  // Fracción continua de erfc para 3 < |x| ≤ 6.
  let f = 0;
  for (let n = 60; n >= 1; n -= 1) f = (n / 2) / (ax + f);
  const erfc = Math.exp(-ax * ax) / Math.sqrt(Math.PI) / (ax + f);
  return Math.sign(x) * (1 - erfc);
};
const coberturaNormal = (z) => erf(z / Math.SQRT2);

/** Función de distribución de la normal tipificada. */
const normalAcumulada = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

const biseccion = (f, objetivo, bajo, alto) => {
  let [a, b] = [bajo, alto];
  for (let i = 0; i < 200; i += 1) {
    const medio = (a + b) / 2;
    if (f(medio) < objetivo) a = medio;
    else b = medio;
    if (b - a < 1e-12) break;
  }
  return (a + b) / 2;
};

// ─── Factor de cobertura ───────────────────────────────────────────────────

/**
 * t de Student tal que la probabilidad entre −t y t es `p` (GUM Tabla G.2).
 * ν no entero se trunca al entero inferior (GUM G.6.4); ν infinito o muy
 * grande usa la normal.
 */
const tStudent = (nu, p = COBERTURA) => {
  if (!(nu >= 1)) throw new Error('Los grados de libertad deben ser al menos 1.');
  if (!Number.isFinite(nu) || nu > 1e7) return biseccion(coberturaNormal, p, 0, 10);
  const entero = Math.floor(nu);
  return biseccion(t => coberturaT(t, entero), p, 0, 1000);
};

/**
 * Grados efectivos de libertad por Welch-Satterthwaite (GUM G.2b; EURAMET
 * B3-1): νeff = u⁴ / Σ(ui⁴/νi). Las componentes con ν infinito no suman al
 * denominador. Sin componentes de ν finito, νeff es infinito.
 * componentes: [{ u, nu }] con u ya multiplicada por su coeficiente.
 */
const gradosEfectivos = (componentes) => {
  const u2 = componentes.reduce((suma, c) => suma + c.u * c.u, 0);
  const denominador = componentes
    .filter(c => Number.isFinite(c.nu) && c.u > 0)
    .reduce((suma, c) => suma + (c.u ** 4) / c.nu, 0);
  if (denominador === 0) return Infinity;
  return (u2 * u2) / denominador;
};

/** Combina en cuadratura componentes no correlacionadas (GUM 5.1.2). */
const combinar = (componentes) => Math.sqrt(componentes.reduce((suma, c) => suma + c.u * c.u, 0));

/**
 * Factor de cobertura para el 95,45 % con νeff (decisión 2), redondeado a dos
 * decimales como se imprime; con él se calcula U para que k·u = U cuadre.
 */
const factorCobertura = (nuEfectivos) => Math.round(tStudent(Math.max(1, nuEfectivos)) * 100) / 100;

// ─── Redondeo ──────────────────────────────────────────────────────────────

/**
 * U con dos cifras significativas redondeadas hacia arriba (decisión 3; GUM
 * 7.2.6 admite redondear hacia arriba). Devuelve el valor y sus decimales.
 */
const redondearIncertidumbre = (u) => {
  if (!(u > 0)) return { valor: 0, decimales: 0 };
  let exponente = Math.floor(Math.log10(u));
  let escala = 10 ** (1 - exponente);
  // El margen evita subir por el ruido del punto flotante (0,000 93 × 10⁵ = 93,000…01).
  let cifras = Math.ceil(u * escala - 1e-9);
  if (cifras >= 100) {
    exponente += 1;
    escala /= 10;
    cifras = 10;
  }
  const decimales = Math.max(0, 1 - exponente);
  return { valor: Number((cifras / escala).toFixed(decimales)), decimales };
};

/** Redondeo al número de decimales indicado, alejándose de cero en el medio. */
const redondearA = (valor, decimales) => {
  if (valor == null || !Number.isFinite(valor)) return valor;
  const factor = 10 ** decimales;
  const redondeado = Math.sign(valor) * Math.round(Math.abs(valor) * factor + 1e-9) / factor;
  return Number(redondeado.toFixed(Math.max(0, decimales)));
};

module.exports = {
  COBERTURA,
  combinar,
  factorCobertura,
  gradosEfectivos,
  normalAcumulada,
  redondearA,
  redondearIncertidumbre,
  tStudent,
};
