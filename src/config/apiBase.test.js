import { describe, expect, it } from 'vitest';
import { resolveApiBase } from './apiBase';

describe('origen de la API detrás de HTTPS y en la red local', () => {
  it.each([
    ['https://datamet.lenash.dev', 'https://datamet.lenash.dev/api'],
    ['http://192.168.1.5:3000', 'http://192.168.1.5:3000/api'],
    ['http://servidor-metrica:3000', 'http://servidor-metrica:3000/api'],
    ['http://localhost:4173', 'http://localhost:4173/api'],
  ])('conserva el origen real %s cuando no se configura una API aparte', (url, expected) => {
    expect(resolveApiBase({ location: new URL(url) })).toBe(expected);
  });

  it('las variables vacías permiten usar HTTPS sin añadir el puerto 3000', () => {
    expect(resolveApiBase({ location: new URL('https://datamet.lenash.dev'), apiUrl: ' ', apiPort: '' }))
      .toBe('https://datamet.lenash.dev/api');
  });

  it('conserva la configuración explícita de una API separada', () => {
    const location = new URL('http://localhost:3000');
    expect(resolveApiBase({ location, apiUrl: ' http://localhost:5000/ ', apiPort: 3000 })).toBe('http://localhost:5000/api');
    expect(resolveApiBase({ location, apiPort: 5000 })).toBe('http://localhost:5000/api');
  });
});
