/**
 * Cargas de sustitución (EURAMET cg-18 v4.0, 4.3.3 y 7.1.2.6; decisión 8).
 *
 * La balanza se usa como comparador: con la carga patrón mref se lee I1; se
 * reemplaza por material de sustitución hasta una indicación parecida y se
 * vuelve a agregar mref, y así n veces:
 *   LTn   = n·mref + ΔI1 + … + ΔIn−1                       (4.3.3-5a)
 *   LTn,k = (n − 1)·mref + mref,k + ΔI1 + … + ΔIn−1        (4.3.3-5b)
 * con mref,k una parte de la carga patrón.
 */

/**
 * Valor y u de una carga de sustitución.
 * mref, uMref: carga patrón completa y su u (de masaReferencia).
 * diferencias: [ΔI1 … ΔIn−1]; uIndicaciones: [u(I1) … u(In−1)] calculadas con
 * 7.1.1-12 en cada indicación, incluso si ΔIj = 0.
 * parcial: { mref, u } de la carga patrón parcial mref,k (7.1.2-15b) o null.
 */
const cargaSustitucion = ({ mref, uMref, diferencias = [], uIndicaciones = [], parcial = null }) => {
  if (uIndicaciones.length !== diferencias.length) {
    throw new Error('Hace falta una u(I) por cada diferencia de indicación.');
  }
  const n = diferencias.length + 1;
  const sumaDiferencias = diferencias.reduce((a, b) => a + b, 0);
  const terminoIndicaciones = 2 * uIndicaciones.reduce((suma, u) => suma + u * u, 0);
  if (parcial) {
    return {
      n,
      valor: (n - 1) * mref + parcial.mref + sumaDiferencias,
      u: Math.sqrt(((n - 1) * uMref + parcial.u) ** 2 + terminoIndicaciones), // 7.1.2-15b
      ecuacion: '7.1.2-15b',
    };
  }
  return {
    n,
    valor: n * mref + sumaDiferencias,
    u: Math.sqrt(n * n * uMref * uMref + terminoIndicaciones), // 7.1.2-15a
    ecuacion: '7.1.2-15a',
  };
};

/**
 * «Método 2» del laboratorio (explicado por el personal el 2026-11-13): con
 * la carga patrón se halla el error E = Iref − mref (500 kg lee 499,5: E =
 * −0,5); cada carga sustitutiva se pesa sola, cerca de ese valor, y su masa es
 * su indicación menos ese mismo error (495 → 495,5); luego se suben una por
 * una junto con las pesas (500 + 495,5 = 995,5; + 502,5 = 1 498; …):
 *   LT = mref + Σ (Is,j − E) = (k + 1)·mref + Σ Is,j − k·Iref
 * Ninguna de las guías lo describe (solo la cadena de 4.3.3); la
 * incertidumbre sale de ese modelo (GUM 5.1.2). Las pesas y la lectura Iref
 * entran en cada una de las k cargas sustitutivas, así que se suman
 * linealmente; la lectura propia de cada una, en cuadratura:
 *   u²(LT) = (k + 1)²·u²(mref) + Σ u²(Is,j) + k²·u²(Iref)
 * mref, uMref: la carga patrón y su u (de masaReferencia); nominal: su valor
 * nominal; uIndicacionPatron: u(Iref) (7.1.1-12). sustitutas: [{ masa,
 * uIndicacion }] con la masa declarada por el técnico, que usó el nominal
 * (ms = Is − (Iref − nominal)), y u(Is) en su indicación. Con la mref real,
 * cada una suma mref − nominal.
 */
const cargaMetodo2 = ({ mref, uMref, nominal, uIndicacionPatron, sustitutas = [] }) => {
  const k = sustitutas.length;
  const material = sustitutas.reduce((suma, s) => suma + s.masa, 0);
  const uPatron = (k + 1) * uMref;
  const uIndicaciones = Math.sqrt(sustitutas.reduce((suma, s) => suma + s.uIndicacion ** 2, 0) + (k * uIndicacionPatron) ** 2);
  return {
    n: k + 1,
    valor: mref + material + k * (mref - nominal),
    u: Math.sqrt(uPatron ** 2 + uIndicaciones ** 2),
    uPatron,
    uIndicaciones,
    ecuacion: 'Método 2 (GUM)',
  };
};

module.exports = { cargaMetodo2, cargaSustitucion };
