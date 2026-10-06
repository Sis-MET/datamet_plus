import { describe, expect, it } from 'vitest';
import { complianceSentence, filterClausulas, groupActions } from './compliance';

const clausulas = [
  { id: '7.5', requisitos: [{ id: 'a', estado: 'CUMPLE' }, { id: 'b', estado: 'NO_CUMPLE' }] },
  { id: '8.4', requisitos: [{ id: 'c', estado: 'CUMPLE' }] },
];

describe('cumplimiento NB/ISO/IEC 17025', () => {
  it('resume la evaluación en una frase', () => {
    expect(complianceSentence({ CUMPLE: 6, PARCIAL: 12, NO_CUMPLE: 2, LABORATORIO: 3, total: 23 }))
      .toBe('De 23 requisitos, 6 se cumplen, 12 en parte y 2 no. Otros 3 dependen de evidencia del laboratorio.');
    expect(complianceSentence({ CUMPLE: 1, PARCIAL: 0, NO_CUMPLE: 0, LABORATORIO: 1, total: 2 }))
      .toBe('De 2 requisitos, 1 se cumple. Otro depende de evidencia del laboratorio.');
    expect(complianceSentence({ LABORATORIO: 2, total: 2 }))
      .toBe('De 2 requisitos, los 2 dependen de evidencia del laboratorio.');
    expect(complianceSentence({ CUMPLE: 4, total: 4 })).toBe('De 4 requisitos, 4 se cumplen.');
    expect(complianceSentence(null)).toBe('No hay requisitos evaluados.');
  });

  it('filtra por estado y quita las cláusulas que quedan vacías', () => {
    expect(filterClausulas(clausulas, new Set())).toBe(clausulas);
    const soloNo = filterClausulas(clausulas, new Set(['NO_CUMPLE']));
    expect(soloNo.map(clausula => clausula.id)).toEqual(['7.5']);
    expect(soloNo[0].requisitos.map(requisito => requisito.id)).toEqual(['b']);
  });

  it('agrupa el plan de acción de prioridad alta a baja', () => {
    const groups = groupActions([
      { id: 'x', prioridad: 'BAJA' },
      { id: 'y', prioridad: 'ALTA' },
      { id: 'z', prioridad: 'ALTA' },
    ]);
    expect(groups.map(group => group.prioridad)).toEqual(['ALTA', 'BAJA']);
    expect(groups[0].items.map(item => item.id)).toEqual(['y', 'z']);
    expect(groupActions(undefined)).toEqual([]);
  });
});
