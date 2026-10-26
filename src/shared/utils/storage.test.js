import { describe, expect, it } from 'vitest';
import { migrarClavesAnteriores } from './storage';

const crearAlmacen = (inicial) => {
  const datos = new Map(Object.entries(inicial));
  return {
    get length() { return datos.size; },
    key: (indice) => [...datos.keys()][indice] ?? null,
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
    contenido: () => Object.fromEntries(datos),
  };
};

describe('migrarClavesAnteriores', () => {
  it('pasa las claves rimmet_ a datamet_ y conserva las demás', () => {
    const almacen = crearAlmacen({
      rimmet_token: 'token',
      rimmet_theme: 'dark',
      rimmet_soporte_informe: '{"tipo":"MPR"}',
      otra_app: 'sin tocar',
    });

    migrarClavesAnteriores(() => almacen);

    expect(almacen.contenido()).toEqual({
      datamet_token: 'token',
      datamet_theme: 'dark',
      datamet_soporte_informe: '{"tipo":"MPR"}',
      otra_app: 'sin tocar',
    });
  });

  it('si la clave nueva ya existe, se queda la nueva y borra la anterior', () => {
    const almacen = crearAlmacen({ rimmet_theme: 'dark', datamet_theme: 'light' });

    migrarClavesAnteriores(() => almacen);

    expect(almacen.contenido()).toEqual({ datamet_theme: 'light' });
  });

  it('no falla si el navegador bloquea el almacenamiento', () => {
    expect(() => migrarClavesAnteriores(() => { throw new Error('bloqueado'); })).not.toThrow();
  });
});
