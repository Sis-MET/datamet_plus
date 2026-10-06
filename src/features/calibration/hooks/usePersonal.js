import { useEffect, useState } from 'react';
import { calibrationApi } from '../api/calibration';

// La lista de personal casi no cambia: se pide una vez por sesión de página.
let cache = null;

export function usePersonal() {
  const [personal, setPersonal] = useState(() => (Array.isArray(cache) ? cache : []));

  useEffect(() => {
    if (Array.isArray(cache)) return undefined;
    let active = true;
    if (!cache) {
      cache = calibrationApi.personal().catch((error) => {
        cache = null;
        throw error;
      });
    }
    cache
      .then((list) => {
        cache = list;
        if (active) setPersonal(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return personal;
}
