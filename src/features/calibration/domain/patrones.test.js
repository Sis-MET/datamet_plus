import { describe, expect, it } from 'vitest';
import {
  aptaPieza,
  cambiarExpresion,
  claseInferior,
  claseQueCumple,
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
    expect(grande.fallas.map(f => f.norma)).toEqual(['5.2']);
  });

  it('dice qué condición falla: la incertidumbre, la corrección o las dos', () => {
    const tabla = { clases: ['E2', 'F1'], emp: [[10, 0.008, 0.025]] };
    // E2-003, 10 mg (LP-CC-M-0221-2026): la corrección cabe, pero U = 0,003 > 0,008/3.
    const soloU = aptaPieza({ r111: tabla, clase: 'E2', nominalMg: 10, correccion: '0,002', u: '0,003', k: '2' });
    expect([soloU.apta, soloU.cumpleU, soloU.cumpleCorreccion]).toEqual([false, false, true]);
    expect(soloU.fallas).toEqual([{ norma: '5.2', texto: 'U > emp/3', detalle: 'La incertidumbre del certificado (0,003 mg) supera emp/3 (0,002667 mg).' }]);
    // Cada condición por separado, para su columna.
    expect(soloU.condiciones.map(c => [c.norma, c.cumple, c.valor, c.limite])).toEqual([
      ['5.2', false, '0,003', '0,002667'],
      ['5.3', true, '0,002', '0,005'],
    ]);
    expect(soloU.condiciones[0].detalle).toMatch(/supera emp\/3 = 0,002667 mg: la incertidumbre del certificado es grande para la clase E2/);
    // La misma pieza como F1 sí cumple.
    expect(aptaPieza({ r111: tabla, clase: 'F1', nominalMg: 10, correccion: '0,002', u: '0,003', k: '2' })).toMatchObject({ apta: true, fallas: [] });
    // Solo la corrección.
    const soloCorreccion = aptaPieza({ r111: tabla, clase: 'E2', nominalMg: 10, correccion: '-0,007', u: '0,002', k: '2' });
    expect(soloCorreccion.fallas.map(f => f.norma)).toEqual(['5.3']);
    // Las dos.
    const ambas = aptaPieza({ r111: tabla, clase: 'E2', nominalMg: 10, correccion: '0,006', u: '0,004', k: '2' });
    expect(ambas.fallas.map(f => [f.norma, f.texto])).toEqual([['5.2', 'U > emp/3'], ['5.3', '|corr.| > emp − U']]);
  });

  it('encuentra la clase más exacta que cumple la pieza con su certificado', () => {
    const tabla = { clases: ['E1', 'E2', 'F1', 'F2'], emp: [[10, 0.003, 0.008, 0.025, 0.08], [20, 0.003, 0.010, 0.03, 0.10]] };
    const pieza = (nominalMg, correccion, u) => claseQueCumple({ r111: tabla, nominalMg, correccion, u, k: '2' });
    // E2-003: con U = 0,003 mg, 10 mg no llega a E2 pero sí a F1; 20 mg sí es E2.
    expect(pieza(10, '0,002', '0,003')).toEqual({ calculable: true, clase: 'F1' });
    expect(pieza(20, '-0,001', '0,003')).toEqual({ calculable: true, clase: 'E2' });
    // Con una U chica cumple hasta E1.
    expect(pieza(10, '0,001', '0,001')).toEqual({ calculable: true, clase: 'E1' });
    // Una corrección enorme no cabe en ninguna.
    expect(pieza(10, '0,2', '0,003')).toEqual({ calculable: true, clase: null });
    // Sin valores no se calcula.
    expect(pieza(10, '', '0,003')).toEqual({ calculable: false, clase: null });
    expect([claseInferior(tabla, 'F1', 'E2'), claseInferior(tabla, 'E1', 'E2'), claseInferior(tabla, 'E2', 'E2')]).toEqual([true, false, false]);
  });

  it('con el criterio del laboratorio decide |corrección| + U ≤ emp y la 5.2 queda como dato', () => {
    const tabla = { clases: ['E1', 'E2', 'F1'], emp: [[10, 0.003, 0.008, 0.025]] };
    const pieza = { r111: tabla, clase: 'E2', nominalMg: 10, correccion: '0,002', u: '0,003', k: '2' };
    const r111 = aptaPieza(pieza);
    const laboratorio = aptaPieza({ ...pieza, criterio: 'SUMA_EMP' });
    expect([r111.apta, laboratorio.apta]).toEqual([false, true]);
    expect(laboratorio.condiciones.map(c => [c.norma, c.exigida, c.cumple])).toEqual([['5.2', false, false], ['5.3', true, true]]);
    expect(laboratorio.fallas).toEqual([]);
    expect(laboratorio.condiciones[0].detalle).toMatch(/el criterio del laboratorio no lo exige/);
    expect(laboratorio.motivo).toMatch(/Criterio del laboratorio/);
    // La clase que cumple sigue el mismo criterio: E2 con el del laboratorio, F1 con la R111.
    expect(claseQueCumple({ ...pieza, criterio: 'SUMA_EMP' }).clase).toBe('E2');
    expect(claseQueCumple(pieza).clase).toBe('F1');
    // Si la suma se pasa del emp, no es apta con ningún criterio.
    expect(aptaPieza({ ...pieza, correccion: '0,006', criterio: 'SUMA_EMP' }).apta).toBe(false);
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
