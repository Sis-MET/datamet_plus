import { useCallback, useEffect, useState } from 'react';
import { calibrationApi } from '../api/calibration';

/**
 * Evaluación de cumplimiento NB/ISO/IEC 17025. Se pide al abrir la pestaña y
 * `reload` la vuelve a calcular con los datos del momento.
 */
export function useCompliance() {
  const [round, setRound] = useState(0);
  const [state, setState] = useState({ round: null, data: null, error: null });

  useEffect(() => {
    let active = true;
    calibrationApi.cumplimiento()
      .then((data) => {
        if (active) setState({ round, data, error: null });
      })
      .catch((error) => {
        if (active) setState(current => ({ ...current, round, error }));
      });
    return () => {
      active = false;
    };
  }, [round]);

  const reload = useCallback(() => setRound(value => value + 1), []);
  return { data: state.data, error: state.error, loading: state.round !== round, reload };
}
