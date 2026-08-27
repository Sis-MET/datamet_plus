import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeStorage } from '../../../shared/utils/storage';
import { ivmetAccessSession } from '../accessSession';
import { ivmetApi } from './ivmet';

vi.mock('../../../config/api', () => ({
  API_BASE: 'http://fixture.invalid/api',
}));

afterEach(() => {
  ivmetAccessSession.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('contrato HTTP del acceso al gestor', () => {
  it('el código solo viaja por POST; las consultas y acciones llevan el pase en un header', async () => {
    vi.spyOn(safeStorage, 'getItem').mockReturnValue('test-login');
    const grant = {
      ticket: 'test-access-ticket',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        Response.json({ success: true, data: grant }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await ivmetApi.accessStatus();
    expect(
      fetchMock.mock.calls[0][1].headers['X-Ivmet-Access'],
    ).toBeUndefined();
    const result = await ivmetApi.unlock('fixture-only-code');
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/ivmet\/access\/unlock$/);
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      code: 'fixture-only-code',
    });
    expect(fetchMock.mock.calls[1][0]).not.toContain('fixture-only-code');
    ivmetAccessSession.accept(result, 'test-login');
    await ivmetApi.read('clients', { page: 2 });
    await ivmetApi.mutate('plan.save', { name: 'Test' }, 'request-id');
    for (const [, options] of fetchMock.mock.calls.slice(2)) {
      expect(options.headers['X-Ivmet-Access']).toBe(grant.ticket);
      expect(options.headers.Authorization).toBe('Bearer test-login');
    }
  });
  it('un código incorrecto no se reintenta automáticamente', async () => {
    vi.spyOn(safeStorage, 'getItem').mockReturnValue('test-login');
    const fetchMock = vi.fn().mockImplementation(async () =>
      Response.json(
        {
          code: 'IVMET_ACCESS_INVALID_CODE',
          message: 'Código incorrecto',
        },
        { status: 403 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(ivmetApi.unlock('wrong')).rejects.toMatchObject({
      status: 403,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('un permiso revocado limpia el pase tras rechazar una consulta', async () => {
    vi.spyOn(safeStorage, 'getItem').mockReturnValue('test-login');
    ivmetAccessSession.accept(
      { ticket: 'test', expiresAt: new Date(Date.now() + 60000).toISOString() },
      'test-login',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () =>
        Response.json(
          {
            code: 'IVMET_ACCESS_DENIED',
            message: 'Acceso revocado',
          },
          { status: 403 },
        ),
      ),
    );
    await expect(ivmetApi.read('clients')).rejects.toMatchObject({
      status: 403,
    });
    expect(ivmetAccessSession.getSnapshot().ticket).toBeNull();
  });
});
