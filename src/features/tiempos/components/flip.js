import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../../shared/utils/motion';

const SUAVE = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * Movimiento de las tarjetas al filtrar u ordenar, con la técnica FLIP: se
 * mide dónde estaba cada elemento marcado con `data-flip` y dónde queda, y se
 * lo desliza desde el lugar anterior solo con `transform` (lo mueve el
 * compositor, sin volver a maquetar). Lo que aparece entra desvanecido y
 * escalonado. Cada vez que cambia `clave` se anima; si la página cambia de
 * tamaño, solo se vuelven a medir las posiciones.
 *
 * `salir(quedan, cambio)` desvanece las tarjetas que no están en `quedan`
 * (sus `data-flip`) y después aplica `cambio`.
 */
export function useFlip(clave) {
  const raizRef = useRef(null);
  const posiciones = useRef(new Map());
  const [reducido] = useState(prefersReducedMotion);

  const medir = useCallback((animar) => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const base = raiz.getBoundingClientRect();
    const nuevas = new Map();
    let entradas = 0;
    for (const nodo of raiz.querySelectorAll('[data-flip]')) {
      // Lo que quedaba de una animación anterior se corta: se mide el lugar real.
      for (const anim of nodo.getAnimations()) if (anim.id === 'flip') anim.cancel();
      const caja = nodo.getBoundingClientRect();
      const posicion = { x: caja.left - base.left, y: caja.top - base.top };
      nuevas.set(nodo.dataset.flip, posicion);
      if (!animar) continue;
      const antes = posiciones.current.get(nodo.dataset.flip);
      if (antes) {
        const dx = antes.x - posicion.x;
        const dy = antes.y - posicion.y;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
        const anim = nodo.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 300, easing: SUAVE },
        );
        anim.id = 'flip';
      } else {
        const anim = nodo.animate(
          [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 240, delay: Math.min(entradas * 35, 175), easing: SUAVE, fill: 'backwards' },
        );
        anim.id = 'flip';
        entradas += 1;
      }
    }
    posiciones.current = nuevas;
  }, []);

  // Después de cada cambio, antes de pintar: se mide y se anima desde el lugar anterior.
  useLayoutEffect(() => {
    medir(!reducido && posiciones.current.size > 0);
  }, [clave, medir, reducido]);

  // Si cambia el ancho (ventana, barra lateral), solo se vuelven a medir las posiciones.
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz || typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver(() => medir(false));
    observador.observe(raiz);
    return () => observador.disconnect();
  }, [medir]);

  const salir = useCallback((quedan, cambio) => {
    const raiz = raizRef.current;
    const salientes = raiz && !reducido
      ? [...raiz.querySelectorAll('[data-flip][data-sale]')].filter(nodo => !quedan.has(nodo.dataset.flip))
      : [];
    if (!salientes.length) {
      cambio();
      return;
    }
    for (const nodo of salientes) {
      const anim = nodo.animate(
        [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.97)' }],
        { duration: 140, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
      );
      anim.id = 'flip';
    }
    setTimeout(cambio, 120);
  }, [reducido]);

  return { raizRef, salir };
}
