/**
 * Masa de referencia de una carga formada por pesas patrón:
 * mref = mN + δmc + δmB + δmD + δmconv  (EURAMET cg-18 v4.0, 7.1.2).
 *
 * Todas las masas van en la unidad del instrumento (`unidad`); las densidades
 * en kg/m³. Las incertidumbres de las pesas de una misma carga se suman
 * linealmente (EURAMET 7.1.2.1: se suponen correlacionadas).
 */

const RHO_0 = 1.2; // kg/m³, densidad del aire de referencia (EURAMET 4.2.2-2).
const RHO_C = 8000; // kg/m³, densidad convencional de las pesas.

const GRAMOS_POR = { mg: 1e-3, g: 1, kg: 1e3, t: 1e6 };

/**
 * Densidad supuesta por material, con su incertidumbre típica (k = 1)
 * (EURAMET cg-18 Anexo E1; R111 Tabla B.7).
 */
const DENSIDADES_SUPUESTAS = [
  { patron: /alpaca|plata alemana|niquel plata/i, rho: 8600, u: 85 },
  { patron: /lat[oó]n|bronce/i, rho: 8400, u: 85 },
  { patron: /inox/i, rho: 7950, u: 70 },
  { patron: /fundici[oó]n blanca/i, rho: 7700, u: 200 },
  { patron: /fundici[oó]n|hierro fundido|gris/i, rho: 7100, u: 300 },
  { patron: /acero al carbono|acero/i, rho: 7700, u: 100 },
  { patron: /hierro/i, rho: 7800, u: 100 },
  { patron: /aluminio/i, rho: 2700, u: 65 },
];

const densidadSupuesta = (material) => {
  const fila = DENSIDADES_SUPUESTAS.find(item => item.patron.test(String(material || '')));
  return fila ? { rho: fila.rho, u: fila.u } : null;
};

/** Corrección por empuje: δmB = −mN·(ρa − ρ0)·(1/ρ − 1/ρc)  (7.1.2-4). */
const correccionEmpuje = (mN, rhoA, rho) => -mN * (rhoA - RHO_0) * (1 / rho - 1 / RHO_C);

/**
 * u(δmB) con la densidad del aire y de la pesa (7.1.2-5a), o con la densidad
 * del aire cuando se calibraron las pesas ρa1 (7.1.2-5b), más exacta en
 * altura. uRho es incertidumbre típica (k = 1).
 */
const incertidumbreEmpuje = ({ mN, rhoA, uRhoA, rho, uRho, rhoA1 = null }) => {
  const aire = (uRhoA * (1 / rho - 1 / RHO_C)) ** 2;
  const factorPesa = rhoA1 == null
    ? (rhoA - RHO_0) ** 2 // 7.1.2-5a
    : (rhoA - RHO_0) * ((rhoA - RHO_0) - 2 * (rhoA1 - RHO_0)); // 7.1.2-5b
  // Con 5b el término de la densidad puede salir negativo: no resta incertidumbre.
  const pesa = Math.max(0, factorPesa) * (uRho ** 2) / (rho ** 4);
  return Math.abs(mN) * Math.sqrt(aire + pesa);
};

/**
 * Cotas de u(δmB) para pesas R111 sin corrección de empuje, válidas solo con
 * aire dentro de ±10 % de 1,2 kg/m³ (no en el altiplano):
 * '5c' ajustada justo antes; '5d' sin ajuste; '5e' conociendo ΔT del lugar.
 */
const cotaEmpuje = (metodo, { mN, emp, deltaT = 0 }) => {
  if (metodo === '5c') return emp / (4 * Math.sqrt(3)); // 7.1.2-5c
  if (metodo === '5d') return (Math.abs(mN) * 0.1 * RHO_0 / RHO_C + emp / 4) / Math.sqrt(3); // 7.1.2-5d
  if (metodo === '5e') {
    return Math.abs(mN) * Math.sqrt(1.07e-4 + 1.33e-6 * deltaT * deltaT) * RHO_0 / RHO_C + emp / (4 * Math.sqrt(3)); // 7.1.2-5e
  }
  throw new Error(`Método de empuje desconocido: ${metodo}`);
};

