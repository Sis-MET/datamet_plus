import { API_BASE } from '../../config/api';
import { safeStorage } from '../utils/storage';

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

async function request(endpoint, { method = 'GET', body, params, headers = {} } = {}) {
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

  const res = await fetch(url, {
    method,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...getAuthHeaders(),
      ...headers,
    },
    ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
  });

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
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export const api = {
  get: (endpoint, params) => request(endpoint, { params }),

  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body, ...options }),

  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body, ...options }),

  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options }),

  upload: (endpoint, formData, options) =>
    request(endpoint, { method: 'POST', body: formData, ...options }),
};

export { ApiError, parseToken };
