import { api } from '../../../shared/api/client';

const unwrap = (promise) => promise.then(response => response.data);
const ruta = (tipo, codigo) => `/soporte/informes/${encodeURIComponent(tipo)}/${encodeURIComponent(codigo)}`;

// Avisa a quien muestre el contador de próximos servicios (barra lateral,
// pestañas) que algo cambió: un seguimiento, los avisos o la fecha de un informe.
export const SOPORTE_CHANGED_EVENT = 'rimmet:soporte-changed';
const avisar = (result) => {
  window.dispatchEvent(new Event(SOPORTE_CHANGED_EVENT));
  return result;
};

export const soporteApi = {
  informes: (params) => unwrap(api.get('/soporte/informes', params)),
  // Lista agrupada: `por` es 'otst' o 'tecnico'.
  grupos: (params) => unwrap(api.get('/soporte/informes/grupos', params)),
  filtros: () => unwrap(api.get('/soporte/informes/filtros')),
  // Sugerencia de redacción con Google Gemini: { texto, modelo }.
  redaccion: (body) => unwrap(api.post('/soporte/redaccion', body, { timeout: 50000 })),
  informe: (tipo, codigo) => unwrap(api.get(ruta(tipo, codigo), undefined, { timeout: 30000 })),
  // Cada acción responde el informe actualizado.
  guardar: (tipo, codigo, body) => unwrap(api.post(`${ruta(tipo, codigo)}/cambios`, body, { timeout: 30000 })).then(avisar),
  emitir: (tipo, codigo, body) => unwrap(api.post(`${ruta(tipo, codigo)}/emision`, body, { timeout: 30000 })),
  // Reemisión: abrir una revisión (con motivo), reemitirla o cancelarla.
  abrirRevision: (tipo, codigo, body) => unwrap(api.post(`${ruta(tipo, codigo)}/revision`, body, { timeout: 30000 })),
  reemitir: (tipo, codigo, body) => unwrap(api.post(`${ruta(tipo, codigo)}/reemision`, body, { timeout: 30000 })).then(avisar),
  cancelarRevision: (tipo, codigo, body) => unwrap(api.post(`${ruta(tipo, codigo)}/revision/cancelar`, body, { timeout: 30000 })).then(avisar),
  // Copia de una revisión emitida, para imprimirla tal como se entregó.
  revision: (tipo, codigo, revision) => unwrap(api.get(`${ruta(tipo, codigo)}/revisiones/${revision}`, undefined, { timeout: 30000 })),
  agregarFoto: (tipo, codigo, body) => unwrap(api.post(`${ruta(tipo, codigo)}/fotos`, body, { timeout: 60000 })),
  editarFoto: (tipo, codigo, id, body) => unwrap(api.put(`${ruta(tipo, codigo)}/fotos/${id}`, body, { timeout: 30000 })),
  quitarFoto: (tipo, codigo, id, body) => unwrap(api.post(`${ruta(tipo, codigo)}/fotos/${id}/quitar`, body, { timeout: 30000 })),
  ordenarFotos: (tipo, codigo, body) => unwrap(api.post(`${ruta(tipo, codigo)}/fotos/orden`, body, { timeout: 30000 })),

  // Próximos servicios: el año de la línea de tiempo, el resumen del
  // contador y la ficha de un equipo (Código Métrica).
  proximos: (anio) => unwrap(api.get('/soporte/proximos', { anio }, { timeout: 30000 })),
  proximosResumen: () => unwrap(api.get('/soporte/proximos/resumen', undefined, { timeout: 30000 })),
  equipo: (codMetrica) => unwrap(api.get(`/soporte/proximos/equipos/${encodeURIComponent(codMetrica)}`, undefined, { timeout: 30000 })),
  // Responde la ficha del equipo actualizada.
  seguimiento: (body) => unwrap(api.post('/soporte/proximos/seguimiento', body, { timeout: 30000 })).then(avisar),

  // Avisos por correo.
  avisos: () => unwrap(api.get('/soporte/avisos')),
  personal: () => unwrap(api.get('/soporte/avisos/personal')),
  guardarAjustes: (body) => unwrap(api.put('/soporte/avisos/ajustes', body)).then(avisar),
  crearContacto: (body) => unwrap(api.post('/soporte/avisos/contactos', body)),
  editarContacto: (id, body) => unwrap(api.put(`/soporte/avisos/contactos/${id}`, body)),
  quitarContacto: (id) => unwrap(api.delete(`/soporte/avisos/contactos/${id}`)),
  probarCorreo: (email) => unwrap(api.post('/soporte/avisos/prueba', { email }, { timeout: 30000 })),
  enviarAvisos: () => unwrap(api.post('/soporte/avisos/ejecutar', {}, { timeout: 120000 })),
};
