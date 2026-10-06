import { useEffect, useState } from 'react';
import { calibrationApi } from '../api/calibration';

/** Historial de una actividad: cambios de su configuración y de sus fechas. */
export function useActivityHistory(actividadId) {
  const [state, setState] = useState({ id: null, items: null, error: null });

  useEffect(() => {
    if (actividadId == null) return undefined;
    let active = true;
    calibrationApi.actividadHistorial(actividadId)
      .then((items) => {
        if (active) setState({ id: actividadId, items, error: null });
      })
      .catch((error) => {
        if (active) setState({ id: actividadId, items: null, error });
      });
    return () => {
      active = false;
    };
  }, [actividadId]);

  return state.id === actividadId ? state : { id: actividadId, items: null, error: null };
}
