import { describe, expect, it } from 'vitest';
import { periodoPlan, seleccionarProximos } from './proximosExport';

const eventos = [
  { id: '1', clase: 'PROXIMO', fecha: '2027-01-01', codMetrica: '001', cliente: 'A' },
  { id: '2', clase: 'PROXIMO', fecha: '2027-03-31', codMetrica: '002', cliente: 'B' },
  { id: '3', clase: 'PROXIMO', fecha: '2027-12-31', codMetrica: '003', situacion: 'DESCARTADO' },
  { id: '4', clase: 'SERVICIO', fecha: '2027-01-15' },
  { id: '5', clase: 'PROXIMO', fecha: '2026-12-31' },
  { id: '6', clase: 'PROXIMO', fecha: '2028-01-01' },
];
describe('selección del PDF del plan', () => {
  it('exporta el año completo y excluye realizados, descartados y otros años', () => {
    expect(seleccionarProximos(eventos, { anio: 2027 }).map(e => e.id)).toEqual(['1', '2']);
    expect(seleccionarProximos(eventos, { anio: 2027, incluirDescartados: true }).map(e => e.id)).toEqual(['1', '2', '3']);
  });
  it('permite un mes y varios meses, incluidos sus extremos', () => {
    expect(seleccionarProximos(eventos, { anio: 2027, desdeMes: 3, hastaMes: 3 }).map(e => e.id)).toEqual(['2']);
    expect(seleccionarProximos(eventos, { anio: 2027, desdeMes: 1, hastaMes: 3 }).map(e => e.id)).toEqual(['1', '2']);
    expect(seleccionarProximos(eventos, { anio: 2027, desdeMes: 5, hastaMes: 3 })).toEqual([]);
  });
  it('nombra el período y maneja la selección vacía', () => {
    expect(periodoPlan({ anio: 2027, desdeMes: 1, hastaMes: 12 })).toBe('Año 2027');
    expect(periodoPlan({ anio: 2027, desdeMes: 3, hastaMes: 3 })).toBe('Marzo 2027');
    expect(seleccionarProximos([], { anio: 2027 })).toEqual([]);
  });
});
