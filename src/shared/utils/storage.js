// Hasta la versión 2.13 las claves usaban el prefijo `rimmet_` (nombre anterior
// de la aplicación). Se pasan una sola vez a `datamet_` para conservar la sesión
// y las preferencias; si la clave nueva ya existe, se queda la nueva.
const PREFIJO_ANTERIOR = 'rimmet_';
const PREFIJO = 'datamet_';

export function migrarClavesAnteriores(obtenerAlmacen = () => window.localStorage) {
  try {
    const almacen = obtenerAlmacen();
    const anteriores = [];
    for (let indice = 0; indice < almacen.length; indice += 1) {
      const clave = almacen.key(indice);
      if (clave?.startsWith(PREFIJO_ANTERIOR)) anteriores.push(clave);
    }
    for (const clave of anteriores) {
      const nueva = PREFIJO + clave.slice(PREFIJO_ANTERIOR.length);
      if (almacen.getItem(nueva) === null) almacen.setItem(nueva, almacen.getItem(clave));
      almacen.removeItem(clave);
    }
  } catch {
    // Sin acceso al almacenamiento no hay claves que pasar.
  }
}

// Corre al cargar el módulo, antes de que cualquier pantalla lea una clave.
migrarClavesAnteriores();

export const safeStorage = {
  getItem: (key) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      console.warn('localStorage is blocked by browser settings');
    }
    return null;
  },
  setItem: (key, value) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      console.warn('localStorage is blocked by browser settings');
    }
  },
  removeItem: (key) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      console.warn('localStorage is blocked by browser settings');
    }
  }
};
