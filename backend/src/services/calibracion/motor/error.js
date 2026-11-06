/**
 * Error de indicación y su incertidumbre expandida en un punto:
 * E = I − mref (7.1-1); u²(E) = u²(I) + u²(mref) (7.1-2, 7.1.3-1a);
 * νeff por Welch-Satterthwaite (B3-1); k = t al 95,45 % (7.3, decisión 2);
 * U con dos cifras hacia arriba y el error al mismo decimal (decisión 3).
 */
const {
  combinar, factorCobertura, gradosEfectivos, redondearA, redondearIncertidumbre,
} = require('./estadistica');

/**
 * indicacion: I (ya restado el cero); componentesI: de componentesIndicacion;
 * referencia: resultado de masaReferencia (mref y sus componentes).
 */
const errorEnPunto = ({ indicacion, componentesI, referencia }) => {
  const error = indicacion - referencia.mref;
  const componentes = [
    ...componentesI.map(c => ({ ...c, grupo: 'indicacion' })),
    ...referencia.componentes.map(c => ({ ...c, grupo: 'referencia' })),
  ].filter(c => c.u > 0);
  const u = combinar(componentes);
  const nuEff = gradosEfectivos(componentes);
  const k = factorCobertura(nuEff);
  const U = k * u;
  const redondeada = redondearIncertidumbre(U);
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
    presentacion: {
      error: redondearA(error, redondeada.decimales),
      U: redondeada.valor,
      decimales: redondeada.decimales,
      k,
    },
    componentes,
  };
};

module.exports = { errorEnPunto };
