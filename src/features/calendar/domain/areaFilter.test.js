import { describe, expect, it } from 'vitest';
import { filterResourcesByAreas, getAreaLabel, toggleAreaSelection } from './areaFilter';
import { getPlantAddress, getTaskClientLabel } from './taskFormDomain';

const AREAS = ['Calibración', 'Comercial', 'Soporte Técnico', 'VEHÍCULOS'];

describe('toggleAreaSelection', () => {
  it('al empezar a filtrar por personal suma los vehículos', () => {
    expect(toggleAreaSelection([], 'Calibración', AREAS)).toEqual(['VEHÍCULOS', 'Calibración']);
  });

  it('permite ver solo los vehículos', () => {
    expect(toggleAreaSelection([], 'VEHÍCULOS', AREAS)).toEqual(['VEHÍCULOS']);
  });

  it('acumula varias áreas', () => {
    const una = toggleAreaSelection([], 'Calibración', AREAS);
    expect(toggleAreaSelection(una, 'Comercial', AREAS)).toEqual(['VEHÍCULOS', 'Calibración', 'Comercial']);
  });

  it('respeta que se hayan quitado los vehículos', () => {
    const sinVehiculos = toggleAreaSelection(['VEHÍCULOS', 'Calibración'], 'VEHÍCULOS', AREAS);
    expect(sinVehiculos).toEqual(['Calibración']);
    expect(toggleAreaSelection(sinVehiculos, 'Comercial', AREAS)).toEqual(['Calibración', 'Comercial']);
  });

  it('vuelve a Todas al quitar la última área de personal', () => {
    expect(toggleAreaSelection(['VEHÍCULOS', 'Calibración'], 'Calibración', AREAS)).toEqual([]);
    expect(toggleAreaSelection(['Calibración'], 'Calibración', AREAS)).toEqual([]);
  });

  it('vuelve a Todas al marcar todas las áreas', () => {
    expect(toggleAreaSelection(['VEHÍCULOS', 'Calibración', 'Comercial'], 'Soporte Técnico', AREAS)).toEqual([]);
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

  it('sin selección muestra todos', () => {
    expect(filterResourcesByAreas(recursos, [])).toBe(recursos);
  });

  it('muestra solo las áreas elegidas', () => {
    expect(filterResourcesByAreas(recursos, ['Calibración', 'Comercial']).map(r => r.id)).toEqual(['a', 'b']);
  });

  it('reconoce a quien no tiene área', () => {
    expect(getAreaLabel('  ')).toBe('Sin Área');
    expect(filterResourcesByAreas(recursos, ['Sin Área']).map(r => r.id)).toEqual(['c']);
  });
});
