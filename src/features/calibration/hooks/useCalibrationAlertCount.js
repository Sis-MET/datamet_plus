import { useEffect, useState } from 'react';
import { calibrationApi, CALIBRATION_CHANGED_EVENT } from '../api/calibration';

const REFRESH_MS = 10 * 60 * 1000;

/**
 * Fechas del plan de calibración que requieren atención (vencidas o dentro
 * de su ventana de alerta). Alimenta el contador de la barra lateral.
 */
export function useCalibrationAlertCount(enabled = true) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const load = async () => {
      try {
        const data = await calibrationApi.alertSummary();
        if (active) setSummary(data);
      } catch {
        // Sin módulo instalado o sin conexión: simplemente no hay contador.
        if (active) setSummary(null);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };

    load();
    const intervalId = setInterval(load, REFRESH_MS);
    window.addEventListener(CALIBRATION_CHANGED_EVENT, load);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      clearInterval(intervalId);
      window.removeEventListener(CALIBRATION_CHANGED_EVENT, load);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled]);

  return summary;
}
