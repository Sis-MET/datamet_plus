import { describe, expect, it } from 'vitest';
import {
  createGroupId,
  findLinkedTasks,
  hasTimeOverlap,
  isLinkedTask,
} from './taskLinks';

const day = new Date('2026-09-23T12:00:00');
const otherDay = new Date('2026-09-24T12:00:00');
const base = { tipoTarea: 'Visita', descripcion: 'Planta norte', cliente: 'ACME', fecha: day };

describe('taskLinks', () => {
  it('genera UUID v4 válidos', () => {
    expect(createGroupId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('con grupo vincula por grupo aunque el texto difiera', () => {
    const source = { ...base, rowId: 1, grupoId: 'g1' };
    expect(isLinkedTask({ ...base, descripcion: 'otra', grupoId: 'g1' }, source)).toBe(true);
    expect(isLinkedTask({ ...base, grupoId: 'g2' }, source)).toBe(false);
    expect(isLinkedTask({ ...base }, source)).toBe(false);
  });

  it('sin grupo vincula por texto solo filas antiguas', () => {
    const source = { ...base, rowId: 1 };
    expect(isLinkedTask({ ...base, cliente: ' acme ' }, source)).toBe(true);
    expect(isLinkedTask({ ...base, grupoId: 'g1' }, source)).toBe(false);
  });

  it('sin grupo no mezcla la misma actividad en otro horario', () => {
    const source = { ...base, rowId: 1, horaInicio: '08:30', horaFin: '12:00' };
    expect(isLinkedTask({ ...base, horaInicio: '08:30', horaFin: '12:00' }, source)).toBe(true);
    expect(isLinkedTask({ ...base, horaInicio: '14:00', horaFin: '18:00' }, source)).toBe(false);
  });

  it('busca las demás filas de la ficha en ese día', () => {
    const source = { ...base, rowId: 1, grupoId: 'g1' };
    const tasks = [
      source,
      { ...base, rowId: 2, grupoId: 'g1', Tecnico: 'VAN' },
      { ...base, rowId: 3, grupoId: 'g1', fecha: otherDay },
      { ...base, rowId: 4, grupoId: 'g2' },
    ];
    expect(findLinkedTasks(tasks, source, day).map(task => task.rowId)).toEqual([2]);
  });

  it('detecta choques de horario y respeta bordes contiguos', () => {
    const morning = { horaInicio: '08:30', horaFin: '12:00' };
    expect(hasTimeOverlap(morning, { horaInicio: '11:00', horaFin: '13:00' })).toBe(true);
    expect(hasTimeOverlap(morning, { horaInicio: '12:00', horaFin: '13:00' })).toBe(false);
    expect(hasTimeOverlap(morning, {})).toBe(true);
  });
});
