import { useCallback, useEffect, useRef, useState } from 'react';
import { calibrationApi } from '../api/calibration';

/**
 * Plan anual completo (equipos, actividades, fechas y alertas activas).
 * Al cambiar de año conserva los datos anteriores hasta que llegan los nuevos,
 * para que la vista no parpadee.
 */
export function useCalibrationPlan(anio) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    try {
      const plan = await calibrationApi.plan(anio);
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

  // Al volver a la pestaña el plan puede haber cambiado (otra persona, o el día).
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [load]);

  return { data, error, loading, reload: load };
}
