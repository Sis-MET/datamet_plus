import { useEffect, useState } from 'react';
import { calibrationApi } from '../api/calibration';

/**
 * Historial de un equipo (certificados, verificaciones y bitácora). Cambiar
 * `version` lo vuelve a pedir después de registrar un cambio.
 */
export function useEquipmentHistory(equipoId, version = 0) {
  const key = `${equipoId}:${version}`;
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    let active = true;
    calibrationApi.equipoHistorial(equipoId)
      .then((data) => {
        if (active) setState({ key, data, error: null });
      })
      .catch((error) => {
        if (active) setState(current => ({ ...current, key, error }));
      });
    return () => {
      active = false;
    };
  }, [equipoId, key]);

  return { data: state.data, error: state.error, loading: state.key !== key };
}
