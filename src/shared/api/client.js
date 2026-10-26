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
  return safeStorage.getItem('datamet_token');
}

function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const REQUEST_TIMEOUT_MS = 15000;

// El backend responde 401 con este código cuando el token venció o el usuario
// ya no está activo. La app escucha el evento y vuelve al inicio de sesión.
// Otras respuestas 401 (como el código de acceso de IvMET) no lo disparan.
const SESSION_INVALID_EVENT = 'datamet:session-invalid';

async function request(endpoint, { method = 'GET', body, params, headers = {}, retry = method === 'GET' ? 1 : 0, timeout = REQUEST_TIMEOUT_MS, responseType } = {}) {
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
  const isBinary = body instanceof Blob;

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeout);
  let res;

  try {
    res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': isBinary ? body.type || 'application/octet-stream' : 'application/json' }),
        ...getAuthHeaders(),
        ...headers,
      },
      ...(body ? { body: isFormData || isBinary ? body : JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (retry > 0 && method === 'GET') {
      return request(endpoint, { method, body, params, headers, retry: retry - 1, timeout, responseType });
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

  if (res.ok && responseType === 'blob') return res.blob();
  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    const text = await res.text();
    data = { message: text };
  }

  if (!res.ok) {
    if (res.status === 401 && data?.code === 'SESSION_INVALID') {
      globalThis.dispatchEvent?.(new CustomEvent(SESSION_INVALID_EVENT, { detail: { message: data.message } }));
    }
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
  blob: (endpoint, options) => request(endpoint, { ...options, responseType: 'blob' }),
  get: (endpoint, params, options) => request(endpoint, { params, ...options }),

  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body, ...options }),

  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body, ...options }),

  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options }),

  upload: (endpoint, formData, options) =>
    request(endpoint, { method: 'POST', body: formData, ...options }),
};

export { ApiError, parseToken, SESSION_INVALID_EVENT };
