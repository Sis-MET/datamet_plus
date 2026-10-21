import { describe, expect, it } from 'vitest';
import {
  aNumero,
  calcularPruebas,
  decimalesInstrumento,
  divisionPara,
  rangoPara,
  rangosInstrumento,
  conUnidad,
  decimalesDeDivision,
  diferenciaMaxima,
  enDivisiones,
  errorMaximo,
  erroresLinealidad,
  formatoNumero,
  redondear,
} from './calculos';

describe('lectura de números', () => {
  it('acepta coma o punto decimal y descarta texto', () => {
    expect(aNumero('0,05')).toBe(0.05);
    expect(aNumero(' 199.77 ')).toBe(199.77);
    expect(aNumero(12)).toBe(12);
    expect(aNumero('-')).toBeNull();
    expect(aNumero('1 Bueno')).toBeNull();
    expect(aNumero('')).toBeNull();
    expect(aNumero(null)).toBeNull();
  });
});

describe('redondeo', () => {
  it('redondea la mitad lejos de cero sin errores de coma flotante', () => {
    expect(redondear(1.005, 2)).toBe(1.01);
    expect(redondear(0.199999999999989, 3)).toBe(0.2);
    expect(redondear(2.5, 0)).toBe(3);
    expect(redondear(-2.5, 0)).toBe(-3);
    expect(redondear(-0.0000001, 2)).toBe(0);
    expect(redondear(1e-7, 9)).toBe(1e-7);
  });
});

describe('decimales de la división', () => {
  it('sigue la regla de las macros', () => {
    expect(decimalesDeDivision(0.001)).toBe(3);
    expect(decimalesDeDivision(0.01)).toBe(2);
    expect(decimalesDeDivision(0.05)).toBe(2);
    expect(decimalesDeDivision(0.1)).toBe(1);
    expect(decimalesDeDivision(0.2)).toBe(1);
    expect(decimalesDeDivision(0.5)).toBe(1);
    expect(decimalesDeDivision(1)).toBe(0);
    expect(decimalesDeDivision(10)).toBe(0);
    expect(decimalesDeDivision(0)).toBe(1);
    expect(decimalesDeDivision(null)).toBe(1);
  });
});

describe('formato', () => {
  it('usa los decimales del instrumento y la unidad', () => {
    expect(formatoNumero(1000.1, 1)).toBe('1000.1');
    expect(formatoNumero(1000, 1)).toBe('1000.0');
    expect(formatoNumero('-', 1)).toBe('-');
    expect(conUnidad(199.7, 2, 'g')).toBe('199.70 g');
    expect(conUnidad(null, 2, 'g')).toBe('-');
    expect(conUnidad(5, 0, '')).toBe('5');
  });
});

