import { describe, expect, it } from 'vitest';
import { EDGE_SCROLL, getEdgeIntent, getEdgeSpeed } from './edgeScroll';

const bounds = { left: 200, right: 1000, zone: 50 };
const speed = { dwell: 200, ramp: 400, minSpeed: 100, maxSpeed: 600 };

describe('getEdgeIntent', () => {
  it('no actúa en el centro ni fuera de la grilla', () => {
    expect(getEdgeIntent({ ...bounds, x: 600 }).direction).toBe(0);
    expect(getEdgeIntent({ ...bounds, x: 150 }).direction).toBe(0);
    expect(getEdgeIntent({ ...bounds, x: 1010 }).direction).toBe(0);
  });

  it('empuja hacia la izquierda junto a la columna de nombres', () => {
    expect(getEdgeIntent({ ...bounds, x: 200 })).toEqual({ direction: -1, strength: 1 });
    expect(getEdgeIntent({ ...bounds, x: 225 })).toEqual({ direction: -1, strength: 0.5 });
  });

  it('empuja hacia la derecha junto al borde', () => {
    expect(getEdgeIntent({ ...bounds, x: 1000 })).toEqual({ direction: 1, strength: 1 });
    expect(getEdgeIntent({ ...bounds, x: 975 })).toEqual({ direction: 1, strength: 0.5 });
  });
});

describe('getEdgeSpeed', () => {
  it('espera antes de mover la grilla', () => {
    expect(getEdgeSpeed({ ...speed, strength: 1, elapsed: 199 })).toBe(0);
  });

  it('acelera hasta la velocidad de destino', () => {
    const inicio = getEdgeSpeed({ ...speed, strength: 1, elapsed: 200 });
    const final = getEdgeSpeed({ ...speed, strength: 1, elapsed: 600 });
    expect(inicio).toBeGreaterThan(0);
    expect(inicio).toBeLessThan(final);
    expect(final).toBe(600);
  });

  it('va más rápido cuanto más cerca del borde', () => {
    const lejos = getEdgeSpeed({ ...speed, strength: 0.2, elapsed: 900 });
    const cerca = getEdgeSpeed({ ...speed, strength: 0.9, elapsed: 900 });
    expect(cerca).toBeGreaterThan(lejos);
  });

  it('la zona de arrastre es más amplia y responde antes', () => {
    expect(EDGE_SCROLL.dragZone).toBeGreaterThan(EDGE_SCROLL.zone);
    expect(EDGE_SCROLL.dragDwell).toBeLessThan(EDGE_SCROLL.dwell);
  });
});
