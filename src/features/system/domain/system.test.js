import { describe, expect, it } from 'vitest';
import {
  boliviaDateTimeInput,
  changeGroup,
  changeSituation,
  changeSteps,
  compareVersions,
  failureGroup,
  groupByVersion,
  relativeTime,
  versionStatus,
} from './system';

const cambio = (overrides = {}) => ({
  version: '2.7.0', estado: 'REGISTRADO', validacionResultado: null, aprobadoPor: null, ...overrides,
});

describe('control de cambios', () => {
  it('marca los pasos cumplidos y los fallidos', () => {
    expect(changeSteps(cambio()).map(step => step.done)).toEqual([true, false, false, false]);
    expect(changeSteps(cambio({ validacionResultado: 'NO_CONFORME' }))[1].failed).toBe(true);
    const aprobado = changeSteps(cambio({ estado: 'APROBADO', validacionResultado: 'CONFORME', aprobadoPor: 'jefe' }));
    expect(aprobado.map(step => step.done)).toEqual([true, true, true, false]);
    expect(changeSteps(cambio({ estado: 'RECHAZADO', aprobadoPor: 'jefe' }))[2]).toMatchObject({ done: false, failed: true });
  });

  it('dice qué le falta a cada cambio', () => {
    expect(changeSituation(cambio()).label).toBe('Por validar');
    expect(changeSituation(cambio({ estado: 'VALIDADO' })).label).toBe('Por aprobar');
    expect(changeSituation(cambio({ estado: 'IMPLEMENTADO' }))).toEqual({ label: 'En uso sin aprobar', tone: 'warning' });
    expect(changeSituation(cambio({ estado: 'IMPLEMENTADO', aprobadoPor: 'jefe' })).tone).toBe('success');
    expect(changeGroup(cambio({ estado: 'IMPLEMENTADO' }))).toBe('PENDIENTE');
    expect(changeGroup(cambio({ estado: 'IMPLEMENTADO', aprobadoPor: 'jefe' }))).toBe('COMPLETO');
  });

  it('ordena las versiones por sus números y deja las que no tienen al final', () => {
    expect(compareVersions('2.10.0', '2.9.1')).toBeGreaterThan(0);
    const groups = groupByVersion([
      cambio({ version: '2.5.4' }), cambio({ version: null }), cambio({ version: '2.7.0' }), cambio({ version: '2.6.1' }),
    ]);
    expect(groups.map(group => group.version)).toEqual(['2.7.0', '2.6.1', '2.5.4', null]);
  });

  it('cuenta los cambios aprobados de la versión en uso', () => {
    const lista = [cambio(), cambio({ aprobadoPor: 'jefe' }), cambio({ estado: 'RECHAZADO', aprobadoPor: 'jefe' }), cambio({ version: '2.6.1' })];
    expect(versionStatus(lista, '2.7.0')).toEqual({ total: 2, aprobados: 1, pendientes: 1 });
  });
});

describe('registro de fallas', () => {
  it('agrupa abiertas y en curso', () => {
    expect(failureGroup({ estado: 'EN_CURSO' })).toBe('ABIERTAS');
    expect(failureGroup({ estado: 'CERRADA' })).toBe('CERRADA');
  });

  it('expresa cuándo ocurrió', () => {
    const now = new Date('2026-10-06T14:00:00Z');
    expect(relativeTime('2026-10-06T13:55:00Z', now)).toBe('hace 5 min');
    expect(relativeTime('2026-10-06T11:00:00Z', now)).toBe('hace 3 h');
    expect(relativeTime('2026-10-04T14:00:00Z', now)).toBe('hace 2 días');
  });

  it('usa la hora de Bolivia en el formulario', () => {
    expect(boliviaDateTimeInput(new Date('2026-10-06T12:30:00Z'))).toBe('2026-10-06T08:30');
  });
});
