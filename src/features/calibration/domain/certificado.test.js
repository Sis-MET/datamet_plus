import { describe, expect, it } from 'vitest';
import { escalaBonita, marcasDe, tramos } from './certificado';

describe('documento del certificado', () => {
  it('escala de ejes con límites y pasos redondos', () => {
    expect(escalaBonita(0, 600, 6)).toEqual({ min: 0, max: 600, paso: 100 });
    expect(escalaBonita(0, 600)).toEqual({ min: 0, max: 600, paso: 200 });
    expect(escalaBonita(-0.03, 0.03, 6)).toEqual({ min: -0.03, max: 0.03, paso: 0.01 });
    expect(escalaBonita(0, 0.0083)).toEqual({ min: 0, max: 0.01, paso: 0.002 });
    // Sin rango (todo en cero): un eje de 0 a 1.
    expect(escalaBonita(0, 0)).toEqual({ min: 0, max: 1, paso: 0.2 });
  });

  it('marcas con coma decimal', () => {
    expect(marcasDe({ min: 0, max: 0.01, paso: 0.002 }).map(m => m.texto)).toEqual(['0,000', '0,002', '0,004', '0,006', '0,008', '0,010']);
    expect(marcasDe({ min: -0.02, max: 0.02, paso: 0.01 }).map(m => m.texto)).toEqual(['-0,02', '-0,01', '0,00', '0,01', '0,02']);
    expect(marcasDe({ min: 0, max: 600, paso: 100 }).map(m => m.texto)).toEqual(['0', '100', '200', '300', '400', '500', '600']);
  });

  it('reparte una tabla larga en tramos', () => {
    expect(tramos([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(tramos([], 3)).toEqual([[]]);
  });
});
