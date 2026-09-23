import { API_BASE } from '../../config/api';
import { safeStorage } from '../utils/storage';
import { decodeJwtPayload } from '../utils/jwt';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function getToken() {
  return safeStorage.getItem('rimmet_token');
}

function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const REQUEST_TIMEOUT_MS = 15000;

async function request(endpoint, { method = 'GET', body, params, headers = {}, retry = method === 'GET' ? 1 : 0 } = {}) {
  let url = `${API_BASE}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const isFormData = body instanceof FormData;

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;

  try {
    res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...getAuthHeaders(),
        ...headers,
      },
      ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (retry > 0 && method === 'GET') {
      return request(endpoint, { method, body, params, headers, retry: retry - 1 });
    }
    const isTimeout = error?.name === 'AbortError';
    throw new ApiError(
      isTimeout
        ? 'La solicitud tardó demasiado. Comprueba la conexión e inténtalo de nuevo.'
        : 'No se pudo conectar con el servidor. Comprueba tu red e inténtalo de nuevo.',
      0,
      { cause: isTimeout ? 'timeout' : 'network' }
    );
  } finally {
    globalThis.clearTimeout(timeoutId);
  }

  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    const text = await res.text();
    data = { message: text };
  }

  if (!res.ok) {
    throw new ApiError(
      data.message || data.error || `Error ${res.status}`,
      res.status,
      data
    );
  }

  return data;
}

function parseToken() {
  return decodeJwtPayload(getToken());
}

export const api = {
  get: (endpoint, params, options) => request(endpoint, { params, ...options }),

  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body, ...options }),

  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body, ...options }),

  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options }),

  upload: (endpoint, formData, options) =>
    request(endpoint, { method: 'POST', body: formData, ...options }),
};

export { ApiError, parseToken };
