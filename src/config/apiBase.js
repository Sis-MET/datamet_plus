/**
 * Por omisión, frontend y API comparten origen: funciona por HTTP en el
 * puerto 3000 y detrás de un proxy HTTPS en el 443. Los despliegues con una
 * API separada pueden conservar VITE_API_URL o VITE_API_PORT.
 */
export function resolveApiBase({ apiUrl, apiPort, location }) {
  const configuredUrl = String(apiUrl || '').trim().replace(/\/+$/, '');
  if (configuredUrl) return `${configuredUrl}/api`;

  const port = String(apiPort || '').trim();
  const origin = port ? `${location.protocol}//${location.hostname}:${port}` : location.origin;
  return `${origin}/api`;
}
