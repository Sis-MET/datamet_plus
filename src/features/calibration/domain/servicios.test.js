import { describe, expect, it } from 'vitest';
import { parseNumber } from './patrones';
import {
  agruparPorSeca,
  contarCalidades,
  filtrarServicios,
  leerCargas,
  ordenarAvisos,
  seccionDeAviso,
  tecnicosDe,
} from './servicios';

const servicio = (extra = {}) => ({
  codigo: '0103-31-C05-26-5-0103-31-006',
  fecha: '2026-07-23',
  seca: '0103-31-C05-26',
  secaLibro: '0103-C05-26',
  reca: '05',
  sticker: '8785',
  cliente: 'CLIENTE A',
  razonSocial: 'CLIENTE A S.A.',
  planta: 'PLANTA NORTE',
  tecnico: { original: 'Ing. Jorge Ortuño R.', usuario: 'Ortuño', iniciales: 'JOR', nombre: 'Jorge Ortuño Ramirez' },
  instrumento: { codigoMetrica: '0103-31-006', codigoInterno: 'SC-B-30', marca: 'METTLER TOLEDO', modelo: 'IND231', serie: 'C03', max: 1500, unidad: 'kg' },
  avisos: { errores: 0, avisos: 0, notas: 0, codigos: [] },
  ...extra,
});

describe('lista de servicios de ServiceMET', () => {
  const lista = [
    servicio(),
    servicio({ codigo: 'B', reca: '02', fecha: '2026-07-22', avisos: { errores: 1, avisos: 2, notas: 0, codigos: ['SIN_PESAS'] } }),
    servicio({
      codigo: 'C', secaLibro: '0090-C08-26', reca: '01', fecha: '2026-08-01', cliente: 'CLIENTE B',
      tecnico: { original: 'Usuario sin datos', usuario: null, iniciales: null, nombre: null },
      avisos: { errores: 0, avisos: 1, notas: 2, codigos: ['TECNICO_SIN_IDENTIFICAR'] },
    }),
  ];

  it('filtra por texto, técnico y calidad de los datos', () => {
    expect(filtrarServicios(lista, { q: 'cliente b' }).map(s => s.codigo)).toEqual(['C']);
    expect(filtrarServicios(lista, { q: 'ortuno' }).length).toBe(2);
    expect(filtrarServicios(lista, { tecnico: 'Ortuño' }).length).toBe(2);
    expect(filtrarServicios(lista, { calidad: 'CON_ERRORES' }).map(s => s.codigo)).toEqual(['B']);
    expect(filtrarServicios(lista, { calidad: 'CON_AVISOS' }).map(s => s.codigo)).toEqual(['C']);
    expect(filtrarServicios(lista, { calidad: 'LIMPIOS' }).map(s => s.reca)).toEqual(['05']);
    expect(contarCalidades(lista)).toEqual({ CON_ERRORES: 1, CON_AVISOS: 1, SIN_TECNICO: 1, LIMPIOS: 1 });
  });

  it('agrupa por SECA del libro, el más reciente primero y por RECA dentro', () => {
    const grupos = agruparPorSeca(lista);
    expect(grupos.map(g => g.clave)).toEqual(['0090-C08-26', '0103-C05-26']);
    const [, seca] = grupos;
    expect(seca.servicios.map(s => s.reca)).toEqual(['02', '05']);
    expect(seca).toMatchObject({ total: 2, conErrores: 1, conAvisos: 0, desde: '2026-07-22', hasta: '2026-07-23', tecnicos: ['JOR'] });
    expect(agruparPorSeca([servicio({ secaLibro: null, seca: null })])[0].clave).toBe('Sin SECA');
  });

  it('lista los técnicos reconocidos una sola vez', () => {
    expect(tecnicosDe(lista)).toEqual([{ value: 'Ortuño', label: 'Jorge Ortuño Ramirez' }]);
  });
});

describe('avisos del detalle', () => {
  it('ubica cada aviso en su sección y los ordena por nivel', () => {
    expect(seccionDeAviso({ seccion: 'ambiente', codigo: 'PATRON_SIN_VALORES' })).toBe('patrones');
    expect(seccionDeAviso({ seccion: 'ambiente', codigo: 'AMBIENTE_FUERA_DE_RANGO' })).toBe('ambiente');
    expect(seccionDeAviso({ seccion: 'acordado', codigo: 'SIN_PUNTOS_ACORDADOS' })).toBe('errores');
    expect(seccionDeAviso({ seccion: 'otra', codigo: 'X' })).toBe('servicio');
    expect(ordenarAvisos([{ nivel: 'info' }, { nivel: 'error' }, { nivel: 'aviso' }]).map(a => a.nivel)).toEqual(['error', 'aviso', 'info']);
  });
});

describe('cargas acordadas escritas o pegadas', () => {
  it('acepta coma decimal y separa por punto y coma, tabulador o salto de línea', () => {
    expect(leerCargas('5; 20\t50\n100 0,5', parseNumber)).toEqual({ cargas: [5, 20, 50, 100, 0.5], invalidas: [] });
    expect(leerCargas('10; abc; -2; 0', parseNumber)).toEqual({ cargas: [10], invalidas: ['abc', '-2', '0'] });
    expect(leerCargas('', parseNumber)).toEqual({ cargas: [], invalidas: [] });
  });
});
