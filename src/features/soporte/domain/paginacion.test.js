import { describe, expect, it } from 'vitest';
import { paginar } from './paginacion';

describe('paginación del informe', () => {
  it('pasa a la hoja siguiente lo que no cabe', () => {
    expect(paginar([300, 300, 300, 300], 700, [false, false, false, false])).toEqual([[0, 1], [2, 3]]);
  });

  it('respeta los saltos de hoja de la plantilla', () => {
    expect(paginar([100, 100, 100], 900, [false, true, false])).toEqual([[0], [1, 2]]);
  });

  it('un bloque más alto que la hoja ocupa una hoja propia', () => {
    expect(paginar([1200, 100], 900, [false, false])).toEqual([[0], [1]]);
    expect(paginar([100, 1200], 900, [false, false])).toEqual([[0], [1]]);
  });
});