describe('resultados de las pruebas', () => {
  it('diferencia máxima ignora vacíos y texto', () => {
    expect(diferenciaMaxima([199.77, '-', null, 199.74], 2)).toBe(0.03);
    expect(diferenciaMaxima(['-', null], 2)).toBeNull();
    expect(diferenciaMaxima([-1, -3], 0)).toBe(2);
  });

  it('el error de linealidad es indicación menos carga', () => {
    expect(erroresLinealidad([{ carga: 200, indicacion: 200.5 }, { carga: 50, indicacion: 49.95 }, { carga: 10, indicacion: null }], 2))
      .toEqual([0.5, -0.05, null]);
    expect(errorMaximo([0.01, -0.53, null], 2)).toBe(0.53);
    expect(errorMaximo([null], 2)).toBeNull();
  });

  it('en divisiones sin división válida no hay resultado', () => {
    expect(enDivisiones(0.53, 0.01)).toBe(53);
    expect(enDivisiones(0.53, 0)).toBeNull();
    expect(enDivisiones(null, 0.01)).toBeNull();
    expect(enDivisiones(0.25, 0.1)).toBe(3);
  });

  // Plantilla IMPR v10.0.2 (balanza de 400 g, d = 0.01 g).
  const unRango = (d, e = d, cap = 1000) => rangosInstrumento({ cap_max1: cap, d1: d, e1: e });

  it('reproduce el informe de mantenimiento preventivo regular', () => {
    const resultado = calcularPruebas({
      excentricidad: [199.77, 199.75, 199.77, 199.75, 199.74],
      repetibilidad: [199.77, 199.77, 199.78, '-', '-'],
      linealidad: [
        { carga: 10, indicacion: 10.01 },
        { carga: 50, indicacion: 49.95 },
        { carga: 100, indicacion: 99.9 },
        { carga: 200, indicacion: 199.77 },
        { carga: 400, indicacion: 399.47 },
        { carga: '-', indicacion: '-' },
      ],
    }, { rangos: unRango(0.01, 0.01, 400), decimales: 2 });
    expect(resultado.excentricidad).toEqual({ diferencia: 0.03, divisiones: 3, simbolo: 'd' });
    expect(resultado.repetibilidad).toEqual({ diferencia: 0.01, divisiones: 1, simbolo: 'd' });
    expect(resultado.linealidad.errores).toEqual([0.01, -0.05, -0.1, -0.23, -0.53, null]);
    expect(resultado.linealidad.maximo).toBe(0.53);
    expect(resultado.linealidad.divisiones).toBe(53);
  });

  // Plantilla IMPA v4.4.2 (sistema de camiones de 80 000 kg, e = 10 kg).
  it('reproduce el informe de mantenimiento preventivo avanzado en «e»', () => {
    const resultado = calcularPruebas({
      excentricidad: [19910, 19910, 19920, 19920, 19910, 19910],
      repetibilidad: [35760, 35760, 35760],
      linealidad: [
        { carga: 19920, indicacion: 19920 },
        { carga: 15850, indicacion: 15850 },
        { carga: 35770, indicacion: 35760 },
      ],
    }, { rangos: unRango(10, 10, 80000), decimales: 0, preferida: 'e' });
    expect(resultado.excentricidad).toEqual({ diferencia: 10, divisiones: 1, simbolo: 'e' });
    expect(resultado.repetibilidad).toEqual({ diferencia: 0, divisiones: 0, simbolo: 'e' });
    expect(resultado.linealidad.maximo).toBe(10);
    expect(resultado.linealidad.divisiones).toBe(1);
    expect(resultado.linealidad.simbolo).toBe('e');
  });

  it('sin escala de verificación (e) el preventivo avanzado se expresa en d', () => {
    const resultado = calcularPruebas(
      { excentricidad: [19910, 19920] },
      { rangos: rangosInstrumento({ cap_max1: 80000, d1: 10, e1: null }), decimales: 0, preferida: 'e' },
    );
    expect(resultado.excentricidad).toEqual({ diferencia: 10, divisiones: 1, simbolo: 'd' });
  });

  // 0071-11-073: rango 1 = 6000 g con d = 0.5; rango 2 = 3000 g con d = 0.1.
  it('cada carga se expresa en la división de su rango', () => {
    const rangos = rangosInstrumento({ cap_max1: 6000, d1: 0.5, e1: 0.5, cap_max2: 3000, d2: 0.1, e2: 0.1, cap_max3: 0, d3: 0 });
    const resultado = calcularPruebas({
      excentricidad: [1000, 1000.3],
      repetibilidad: [4000, 4001],
      linealidad: [{ carga: 1000, indicacion: 1000.2 }, { carga: 5000, indicacion: 5000.5 }],
      cargas: { excentricidad: 1000, repetibilidad: 4000 },
    }, { rangos, decimales: decimalesInstrumento({ d1: 0.5, d2: 0.1, cap_max1: 6000, cap_max2: 3000 }) });
    // 0.3 g con la d fina (0.1) = 3 d; con la d1 (0.5) habría dado 1 d.
    expect(resultado.excentricidad.divisiones).toBe(3);
    // 4000 g está en el rango grueso: 1 g / 0.5 = 2 d.
    expect(resultado.repetibilidad.divisiones).toBe(2);
    // 0.2 / 0.1 = 2 d en 1000 g y 0.5 / 0.5 = 1 d en 5000 g: manda el mayor.
    expect(resultado.linealidad.maximo).toBe(0.5);
    expect(resultado.linealidad.divisiones).toBe(2);
  });
});

describe('rangos del instrumento', () => {
  it('se ordenan por capacidad y descartan los vacíos', () => {
    const rangos = rangosInstrumento({ cap_max1: 6000, d1: 0.5, e1: 0.5, cap_max2: 3000, d2: 0.1, e2: 0.1, cap_max3: 0, d3: 0, e3: 0 });
    expect(rangos.map(r => r.rango)).toEqual([2, 1]);
    expect(rangoPara(rangos, 2500).rango).toBe(2);
    expect(rangoPara(rangos, 3000).rango).toBe(2);
    expect(rangoPara(rangos, 3001).rango).toBe(1);
    expect(rangoPara(rangos, 9000).rango).toBe(1);
    expect(rangoPara(rangos, null).rango).toBe(1);
  });

  it('el rango 1 vale aunque falte su capacidad', () => {
    expect(rangosInstrumento({ d1: 0.1 })).toEqual([{ rango: 1, cap: Infinity, d: 0.1, e: null }]);
    expect(rangosInstrumento({ d1: 0 })).toEqual([]);
    expect(divisionPara([], 10)).toEqual({ valor: null, simbolo: 'd', rango: null });
  });

  it('los decimales son los de la división más fina', () => {
    expect(decimalesInstrumento({ cap_max1: 6000, d1: 0.5, cap_max2: 3000, d2: 0.01 })).toBe(2);
    expect(decimalesInstrumento({ d1: 1 })).toBe(0);
    expect(decimalesInstrumento({})).toBe(1);
  });
});
