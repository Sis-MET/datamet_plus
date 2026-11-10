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
 * Tolerancia absoluta que el cliente fija por rango de carga (como el libro:
 * la del primer rango cuyo límite «hasta» contiene la carga). tramos:
 * [{ hasta, tolerancia }]; hasta null = en adelante. null si la carga queda
 * fuera de todos.
 */
const toleranciaPorRango = (carga, tramos) => {
  const ordenados = [...(tramos || [])]
    .filter(t => t && t.tolerancia > 0)
    .sort((a, b) => (a.hasta ?? Infinity) - (b.hasta ?? Infinity));
  const tramo = ordenados.find(t => t.hasta == null || Math.abs(carga) <= t.hasta * (1 + 1e-9));
  return tramo ? tramo.tolerancia : null;
};

// OIML R76 Tabla 3: e en g y n = Max/e de cada clase.
const TABLA_3 = [
  { clase: 'I', eMin: 0.001, eMax: Infinity, nMin: 50000, nMax: Infinity },
  { clase: 'II', eMin: 0.001, eMax: 0.05, nMin: 100, nMax: 100000 },
  { clase: 'II', eMin: 0.1, eMax: Infinity, nMin: 5000, nMax: 100000 },
  { clase: 'III', eMin: 0.1, eMax: 2, nMin: 100, nMax: 10000 },
  { clase: 'III', eMin: 5, eMax: Infinity, nMin: 500, nMax: 10000 },
  { clase: 'IIII', eMin: 5, eMax: Infinity, nMin: 100, nMax: 1000 },
];
// De menor a mayor exactitud.
const ORDEN_CLASES = ['IIII', 'III', 'II', 'I'];
const dentro = (valor, min, max) => valor >= min * (1 - 1e-9) && valor <= max * (1 + 1e-9);
// La regla del libro F-VMET-02-7.2: solo por n.
const clasePorN = n => (n <= 1000 ? 'IIII' : n <= 10000 ? 'III' : n <= 100000 ? 'II' : 'I');

/**
 * Clase sugerida cuando el instrumento no la tiene registrada: la que admiten
 * todos sus rangos según la Tabla 3 de la R76 (e y n = Max/e, con e o, si no
 * hay, d); si admiten varias, la de menor exactitud, que es la que elegía el
 * libro por n. Si ninguna cumple la tabla, la del libro por n del rango mayor.
 * Es una propuesta: el ingeniero la confirma (origen DEDUCIDA) o la corrige.
 * rangos: [{ max, d, e }] en la unidad del instrumento; gPorUnidad: g por unidad.
 */
const claseSugerida = (rangos, gPorUnidad) => {
  const validos = (rangos || []).filter(r => r.max > 0 && (r.e > 0 || r.d > 0));
  if (!validos.length || !(gPorUnidad > 0)) return null;
  const porRango = validos.map((r) => {
    const e = r.e > 0 ? r.e : r.d;
    const n = r.max / e;
    const eG = e * gPorUnidad;
    const candidatas = new Set(TABLA_3.filter(t => dentro(eG, t.eMin, t.eMax) && dentro(n, t.nMin, t.nMax)).map(t => t.clase));
    return { e, n, candidatas };
  });
  const comunes = ORDEN_CLASES.filter(c => porRango.every(r => r.candidatas.has(c)));
  const mayor = porRango[porRango.length - 1];
  return {
    valor: comunes[0] || clasePorN(mayor.n),
    n: Math.round(mayor.n),
    e: mayor.e,
    enTabla: comunes.length > 0,
  };
};

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
  claseSugerida,
  conformidad,
  empEnServicio,
  empVerificacion,
  rangoDeCarga,
  toleranciaPorRango,
  toleranciaPorcentaje,
};
