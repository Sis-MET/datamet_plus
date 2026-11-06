import { describe, expect, it } from 'vitest';
import {
  esPegadoMultiple,
  formatNominal,
  formatNumber,
  parseNominalText,
  parseNumber,
  parsePegado,
  pegarEnFilas,
  piezaLabel,
  splitNominal,
  tipoPatronSugerido,
  toMg,
} from './patrones';

describe('números y unidades de los patrones', () => {
  it('lee números con coma o punto decimal', () => {
    expect(parseNumber('0,012')).toBe(0.012);
    expect(parseNumber('0.012')).toBe(0.012);
    expect(parseNumber(' -1,5 ')).toBe(-1.5);
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('7950')).toBe(7950);
    expect(parseNumber('2e-3')).toBe(0.002);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNaN();
    expect(parseNumber('1,2,3')).toBeNaN();
  });

  it('muestra los números con coma y sin ceros de más', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0,3');
    expect(formatNumber(20)).toBe('20');
    expect(formatNumber(null)).toBe('');
  });

  it('elige la unidad más legible para el valor nominal', () => {
    expect(splitNominal(500)).toEqual({ valor: 500, unidad: 'mg' });
    expect(splitNominal(2000)).toEqual({ valor: 2, unidad: 'g' });
    expect(splitNominal(20e6)).toEqual({ valor: 20, unidad: 'kg' });
    expect(formatNominal(500e3)).toBe('500 g');
    expect(toMg(0.5, 'g')).toBe(500);
    expect(toMg(20, 'kg')).toBe(20e6);
    expect(piezaLabel({ nominalMg: 2000, identificacion: '*' })).toBe('2 g *');
  });

  it('lee el valor nominal con o sin unidad', () => {
    expect(parseNominalText('500 mg')).toEqual({ valor: '500', unidad: 'mg' });
    expect(parseNominalText('1 KG')).toEqual({ valor: '1', unidad: 'kg' });
    expect(parseNominalText('0,5', 'g')).toEqual({ valor: '0,5', unidad: 'g' });
    expect(parseNominalText('pesa')).toBeNull();
  });
});

describe('pegado desde Excel', () => {
  it('separa filas y columnas y quita el salto final', () => {
    expect(parsePegado('1\t0,01\n2\t0,02\r\n')).toEqual([['1', '0,01'], ['2', '0,02']]);
    expect(esPegadoMultiple('0,01')).toBe(false);
    expect(esPegadoMultiple('0,01\n')).toBe(false);
    expect(esPegadoMultiple('0,01\t0,03')).toBe(true);
  });

  it('llena las filas desde la celda donde se pega y agrega las que faltan', () => {
    const filas = [{ a: '', b: '', c: '' }];
    const result = pegarEnFilas({
      filas,
      fila: 0,
      columna: 'b',
      celdas: [['1', '2', '3'], ['4', '5']],
      columnas: ['a', 'b', 'c'],
      nuevaFila: () => ({ a: '', b: '', c: '' }),
    });
    expect(result).toEqual([{ a: '', b: '1', c: '2' }, { a: '', b: '4', c: '5' }]);
  });

  it('sin nueva fila descarta lo que no cabe', () => {
    const result = pegarEnFilas({ filas: [{ a: '' }], fila: 0, columna: 'a', celdas: [['1'], ['2']], columnas: ['a'] });
    expect(result).toEqual([{ a: '1' }]);
  });
});

describe('tipo de patrón sugerido', () => {
  it('reconoce juegos de pesas y equipos de condiciones ambientales', () => {
    expect(tipoPatronSugerido('Pesas Patron')).toBe('PESAS');
    expect(tipoPatronSugerido('PESA PATRÓN 20 kg')).toBe('PESAS');
    expect(tipoPatronSugerido('Termohigrómetro')).toBe('AMBIENTE');
    expect(tipoPatronSugerido('Barómetro digital')).toBe('AMBIENTE');
    expect(tipoPatronSugerido('Multímetro')).toBeNull();
    expect(tipoPatronSugerido(null)).toBeNull();
  });
});
