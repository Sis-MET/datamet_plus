/**
 * Indicación y su incertidumbre:
 * I = IL + δIdigL + δIrep + δIecc − I0 − δIdig0  (EURAMET cg-18 v4.0, 7.1.1).
 */

const RAIZ_12 = Math.sqrt(12);

/** Media y desviación típica de una serie de lecturas (6.1-1, 6.1-2). */
const repetibilidad = (lecturas) => {
  const valores = lecturas.filter(v => v != null && Number.isFinite(v));
  const n = valores.length;
  if (n < 2) return { n, media: valores[0] ?? null, s: null, nu: null };
  const media = valores.reduce((a, b) => a + b, 0) / n;
  // Lecturas iguales dan s = 0, no el residuo del punto flotante (1e-13).
  const iguales = valores.every(v => v === valores[0]);
  const s = iguales ? 0 : Math.sqrt(valores.reduce((suma, v) => suma + (v - media) ** 2, 0) / (n - 1));
  return { n, media: iguales ? valores[0] : media, s, nu: n - 1 };
};

/**
 * s que corresponde a una indicación: con varios ensayos, el mayor de los dos
 * que encierran la indicación (7.1.1.3); fuera de ellos, el del extremo.
 * ensayos: [{ carga, s, nu }] (sin los que no tienen s).
 */
const repetibilidadPara = (indicacion, ensayos) => {
  const validos = ensayos.filter(e => e.s != null).sort((a, b) => a.carga - b.carga);
  if (!validos.length) return null;
  if (validos.length === 1) return validos[0];
  if (indicacion <= validos[0].carga) return validos[0];
  if (indicacion >= validos[validos.length - 1].carga) return validos[validos.length - 1];
  const arriba = validos.findIndex(e => e.carga >= indicacion);
  const [a, b] = [validos[arriba - 1], validos[arriba]];
  return a.s >= b.s ? a : b;
};

/**
 * Excentricidad por el método 3 (decisión 11; EURAMET 5.3 y 6.3-2):
 * ΔIecc,i = (ILi − I0i) − IL1, con I0i el retorno a cero tras retirar la carga
 * de la posición i. urel(δIecc) = |ΔIecc,i|máx / (2·Lecc·√3)  (7.1.1-11).
 * posiciones: [{ indicacion, retorno }] empezando por el centro (posición 1).
 */
const excentricidad = ({ posiciones, carga }) => {
  const validas = posiciones.filter(p => p.indicacion != null);
  if (validas.length < 2 || !(carga > 0)) return { diferencias: [], maxima: 0, uRel: 0 };
  const centro = validas[0].indicacion;
  const diferencias = validas.slice(1).map(p => (p.indicacion - (p.retorno || 0)) - centro);
  const maxima = Math.max(...diferencias.map(Math.abs));
  return { diferencias, maxima, uRel: maxima / (2 * carga * Math.sqrt(3)) };
};

/**
 * Componentes de u(I) en una indicación (7.1.1-12):
 * u²(I) = d0²/12 + dI²/12 + s² + u²rel(δIecc)·I².
 * Sin carga solo cuentan el redondeo en cero y la repetibilidad.
 * opciones: { d0, dI, s, nuS, uRelEcc, aprobadoR76 (redondeo en cero con
 * d0/(4√3), 7.1.1-2c) }.
 */
const componentesIndicacion = (indicacion, { d0, dI, s, nuS, uRelEcc = 0, aprobadoR76 = false }) => {
  const sinCarga = Math.abs(indicacion) < 1e-12;
  const componentes = [
    { fuente: 'redondeoCero', u: aprobadoR76 ? d0 / (4 * Math.sqrt(3)) : d0 / RAIZ_12, nu: Infinity, ecuacion: aprobadoR76 ? '7.1.1-2c' : '7.1.1-2a' },
    { fuente: 'repetibilidad', u: s ?? 0, nu: nuS ?? Infinity, ecuacion: '7.1.1-5' },
  ];
  if (!sinCarga) {
    componentes.splice(1, 0, { fuente: 'redondeoCarga', u: dI / RAIZ_12, nu: Infinity, ecuacion: '7.1.1-3a' });
    componentes.push({ fuente: 'excentricidad', u: uRelEcc * Math.abs(indicacion), nu: Infinity, ecuacion: '7.1.1-10' });
  }
  return componentes;
};

module.exports = {
  componentesIndicacion,
  excentricidad,
  repetibilidad,
  repetibilidadPara,
};
