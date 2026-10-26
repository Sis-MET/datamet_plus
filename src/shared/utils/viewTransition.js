import { flushSync } from 'react-dom';
import { prefersReducedMotion } from './motion';

let transicionActual = null;

/**
 * Aplica `actualizar` con una transición de vista: el navegador fotografía la
 * pantalla, React pinta el cambio y el CSS (index.css, «Navegación») anima la
 * salida y la entrada. `tipo` elige qué se anima:
 * - 'pagina': el contenido del apartado (elemento .vt-pagina).
 * - 'panel': el contenido de una pestaña (elemento .vt-panel).
 * - 'app': toda la pantalla, al entrar o salir de la sesión.
 * Sin soporte del navegador, con movimiento reducido o durante el cambio de
 * tema, solo actualiza.
 */
export function conTransicion(actualizar, tipo = 'pagina') {
  const documento = typeof document === 'undefined' ? null : document;
  const raiz = documento?.documentElement;
  if (!documento?.startViewTransition || prefersReducedMotion() || raiz.classList.contains('theme-switching')) {
    actualizar();
    return;
  }
  transicionActual?.skipTransition();
  raiz.dataset.transicion = tipo;
  let actualizado = false;
  const transicion = documento.startViewTransition(() => {
    actualizado = true;
    flushSync(actualizar);
  });
  transicionActual = transicion;
  // El navegador espera un cuadro pintado para empezar. Si no llega (ventana en
  // segundo plano), se omite la animación: el cambio nunca queda en espera.
  const reserva = setTimeout(() => {
    if (!actualizado) transicion.skipTransition();
  }, 300);
  transicion.updateCallbackDone.finally(() => clearTimeout(reserva)).catch(() => {});
  transicion.finished.finally(() => {
    if (transicionActual !== transicion) return;
    transicionActual = null;
    delete raiz.dataset.transicion;
  });
}
