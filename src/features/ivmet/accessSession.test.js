import { describe, expect, it, vi } from 'vitest';
import { createAccessSession } from './accessSession';

const start = Date.UTC(2026, 7, 27, 12);
const grant = {
  ticket: 'test-pass',
  expiresAt: new Date(start + 60000).toISOString(),
};

describe('pase temporal IvMET, solo en memoria', () => {
  it('empieza bloqueado; notifica el desbloqueo y el cierre sin persistirlo', () => {
    const session = createAccessSession(
      () => 'login',
      () => start,
    );
    const onChange = vi.fn();
    const stop = session.subscribe(onChange);
    expect(session.headers()).toEqual({});
    expect(session.accept(grant, 'login')).toBe(true);
    expect(session.headers()).toEqual({ 'X-Ivmet-Access': grant.ticket });
    expect(onChange).toHaveBeenCalledTimes(1);
    session.clear();
    session.clear();
    expect(session.getSnapshot().ticket).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
    session.accept(grant, 'login');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(
      createAccessSession(
        () => 'login',
        () => start,
      ).getSnapshot().ticket,
    ).toBeNull();
  });
  it('descarta una respuesta tardía de otra sesión y respuestas incompletas', () => {
    const session = createAccessSession(
      () => 'current-login',
      () => start,
    );
    expect(session.accept(grant, 'old-login')).toBe(false);
    for (const result of [
      null,
      {},
      { ...grant, ticket: '' },
      { ...grant, expiresAt: 'invalid' },
      { ...grant, expiresAt: new Date(start).toISOString() },
    ]) {
      expect(session.accept(result, 'current-login')).toBe(false);
    }
    expect(session.getSnapshot().ticket).toBeNull();
  });
  it('vencimiento o cambio de login borra el pase antes de la siguiente consulta', () => {
    let time = start;
    let auth = 'login';
    const session = createAccessSession(
      () => auth,
      () => time,
    );
    session.accept(grant, auth);
    time += 60000;
    expect(session.headers()).toEqual({});
    expect(session.getSnapshot().ticket).toBeNull();
    time = start;
    session.accept(grant, auth);
    auth = 'new-login';
    expect(session.headers()).toEqual({});
    expect(session.getSnapshot().ticket).toBeNull();
  });
  it('rechazo del servidor retira el pase, pero un error de negocio no lo retira', () => {
    const session = createAccessSession(
      () => 'login',
      () => start,
    );
    for (const error of [
      { status: 401 },
      { status: 403, data: { code: 'IVMET_ACCESS_CODE_REQUIRED' } },
      { status: 403, data: { code: 'IVMET_ACCESS_DENIED' } },
    ]) {
      session.accept(grant, 'login');
      expect(() => session.handleError(error)).toThrow();
      expect(session.getSnapshot().ticket).toBeNull();
    }
    session.accept(grant, 'login');
    expect(() => session.handleError(new Error('Importe inválido'))).toThrow(
      'Importe inválido',
    );
    expect(session.getSnapshot().ticket).toBe(grant.ticket);
  });
});
