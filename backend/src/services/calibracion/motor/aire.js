/**
 * Densidad del aire y su incertidumbre.
 *
 * Referencias: CIPM-2007 (Picard et al., Metrologia 45, 2008), adoptada por la
 * OIML R111-1 Enmienda 2025 (Anexo E) con R = 8,314 462 618 J/(mol·K);
 * EURAMET cg-18 v4.0, Anexo A (A1.1-1 y A3). Decisión del laboratorio 5:
 * u(t), u(HR), u(p) = U del certificado del termohigrómetro + variación
 * inicio-fin.
 */

const R = 8.314462618; // J/(mol·K), exacta desde el SI de 2019.
const MV = 18.01528e-3; // kg/mol, agua.
const X_CO2 = 0.0004; // fracción molar de CO2 por defecto.

// Presión de vapor de saturación (CIPM-2007, E.2).
const PSV = { A: 1.2378847e-5, B: -1.9121316e-2, C: 33.93711047, D: -6.3431645e3 };
// Factor de realce (E.3).
const REALCE = { alfa: 1.00062, beta: 3.14e-8, gamma: 5.6e-7 };
// Factor de compresibilidad (E.4).
const COMPRESIBILIDAD = {
  a0: 1.58123e-6, a1: -2.9331e-8, a2: 1.1043e-10,
  b0: 5.707e-6, b1: -2.051e-8,
  c0: 1.9898e-4, c1: -2.376e-6,
  d: 1.83e-11, e: -0.765e-8,
};

// Incertidumbre relativa de la propia fórmula CIPM-2007 (EURAMET A1.1).
const U_REL_CIPM = 2.2e-5;
// Incertidumbre relativa de la fórmula aproximada en su rango (EURAMET A1.1-1).
const U_REL_APROXIMADA = 2.4e-4;

/**
 * Densidad del aire por CIPM-2007, en kg/m³.
 * t en °C, hr en % (0–100), p en hPa; xCO2 como fracción molar.
 */
const densidadCIPM2007 = ({ t, hr, p, xCO2 = X_CO2 }) => {
  const T = t + 273.15;
  const pa = p * 100;
  const h = hr / 100;
  const Ma = (28.96546 + 12.011 * (xCO2 - 0.0004)) * 1e-3;
  const psv = Math.exp(PSV.A * T * T + PSV.B * T + PSV.C + PSV.D / T);
  const f = REALCE.alfa + REALCE.beta * pa + REALCE.gamma * t * t;
  const xv = (h * f * psv) / pa;
  const c = COMPRESIBILIDAD;
  const Z = 1
    - (pa / T) * (c.a0 + c.a1 * t + c.a2 * t * t + (c.b0 + c.b1 * t) * xv + (c.c0 + c.c1 * t) * xv * xv)
    + ((pa * pa) / (T * T)) * (c.d + c.e * xv * xv);
  return ((pa * Ma) / (Z * R * T)) * (1 - xv * (1 - MV / Ma));
};

/**
 * Fórmula aproximada (R111 E.3-1; EURAMET A1.1-1), p en hPa, hr en %, t en °C.
 * Válida con 2,4×10⁻⁴ entre 600 y 1 100 hPa, 15–27 °C y 20–80 % HR.
 */
const densidadAproximada = ({ t, hr, p }) => (0.34848 * p - 0.009 * hr * Math.exp(0.061 * t)) / (273.15 + t);

/**
 * Incertidumbre típica de una lectura del termohigrómetro (decisión 5): la U
 * de su certificado (con su k) y la variación entre el inicio y el fin como
 * distribución rectangular de ancho completo (variación/√12, EURAMET A2).
 */
const incertidumbreLectura = ({ U = 0, k = 2, inicio, fin }) => {
  const variacion = inicio != null && fin != null ? Math.abs(fin - inicio) : 0;
  return Math.sqrt((U / k) ** 2 + (variacion / Math.sqrt(12)) ** 2);
};

/**
 * Lectura del termohigrómetro corregida con los puntos de su certificado
 * (fase 1, CAL_CERT_PUNTOS): corrección y U interpoladas linealmente entre los
 * dos puntos calibrados que encierran la lectura; fuera del rango calibrado se
 * usa el punto más cercano y se marca `fuera`.
 * puntos: [{ punto, correccion, u (U expandida), k }].
 */
const corregirLectura = (valor, puntos = []) => {
  if (valor == null || !puntos.length) return { valor, correccion: 0, U: null, k: null, fuera: false, sinCertificado: !puntos.length };
  const orden = [...puntos].sort((a, b) => a.punto - b.punto);
  let correccion;
  let U;
  let k;
  let fuera = false;
  if (valor <= orden[0].punto || orden.length === 1) {
    ({ correccion, u: U, k } = orden[0]);
    fuera = valor < orden[0].punto || (orden.length === 1 && valor !== orden[0].punto);
  } else if (valor >= orden[orden.length - 1].punto) {
    ({ correccion, u: U, k } = orden[orden.length - 1]);
    fuera = valor > orden[orden.length - 1].punto;
  } else {
    const j = orden.findIndex(p => p.punto >= valor);
    const [a, b] = [orden[j - 1], orden[j]];
    const f = (valor - a.punto) / (b.punto - a.punto);
    correccion = a.correccion + f * (b.correccion - a.correccion);
    // La U interpolada no puede ser menor que la menor de los dos puntos.
    U = Math.max(a.u + f * (b.u - a.u), Math.min(a.u, b.u));
    k = Math.min(a.k, b.k);
  }
  return { valor: valor + correccion, correccion, U, k, fuera, sinCertificado: false };
};

