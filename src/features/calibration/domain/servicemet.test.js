import { describe, expect, it } from 'vitest';
import {
  compareAppVersions,
  currentVersion,
  splitLines,
  versionGroup,
  versionSituation,
  versionSteps,
} from './servicemet';

const version = (overrides = {}) => ({ version: '6.4.1+19', estado: 'REGISTRADA', validacionResultado: null, enUsoDesde: null, ...overrides });

describe('versiones de ServiceMET', () => {
  it('nombra lo que le falta a cada versión', () => {
    expect(versionSituation(version()).label).toBe('Por validar');
    expect(versionSituation(version({ validacionResultado: 'NO_CONFORME' })).label).toBe('Validación no conforme');
    expect(versionSituation(version({ estado: 'VALIDADA', validacionResultado: 'CONFORME' })).label).toBe('Por aprobar');
    expect(versionSituation(version({ estado: 'APROBADA' })).label).toBe('Aprobada');
    expect(versionSituation(version({ estado: 'EN_USO' })).tone).toBe('success');
    expect(versionSituation(version({ estado: 'RECHAZADA' })).tone).toBe('danger');
  });

  it('marca los pasos cumplidos y el rechazo', () => {
    const pasos = (overrides) => versionSteps(version(overrides)).map(step => (step.done ? 'si' : step.failed ? 'no' : '-'));
    expect(pasos({})).toEqual(['si', '-', '-', '-']);
    expect(pasos({ estado: 'VALIDADA', validacionResultado: 'CONFORME' })).toEqual(['si', 'si', '-', '-']);
    expect(pasos({ estado: 'EN_USO', validacionResultado: 'CONFORME' })).toEqual(['si', 'si', 'si', 'si']);
    expect(pasos({ estado: 'RECHAZADA', validacionResultado: 'NO_CONFORME' })).toEqual(['si', 'no', 'no', '-']);
    expect(versionGroup(version({ estado: 'VALIDADA' }))).toBe('PENDIENTE');
    expect(versionGroup(version({ estado: 'EN_USO' }))).toBe('APROBADA');
  });

  it('ordena por número con el build y elige la vigente por su puesta en uso', () => {
    expect(compareAppVersions('6.10.0+20', '6.9.9+30')).toBeGreaterThan(0);
    expect(compareAppVersions('6.4.1+19', '6.4.1+20')).toBeLessThan(0);
    const versiones = [
      version({ version: '6.4.1+19', estado: 'APROBADA' }),
      version({ version: '6.4.0+18', estado: 'EN_USO', enUsoDesde: '2026-10-21' }),
      version({ version: '6.3.5+17', estado: 'EN_USO', enUsoDesde: '2026-10-16' }),
    ];
    expect(currentVersion(versiones).version).toBe('6.4.0+18');
    expect(currentVersion([version()])).toBeNull();
  });

  it('separa las listas por línea y quita las viñetas', () => {
    expect(splitLines('- Uno\n\n• Dos  \r\n  Tres')).toEqual(['Uno', 'Dos', 'Tres']);
    expect(splitLines('')).toEqual([]);
  });
});
