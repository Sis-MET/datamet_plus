import { api } from '../../../shared/api/client';

export const ivmetApi = {
  getOverview: () => api.get('/ivmet/overview'),
  getClients: () => api.get('/ivmet/clients'),
  getPlans: () => api.get('/ivmet/plans'),
  getEquipmentReview: () => api.get('/ivmet/equipment-review'),
};
