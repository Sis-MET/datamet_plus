/**
 * Cálculos de las pruebas metrológicas de los informes de Soporte técnico,
 * los mismos en todas las plantillas (macros GENERAR_CERT):
 *
 * - Excentricidad y repetibilidad: diferencia máxima = máx − mín de las
 *   indicaciones.
 * - Linealidad: error de cada punto = indicación − carga; error máximo = el
 *   mayor error en valor absoluto.
 * - Cada resultado también se expresa en divisiones: resultado ÷ d (o ÷ e en
 *   el preventivo avanzado).
 *
 * Los decimales salen de la división del instrumento (d = 0.01 → 2) y los
 * resultados se redondean a esos decimales + 2 para no arrastrar errores de
 * coma flotante (0.199999999999989 → 0.2).
 */

/** Número de un valor guardado o escrito («0,05» también vale); si no, null. */
export function aNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const texto = String(valor).trim().replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(texto)) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

/** Corre la coma decimal sin pasar por una multiplicación (1.005 × 100 = 100.49999…). */
const correrComa = (numero, posiciones) => {
  const [base, exponente = '0'] = String(numero).split('e');
  return Number(`${base}e${Number(exponente) + posiciones}`);
};

/** Redondeo decimal, la mitad lejos de cero (como el formato de Excel). */
export function redondear(valor, decimales = 0) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return null;
  const signo = valor < 0 ? -1 : 1;
  const resultado = signo * correrComa(Math.round(correrComa(Math.abs(valor), decimales)), -decimales);
  return Object.is(resultado, -0) ? 0 : resultado;
}

/**
 * Decimales que implica la división del instrumento:
 * 0.001 → 3 | 0.01 → 2 | 0.05 → 2 | 0.1 → 1 | 0.2 → 1 | 1 → 0 | 10 → 0.
 * Sin división válida se usa 1, como en las macros.
 */
export function decimalesDeDivision(division) {
  const d = aNumero(division);
  if (d === null || d <= 0) return 1;
  if (d >= 1) return 0;
  const decimales = Math.ceil(-Math.log10(d) - 1e-9);
  return Math.min(10, Math.max(0, decimales));
}

/** «1000.10» con los decimales del instrumento; null o texto → «-». */
export function formatoNumero(valor, decimales) {
  const numero = aNumero(valor);
  if (numero === null) return '-';
  return redondear(numero, decimales).toFixed(decimales);
}

/** «1000.1 g» */
export function conUnidad(valor, decimales, unidad) {
  const texto = formatoNumero(valor, decimales);
  if (texto === '-') return texto;
  return unidad ? `${texto} ${unidad}` : texto;
}

const numericos = (valores) => valores.map(aNumero).filter(valor => valor !== null);

/** Máx − mín de las indicaciones; null si no hay ninguna. */
export function diferenciaMaxima(valores, decimales) {
  const lista = numericos(valores);
  if (lista.length === 0) return null;
  return redondear(Math.max(...lista) - Math.min(...lista), decimales + 2);
}

/** Error de cada punto de linealidad (indicación − carga); null si falta uno de los dos. */
export function erroresLinealidad(puntos, decimales) {
  return puntos.map(({ carga, indicacion }) => {
    const c = aNumero(carga);
    const i = aNumero(indicacion);
    return c === null || i === null ? null : redondear(i - c, decimales + 2);
  });
}

/** Mayor error en valor absoluto; null si no hay errores. */
export function errorMaximo(errores, decimales) {
  const lista = numericos(errores).map(Math.abs);
  if (lista.length === 0) return null;
  return redondear(Math.max(...lista), decimales + 2);
}

/** Resultado expresado en divisiones (d o e); null sin división válida. */
export function enDivisiones(valor, division, decimales = 0) {
  const d = aNumero(division);
  if (valor === null || valor === undefined || d === null || d <= 0) return null;
  return redondear(valor / d, decimales);
}

// ─── Rangos del instrumento ────────────────────────────────────────────────

/**
 * Rangos válidos (capacidad, d y e) ordenados de menor a mayor capacidad.
 * ServiceMET no los guarda en orden: a veces el rango 1 es el de mayor
 * capacidad (6000 g, d = 0.5) y el 2 el fino (3000 g, d = 0.1). El rango 1
 * vale aunque falte su capacidad.
 */
