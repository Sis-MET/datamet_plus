/**
 * Vista previa del cálculo de un servicio de calibración (fase 3): reúne el
 * modelo del servicio, las piezas de sus juegos de pesas con los valores del
 * certificado que regía en la fecha del servicio y los puntos del
 * termohigrómetro, y llama al motor. No guarda nada.
 */
const { leerServicio } = require('./calibration.servicios');
const { claseSugerida, empR111, getPatron, valoresVigentesEn } = require('./calibration.patrones');
const { calcularServicio } = require('./calibracion/motor/servicio');
const metodo = require('./calibration.metodo');

/** Datos de un patrón en una fecha; sin la migración 016 o sin datos, lo mínimo. */
const datosDePatron = async (patron, fecha) => {
  if (!patron.equipoId) return null;
  let ficha = null;
  let vigente = null;
  try {
    [ficha, vigente] = await Promise.all([getPatron(patron.equipoId), valoresVigentesEn(patron.equipoId, fecha)]);
  } catch {
    return { codigo: patron.codigo, clase: claseSugerida(patron.codigo), piezas: [], valores: new Map(), verificado: false, condiciones: null, puntos: [] };
  }
  const valores = new Map((vigente?.valores || []).map(v => [`${Number(v.nominalMg)}|${v.identificacion || ''}`, v]));
  return {
    codigo: patron.codigo,
    clase: ficha?.patron?.clase || claseSugerida(patron.codigo),
    material: ficha?.piezas?.find(p => p.material)?.material || null,
    piezas: ficha?.piezas || [],
    valores,
    verificado: Boolean(vigente?.verificado),
    certificado: vigente?.certificado?.numero || null,
    condiciones: vigente?.condiciones || null,
    puntos: vigente?.puntos || [],
  };
};

/**
 * Calcula un modelo de servicio (el de ServiceMET o el del registro, con sus
 * correcciones). `composiciones`: las cargas armadas a mano en el registro.
 * `version`: la de la configuración del método (la de un registro aprobado);
 * sin ella, la vigente.
 */
const calcularModelo = async (modelo, { composiciones = null } = {}, { version = null } = {}) => {
  const fecha = modelo.servicio.fecha;
  const metodoUsado = await metodo.configuracionDe(version);
  const juegos = (await Promise.all(modelo.patrones.juegos.map(p => datosDePatron(p, fecha)))).filter(Boolean);
  // El termohigrómetro: el primero con puntos transcritos; si ninguno, el primero.
  const ambientes = (await Promise.all(modelo.patrones.ambiente.map(p => datosDePatron(p, fecha)))).filter(Boolean);
  const conPuntos = ambientes.find(a => a.puntos.length) || ambientes[0] || null;
  const termohigrometro = conPuntos ? {
    codigo: conPuntos.codigo,
    puntos: { T: conPuntos.puntos.filter(p => p.magnitud === 'T'), HR: conPuntos.puntos.filter(p => p.magnitud === 'HR'), P: conPuntos.puntos.filter(p => p.magnitud === 'P') },
  } : null;

  const calculo = calcularServicio(modelo, {
    juegos,
    termohigrometro,
    empR111,
    claseInstrumento: modelo.instrumento.clase?.valor || null,
    configuracion: metodoUsado.motor,
    composiciones,
  });
  // Alcance de cada juego (la pieza menor y la mayor), para el certificado.
  const rangoMg = (piezas) => {
    const nominales = piezas.filter(p => p.activa !== false).map(p => Number(p.nominalMg)).filter(n => n > 0);
    return nominales.length ? { min: Math.min(...nominales), max: Math.max(...nominales) } : null;
  };
  return {
    metodo: { version: metodoUsado.version, aprobada: metodoUsado.aprobada },
    termohigrometro: termohigrometro?.codigo || null,
    juegos: juegos.map(j => ({
      codigo: j.codigo, clase: j.clase, piezas: j.piezas.length, rangoMg: rangoMg(j.piezas), certificado: j.certificado, verificado: j.verificado,
    })),
    ...calculo,
  };
};

const calcularVistaPrevia = async (codigo) => {
  const { modelo } = await leerServicio(codigo);
  return { codigo, ...(await calcularModelo(modelo)) };
};

module.exports = { calcularModelo, calcularVistaPrevia };
