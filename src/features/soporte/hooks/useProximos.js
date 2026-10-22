import { useCallback, useEffect, useRef, useState } from 'react';
import { SOPORTE_CHANGED_EVENT, soporteApi } from '../api/soporte';

/**
 * Próximos servicios de un año: equipos, marcas de la línea de tiempo y lo
 * que requiere atención. Al cambiar de año conserva los datos anteriores
 * hasta que llegan los nuevos, para que la vista no parpadee.
 */
export function useProximos(anio) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    try {
      const plan = await soporteApi.proximos(anio);
      if (requestId !== requestRef.current) return;
      setData(plan);
      setError(null);
    } catch (loadError) {
      if (requestId !== requestRef.current) return;
      setError(loadError);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [anio]);

  useEffect(() => {
    load();
  }, [load]);

  // Al volver a la pestaña o tras un cambio (seguimiento, avisos, informe).
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener(SOPORTE_CHANGED_EVENT, load);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener(SOPORTE_CHANGED_EVENT, load);
    };
  }, [load]);

  return { data, error, loading, reload: load };
}