/**
 * Convección (Anexo F, Tabla F2.1): cambio de masa aparente en mg según la
 * masa de la pesa y |ΔT|. Se toma la fila de masa y la columna de ΔT
 * inmediatamente superiores (cota), y por encima de 20 K se escala.
 */
const CONVECCION_DT = [1, 2, 3, 5, 7, 10, 15, 20];
const CONVECCION = [
  // kg      1 K   2 K   3 K   5 K   7 K   10 K   15 K   20 K   (mg)
  [0.01, [0.01, 0.01, 0.02, 0.03, 0.03, 0.05, 0.06, 0.08]],
  [0.02, [0.01, 0.02, 0.03, 0.05, 0.06, 0.08, 0.11, 0.14]],
  [0.05, [0.03, 0.05, 0.06, 0.09, 0.12, 0.17, 0.23, 0.29]],
  [0.1, [0.05, 0.08, 0.11, 0.17, 0.22, 0.29, 0.40, 0.51]],
  [0.2, [0.08, 0.14, 0.19, 0.29, 0.38, 0.51, 0.72, 0.91]],
  [0.5, [0.17, 0.29, 0.40, 0.61, 0.81, 1.09, 1.54, 1.96]],
  [1, [0.29, 0.51, 0.72, 1.09, 1.45, 1.96, 2.76, 3.53]],
  [2, [0.51, 0.91, 1.27, 1.96, 2.61, 3.53, 5.01, 6.42]],
  [5, [1.09, 1.96, 2.76, 4.28, 5.72, 7.79, 11.10, 14.30]],
  [10, [1.96, 3.53, 5.01, 7.79, 10.45, 14.30, 20.47, 26.43]],
  [20, [3.53, 6.42, 9.14, 14.30, 19.25, 26.43, 38.00, 49.23]],
  [50, [7.79, 14.30, 20.47, 32.27, 43.65, 60.23, 87.06, 113.23]],
];

const conveccionMg = (masaKg, deltaT) => {
  const dt = Math.abs(deltaT || 0);
  if (dt === 0 || !(masaKg > 0)) return 0;
  const fila = CONVECCION.find(([kg]) => kg >= masaKg - 1e-12) || CONVECCION[CONVECCION.length - 1];
  const escalaMasa = masaKg > 50 ? masaKg / 50 : 1;
  const columna = CONVECCION_DT.findIndex(valor => valor >= dt);
  const valor = columna >= 0 ? fila[1][columna] : fila[1][CONVECCION_DT.length - 1] * (dt / 20);
  return valor * escalaMasa;
};

const CLASES_CON_CONVECCION = new Set(['E1', 'E2', 'F1']);

/**
 * Masa de referencia de una carga y su presupuesto.
 *
 * piezas: [{ nominal, correccion|null, U|null, k, emp, densidad|null,
 *   uDensidad|null (típica), material, clase }] en la unidad del instrumento.
 * opciones: {
 *   unidad,
 *   aire: { rho, u },            densidad del aire durante la calibración
 *   rhoA1,                       aire cuando se calibraron las pesas (5b) o null;
 *                                cada pieza puede traer el suyo (pieza.rhoA1)
 *   empuje: '5a'|'5b'|'5c'|'5d'|'5e', con corrección solo en 5a y 5b
 *   kD,                          factor de la deriva (7.1.2-10), 1 por defecto
 *   deltaT,                      diferencia de temperatura pesas–aire (convección, 5e)
 *   conveccion,                  true para incluirla (pesas F1 o mejores)
 * }
 */
