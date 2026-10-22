import { useEffect, useState } from 'react';
import { SOPORTE_CHANGED_EVENT, soporteApi } from '../api/soporte';

const REFRESH_MS = 10 * 60 * 1000;

/**
 * Próximos servicios que requieren atención (vencidos o dentro del aviso).
 * Alimenta el contador de la barra lateral y de la pestaña.
 */
export function useSoporteAlertCount(enabled = true) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const load = async () => {
      try {
        const data = await soporteApi.proximosResumen();
        if (active) setSummary(data);
      } catch {
        // Sin la migración o sin conexión: simplemente no hay contador.
        if (active) setSummary(null);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };

    load();
    const intervalId = setInterval(load, REFRESH_MS);
    window.addEventListener(SOPORTE_CHANGED_EVENT, load);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      clearInterval(intervalId);
      window.removeEventListener(SOPORTE_CHANGED_EVENT, load);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled]);

  return summary;
}
