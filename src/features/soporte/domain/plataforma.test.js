import { describe, expect, it } from 'vitest';
import { lecturasCamion, leerPlataforma, posicionIndicador, posicionesPlataforma } from './plataforma';

describe('plataforma de excentricidad', () => {
  it('lee la forma, los puntos y el indicador que guarda ServiceMET', () => {
    expect(leerPlataforma('Circular', 'Circular 5 pts - Ind Frontal')).toEqual({ forma: 'circular', puntos: 5, indicador: 'frente' });
    expect(leerPlataforma(null, 'Rectangular 3 pts - Ind Izquierda')).toEqual({ forma: 'rectangular', puntos: 3, indicador: 'izquierda' });
    expect(leerPlataforma('Cuadrada', 'Cuadrada - Ind Atras')).toEqual({ forma: 'cuadrada', puntos: 5, indicador: 'atras' });
    expect(leerPlataforma('Triangular', 'Triangular - Ind Frontal')).toEqual({ forma: 'triangular', puntos: 4, indicador: 'frente' });
    expect(leerPlataforma('Rectangular', 'Rectangular - Ind Frontal', 3).puntos).toBe(3);
    expect(leerPlataforma('Circular', null, 4)).toEqual({ forma: 'circular', puntos: 4, indicador: null });
    expect(leerPlataforma(null, null)).toBeNull();
    expect(leerPlataforma('Otra', 'algo')).toBeNull();
  });

  it('reconoce la báscula de camión y la posición de la caseta', () => {
    expect(leerPlataforma('Báscula de camión', '6')).toEqual({ forma: 'camion', puntos: 6, caseta: null });
    expect(leerPlataforma(null, '6F')).toEqual({ forma: 'camion', puntos: 6, caseta: 'frente' });
    expect(leerPlataforma('Báscula de camión', null, 4)).toEqual({ forma: 'camion', puntos: 4, caseta: null });
  });

  it('usa las coordenadas de ServiceMET', () => {
    expect(posicionesPlataforma('cuadrada', 5)).toHaveLength(5);
    expect(posicionesPlataforma('rectangular', 3)).toHaveLength(3);
    expect(posicionesPlataforma('circular', 4)[2]).toEqual([0.5, 0.77]);
    expect(posicionIndicador('cuadrada', 'frente')).toEqual([0.5, 0.85]);
    expect(posicionIndicador('cuadrada', null)).toBeNull();
  });

  // 26-0131-51-S02-004: Ida 1-3 y Vuelta 3, 2, 1 en las filas 4 a 6.
  it('ubica cada lectura del camión según su etiqueta', () => {
    const lecturas = [
      { posicion: 'Ida 1', indicacion: 19910 },
      { posicion: 'Ida 2', indicacion: 19910 },
      { posicion: 'Ida 3', indicacion: 19920 },
      { posicion: 'Vuelta 3', indicacion: 19920 },
      { posicion: 'Vuelta 2', indicacion: 19910 },
      { posicion: 'Vuelta 1', indicacion: 19910 },
    ];
    const { ida, vuelta } = lecturasCamion(lecturas, 6);
    expect(ida.map(l => l.valor)).toEqual([19910, 19910, 19920]);
    // De izquierda a derecha: Vuelta 3, Vuelta 2, Vuelta 1.
    expect(vuelta.map(l => l.numero)).toEqual([3, 2, 1]);
    expect(vuelta.map(l => l.valor)).toEqual([19920, 19910, 19910]);
    // Sin etiquetas, el mismo orden de ServiceMET.
    const sinEtiqueta = lecturasCamion(lecturas.map(l => ({ indicacion: l.indicacion })), 6);
    expect(sinEtiqueta.vuelta.map(l => l.fila)).toEqual([4, 5, 6]);
  });
});