const masaReferencia = (piezas, opciones) => {
  const {
    unidad = 'g', aire = null, rhoA1 = null, empuje = '5b', kD = 1, deltaT = 0, conveccion = false,
  } = opciones || {};
  const enGramos = GRAMOS_POR[unidad];
  if (!enGramos) throw new Error(`Unidad desconocida: ${unidad}`);
  const corrigeEmpuje = empuje === '5a' || empuje === '5b';
  if (corrigeEmpuje && !(aire?.rho > 0)) throw new Error('Falta la densidad del aire para corregir el empuje.');

  let mN = 0;
  let deltaMc = 0;
  let deltaMb = 0;
  const u = { certificado: 0, empuje: 0, deriva: 0, conveccion: 0 };
  const detalle = [];

  for (const pieza of piezas) {
    const nominal = Number(pieza.nominal);
    mN += nominal;
    // Certificado: u = U/k (7.1.2-2); sin certificado, nominal con u = emp/√3 (7.1.2-3).
    const conCertificado = pieza.correccion != null && pieza.U != null;
    const correccion = conCertificado ? Number(pieza.correccion) : 0;
    const uCert = conCertificado ? Number(pieza.U) / Number(pieza.k || 2) : Number(pieza.emp || 0) / Math.sqrt(3);
    // Deriva: D = kD·U (7.1.2-10); sin U, D = emp; u = D/√3 (7.1.2-11).
    const D = pieza.U != null ? kD * Number(pieza.U) : Number(pieza.emp || 0);
    const uDeriva = D / Math.sqrt(3);
    // Empuje.
    const densidad = pieza.densidad != null
      ? { rho: Number(pieza.densidad), u: Number(pieza.uDensidad || 0) }
      : densidadSupuesta(pieza.material) || { rho: RHO_C, u: 0 };
    const correccionB = corrigeEmpuje ? correccionEmpuje(nominal, aire.rho, densidad.rho) : 0;
    const uEmpuje = corrigeEmpuje
      ? incertidumbreEmpuje({ mN: nominal, rhoA: aire.rho, uRhoA: aire.u || 0, rho: densidad.rho, uRho: densidad.u, rhoA1: empuje === '5b' ? (pieza.rhoA1 ?? rhoA1) : null })
      : cotaEmpuje(empuje, { mN: nominal, emp: Number(pieza.emp || 0), deltaT });
    // Convección (7.1.2-13), solo en pesas F1 o mejores.
    const uConveccion = conveccion && CLASES_CON_CONVECCION.has(pieza.clase)
      ? (conveccionMg((nominal * enGramos) / 1000, deltaT) / 1000 / enGramos) / Math.sqrt(3)
      : 0;

    deltaMc += correccion;
    deltaMb += correccionB;
    u.certificado += uCert;
    u.deriva += uDeriva;
    u.empuje += uEmpuje;
    u.conveccion += uConveccion;
    detalle.push({ nominal, correccion, uCert, correccionB, uEmpuje, uDeriva, uConveccion, densidad });
  }

  const componentes = [
    { fuente: 'certificado', u: u.certificado, nu: Infinity, ecuacion: '7.1.2-2' },
    { fuente: 'empuje', u: u.empuje, nu: Infinity, ecuacion: `7.1.2-${empuje}` },
    { fuente: 'deriva', u: u.deriva, nu: Infinity, ecuacion: '7.1.2-11' },
    { fuente: 'conveccion', u: u.conveccion, nu: Infinity, ecuacion: '7.1.2-13' },
  ];
  return {
    mN,
    deltaMc,
    deltaMb,
    mref: mN + deltaMc + deltaMb,
    u: Math.sqrt(componentes.reduce((suma, c) => suma + c.u * c.u, 0)), // 7.1.2-14
    componentes,
    piezas: detalle,
  };
};

module.exports = {
  RHO_0,
  RHO_C,
  conveccionMg,
  correccionEmpuje,
  cotaEmpuje,
  densidadSupuesta,
  incertidumbreEmpuje,
  masaReferencia,
};
