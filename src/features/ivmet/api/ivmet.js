import { api } from '../../../shared/api/client';
import { ivmetAccessSession } from '../accessSession';

export const ivmetApi = {
  operate: (action, payload, requestId) => api.post(`/ivmet/ops/actions/${action}`, { payload, requestId },
    { headers: ivmetAccessSession.headers() }).then((response) => response.data).catch(ivmetAccessSession.handleError),
  read: (path, params) =>
    api
      .get(`/ivmet/${path}`, params, { headers: ivmetAccessSession.headers() })
      .then((response) => response.data)
      .catch(ivmetAccessSession.handleError),
  mutate: (action, payload, requestId) =>
    api
      .post(
        `/ivmet/actions/${action}`,
        { payload, requestId },
        { headers: ivmetAccessSession.headers() },
      )
      .then((response) => response.data)
      .catch(ivmetAccessSession.handleError),
  accessStatus: () =>
    api
      .get('/ivmet/access', undefined, {
        headers: ivmetAccessSession.headers(),
      })
      .then((response) => response.data),
  unlock: (code) =>
    api
      .post('/ivmet/access/unlock', { code })
      .then((response) => response.data),
};
