/**
 * Evaluación de la balanza con los criterios de la USP ⟨41⟩ (balanzas de uso
 * farmacéutico), como la hoja INCO del libro F-VMET-02-7.2. Es información
 * adicional a pedido del cliente: no forma parte del certificado.
 *
 * Los límites los fija la configuración del método (por omisión, los de la
 * USP que usaba el libro):
 * - repetibilidad: factorS·s / m ≤ tolerancia, con m = cargaEvaluacion·Max y
 *   s la mayor de los ensayos, no menor que sMinimaEnD·d;
 * - exactitud: |E| ≤ tolerancia·carga en las cargas entre m y Max;
 * - adecuación de las pesas: U(mref) ≤ tolerancia·carga / divisorPesas;
 * - peso mínimo de muestra: factorS·s·SF / exactitud.
 *
 * Solo usa los números de la USP, no su texto.
 */

/** Configuración por omisión (la del libro). */
const USP_INICIAL = Object.freeze({
  tolerancia: 0.001, // 0,10 %
  cargaEvaluacion: 0.05, // 5 % de Max
  sMinimaEnD: 0.41,
  factorS: 2,
  divisorPesas: 3,
});

/**
 * datos: {
 *   rangos: [{ max, d }] de menor a mayor,
 *   ensayos: [{ carga, s }] de repetibilidad,
 *   puntos: [{ carga, error, uReferencia, presentacion }] calculados,
 *   configuracion: USP_INICIAL o la del método,
 *   pesadaMinima: { exactitudes, factores } (las mismas de la pesada mínima EURAMET),
 * }
 * Devuelve null si no hay rangos o repetibilidad.
 */
const evaluarUSP = ({ rangos, ensayos, puntos, configuracion = USP_INICIAL, pesadaMinima = { exactitudes: [], factores: [] } }) => {
  const c = { ...USP_INICIAL, ...configuracion };
  const max = rangos?.length ? rangos[rangos.length - 1].max : null;
  const d = rangos?.length ? rangos[0].d : null;
  const sMedida = Math.max(0, ...(ensayos || []).filter(e => e.s != null).map(e => e.s));
  if (!(max > 0) || !(d > 0) || !(ensayos || []).some(e => e.s != null)) return null;

  // Repetibilidad a la carga de evaluación, con la s mínima de la USP.
  const m = c.cargaEvaluacion * max;
  const sMinima = c.sMinimaEnD * d;
  const s = Math.max(sMedida, sMinima);
  const valor = (c.factorS * s) / m;
  const repetibilidad = {
    carga: m,
    sMedida,
    sMinima,
    s,
    valor,
    limite: c.tolerancia,
    cumple: valor <= c.tolerancia * (1 + 1e-12),
    // Menor carga neta que cumple la repetibilidad.
    pesoMinimo: (c.factorS * s) / c.tolerancia,
  };

  // Exactitud y adecuación de las pesas, en las cargas entre m y Max.
  const filas = (puntos || [])
    .filter(p => p.carga >= m * (1 - 1e-9) && p.carga <= max * (1 + 1e-9))
    .map((p) => {
      const limite = c.tolerancia * Math.abs(p.carga);
      const Upesas = 2 * (p.uReferencia || 0);
      return {
        carga: p.carga,
        error: p.error,
        presentacion: p.presentacion,
        limite,
        cumple: Math.abs(p.error) <= limite * (1 + 1e-12),
        Upesas,
        limitePesas: limite / c.divisorPesas,
        pesasAdecuadas: Upesas <= (limite / c.divisorPesas) * (1 + 1e-12),
      };
    });

  // Peso mínimo de muestra por exactitud requerida y factor de seguridad.
  const tabla = {
    exactitudes: pesadaMinima.exactitudes || [],
    factores: pesadaMinima.factores || [],
    filas: (pesadaMinima.exactitudes || []).map(exactitud => ({
      exactitud,
      valores: (pesadaMinima.factores || []).map((factor) => {
        const valorMinimo = (c.factorS * s * factor) / exactitud;
        return valorMinimo <= max ? valorMinimo : null;
      }),
    })),
  };

  return {
    configuracion: c,
    max,
    d,
    repetibilidad,
    exactitud: { desde: m, hasta: max, filas },
    pesoMinimo: tabla,
  };
};

module.exports = { USP_INICIAL, evaluarUSP };
