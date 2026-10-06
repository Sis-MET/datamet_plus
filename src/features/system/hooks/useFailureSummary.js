import { useEffect, useState } from 'react';
import { FAILURES_CHANGED_EVENT, systemApi } from '../api/system';

const REFRESH_MS = 5 * 60 * 1000;

/**
 * Fallas abiertas y en curso, para el contador de la barra lateral. Solo
 * consulta si quien navega administra el sistema.
 */
export function useFailureSummary(enabled) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const load = () => systemApi.resumenFallas()
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch(() => {
        // Sin la migración 007 o sin red no se muestra el contador.
      });
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    window.addEventListener(FAILURES_CHANGED_EVENT, load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(FAILURES_CHANGED_EVENT, load);
    };
  }, [enabled]);

  return enabled ? summary : null;
}
