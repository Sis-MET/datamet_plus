// Lectura del payload de un JWT. No valida la firma: eso es cosa del backend.
// Aquí solo se usa para saber a quién mostrar y si la sesión ya caducó.
//
// El payload viene en base64url, que no es base64: usa `-` y `_` en lugar de
// `+` y `/`, y omite el relleno `=`. Hay que traducirlo antes de `atob`, o los
// tokens que contengan esos caracteres no decodifican y la sesión parece
// inválida. Además el resultado de `atob` son bytes, no texto: sin decodificar
// UTF-8 los nombres con acentos salen corruptos.

const base64UrlToBase64 = (segment) => {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = base64.length % 4;
  return remainder === 0 ? base64 : base64.padEnd(base64.length + (4 - remainder), '=');
};

export function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null;

  const segment = token.split('.')[1];
  if (!segment) return null;

  try {
    const binary = globalThis.atob(base64UrlToBase64(segment));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}

/** Un token sin `exp` no caduca: se respeta el criterio que ya usaba la app. */
export function isJwtExpired(payload, now = Date.now()) {
  const exp = payload?.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return false;
  return now >= exp * 1000;
}
