/**
 * Vista previa del cálculo de un servicio de calibración (fase 3): reúne el
 * modelo del servicio, las piezas de sus juegos de pesas con los valores del
 * certificado que regía en la fecha del servicio y los puntos del
 * termohigrómetro, y llama al motor. No guarda nada.
 */
const { leerServicio } = require('./calibration.servicios');
const { claseSugerida, empR111, getPatron, valoresVigentesEn } = require('./calibration.patrones');
const motor = require('./calibracion/motor');
const { calcularServicio } = require('./calibracion/motor/servicio');

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

/** Calcula un modelo de servicio (el de ServiceMET o el del registro, con sus correcciones). */
const calcularModelo = async (modelo) => {
  const fecha = modelo.servicio.fecha;
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
    configuracion: motor.CONFIGURACION_V1,
  });
  return { termohigrometro: termohigrometro?.codigo || null, juegos: juegos.map(j => ({ codigo: j.codigo, clase: j.clase, piezas: j.piezas.length, certificado: j.certificado, verificado: j.verificado })), ...calculo };
};

const calcularVistaPrevia = async (codigo) => {
  const { modelo } = await leerServicio(codigo);
  return { codigo, ...(await calcularModelo(modelo)) };
};

module.exports = { calcularModelo, calcularVistaPrevia };
