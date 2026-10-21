/**
 * Plataforma de la prueba de excentricidad tal como la registra ServiceMET:
 * su forma, cuántas posiciones se cargaron y de qué lado está el indicador
 * («Circular 5 pts - Ind Frontal», «Rectangular 3 pts - Ind Izquierda»), o,
 * en una báscula de camión, las posiciones de ida y vuelta («6», «6F» con la
 * caseta al frente). Las coordenadas son las del diagrama de ServiceMET.
 */

const normalizar = (valor) => String(valor ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim();

const FORMAS = ['cuadrada', 'rectangular', 'circular', 'triangular'];

const LADOS = { frontal: 'frente', frente: 'frente', atras: 'atras', izquierda: 'izquierda', derecha: 'derecha' };
const LETRAS = { F: 'frente', A: 'atras', I: 'izquierda', D: 'derecha' };

export const NOMBRE_LADO = { frente: 'al frente', atras: 'atrás', izquierda: 'a la izquierda', derecha: 'a la derecha' };

/** Puntos que admite cada forma en ServiceMET; el primero es el habitual. */
const PUNTOS = { cuadrada: [5], rectangular: [5, 3], circular: [5, 4], triangular: [4] };

/**
 * Lee la plataforma de los datos del servicio. `lecturas` es la cantidad de
 * indicaciones registradas (para elegir entre 3 y 5 puntos si no se dice).
 * Devuelve null si no hay datos para dibujarla.
 */
export function leerPlataforma(tipo, puntos, lecturas = 0) {
  const t = normalizar(tipo);
  const p = String(puntos ?? '').trim();
  const pn = normalizar(p);

  const camion = /^(\d+)\s*([FAID])?$/i.exec(p);
  if (t.includes('camion') || camion) {
    const n = camion ? Number(camion[1]) : lecturas;
    return {
      forma: 'camion',
      puntos: n >= 2 ? n : Math.max(lecturas, 2),
      caseta: camion?.[2] ? LETRAS[camion[2].toUpperCase()] : null,
    };
  }

  const forma = FORMAS.find(f => t.startsWith(f)) || FORMAS.find(f => pn.startsWith(f));
  if (!forma) return null;
  const cantidad = Number(/(\d+)\s*pts/.exec(pn)?.[1]);
  const opciones = PUNTOS[forma];
  const n = opciones.includes(cantidad) ? cantidad
    : opciones.includes(lecturas) ? lecturas
      : opciones[0];
  const lado = /ind\s+(frontal|frente|atras|izquierda|derecha)/.exec(pn)?.[1];
  return { forma, puntos: n, indicador: lado ? LADOS[lado] : null };
}

/** Centro de cada posición (1, 2, …) en un cuadro de 0 a 1, como ServiceMET. */
export function posicionesPlataforma(forma, n) {
  switch (forma) {
    case 'cuadrada':
      return [[0.5, 0.5], [0.73, 0.27], [0.73, 0.73], [0.27, 0.73], [0.27, 0.27]];
    case 'rectangular':
      return n === 3
        ? [[0.5, 0.5], [0.22, 0.5], [0.78, 0.5]]
        : [[0.5, 0.5], [0.78, 0.35], [0.78, 0.65], [0.22, 0.65], [0.22, 0.35]];
    case 'circular':
      return n === 4
        ? [[0.5, 0.5], [0.691, 0.309], [0.5, 0.77], [0.309, 0.309]]
        : [[0.5, 0.5], [0.691, 0.309], [0.691, 0.691], [0.309, 0.691], [0.309, 0.309]];
    case 'triangular':
      return [[0.5, 0.53], [0.5, 0.3], [0.66, 0.66], [0.34, 0.66]];
    default:
      return [];
  }
}

/** Dónde va el indicador en cada forma (también como ServiceMET). */
export function posicionIndicador(forma, lado) {
  const tabla = {
    cuadrada: { frente: [0.5, 0.85], atras: [0.5, 0.15], izquierda: [0.15, 0.5], derecha: [0.85, 0.5] },
    rectangular: { frente: [0.5, 0.75], atras: [0.5, 0.25], izquierda: [0.12, 0.5], derecha: [0.88, 0.5] },
    circular: { frente: [0.5, 0.9], atras: [0.5, 0.1], izquierda: [0.1, 0.5], derecha: [0.9, 0.5] },
    triangular: { frente: [0.5, 0.9], atras: [0.5, 0.1], izquierda: [0.1, 0.9], derecha: [0.9, 0.9] },
  };
  return tabla[forma]?.[lado] || null;
}

/**
 * Lecturas de una báscula de camión en su lugar del puente: la ida va por el
 * carril de arriba (1, 2, 3 de izquierda a derecha) y la vuelta por el de
 * abajo, de derecha a izquierda (Vuelta 1 a la derecha). Usa la etiqueta que
 * guardó el técnico («Ida 2», «Vuelta 3»); sin etiqueta, el orden de
 * ServiceMET: primero las idas y luego las vueltas de la última a la primera.
 */
export function lecturasCamion(lecturas, n) {
  const mitad = Math.max(1, Math.ceil(n / 2));
  const ida = Array.from({ length: mitad }, () => null);
  const vuelta = Array.from({ length: mitad }, () => null);
  lecturas.forEach((lectura, index) => {
    const etiqueta = normalizar(lectura.posicion);
    const match = /^(ida|vuelta)\s*(\d+)$/.exec(etiqueta);
    let carril;
    let numero;
    if (match) {
      carril = match[1];
      numero = Number(match[2]);
    } else if (index < mitad) {
      carril = 'ida';
      numero = index + 1;
    } else {
      carril = 'vuelta';
      numero = n - index;
    }
    if (numero < 1 || numero > mitad) return;
    if (carril === 'ida') ida[numero - 1] = { numero, valor: lectura.indicacion, fila: index + 1 };
    // Vuelta 1 queda a la derecha: columna mitad - numero desde la izquierda.
    else vuelta[mitad - numero] = { numero, valor: lectura.indicacion, fila: index + 1 };
  });
  return { ida, vuelta };
}
