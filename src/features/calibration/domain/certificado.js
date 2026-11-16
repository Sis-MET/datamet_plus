// Certificado de calibración (fase 5): ayudas del documento. El contenido lo
// arma el servidor (calibration.certificado.js); aquí solo se dibuja.

/**
 * Escala «bonita» para un eje: límites y paso redondos (1, 2, 2,5 o 5 por
 * potencia de diez) que contienen [min, max] con unas `marcas` divisiones.
 * Con `decimales`, el paso es un múltiplo de 10^-decimales, para que cada
 * marca se lea exacta con esos decimales (sin 2,5 si no caben).
 */
export const escalaBonita = (min, max, marcas = 5, decimales = null) => {
  let bajo = Number.isFinite(min) ? min : 0;
  let alto = Number.isFinite(max) ? max : 1;
  if (!(alto > bajo)) {
    const margen = Math.abs(bajo) > 0 ? Math.abs(bajo) * 0.5 : 1;
    bajo -= bajo === 0 ? 0 : margen;
    alto += margen;
  }
  const bruto = (alto - bajo) / marcas;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const normal = bruto / magnitud;
  const resolucion = decimales == null ? null : 10 ** -decimales;
  const cabe = (p) => resolucion == null || (p >= resolucion * (1 - 1e-9) && Math.abs(p / resolucion - Math.round(p / resolucion)) < 1e-6);
  const factor = [1, 2, 2.5, 5, 10].find(f => normal <= f && cabe(f * magnitud));
  // Sin factor: el rango es menor que la resolución y el paso es la resolución.
  const paso = factor ? factor * magnitud : resolucion;
  const redondear = (valor) => Number(valor.toPrecision(12));
  return { min: redondear(Math.floor(bajo / paso + 1e-9) * paso), max: redondear(Math.ceil(alto / paso - 1e-9) * paso), paso: redondear(paso) };
};

/**
 * Marcas de un eje con su texto (coma decimal, los decimales del paso o los
 * `fijos` que se pidan, como los de la desviación estándar).
 */
export const marcasDe = ({ min, max, paso }, fijos = null) => {
  const decimales = fijos ?? Math.max(0, -Math.floor(Math.log10(paso) + 1e-9) + (String(paso).includes('5') && paso < 1 ? 1 : 0));
  const marcas = [];
  for (let valor = min; valor <= max + paso * 1e-6; valor += paso) {
    const v = Number(valor.toPrecision(12));
    marcas.push({ valor: v, texto: (Object.is(v, -0) ? 0 : v).toFixed(Math.min(decimales, 6)).replace('.', ',') });
  }
  return marcas;
};

/** Divide filas en tramos para repartir una tabla larga en varias hojas. */
export const tramos = (filas, tamano) => {
  const partes = [];
  for (let i = 0; i < filas.length; i += tamano) partes.push(filas.slice(i, i + tamano));
  return partes.length ? partes : [[]];
};