export function rangosInstrumento(valores) {
  return [1, 2, 3]
    .map(rango => ({
      rango,
      cap: aNumero(valores[`cap_max${rango}`]),
      d: aNumero(valores[`d${rango}`]),
      e: aNumero(valores[`e${rango}`]),
    }))
    .filter(r => r.d !== null && r.d > 0 && (r.rango === 1 || (r.cap !== null && r.cap > 0)))
    .map(r => ({ ...r, cap: r.cap !== null && r.cap > 0 ? r.cap : Infinity }))
    .sort((a, b) => a.cap - b.cap || a.rango - b.rango);
}

/** Rango de una carga: el de menor capacidad que la cubre. Sin carga, el rango 1. */
export function rangoPara(rangos, carga) {
  if (rangos.length === 0) return null;
  const valor = aNumero(carga);
  if (valor === null) return rangos.find(r => r.rango === 1) || rangos[0];
  return rangos.find(r => Math.abs(valor) <= r.cap) || rangos[rangos.length - 1];
}

/**
 * División con que se expresa un resultado: la d del rango de la carga o, si
 * se pide e (preventivo avanzado), la e de ese rango; sin e se usa d.
 */
export function divisionPara(rangos, carga, preferida = 'd') {
  const rango = rangoPara(rangos, carga);
  if (!rango) return { valor: null, simbolo: preferida, rango: null };
  if (preferida === 'e' && rango.e !== null && rango.e > 0) return { valor: rango.e, simbolo: 'e', rango: rango.rango };
  return { valor: rango.d, simbolo: 'd', rango: rango.rango };
}

/** Decimales del instrumento: los de su división más fina (1 si no hay). */
export function decimalesInstrumento(valores) {
  const rangos = rangosInstrumento(valores);
  if (rangos.length === 0) return decimalesDeDivision(valores.d1);
  return Math.max(...rangos.map(r => decimalesDeDivision(r.d)));
}

const mayorAbsoluto = (valores) => {
  const lista = numericos(valores);
  if (lista.length === 0) return null;
  return lista.reduce((max, valor) => (Math.abs(valor) > Math.abs(max) ? valor : max));
};

/**
 * Todos los resultados de un bloque de pruebas.
 * datos: { excentricidad: [indicaciones], repetibilidad: [indicaciones],
 *          linealidad: [{ carga, indicacion }], cargas: { excentricidad, repetibilidad } }
 * opciones: { rangos (rangosInstrumento), decimales, preferida: 'd' | 'e' }
 *
 * Cada resultado se divide por la d (o e) del rango de su carga: la carga
 * de la prueba (o, si falta, la mayor lectura) y, en linealidad, la de cada
 * punto. En «e» los resultados llevan los decimales del instrumento; en «d»,
 * enteros, como en las plantillas.
 */
export function calcularPruebas(datos, { rangos, decimales, preferida = 'd' }) {
  const decimalesDivision = preferida === 'e' ? decimales : 0;
  const cargas = datos.cargas || {};
  const resultado = (lecturas, carga) => {
    const diferencia = diferenciaMaxima(lecturas, decimales);
    const division = divisionPara(rangos, aNumero(carga) ?? mayorAbsoluto(lecturas), preferida);
    return { diferencia, divisiones: enDivisiones(diferencia, division.valor, decimalesDivision), simbolo: division.simbolo };
  };

  const puntos = datos.linealidad || [];
  const errores = erroresLinealidad(puntos, decimales);
  const maximo = errorMaximo(errores, decimales);
  let divisiones = null;
  let simbolo = divisionPara(rangos, null, preferida).simbolo;
  errores.forEach((error, index) => {
    if (error === null) return;
    const division = divisionPara(rangos, puntos[index].carga, preferida);
    const enDiv = enDivisiones(Math.abs(error), division.valor, decimalesDivision);
    if (enDiv !== null && (divisiones === null || enDiv > divisiones)) {
      divisiones = enDiv;
      simbolo = division.simbolo;
    }
  });

  return {
    excentricidad: resultado(datos.excentricidad || [], cargas.excentricidad),
    repetibilidad: resultado(datos.repetibilidad || [], cargas.repetibilidad),
    linealidad: { errores, maximo, divisiones, simbolo },
  };
}
