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

/**
 * Configuración del método, versión 1 (por aprobar; docs/calibracion-plan-
 * implementacion.md, «Configuración inicial»). Los parámetros serán editables
 * con versión y aprobación (fase 6); las fórmulas quedan en el código.
 */
const CONFIGURACION_V1 = Object.freeze({
  version: 1,
  cobertura: estadistica.COBERTURA, // 95,45 % (decisión 2)
  redondeoU: 'DOS_CIFRAS_ARRIBA', // decisión 3
  formulaAire: 'CIPM-2007',
  empuje: '5b', // con ρa1 si se conoce; si no, 5a (decisión 1)
  kD: 1, // deriva D = kD·U (7.1.2-10), configurable de 1 a 3
  conveccion: { clases: ['E1', 'E2', 'F1'] }, // 7.1.2.4 y Anexo F
  excentricidad: 'METODO_3', // decisión 11
  reglaConservadora: 'ABS_E_MAS_U', // |E| + U(E) ≤ T (decisión 7)
  avisos: { excentricidadEnD: 2, lecturaVsCargaEnD: 4, uEnD: 3 },
});

module.exports = {
  CONFIGURACION_V1,
  ...aire,
  ...cargas,
  ...error,
  ...estadistica,
  ...indicacion,
  ...referencia,
  ...sustitucion,
  ...tolerancia,
};
