/**
 * Tolerancia y conformidad del error de indicación.
 *
 * emp NB 23001: el emp en servicio de la OIML R76-1 (doble del de
 * verificación inicial, 3.5.2) por clase y escalón e (Tabla 6). Regla de
 * decisión simple (|E| ≤ T) o conservadora (|E| + U ≤ T) (decisión 7;
 * NB/ISO/IEC 17025 7.8.6). Riesgo bilateral de que el error real esté fuera de
 * ±T con u(E) = U/k.
 */
const { normalAcumulada } = require('./estadistica');

// Límites en escalones e de la Tabla 6 (verificación inicial): hasta l1 → 0,5 e;
// hasta l2 → 1,0 e; más → 1,5 e.
const LIMITES_R76 = { I: [50000, 200000], II: [5000, 20000], III: [500, 2000], IIII: [50, 200] };

/** emp de verificación inicial (R76 Tabla 6) para una carga, en la unidad de e. */
const empVerificacion = ({ carga, clase, e }) => {
  const limites = LIMITES_R76[clase];
  if (!limites || !(e > 0)) return null;
  const escalones = Math.abs(carga) / e;
  if (escalones <= limites[0] + 1e-9) return 0.5 * e;
  if (escalones <= limites[1] + 1e-9) return 1.0 * e;
  return 1.5 * e;
};

/** emp en servicio (NB 23001 = R76 3.5.2): el doble del de verificación inicial. */
const empEnServicio = (datos) => {
  const emp = empVerificacion(datos);
  return emp == null ? null : 2 * emp;
};

/**
 * Rango de un instrumento multirango que corresponde a una carga: el de menor
 * Max que la contiene (los rangos van de menor a mayor).
 */
const rangoDeCarga = (rangos, carga) => rangos.find(r => carga <= r.max * (1 + 1e-9)) || rangos[rangos.length - 1];

/** Tolerancia como porcentaje de la carga (acordada con el cliente). */
const toleranciaPorcentaje = (carga, porcentaje) => Math.abs(carga) * porcentaje / 100;

/**
 * Conformidad de un punto con su tolerancia T.
 * regla: 'SIMPLE' (|E| ≤ T) o 'CONSERVADORA' (|E| + U ≤ T).
 * riesgo: probabilidad de que el error real esté fuera de ±T con una normal
 * de media E y desviación u = U/k.
 */
const conformidad = ({ error, U, k, tolerancia, regla }) => {
  if (!(tolerancia > 0) || !['SIMPLE', 'CONSERVADORA'].includes(regla)) {
    return { evaluada: false, conforme: null, margen: null, riesgo: null };
  }
  const exigido = Math.abs(error) + (regla === 'CONSERVADORA' ? U : 0);
  const u = k > 0 ? U / k : 0;
  const riesgo = u > 0
    ? normalAcumulada((-tolerancia - error) / u) + (1 - normalAcumulada((tolerancia - error) / u))
    : (Math.abs(error) > tolerancia ? 1 : 0);
  return {
    evaluada: true,
    regla,
    conforme: exigido <= tolerancia + 1e-15,
    margen: tolerancia - exigido,
    riesgo,
  };
};

module.exports = {
  conformidad,
  empEnServicio,
  empVerificacion,
  rangoDeCarga,
  toleranciaPorcentaje,
};
