import { resolveApiBase } from './apiBase';

export const API_BASE = resolveApiBase({
  apiUrl: import.meta.env.VITE_API_URL,
  apiPort: import.meta.env.VITE_API_PORT,
  location: window.location,
});

