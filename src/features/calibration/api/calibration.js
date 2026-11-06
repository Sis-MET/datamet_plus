import { api } from '../../../shared/api/client';
import { APP_VERSION } from '../../../shared/utils/appVersion';

const BASE = '/calibracion';

// Avisa a quien muestre contadores de alertas (barra lateral) que el plan cambió.
export const CALIBRATION_CHANGED_EVENT = 'datamet:calibration-changed';
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
  // Evaluación NB/ISO/IEC 17025 (7.5, 7.11 y 8.4) con los datos actuales.
  cumplimiento: () => unwrap(api.get(`${BASE}/cumplimiento`, { version: APP_VERSION })),

  // Versiones de ServiceMET: Sistemas las registra y valida; el jefe de Calibración las aprueba.
  servicemet: () => unwrap(api.get(`${BASE}/servicemet`)),
  servicemetVersion: (id) => unwrap(api.get(`${BASE}/servicemet/${id}`)),
  createServicemet: (body) => unwrap(api.post(`${BASE}/servicemet`, body)),
  updateServicemet: (id, body) => unwrap(api.put(`${BASE}/servicemet/${id}`, body)),
  validarServicemet: (id, body) => unwrap(api.post(`${BASE}/servicemet/${id}/validacion`, body)),
  decidirServicemet: (id, body) => unwrap(api.post(`${BASE}/servicemet/${id}/decision`, body)),
  ponerServicemetEnUso: (id, body) => unwrap(api.post(`${BASE}/servicemet/${id}/puesta-en-uso`, body)),

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
  revisarCertificado: (id, body) => write(api.post(`${BASE}/equipos/${id}/certificados/vigente/revision`, body)),
  // Patrón: tipo, clase, piezas y valores del certificado vigente (migración 016).
  patron: (id) => unwrap(api.get(`${BASE}/equipos/${id}/patron`)),
  savePatron: (id, body) => write(api.put(`${BASE}/equipos/${id}/patron`, body)).then(response => response.data),

  // Servicios de calibración que subió ServiceMET, con su modelo y avisos (fase 2).
  servicios: (params) => unwrap(api.get(`${BASE}/servicios`, params)),
  servicio: (codigo) => unwrap(api.get(`${BASE}/servicios/${encodeURIComponent(codigo)}`)),
  // Vista previa del cálculo con el motor (fase 3): no guarda nada.
  calculoServicio: (codigo) => unwrap(api.get(`${BASE}/servicios/${encodeURIComponent(codigo)}/calculo`)),
  // Registro de calibración de un servicio (fase 4, migración 018).
  registro: (codigo) => unwrap(api.get(`${BASE}/registros/${encodeURIComponent(codigo)}`)),
  guardarRegistro: (codigo, body) => write(api.put(`${BASE}/registros/${encodeURIComponent(codigo)}`, body)).then(response => response.data),
  enviarRegistro: (codigo) => write(api.post(`${BASE}/registros/${encodeURIComponent(codigo)}/envio`, {})),
  retirarRegistro: (codigo) => write(api.post(`${BASE}/registros/${encodeURIComponent(codigo)}/retiro`, {})),
  revisarRegistro: (codigo, body) => write(api.post(`${BASE}/registros/${encodeURIComponent(codigo)}/revision`, body)),
  reabrirRegistro: (codigo, body) => write(api.post(`${BASE}/registros/${encodeURIComponent(codigo)}/reapertura`, body)),
  // Puntos de ensayo acordados de un instrumento de cliente (migración 017).
  puntosAcordados: (codMetrica) => unwrap(api.get(`${BASE}/puntos-acordados/${encodeURIComponent(codMetrica)}`)),
  savePuntosAcordados: (codMetrica, body) => unwrap(api.put(`${BASE}/puntos-acordados/${encodeURIComponent(codMetrica)}`, body)),

  createActividad: (body) => write(api.post(`${BASE}/actividades`, body)),
  updateActividad: (id, body) => write(api.put(`${BASE}/actividades/${id}`, body)),
  deleteActividad: (id) => write(api.delete(`${BASE}/actividades/${id}`)),
  actividadHistorial: (id) => unwrap(api.get(`${BASE}/actividades/${id}/historial`)),

  saveEvento: (body) => write(api.put(`${BASE}/eventos`, body)),
  // Volver a la programación original deja la última versión en el historial.
  resetEvento: ({ serie, fechaProgramada, motivo }) => write(api.post(`${BASE}/eventos/restablecer`, { serie, fechaProgramada, motivo })),
  revisarEvento: ({ serie, fechaProgramada }) => write(api.post(`${BASE}/eventos/revision`, { serie, fechaProgramada })),
  eventoHistorial: ({ serie, fechaProgramada }) => unwrap(api.get(`${BASE}/eventos/historial`, { serie, fechaProgramada })),

  alertSettings: () => unwrap(api.get(`${BASE}/alertas/ajustes`)),
  saveAjustes: (body) => write(api.put(`${BASE}/alertas/ajustes`, body)),
  createContacto: (body) => unwrap(api.post(`${BASE}/alertas/contactos`, body)),
  updateContacto: (id, body) => unwrap(api.put(`${BASE}/alertas/contactos/${id}`, body)),
  deleteContacto: (id) => unwrap(api.delete(`${BASE}/alertas/contactos/${id}`)),
  sendTest: (email) => unwrap(api.post(`${BASE}/alertas/prueba`, { email })),
  runAlerts: () => unwrap(api.post(`${BASE}/alertas/ejecutar`, {})),
};
