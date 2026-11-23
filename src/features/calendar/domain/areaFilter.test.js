import { describe, expect, it } from 'vitest';
import {
  filterResourcesByAreas,
  getAreaLabel,
  listAreas,
  parseSavedSelection,
  resolveAreaSelection,
  toSavedSelection,
  toggleAllAreas,
  toggleArea,
} from './areaFilter';
import { getPlantAddress, getTaskClientLabel } from './taskFormDomain';

const AREAS = ['Calibración', 'Comercial', 'Soporte Técnico', 'VEHÍCULOS'];

describe('resolveAreaSelection', () => {
  it('por defecto marca solo el área de la persona', () => {
    expect(resolveAreaSelection(null, AREAS, 'Calibración')).toEqual(['Calibración']);
  });

  it('reconoce el área sin importar tildes ni mayúsculas', () => {
    expect(resolveAreaSelection(null, AREAS, ' SOPORTE TECNICO ')).toEqual(['Soporte Técnico']);
  });

  it('quien no tiene un área visible ve todas', () => {
    expect(resolveAreaSelection(null, AREAS, 'Sistemas')).toEqual(AREAS);
    expect(resolveAreaSelection(null, AREAS, '')).toEqual(AREAS);
  });

  it('respeta lo guardado', () => {
    expect(resolveAreaSelection({ areas: ['Comercial', 'VEHÍCULOS'] }, AREAS, 'Calibración')).toEqual(['Comercial', 'VEHÍCULOS']);
    expect(resolveAreaSelection({ all: true }, AREAS, 'Calibración')).toEqual(AREAS);
  });

  it('«todas» incluye las áreas nuevas', () => {
    expect(resolveAreaSelection({ all: true }, [...AREAS, 'Logística'], 'Calibración')).toContain('Logística');
  });

  it('ignora áreas que ya no existen y, si no queda ninguna, usa la propia', () => {
    expect(resolveAreaSelection({ areas: ['Comercial', 'Antigua'] }, AREAS, 'Calibración')).toEqual(['Comercial']);
    expect(resolveAreaSelection({ areas: ['Antigua'] }, AREAS, 'Calibración')).toEqual(['Calibración']);
  });

  it('permite quedarse sin ninguna marcada mientras se elige', () => {
    expect(resolveAreaSelection({ areas: [] }, AREAS, 'Calibración')).toEqual([]);
  });
});

describe('casillas de áreas', () => {
  it('marca y desmarca un área', () => {
    expect(toggleArea(['Calibración'], 'Comercial')).toEqual(['Calibración', 'Comercial']);
    expect(toggleArea(['Calibración', 'Comercial'], 'Calibración')).toEqual(['Comercial']);
  });

  it('«Todas» marca todas las casillas, también con algunas marcadas', () => {
    expect(toggleAllAreas([], AREAS)).toEqual(AREAS);
    expect(toggleAllAreas(['Comercial'], AREAS)).toEqual(AREAS);
  });

  it('«Todas» las desmarca si ya estaban marcadas', () => {
    expect(toggleAllAreas(AREAS, AREAS)).toEqual([]);
  });

  it('guarda «todas» solo con todas marcadas', () => {
    expect(toSavedSelection(AREAS, AREAS)).toEqual({ all: true });
    expect(toSavedSelection(['Comercial'], AREAS)).toEqual({ areas: ['Comercial'] });
    expect(toSavedSelection([], AREAS)).toEqual({ areas: [] });
  });
});

describe('parseSavedSelection', () => {
  it('lee lo guardado', () => {
    expect(parseSavedSelection('{"all":true}')).toEqual({ all: true });
    expect(parseSavedSelection('{"areas":["Comercial"]}')).toEqual({ areas: ['Comercial'] });
  });

  it('un valor vacío o dañado cuenta como no guardado', () => {
    [null, '', 'no-json', '{"areas":[]}', '{"areas":[1]}', '[]'].forEach((valor) => {
      expect(parseSavedSelection(valor)).toBeNull();
    });
  });
});

describe('etiqueta y dirección de la planta', () => {
  const dir = 'AV. ELIAS MENESES S/N ZONA PIÑAMI - COCHABAMBA';

  it('suma el lugar de la planta al cliente', () => {
    expect(getTaskClientLabel({ cliente: 'EMBOL', plantaDir: dir })).toBe('EMBOL - COCHABAMBA');
    expect(getTaskClientLabel({ cliente: 'EMBOL', plantaDir: 'X', plantaLocalidad: 'Sacaba' })).toBe('EMBOL - Sacaba');
  });

  it('sin planta muestra solo el cliente', () => {
    expect(getTaskClientLabel({ cliente: 'EMBOL' })).toBe('EMBOL');
    expect(getTaskClientLabel({ plantaDir: dir })).toBe('');
  });

  it('un guion dentro de una palabra no es un lugar', () => {
    expect(getTaskClientLabel({ cliente: 'ACME', plantaDir: 'PARQUE INDUSTRIAL MANZANA 20-B' })).toBe('ACME');
  });

  it('conserva la dirección completa', () => {
    expect(getPlantAddress({ dir: `  ${dir.replace(' S/N', '  S/N')} ` })).toBe(dir);
    expect(getPlantAddress(null)).toBe('');
  });
});

describe('filterResourcesByAreas', () => {
  const recursos = [
    { id: 'a', area: 'Calibración' },
    { id: 'b', area: ' Comercial ' },
    { id: 'c', area: '' },
    { id: 'd', area: 'VEHÍCULOS' },
  ];

  it('lista las áreas sin repetir', () => {
    expect(listAreas([...recursos, { id: 'e', area: 'Comercial' }])).toEqual(['Calibración', 'Comercial', 'Sin Área', 'VEHÍCULOS']);
  });

  it('sin ninguna marcada no muestra recursos', () => {
    expect(filterResourcesByAreas(recursos, [])).toEqual([]);
  });

  it('muestra solo las áreas elegidas', () => {
    expect(filterResourcesByAreas(recursos, ['Calibración', 'Comercial']).map(r => r.id)).toEqual(['a', 'b']);
  });

  it('reconoce a quien no tiene área', () => {
    expect(getAreaLabel('  ')).toBe('Sin Área');
    expect(filterResourcesByAreas(recursos, ['Sin Área']).map(r => r.id)).toEqual(['c']);
  });
});
