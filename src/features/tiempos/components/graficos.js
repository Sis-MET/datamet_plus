import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../../shared/utils/motion';

/** Ancho del contenedor en píxeles, al día cuando cambia el tamaño. */
export function useAncho() {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return undefined;
    const medir = () => setAncho(nodo.clientWidth);
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);
  return [ref, ancho];
}

// ─── Movimiento ────────────────────────────────────────────────────────────

/**
 * Un solo reloj para todas las animaciones del panel: un requestAnimationFrame
 * por cuadro para todas las cifras y gráficos. Así React junta en un solo
 * render los cambios de todos los componentes que se mueven a la vez, en vez
 * de un render por cada uno.
 */
const suscriptores = new Set();
let cuadro = null;
const latir = (ahora) => {
  cuadro = null;
  for (const alCuadro of [...suscriptores]) alCuadro(ahora);
  if (suscriptores.size) cuadro = requestAnimationFrame(latir);
};
const suscribir = (alCuadro) => {
  suscriptores.add(alCuadro);
  if (cuadro === null) cuadro = requestAnimationFrame(latir);
  return () => suscriptores.delete(alCuadro);
};

/** Suavizado de salida (cúbico): arranca con decisión y se asienta sin frenazo. */
const suavizar = t => (t >= 1 ? 1 : 1 - (1 - t) ** 3);

/**
 * Lleva `desde` hasta `hacia` en `duracion` ms (cada valor `escalonado` ms
 * después del anterior) llamando a `alCuadro(valores)` en cada cuadro.
 * Devuelve la función que la detiene.
 */
export function animar({ desde, hacia, duracion, escalonado = 0, alCuadro }) {
  let t0 = null;
  const total = duracion + escalonado * Math.max(0, hacia.length - 1);
  const detener = suscribir((ahora) => {
    if (t0 === null) t0 = ahora;
    const transcurrido = ahora - t0;
    alCuadro(hacia.map((valor, i) => {
      const inicio = desde[i] ?? 0;
      return inicio + (valor - inicio) * suavizar(Math.min(1, Math.max(0, transcurrido - escalonado * i) / duracion));
    }));
    if (transcurrido >= total) detener();
  });
  return detener;
}

const finitos = lista => lista.map(v => (Number.isFinite(v) ? v : 0));

/**
 * Valores que se mueven hacia `objetivo`: al montarse parten de cero y, cada
 * vez que el objetivo cambia (otro filtro, período o métrica), van desde donde
 * estaban hasta el nuevo. `escalonado` retrasa cada valor unos milisegundos
 * más que el anterior (columnas que se dibujan de izquierda a derecha). Con
 * «reducir movimiento» devuelve el objetivo tal cual. Los null cuentan como cero.
 */
export function useValoresAnimados(objetivo, { duracion = 600, escalonado = 0 } = {}) {
  const [reducido] = useState(prefersReducedMotion);
  const clave = finitos(objetivo).join('|');
  const [valores, setValores] = useState(() => objetivo.map(() => 0));
  const actualRef = useRef(valores);

  useEffect(() => {
    if (reducido) return undefined;
    const hacia = clave === '' ? [] : clave.split('|').map(Number);
    return animar({
      desde: actualRef.current,
      hacia,
      duracion,
      escalonado,
      alCuadro: (actual) => {
        actualRef.current = actual;
        setValores(actual);
      },
    });
  }, [clave, duracion, escalonado, reducido]);

  if (reducido) return finitos(objetivo);
  // Hasta el primer cuadro, una lista del largo nuevo (los que se agregan, en cero).
  return objetivo.map((_, i) => valores[i] ?? 0);
}

/** Retraso entre columnas sin que el conjunto tarde más de `tope` ms extra. */
export const escalonar = (cantidad, porColumna, tope = 220) => (cantidad > 1 ? Math.min(porColumna, tope / (cantidad - 1)) : 0);

// ─── Colores y formas ──────────────────────────────────────────────────────

const SERIES = 8;

/**
 * Color de cada grupo (tipo de servicio o rango de capacidad): sigue al grupo
 * en el orden fijo que manda el servidor, nunca a su posición en un ranking,
 * así un filtro no repinta a los demás. Un grupo «otros» va en gris.
 */
export function coloresDe(grupos = []) {
  const colores = new Map();
  let slot = 0;
  for (const grupo of grupos) {
    if (grupo.otros || slot >= SERIES) colores.set(grupo.id, 'rgb(var(--serie-otros))');
    else {
      slot += 1;
      colores.set(grupo.id, `rgb(var(--serie-${slot}))`);
    }
  }
  return colores;
}

/** Columna con la punta redondeada y la base recta. */
export const columna = (x, y, ancho, alto, radio = 4) => {
  const r = Math.min(radio, ancho / 2, alto);
  return `M${x},${y + alto} V${y + r} Q${x},${y} ${x + r},${y} H${x + ancho - r} Q${x + ancho},${y} ${x + ancho},${y + r} V${y + alto} Z`;
};
