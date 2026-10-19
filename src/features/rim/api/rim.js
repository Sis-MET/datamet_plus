import { api } from '../../../shared/api/client';

const unwrap = (promise) => promise.then(response => response.data);

export const rimApi = {
  getPlantas: (clienteId) => api.get(`/clientes/${clienteId}/plantas`),

  // Registros RIM (base servicios_extras de ServiceMET).
  registros: (params) => unwrap(api.get('/rim/registros', params)),
  filtros: () => unwrap(api.get('/rim/registros/filtros')),
  registro: (n) => unwrap(api.get(`/rim/registros/${n}`)),
  anular: (n, body) => unwrap(api.post(`/rim/registros/${n}/anulacion`, body)),
  // Ejecución y entrega: cada envío agrega una versión; responden la ficha.
  ejecucion: (n, body) => unwrap(api.post(`/rim/registros/${n}/ejecucion`, body)),
  entrega: (n, body) => unwrap(api.post(`/rim/registros/${n}/entrega`, body, { timeout: 60000 })),
  // Personal activo, para sugerir nombres (el mismo del Cronograma).
  personal: () => unwrap(api.get('/calendar/tecnicos')),
  // Firmas y fotos: la subida puede tardar más que una consulta.
  registrar: (body) => unwrap(api.post('/rim/registros', body, { timeout: 60000 })),

  talonarios: (gestion) => unwrap(api.get('/rim/talonarios', { gestion })),
  cerrarTalonario: (id, body) => unwrap(api.post(`/rim/talonarios/${id}/cierre`, body)),
};
