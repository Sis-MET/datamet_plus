import { useCallback, useEffect, useState } from 'react';

/**
 * Carga un recurso con `load` (estable) y permite recargarlo. Mientras recarga
 * conserva los datos anteriores.
 */
export function useResource(load) {
  const [round, setRound] = useState(0);
  const [state, setState] = useState({ round: null, data: null, error: null });

  useEffect(() => {
    let active = true;
    load()
      .then((data) => {
        if (active) setState({ round, data, error: null });
      })
      .catch((error) => {
        if (active) setState(current => ({ ...current, round, error }));
      });
    return () => {
      active = false;
    };
  }, [load, round]);

  const reload = useCallback(() => setRound(value => value + 1), []);
  return { data: state.data, error: state.error, loading: state.round !== round, reload };
}
