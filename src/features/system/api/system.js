import { api } from '../../../shared/api/client';

const BASE = '/sistema';

// Avisa a la barra lateral que cambió el número de fallas abiertas.
export const FAILURES_CHANGED_EVENT = 'datamet:failures-changed';
const notifyFailures = (result) => {
  window.dispatchEvent(new Event(FAILURES_CHANGED_EVENT));
  return result;
};
const unwrap = (promise) => promise.then(response => response.data);

export const systemApi = {
  cambios: () => unwrap(api.get(`${BASE}/cambios`)),
  cambio: (id) => unwrap(api.get(`${BASE}/cambios/${id}`)),
  createCambio: (body) => unwrap(api.post(`${BASE}/cambios`, body)),
  updateCambio: (id, body) => unwrap(api.put(`${BASE}/cambios/${id}`, body)),
  validarCambio: (id, body) => unwrap(api.post(`${BASE}/cambios/${id}/validacion`, body)),
  aprobarCambio: (id, body) => unwrap(api.post(`${BASE}/cambios/${id}/aprobacion`, body)),
  implementarCambio: (id, body) => unwrap(api.post(`${BASE}/cambios/${id}/implementacion`, body)),

  fallas: () => unwrap(api.get(`${BASE}/fallas`)),
  resumenFallas: () => unwrap(api.get(`${BASE}/fallas/resumen`)),
  falla: (id) => unwrap(api.get(`${BASE}/fallas/${id}`)),
  createFalla: (body) => unwrap(api.post(`${BASE}/fallas`, body)).then(notifyFailures),
  atenderFalla: (id, body) => unwrap(api.put(`${BASE}/fallas/${id}`, body)).then(notifyFailures),
};
