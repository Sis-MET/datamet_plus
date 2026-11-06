import { describe, expect, it } from 'vitest';
import { diferenciasExcentricidad, esquemaExcentricidad } from './excentricidad';

describe('excentricidad del registro', () => {
  it('lee el esquema de ServiceMET: forma, puntos e indicador', () => {
    expect(esquemaExcentricidad('RECTANGULAR', 'Rectangular 5F', 5)).toEqual({ forma: 'rectangular', puntos: 5, indicador: 'frente' });
    expect(esquemaExcentricidad('RECTANGULAR', 'Rectangular 3I', 3)).toEqual({ forma: 'rectangular', puntos: 3, indicador: 'izquierda' });
    expect(esquemaExcentricidad('CUADRADA', 'Cuadrada A', 5)).toEqual({ forma: 'cuadrada', puntos: 5, indicador: 'atras' });
    expect(esquemaExcentricidad('CIRCULAR', 'Circular 4F', 4)).toEqual({ forma: 'circular', puntos: 4, indicador: 'frente' });
    // Solo el número: la forma sale de la plataforma; sin indicador.
    expect(esquemaExcentricidad('CUADRADA', '5', 5)).toEqual({ forma: 'cuadrada', puntos: 5, indicador: null });
    // Sin esquema: la cantidad de lecturas decide entre las que admite la forma.
    expect(esquemaExcentricidad('CIRCULAR', null, 4).puntos).toBe(4);
    expect(esquemaExcentricidad(null, 'Triangular F', 4)).toEqual({ forma: 'triangular', puntos: 4, indicador: 'frente' });
    expect(esquemaExcentricidad(null, '5', 5)).toBeNull();
  });

  it('diferencia de cada posición con el centro, descontado el retorno', () => {
    const filas = diferenciasExcentricidad([
      { posicion: 1, indicacion: 500, retorno: 0 },
      { posicion: 2, indicacion: 500.5, retorno: 0 },
      { posicion: 3, indicacion: 501.5, retorno: 0.5 },
      { posicion: 4, indicacion: 498.5, retorno: 0 },
    ], 1);
    expect(filas.map(f => f.diferencia)).toEqual([0, 0.5, 1, -1.5]);
    expect(filas.map(f => f.excede)).toEqual([false, false, false, true]);
    expect(filas[0].referencia).toBe(true);
    expect(diferenciasExcentricidad([])).toEqual([]);
  });
});
