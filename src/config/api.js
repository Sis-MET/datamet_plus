// Si VITE_API_URL ya incluye puerto (ej: http://192.168.1.5:3000), se usa tal cual.
// Si no, se construye la URL con VITE_API_PORT (o 3000 por defecto).
const rawUrl = import.meta.env.VITE_API_URL;
let host;
if (rawUrl) {
  // Eliminar trailing slash si lo hubiera
  host = rawUrl.replace(/\/$/, '');
} else {
  const port = import.meta.env.VITE_API_PORT || 3000;
  host = `${window.location.protocol}//${window.location.hostname}:${port}`;
}
export const API_BASE = `${host}/api`;

