import { api } from '../../../shared/api/client';

const unwrap = (promise) => promise.then(response => response.data);
const ruta = (tipo, codigo) => `/soporte/informes/${encodeURIComponent(tipo)}/${encodeURIComponent(codigo)}`;

export const soporteApi = {
  informes: (params) => unwrap(api.get('/soporte/informes', params)),
  // Lista agrupada: `por` es 'otst' o 'tecnico'.
  grupos: (params) => unwrap(api.get('/soporte/informes/grupos', params)),
  filtros: () => unwrap(api.get('/soporte/informes/filtros')),
  // Sugerencia de redacción con Google Gemini: { texto, modelo }.
  redaccion: (body) => unwrap(api.post('/soporte/redaccion', body, { timeout: 50000 })),
  informe: (tipo, codigo) => unwrap(api.get(ruta(tipo, codigo), undefined, { timeout: 30000 })),
  // Cada acción responde el informe actualizado.
  guardar: (tipo, codigo, body) => unwrap(api.post(`${ruta(tipo, codigo)}/cambios`, body, { timeout: 30000 })),
  emitir: (tipo, codigo, body) => unwrap(api.post(`${ruta(tipo, codigo)}/emision`, body, { timeout: 30000 })),
  agregarFoto: (tipo, codigo, body) => unwrap(api.post(`${ruta(tipo, codigo)}/fotos`, body, { timeout: 60000 })),
  editarFoto: (tipo, codigo, id, body) => unwrap(api.put(`${ruta(tipo, codigo)}/fotos/${id}`, body, { timeout: 30000 })),
  quitarFoto: (tipo, codigo, id, body) => unwrap(api.post(`${ruta(tipo, codigo)}/fotos/${id}/quitar`, body, { timeout: 30000 })),
  ordenarFotos: (tipo, codigo, body) => unwrap(api.post(`${ruta(tipo, codigo)}/fotos/orden`, body, { timeout: 30000 })),
};
