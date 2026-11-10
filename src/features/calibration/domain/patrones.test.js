import { describe, expect, it } from 'vitest';
import {
  aptaPieza,
  cambiarExpresion,
  densidadSupuestaDe,
  empR111,
  esPegadoMultiple,
  expresionDe,
  formatNominal,
  formatNumber,
  parseNominalText,
  parseNumber,
  parsePegado,
  pegarEnFilas,
  materialDeLista,
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

// Extracto de la tabla que manda el servidor (R111, Tabla 1).
const R111 = {
  clases: ['E1', 'E2', 'F1', 'F2', 'M1', 'M1-2', 'M2', 'M2-3', 'M3'],
  emp: [
    [1e6, 0.5, 1.6, 5, 16, 50, null, 160, null, 500],
    [500, 0.008, 0.025, 0.08, 0.25, 0.8, null, 2.5, null, null],
  ],
};

describe('«Apta» según la OIML R111', () => {
  it('toma el emp de la clase y el valor nominal', () => {
    expect(empR111(R111, 'F1', 1e6)).toBe(5);
    expect(empR111(R111, 'M3', 500)).toBeNull();
    expect(empR111(R111, 'X', 1e6)).toBeNull();
  });

  it('es apta si U (k = 2) ≤ emp/3 y |corrección| ≤ emp − U', () => {
    expect(aptaPieza({ r111: R111, clase: 'F1', nominalMg: 1e6, correccion: '4', u: '1', k: '2' }).apta).toBe(true);
    expect(aptaPieza({ r111: R111, clase: 'F1', nominalMg: 1e6, correccion: '-4,1', u: '1', k: '2' }).apta).toBe(false);
    const grande = aptaPieza({ r111: R111, clase: 'F1', nominalMg: 1e6, correccion: '0', u: '2', k: '2' });
    expect([grande.apta, grande.cumpleU, grande.cumpleCorreccion]).toEqual([false, false, true]);
    expect(grande.motivo).toBe('emp F1: 5 mg. U (k = 2) = 2 mg > emp/3 = 1,667 mg (5.2); |corrección| = 0 mg ≤ emp − U = 3 mg (5.3).');
  });

  it('no decide sin clase, sin el valor nominal en la tabla o sin valores', () => {
    expect(aptaPieza({ r111: R111, clase: '', nominalMg: 1e6, correccion: '0', u: '1', k: '2' }).apta).toBeNull();
    expect(aptaPieza({ r111: R111, clase: 'F1', nominalMg: 3e6, correccion: '0', u: '1', k: '2' }).motivo).toMatch(/no tiene este valor nominal/);
    expect(aptaPieza({ r111: R111, clase: 'F1', nominalMg: 1e6, correccion: '', u: '1', k: '2' }).apta).toBeNull();
  });
});

describe('materiales de la tabla de densidades', () => {
  const MATERIALES = [
    { material: 'Acero inoxidable', claves: ['inox'], rho: 7950, u: 70 },
    { material: 'Fundición gris (hierro fundido)', claves: ['fundicion', 'hierro fundido', 'gris'], rho: 7100, u: 300 },
    { material: 'Acero', claves: ['acero al carbono', 'acero'], rho: 7700, u: 100 },
  ];

  it('reconoce el material escrito o pegado', () => {
    expect(materialDeLista('acero inoxidable', MATERIALES).material).toBe('Acero inoxidable');
    expect(materialDeLista('Inox.', MATERIALES).material).toBe('Acero inoxidable');
    expect(materialDeLista('Hierro fundido', MATERIALES).material).toBe('Fundición gris (hierro fundido)');
    expect(materialDeLista('Acero', MATERIALES).material).toBe('Acero');
    expect(materialDeLista('Vidrio', MATERIALES)).toBeNull();
    expect(materialDeLista('', MATERIALES)).toBeNull();
  });

  it('da la densidad supuesta con su U para k = 2, como la escribe el certificado', () => {
    expect(densidadSupuestaDe('Acero inoxidable', MATERIALES)).toEqual({ densidad: 7950, densidadU: 140, densidadK: 2 });
    expect(densidadSupuestaDe('Vidrio', MATERIALES)).toBeNull();
  });
});

describe('error o corrección del termohigrómetro', () => {
  it('el error es la corrección con el signo cambiado, en los dos sentidos', () => {
    expect(cambiarExpresion(1.33, 'ERROR')).toBe(-1.33);
    expect(cambiarExpresion(-1.33, 'ERROR')).toBe(1.33);
    expect(cambiarExpresion(0.3, 'CORRECCION')).toBe(0.3);
    expect(Object.is(cambiarExpresion(0, 'ERROR'), 0)).toBe(true);
    expect(cambiarExpresion(null, 'ERROR')).toBeNull();
  });

  it('cada magnitud dice lo que da su certificado según sus puntos', () => {
    const puntos = [
      { magnitud: 'T', expresadoComo: 'CORRECCION' },
      { magnitud: 'P', expresadoComo: 'ERROR' },
      { magnitud: 'P', expresadoComo: 'ERROR' },
    ];
    expect(expresionDe(puntos, 'T')).toBe('CORRECCION');
    expect(expresionDe(puntos, 'P')).toBe('ERROR');
    // Sin puntos guardados, lo que se indique por defecto.
    expect(expresionDe(puntos, 'HR')).toBe('CORRECCION');
    expect(expresionDe([], 'P', 'ERROR')).toBe('ERROR');
  });
});
