// Duración de las salidas en milisegundos: la de --motion-exit (index.css) más
// un margen, para desmontar cuando la animación ya terminó.
export const EXIT_MS = 170;

export const prefersReducedMotion = () => typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Espera antes de desmontar algo que sale; sin animaciones, ninguna. */
export const exitDelay = () => (prefersReducedMotion() ? 0 : EXIT_MS);
