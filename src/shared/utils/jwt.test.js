import { describe, expect, it } from 'vitest';
import { decodeJwtPayload, isJwtExpired } from './jwt';

/** Firma un payload como lo haría un emisor real: base64url y sin relleno. */
const makeToken = (payload) => {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const binary = String.fromCharCode(...bytes);
  const base64url = globalThis.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${base64url}.signature`;
};

describe('decodeJwtPayload', () => {
  it('lee un payload simple', () => {
    expect(decodeJwtPayload(makeToken({ sub: '42', usuario: 'jfarfan' })))
      .toEqual({ sub: '42', usuario: 'jfarfan' });
  });

  it('decodifica payloads con varios caracteres propios de base64url', () => {
    // Este payload produce varios `-` y `_` al codificar: es el caso que
    // rompía la sesión cuando solo se sustituía el primero.
    const payload = { sub: 'a~b~c', data: '~~~???~~~???~~~', nombre: 'Jhonatan' };
    const token = makeToken(payload);
    const segment = token.split('.')[1];

    expect(segment).toMatch(/-/);
    expect((segment.match(/_/g) || []).length).toBeGreaterThan(1);
    expect(decodeJwtPayload(token)).toEqual(payload);
  });

  it('conserva los acentos y la eñe', () => {
    const payload = { nombre: 'José Muñoz', area: 'CALIBRACIÓN' };
    expect(decodeJwtPayload(makeToken(payload))).toEqual(payload);
  });

  it('acepta payloads sin relleno de cualquier longitud', () => {
    for (const size of [1, 2, 3, 4, 5, 6, 7]) {
      const payload = { p: 'x'.repeat(size) };
      expect(decodeJwtPayload(makeToken(payload))).toEqual(payload);
    }
  });

  it('devuelve null ante entradas que no son un token usable', () => {
    expect(decodeJwtPayload(null)).toBeNull();
    expect(decodeJwtPayload('')).toBeNull();
    expect(decodeJwtPayload('sin-puntos')).toBeNull();
    expect(decodeJwtPayload('header..firma')).toBeNull();
    expect(decodeJwtPayload('header.no-es-base64-valido!!.firma')).toBeNull();
    expect(decodeJwtPayload(makeToken([1, 2, 3]))).toBeNull();
  });
});

describe('isJwtExpired', () => {
  const now = 1_700_000_000_000;

  it('caduca cuando exp ya pasó', () => {
    expect(isJwtExpired({ exp: now / 1000 - 1 }, now)).toBe(true);
    expect(isJwtExpired({ exp: now / 1000 }, now)).toBe(true);
  });

  it('sigue vigente mientras exp es futuro', () => {
    expect(isJwtExpired({ exp: now / 1000 + 60 }, now)).toBe(false);
  });

  it('un token sin exp no caduca', () => {
    expect(isJwtExpired({}, now)).toBe(false);
    expect(isJwtExpired({ exp: 'mañana' }, now)).toBe(false);
    expect(isJwtExpired(null, now)).toBe(false);
  });
});
