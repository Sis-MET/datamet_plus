import { api } from '../../../shared/api/client';

export const rimApi = {
  getPlantas: (clienteId) => api.get(`/clientes/${clienteId}/plantas`),
};
