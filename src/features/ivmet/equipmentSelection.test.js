import { describe, expect, it } from 'vitest';
import {
  canEnable,
  enableCandidates,
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

describe('habilitar balanzas del cliente en lote', () => {
  const ready = { estado_catalogo: 'READY', habilitado: false, activo: true, estado_configuracion: 'PENDING' };
  const plants = [
    { id: 'p2', legacy_codigo_planta: '0001-02', nombre: 'Centro logístico' },
    { id: 'p1', legacy_codigo_planta: '0001-01', nombre: 'Producción' },
  ];
  const items = [
    { ...ready, id: 'a', planta_id: 'p2', cod_metrica: '0001-02-001', marca: 'OHAUS' },
    { ...ready, id: 'b', planta_id: 'p1', cod_metrica: '0001-01-001', marca: 'METTLER TOLEDO' },
    { ...ready, id: 'c', planta_id: 'p1', cod_metrica: '0001-01-002', estado_configuracion: 'SUSPENDED' },
    { ...ready, id: 'd', planta_id: 'p1', cod_metrica: '0001-01-003', habilitado: true, estado_configuracion: 'READY' },
    { ...ready, id: 'e', planta_id: 'p1', cod_metrica: '0001-01-004', estado_catalogo: 'REQUIRES_REVIEW' },
    { ...ready, id: 'f', planta_id: 'p1', cod_metrica: '0001-01-005', activo: false },
  ];
  it('solo activas, validadas y sin habilitar', () => {
    expect(canEnable(ready)).toBe(true);
    expect(canEnable({ ...ready, estado_configuracion: 'SUSPENDED' })).toBe(true);
    expect(canEnable({ ...ready, habilitado: true })).toBe(false);
    expect(canEnable({ ...ready, estado_catalogo: 'REQUIRES_REVIEW' })).toBe(false);
    expect(canEnable({ ...ready, activo: false })).toBe(false);
  });
  it('agrupa las pendientes por planta y deja las suspendidas aparte', () => {
    const { groups, suspended } = enableCandidates(items, plants);
    expect(groups.map((g) => [g.code, g.name, g.equipment.map((e) => e.id)])).toEqual([
      ['0001-01', 'Producción', ['b']],
      ['0001-02', 'Centro logístico', ['a']],
    ]);
    expect(suspended.map((e) => e.id)).toEqual(['c']);
  });
  it('busca por código o marca sin distinguir mayúsculas', () => {
    expect(enableCandidates(items, plants, ' ohaus ').groups.flatMap((g) => g.equipment.map((e) => e.id))).toEqual(['a']);
    expect(enableCandidates(items, plants, '01-002').suspended.map((e) => e.id)).toEqual(['c']);
    expect(enableCandidates(items, [], 'sin coincidencias')).toEqual({ groups: [], suspended: [] });
    expect(enableCandidates([items[1]], []).groups[0]).toMatchObject({ code: '', name: 'Planta' });
  });
});
