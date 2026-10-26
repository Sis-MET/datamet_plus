import { afterEach, expect, test, vi } from 'vitest';
import { api, SESSION_INVALID_EVENT } from './client';

vi.mock('../../config/api', () => ({ API_BASE: 'http://servidor:3000/api' }));

afterEach(() => vi.unstubAllGlobals());

test('envía un PDF binario con autenticación y devuelve el registro JSON', async () => {
  vi.stubGlobal('window', { location: { protocol: 'http:', hostname: 'servidor', origin: 'http://servidor:3000' }, localStorage: { getItem: () => 'token-prueba' } });
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: 'archivo' } }), { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  const blob = new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' });
  const result = await api.post('/soporte/documentos', blob, { params: { carpeta: 'Cliente A/2026', nombre: 'Informe.pdf' } });
  expect(result.data.id).toBe('archivo');
  expect(fetch.mock.calls[0][1].body).toBe(blob);
  expect(fetch.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer token-prueba', 'Content-Type': 'application/pdf' });
  expect(fetch.mock.calls[0][0]).toContain('carpeta=Cliente+A%2F2026');
});

test('recibe PDF como blob y mantiene los errores JSON de acceso o archivo ausente', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('%PDF-1.4\n%%EOF', { headers: { 'Content-Type': 'application/pdf' } })));
  expect((await api.blob('/pdf')).type).toBe('application/pdf');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'El archivo ya no existe.' }), { status: 404, headers: { 'Content-Type': 'application/json' } })));
  await expect(api.blob('/pdf')).rejects.toMatchObject({ status: 404, message: 'El archivo ya no existe.' });
});

const respuesta401 = body => new Response(JSON.stringify(body), { status: 401, headers: { 'Content-Type': 'application/json' } });

test('avisa a la app cuando el servidor invalida la sesión', async () => {
  const dispatchEvent = vi.fn();
  vi.stubGlobal('dispatchEvent', dispatchEvent);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta401({ code: 'SESSION_INVALID', message: 'Tu usuario ya no está activo.' })));
  await expect(api.get('/rim/registros')).rejects.toMatchObject({ status: 401 });
  expect(dispatchEvent).toHaveBeenCalledTimes(1);
  const [evento] = dispatchEvent.mock.calls[0];
  expect(evento.type).toBe(SESSION_INVALID_EVENT);
  expect(evento.detail.message).toBe('Tu usuario ya no está activo.');
});

test('otros 401 (credenciales, código de IvMET) no cierran la sesión', async () => {
  const dispatchEvent = vi.fn();
  vi.stubGlobal('dispatchEvent', dispatchEvent);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta401({ message: 'Credenciales inválidas' })));
  await expect(api.post('/auth/login', { usuario: 'a', pass: 'b' })).rejects.toMatchObject({ status: 401 });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta401({ code: 'IVMET_ACCESS_SESSION_EXPIRED', message: 'Tu sesión ha vencido.' })));
  await expect(api.get('/ivmet/overview')).rejects.toMatchObject({ status: 401 });
  expect(dispatchEvent).not.toHaveBeenCalled();
});
