// Ensayo de excentricidad del registro: el esquema de la plataforma como lo
// guarda ServiceMET en calibración («Rectangular 5F», «Cuadrada A», «5») y la
// diferencia de cada posición respecto de la del centro. Las posiciones y el
// lugar del indicador son los del diagrama de ServiceMET (los mismos que usa
// Soporte).
import { posicionIndicador, posicionesPlataforma } from '../../soporte/domain/plataforma';

export { posicionIndicador, posicionesPlataforma };

const FORMAS = ['cuadrada', 'rectangular', 'circular', 'triangular'];
/** Puntos que admite cada forma en ServiceMET; el primero es el habitual. */
const PUNTOS = { cuadrada: [5], rectangular: [5, 3], circular: [5, 4], triangular: [4] };
const LADOS = { F: 'frente', A: 'atras', I: 'izquierda', D: 'derecha' };

export const NOMBRE_FORMA = {
  cuadrada: 'Plataforma cuadrada',
  rectangular: 'Plataforma rectangular',
  circular: 'Plataforma circular',
  triangular: 'Plataforma triangular',
};
export const NOMBRE_LADO = { frente: 'al frente', atras: 'atrás', izquierda: 'a la izquierda', derecha: 'a la derecha' };

const normalizar = (valor) => String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Esquema para dibujar la plataforma. plataforma: el código del adaptador
 * (RECTANGULAR…); indicador: el texto de ServiceMET; lecturas: cuántas
 * posiciones se midieron. null si no se sabe la forma.
 */
export const esquemaExcentricidad = (plataforma, indicador, lecturas = 0) => {
  const texto = normalizar(indicador);
  const partes = /^([a-z]+)?\s*(\d)?\s*([FAID])?$/i.exec(texto);
  const formaTexto = partes?.[1]?.toLowerCase();
  const forma = [String(plataforma || '').toLowerCase(), formaTexto].find(f => FORMAS.includes(f));
  if (!forma) return null;
  const opciones = PUNTOS[forma];
  const declarados = Number(partes?.[2]);
  const puntos = opciones.includes(declarados) ? declarados : opciones.includes(lecturas) ? lecturas : opciones[0];
  const lado = partes?.[3] ? LADOS[partes[3].toUpperCase()] : null;
  return { forma, puntos, indicador: lado };
};

/**
 * Diferencia de cada posición con la del centro (la primera), descontado el
 * retorno a cero, como el método 3 del motor; `excede` si supera el límite
 * (2·d por defecto). La primera posición es la referencia.
 */
export const diferenciasExcentricidad = (posiciones, limite = Infinity) => {
  const validas = posiciones.filter(p => p.indicacion != null);
  if (!validas.length) return [];
  const centro = validas[0].indicacion;
  return validas.map((p, index) => {
    if (index === 0) return { posicion: p.posicion, referencia: true, diferencia: 0, excede: false };
    const diferencia = (p.indicacion - (p.retorno || 0)) - centro;
    return { posicion: p.posicion, referencia: false, diferencia, excede: Math.abs(diferencia) > limite + 1e-12 };
  });
};
