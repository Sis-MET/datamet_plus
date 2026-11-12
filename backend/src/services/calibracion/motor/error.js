/**
 * Error de indicación y su incertidumbre expandida en un punto:
 * E = I − mref (7.1-1); u²(E) = u²(I) + u²(mref) (7.1-2, 7.1.3-1a);
 * νeff por Welch-Satterthwaite (B3-1); k y el redondeo de U según la
 * configuración del método (por omisión, t al 95,45 % y dos cifras hacia
 * arriba: decisiones 2 y 3); el error al mismo decimal que U, o, si el
 * laboratorio lo elige, con los decimales del rango y U con uno más.
 */
const {
  combinar, factorCobertura, gradosEfectivos, redondearA, redondearIncertidumbre,
} = require('./estadistica');

/** Decimales de un número tal como se escribe (0,1 → 1; 0,005 → 3). */
const decimalesDe = (valor) => {
  const texto = String(Number(Number(valor).toPrecision(12)));
  const exp = texto.match(/e-(\d+)$/);
  if (exp) return Number(exp[1]);
  return texto.includes('.') ? texto.split('.')[1].length : 0;
};

/** Decimales del rango de una carga: los que declara ServiceMET o, si faltan, los de d. */
const decimalesDeRango = (rango) => {
  if (Number.isInteger(rango?.decimales) && rango.decimales >= 0) return rango.decimales;
  return rango?.d > 0 ? decimalesDe(rango.d) : null;
};

/**
 * U con un número fijo de decimales, en el sentido del método (ARRIBA o
 * CERCANO). Nunca queda en cero: una U menor que el último decimal se escribe
 * con una unidad de ese decimal.
 */
const redondearUA = (U, decimales, sentido = 'ARRIBA') => {
  if (!(U > 0)) return 0;
  const escala = 10 ** decimales;
  // El margen evita subir por el ruido del punto flotante.
  const unidades = sentido === 'CERCANO' ? Math.round(U * escala + 1e-9) : Math.ceil(U * escala - 1e-9);
  return Number((Math.max(unidades, 1) / escala).toFixed(decimales));
};

/**
 * Error y U como se informan. presentacion: { decimales: 'POR_U' | 'POR_RANGO' };
 * decimalesRango: los del rango de la carga (null si no se conocen: POR_U).
 * Devuelve { error, U, decimales (del error), decimalesU, k }.
 */
const presentar = ({ error, U, k, redondeo, presentacion = {}, decimalesRango = null }) => {
  if (presentacion.decimales === 'POR_RANGO' && Number.isInteger(decimalesRango)) {
    const decimalesU = decimalesRango + 1;
    return {
      error: redondearA(error, decimalesRango),
      U: redondearUA(U, decimalesU, redondeo?.sentido),
      decimales: decimalesRango,
      decimalesU,
      k,
    };
  }
  const redondeada = redondearIncertidumbre(U, redondeo);
  return { error: redondearA(error, redondeada.decimales), U: redondeada.valor, decimales: redondeada.decimales, decimalesU: redondeada.decimales, k };
};

/**
 * indicacion: I (ya restado el cero); componentesI: de componentesIndicacion;
 * referencia: resultado de masaReferencia (mref y sus componentes);
 * opciones: { cobertura: { metodo, probabilidad, k }, redondeo: { cifras, sentido },
 * presentacion: { decimales }, decimalesRango }.
 */
const errorEnPunto = ({ indicacion, componentesI, referencia, opciones = {} }) => {
  const error = indicacion - referencia.mref;
  const componentes = [
    ...componentesI.map(c => ({ ...c, grupo: 'indicacion' })),
    ...referencia.componentes.map(c => ({ ...c, grupo: 'referencia' })),
  ].filter(c => c.u > 0);
  const u = combinar(componentes);
  const nuEff = gradosEfectivos(componentes);
  const k = factorCobertura(nuEff, opciones.cobertura);
  const U = k * u;
  return {
    indicacion,
    mref: referencia.mref,
    error,
    uIndicacion: combinar(componentesI),
    uReferencia: referencia.u,
    u,
    nuEff,
    k,
    U,
    presentacion: presentar({
      error, U, k, redondeo: opciones.redondeo, presentacion: opciones.presentacion, decimalesRango: opciones.decimalesRango ?? null,
    }),
    componentes,
  };
};

module.exports = { decimalesDeRango, errorEnPunto, presentar, redondearUA };
