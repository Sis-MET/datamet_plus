// Cálculo del desplazamiento automático al acercar el cursor a un borde del
// cronograma. La espera inicial evita que la grilla se mueva cuando la persona
// solo quiere hacer clic en una ficha cercana al borde.
export const EDGE_SCROLL = {
  zone: 56,
  dragZone: 84,
  dwell: 220,
  dragDwell: 90,
  ramp: 450,
  minSpeed: 110,
  maxSpeed: 620,
  reducedMaxSpeed: 260,
};

const NO_INTENT = Object.freeze({ direction: 0, strength: 0 });

/** Hacia dónde empuja el cursor (-1, 0 o 1) y con qué fuerza (0 a 1). */
export function getEdgeIntent({ x, left, right, zone }) {
  if (x < left || x > right) return NO_INTENT;
  const fromLeft = x - left;
  const fromRight = right - x;
  if (fromLeft <= zone && fromLeft <= fromRight) {
    return { direction: -1, strength: 1 - fromLeft / zone };
  }
  if (fromRight <= zone) {
    return { direction: 1, strength: 1 - fromRight / zone };
  }
  return NO_INTENT;
}

/** Velocidad en px/s: arranca tras la espera y acelera con suavidad. */
export function getEdgeSpeed({ strength, elapsed, dwell, ramp, minSpeed, maxSpeed }) {
  if (elapsed < dwell) return 0;
  const progress = Math.min(1, (elapsed - dwell) / ramp);
  const eased = progress * progress * (3 - 2 * progress);
  const target = minSpeed + (maxSpeed - minSpeed) * strength * strength;
  return target * (0.25 + 0.75 * eased);
}
