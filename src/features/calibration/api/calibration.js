import { api } from '../../../shared/api/client';

const BASE = '/calibracion';

// Avisa a quien muestre contadores de alertas (barra lateral) que el plan cambió.
export const CALIBRATION_CHANGED_EVENT = 'rimmet:calibration-changed';
const notifyChange = (result) => {
  window.dispatchEvent(new Event(CALIBRATION_CHANGED_EVENT));
  return result;
};
const write = (promise) => promise.then(notifyChange);
const unwrap = (promise) => promise.then(response => response.data);

export const calibrationApi = {
  plan: (anio) => unwrap(api.get(`${BASE}/plan`, { anio })),
  alertSummary: () => unwrap(api.get(`${BASE}/alertas/resumen`)),
  personal: () => unwrap(api.get(`${BASE}/personal`)),
  preview: (body) => unwrap(api.post(`${BASE}/vista-previa`, body)),

  saveEquipo: (id, body) => write(api.put(`${BASE}/equipos/${id}`, body)),
  saveEquipos: (body) => write(api.put(`${BASE}/equipos`, body)),

  // Gestión de equipos (DATA_EQUIPOS_CAL) y sus certificados.
  equipoHistorial: (id) => unwrap(api.get(`${BASE}/equipos/${id}/historial`)),
  createEquipo: (body) => write(api.post(`${BASE}/equipos`, body)).then(response => response.data),
  updateEquipoDatos: (id, body) => write(api.put(`${BASE}/equipos/${id}/datos`, body)),
  setEquipoEstado: (id, body) => write(api.put(`${BASE}/equipos/${id}/estado`, body)),
  registrarCertificado: (id, body) => write(api.post(`${BASE}/equipos/${id}/certificados`, body)),
  corregirCertificado: (id, body) => write(api.put(`${BASE}/equipos/${id}/certificados/vigente`, body)),
  anularCertificado: (id, body) => write(api.post(`${BASE}/equipos/${id}/certificados/vigente/anular`, body)),

  createActividad: (body) => write(api.post(`${BASE}/actividades`, body)),
  updateActividad: (id, body) => write(api.put(`${BASE}/actividades/${id}`, body)),
  deleteActividad: (id) => write(api.delete(`${BASE}/actividades/${id}`)),

  saveEvento: (body) => write(api.put(`${BASE}/eventos`, body)),
  resetEvento: ({ serie, fechaProgramada }) => {
    const query = new URLSearchParams({ serie, fechaProgramada }).toString();
    return write(api.delete(`${BASE}/eventos?${query}`));
  },

  alertSettings: () => unwrap(api.get(`${BASE}/alertas/ajustes`)),
  saveAjustes: (body) => write(api.put(`${BASE}/alertas/ajustes`, body)),
  createContacto: (body) => unwrap(api.post(`${BASE}/alertas/contactos`, body)),
  updateContacto: (id, body) => unwrap(api.put(`${BASE}/alertas/contactos/${id}`, body)),
  deleteContacto: (id) => unwrap(api.delete(`${BASE}/alertas/contactos/${id}`)),
  sendTest: (email) => unwrap(api.post(`${BASE}/alertas/prueba`, { email })),
  runAlerts: () => unwrap(api.post(`${BASE}/alertas/ejecutar`, {})),
};
