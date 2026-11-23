import { describe, expect, it } from 'vitest';
import { getPlantDepartment } from './plantDepartment';

describe('getPlantDepartment', () => {
  it.each([
    ['0143-11', 'LPZ', 'La Paz'],
    ['0032-21', 'CBB', 'Cochabamba'],
    ['0060-31', 'SCZ', 'Santa Cruz'],
    ['0182-41', 'ORU', 'Oruro'],
    ['0150-51', 'PTS', 'Potosí'],
    ['0165-61', 'TJA', 'Tarija'],
    ['0027-71', 'PND', 'Pando'],
    ['0072-81', 'CHQ', 'Chuquisaca'],
    ['0509-91', 'BEN', 'Beni'],
  ])('%s es %s', (codigo, code, name) => {
    expect(getPlantDepartment(codigo)).toEqual({ code, name });
  });

  it('usa el primer dígito del sufijo aunque haya varias plantas', () => {
    expect(getPlantDepartment('0114-22').code).toBe('CBB');
    expect(getPlantDepartment(' 0058 - 32 ').code).toBe('SCZ');
  });

  it('sin un código con departamento no muestra ninguno', () => {
    expect(getPlantDepartment('0062-0')).toBeNull();
    expect(getPlantDepartment('Planta norte')).toBeNull();
    expect(getPlantDepartment('')).toBeNull();
    expect(getPlantDepartment(null)).toBeNull();
  });
});