/**
 * Humedad corregida cuando el certificado calibró la humedad a varias
 * temperaturas (puntos con `temperatura`): se corrige con los puntos de cada
 * temperatura y se interpola entre las dos temperaturas calibradas que
 * encierran la lectura de temperatura `t`; fuera de ellas, la más cercana.
 * Con una sola temperatura (o ninguna), igual que corregirLectura.
 */
const corregirHumedad = (hr, t, puntos = []) => {
  const grupos = new Map();
  for (const punto of puntos) {
    if (punto.temperatura == null) continue;
    grupos.set(punto.temperatura, [...(grupos.get(punto.temperatura) || []), punto]);
  }
  const temperaturas = [...grupos.keys()].sort((a, b) => a - b);
  if (temperaturas.length < 2 || hr == null) return corregirLectura(hr, puntos);
  const conPuntosDe = temperatura => corregirLectura(hr, grupos.get(temperatura));
  if (t == null || t <= temperaturas[0]) return conPuntosDe(temperaturas[0]);
  if (t >= temperaturas[temperaturas.length - 1]) return conPuntosDe(temperaturas[temperaturas.length - 1]);
  const j = temperaturas.findIndex(temperatura => temperatura >= t);
  const [a, b] = [conPuntosDe(temperaturas[j - 1]), conPuntosDe(temperaturas[j])];
  const f = (t - temperaturas[j - 1]) / (temperaturas[j] - temperaturas[j - 1]);
  const correccion = a.correccion + f * (b.correccion - a.correccion);
  return {
    valor: hr + correccion,
    correccion,
    // Como en corregirLectura: no menor que la menor de las dos.
    U: Math.max(a.U + f * (b.U - a.U), Math.min(a.U, b.U)),
    k: Math.min(a.k, b.k),
    fuera: a.fuera || b.fuera,
    sinCertificado: false,
  };
};

/**
 * Densidad del aire durante la calibración con su incertidumbre: media de las
 * lecturas de inicio y fin, coeficientes de sensibilidad numéricos sobre
 * CIPM-2007 y la incertidumbre de la fórmula.
 * lecturas: { inicio: {t, hr, p}, fin: {t, hr, p} } (ya corregidas por el
 * certificado del termohigrómetro); certificado: { t: {U, k}, hr: {U, k}, p: {U, k} }.
 */
const aireDeCalibracion = ({ inicio, fin, certificado = {}, formula = 'CIPM-2007' }) => {
  const { densidad, uRel } = FORMULAS_AIRE[formula] || FORMULAS_AIRE['CIPM-2007'];
  const media = (campo) => {
    const valores = [inicio?.[campo], fin?.[campo]].filter(v => v != null && Number.isFinite(v));
    return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
  };
  const condiciones = { t: media('t'), hr: media('hr'), p: media('p') };
  if (condiciones.t == null || condiciones.hr == null || condiciones.p == null) {
    throw new Error('Faltan la temperatura, la humedad o la presión para calcular la densidad del aire.');
  }
  const u = {
    t: incertidumbreLectura({ ...certificado.t, inicio: inicio?.t, fin: fin?.t }),
    hr: incertidumbreLectura({ ...certificado.hr, inicio: inicio?.hr, fin: fin?.hr }),
    p: incertidumbreLectura({ ...certificado.p, inicio: inicio?.p, fin: fin?.p }),
  };
  const rho = densidad(condiciones);
  // Sensibilidades por diferencias centrales.
  const pasos = { t: 0.01, hr: 0.1, p: 0.1 };
  const sensibilidad = Object.fromEntries(Object.entries(pasos).map(([campo, paso]) => {
    const arriba = densidad({ ...condiciones, [campo]: condiciones[campo] + paso });
    const abajo = densidad({ ...condiciones, [campo]: condiciones[campo] - paso });
    return [campo, (arriba - abajo) / (2 * paso)];
  }));
  const componentes = [
    { fuente: 't', u: Math.abs(sensibilidad.t) * u.t },
    { fuente: 'hr', u: Math.abs(sensibilidad.hr) * u.hr },
    { fuente: 'p', u: Math.abs(sensibilidad.p) * u.p },
    { fuente: 'formula', u: uRel * rho },
  ];
  const uRho = Math.sqrt(componentes.reduce((suma, c) => suma + c.u * c.u, 0));
  return { rho, u: uRho, formula: FORMULAS_AIRE[formula] ? formula : 'CIPM-2007', condiciones, incertidumbres: u, sensibilidad, componentes };
};

// Fórmulas de la densidad del aire que el método puede elegir, con la
// incertidumbre relativa de cada una.
const FORMULAS_AIRE = {
  'CIPM-2007': { densidad: densidadCIPM2007, uRel: U_REL_CIPM },
  APROXIMADA: { densidad: densidadAproximada, uRel: U_REL_APROXIMADA },
};

/** Densidad del aire con la fórmula elegida (para ρa1 de las pesas). */
const densidadAire = (condiciones, formula = 'CIPM-2007') => (FORMULAS_AIRE[formula] || FORMULAS_AIRE['CIPM-2007']).densidad(condiciones);

module.exports = {
  FORMULAS_AIRE,
  U_REL_APROXIMADA,
  U_REL_CIPM,
  aireDeCalibracion,
  corregirHumedad,
  corregirLectura,
  densidadAire,
  densidadAproximada,
  densidadCIPM2007,
  incertidumbreLectura,
};
