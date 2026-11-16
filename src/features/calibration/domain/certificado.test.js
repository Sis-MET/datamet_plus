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

  it('con decimales fijos, el paso cabe en ellos', () => {
    // Desviación de 0,26 g con 2 decimales: igual que sin fijarlos.
    expect(escalaBonita(0, 0.26, 5, 2)).toEqual({ min: 0, max: 0.3, paso: 0.1 });
    // 0,025 no se lee con 2 decimales: pasa a 0,05.
    expect(escalaBonita(0, 0.12, 5)).toEqual({ min: 0, max: 0.125, paso: 0.025 });
    expect(escalaBonita(0, 0.12, 5, 2)).toEqual({ min: 0, max: 0.15, paso: 0.05 });
    // Rango menor que la resolución: el paso es la resolución.
    expect(escalaBonita(0, 0.0003, 5, 2)).toEqual({ min: 0, max: 0.01, paso: 0.01 });
  });

  it('marcas con coma decimal', () => {
    expect(marcasDe({ min: 0, max: 0.01, paso: 0.002 }).map(m => m.texto)).toEqual(['0,000', '0,002', '0,004', '0,006', '0,008', '0,010']);
    expect(marcasDe({ min: -0.02, max: 0.02, paso: 0.01 }).map(m => m.texto)).toEqual(['-0,02', '-0,01', '0,00', '0,01', '0,02']);
    expect(marcasDe({ min: 0, max: 600, paso: 100 }).map(m => m.texto)).toEqual(['0', '100', '200', '300', '400', '500', '600']);
  });

  it('marcas con los decimales de la desviación estándar', () => {
    expect(marcasDe({ min: 0, max: 0.3, paso: 0.1 }).map(m => m.texto)).toEqual(['0,0', '0,1', '0,2', '0,3']);
    expect(marcasDe({ min: 0, max: 0.3, paso: 0.1 }, 2).map(m => m.texto)).toEqual(['0,00', '0,10', '0,20', '0,30']);
  });

  it('reparte una tabla larga en tramos', () => {
    expect(tramos([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(tramos([], 3)).toEqual([[]]);
  });
});
