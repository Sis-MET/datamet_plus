/**
 * Motor de cálculo de los certificados de calibración de balanzas (fase 3).
 *
 * Funciones puras, sin acceso a la base: reciben el modelo del servicio, los
 * valores de los patrones y la configuración del método, y devuelven
 * resultados y presupuesto por punto. Cada fórmula cita su ecuación de EURAMET
 * cg-18 v4.0 (decisión 1). Las pruebas con los ejemplos del Anexo H son la
 * evidencia de validación (NB/ISO/IEC 17025, 7.11.6).
 */
const aire = require('./aire');
const cargas = require('./cargas');
const error = require('./error');
const estadistica = require('./estadistica');
const indicacion = require('./indicacion');
const referencia = require('./referencia');
const sustitucion = require('./sustitucion');
const tolerancia = require('./tolerancia');
const uso = require('./uso');
const usp = require('./usp');

/**
 * Cómo se decide si una pesa patrón es apta para su clase con su certificado:
 * - R111: U (k = 2) ≤ emp/3 (5.2) y |corrección| ≤ emp − U (5.3).
 * - SUMA_EMP: criterio del laboratorio, |corrección| + U ≤ emp (la 5.3); la 5.2
 *   queda a la vista como dato, sin aviso. Para cuando ningún laboratorio del
 *   país reporta U ≤ emp/3 (por ejemplo, IBMETRO en E2).
 */
const CRITERIOS_APTITUD_PESAS = ['R111', 'SUMA_EMP'];

/**
 * Cómo se escriben el error y la U en el certificado:
 * - POR_U: U con sus cifras significativas (redondeoU) y el error a los mismos
 *   decimales (GUM 7.2.6; la versión 1).
 * - POR_RANGO: el error con los decimales del rango de su carga (los que
 *   declara ServiceMET) y la U con un decimal más, redondeada en el sentido de
 *   redondeoU (procedimiento del laboratorio).
 */
const DECIMALES_RESULTADO = ['POR_U', 'POR_RANGO'];

/** Cómo se escribe el factor de cobertura: con dos decimales (2,00) o sin los que sobran (2). */
const FORMATOS_K = ['DOS_DECIMALES', 'SIN_DECIMALES'];

/**
 * Riesgo asociado a la declaración de conformidad:
 * - DOS_COLAS: probabilidad de que el error real quede fuera de ±T, con una
 *   normal de media E y desviación u = U/k (JCGM 106; la versión 1).
 * - PLANILLA: como la planilla del laboratorio, 1 − Φ((T − |E|) / U) con el
 *   error y la U que se informan (una cola, la U expandida como desviación).
 */
const METODOS_RIESGO = ['DOS_COLAS', 'PLANILLA'];

/**
 * Configuración del método, versión 1 (docs/calibracion-plan-implementacion.md,
 * «Configuración inicial»). El laboratorio la cambia por versiones en
 * Calibración › Método de cálculo: valores y opciones entre cálculos ya
 * programados y probados; las fórmulas quedan en el código.
 */
const CONFIGURACION_V1 = Object.freeze({
  version: 1,
  // Reglas de cálculo (opciones del método).
  repetibilidad: { regla: 'ENCIERRAN' }, // EURAMET 7.1.1; MAYOR = la del libro
  cobertura: { metodo: 'T_STUDENT', probabilidad: estadistica.COBERTURA, k: 2 }, // decisión 2
  redondeoU: { cifras: 2, sentido: 'ARRIBA' }, // decisión 3
  aire: { formula: 'CIPM-2007' },
  excentricidad: { metodo: 'METODO_3' }, // decisión 11
  conformidad: { bandaGuarda: 1, riesgoUmbral: 0.05, riesgo: 'DOS_COLAS' }, // |E| + 1·U ≤ T (decisión 7)
  // Cómo se escriben el error, la U y k en el certificado.
  presentacion: { decimales: 'POR_U', k: 'DOS_DECIMALES' },
  empServicio: { factor: 2 }, // NB 23001 = R76 3.5.2
  claseSugerida: { regla: 'TABLA_3' },
  empuje: '5b', // con ρa1 si se conoce; si no, 5a (decisión 1)
  kD: 1, // deriva D = kD·U (7.1.2-10), configurable de 1 a 3
  // Convección (7.1.2-13, Anexo F) en pesas F1 o mejores. ΔT pesas–aire según
  // el tiempo de estabilización que registra ServiceMET (por aprobar).
  conveccion: {
    activa: true,
    clases: ['E1', 'E2', 'F1'],
    deltaTPorEstabilizacion: { 'MAYOR A 30 MINUTOS': 3, 'MAYOR A 15 MINUTOS': 5 },
    deltaTSinDato: 7,
  },
  avisos: { excentricidadEnD: 2, lecturaVsCargaEnD: 4, uEnD: 3 },
  // Información adicional (7.4, 7.5, Anexo G), a pedido del cliente. Supuestos
  // del lugar de uso, por aprobar: ΔT del lugar, KT de la R76 por la clase si
  // no se conoce el del fabricante (factor 1: instrumento aprobado), k = 2.
  enUso: { k: 2, deltaT: 5, kT: null, factorKT: 1, fracciones: [0.01, 0.05, 0.1, 0.25, 0.5, 1] },
  pesadaMinima: { exactitudes: [0.001, 0.002, 0.005, 0.01, 0.02, 0.05], factores: [1, 2, 3, 5, 10] },
  // USP ⟨41⟩ en el anexo, a pedido del cliente (los límites que usaba el libro).
  usp: usp.USP_INICIAL,
  // Densidad supuesta por material si la pieza no la trae (R111 B.7).
  densidades: referencia.DENSIDADES_INICIALES,
  // Aptitud de las pesas patrón: la de la OIML R111 hasta que el laboratorio elija otra.
  pesas: { aptitud: 'R111' },
});

module.exports = {
  CONFIGURACION_V1,
  CRITERIOS_APTITUD_PESAS,
  DECIMALES_RESULTADO,
  FORMATOS_K,
  METODOS_RIESGO,
  ...aire,
  ...cargas,
  ...error,
  ...estadistica,
  ...indicacion,
  ...referencia,
  ...sustitucion,
  ...tolerancia,
  ...uso,
  ...usp,
};
