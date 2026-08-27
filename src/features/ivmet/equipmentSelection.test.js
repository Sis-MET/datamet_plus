import { describe, expect, it } from 'vitest';
import {
  groupEquipment,
  selectionState,
  selectEquipment,
} from './equipmentSelection';

const codes = ['0032-11-001', '0032-11-002', '0032-12-001'];
describe('selección de balanzas por planta', () => {
  it('agrupa únicamente las plantas seleccionadas sin mezclar equipos', () => {
    const catalog = {
      plants: [{ code: '0032-11' }, { code: '0032-12' }],
      equipment: codes.map((code) => ({ code })),
    };
    expect(groupEquipment(catalog, ['0032-12'])).toEqual([
      { code: '0032-12', equipment: [{ code: codes[2] }] },
    ]);
    expect(groupEquipment(catalog, [])).toEqual([]);
    expect(groupEquipment(null, [])).toEqual([]);
  });
  it('seleccionar todo no duplica y desmarcar una planta no afecta otra', () => {
    const selected = selectEquipment([codes[0]], codes, true);
    expect(selected).toEqual(codes);
    expect(selectEquipment(selected, codes.slice(0, 2), false)).toEqual([
      codes[2],
    ]);
  });
  it('conserva siempre los equipos previamente incorporados', () => {
    expect(selectEquipment(codes, codes, false, [codes[0]])).toEqual([
      codes[0],
    ]);
    expect(selectEquipment([], [codes[1]], true, [codes[0]])).toEqual([
      codes[0],
      codes[1],
    ]);
    expect(selectionState([codes[0]], [codes[0]], [codes[0]])).toMatchObject({
      checked: true,
      disabled: true,
    });
  });
  it('representa cero, parcial y completo; un grupo vacío no se puede marcar', () => {
    expect(selectionState([], [])).toMatchObject({
      checked: false,
      indeterminate: false,
      disabled: true,
    });
    expect(selectionState(codes, [])).toMatchObject({
      checked: false,
      indeterminate: false,
    });
    expect(selectionState(codes, [codes[0]])).toMatchObject({
      count: 1,
      total: 3,
      checked: false,
      indeterminate: true,
    });
    expect(selectionState(codes, codes)).toMatchObject({
      checked: true,
      indeterminate: false,
    });
  });
});
