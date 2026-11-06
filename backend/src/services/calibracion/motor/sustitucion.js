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

module.exports = { cargaSustitucion };
