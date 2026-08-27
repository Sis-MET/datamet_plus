import { describe, it, expect } from 'vitest';
import {
  onboardingPending,
  workerAvailability,
  syncDescription,
  issueText,
} from './onboarding';

describe('seguimiento de incorporaciones', () => {
  it('una solicitud pendiente o parcial nunca se anuncia como cliente listo', () => {
    for (const syncStatus of [
      'QUEUED',
      'RUNNING',
      'PARTIAL',
      'FAILED',
      'RETRYING',
    ])
      expect(onboardingPending({ syncStatus })).toBe(true);
    expect(onboardingPending({ syncStatus: 'SUCCEEDED' })).toBe(false);
    expect(onboardingPending(null)).toBe(false);
  });
  it('el estado depende de un daemon reciente y compatible con el cliente', () => {
    expect(workerAvailability([])).toBe('OFFLINE');
    expect(workerAvailability([{ available: false, state: 'ONLINE' }])).toBe(
      'OFFLINE'
    );
    expect(
      workerAvailability(
        [{ available: true, state: 'ONLINE', scope_id: 'pilot' }],
        'new'
      )
    ).toBe('RESTRICTED');
    expect(
      workerAvailability(
        [{ available: true, state: 'ONLINE', scope_id: 'pilot' }],
        'pilot'
      )
    ).toBe('ONLINE');
    expect(
      workerAvailability([
        { available: true, state: 'DEGRADED', scope_id: null },
      ])
    ).toBe('DEGRADED');
    expect(
      workerAvailability([{ available: true, state: 'ONLINE', scope_id: null }])
    ).toBe('ONLINE');
  });
  it('explica reintentos sin presentar aprobación ni activar licencias', () => {
    expect(syncDescription({ syncStatus: 'QUEUED' })).toContain('guardada');
    expect(syncDescription({ syncStatus: 'SUCCEEDED' })).toContain(
      'no los activa'
    );
    expect(issueText('PLANT_AMBIGUOUS')).toContain('duplicados');
    expect(issueText('sql-password-secret')).not.toContain('secret');
  });
});
