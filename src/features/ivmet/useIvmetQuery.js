import { useEffect, useState } from 'react';
import { ivmetApi } from './api/ivmet';

export function useIvmetQuery(path, params = {}, revision = 0, pollMs = 0) {
  const key = JSON.stringify([path, params, revision]);
  const [result, setResult] = useState({ key: null, data: null, error: null });
  useEffect(() => {
    if (!path) return;
    let ignore = false;
    let timer;
    let pending = false;
    const [url, query] = JSON.parse(key);
    const load = async (background = false) => {
      if (ignore || pending) return;
      pending = true;
      try {
        const data = await ivmetApi.read(url, query);
        if (!ignore) setResult({ key, data, error: null });
      } catch (error) {
        if (!ignore)
          setResult((previous) => ({
            key,
            // Ante revocación o pérdida de conexión nunca conservar evidencia en pantalla.
            data: background && previous.key === key && !url.startsWith('ops/case') ? previous.data : null,
            error,
          }));
      } finally {
        pending = false;
        if (!ignore && pollMs)
          timer = window.setTimeout(() => {
            if (document.visibilityState === 'visible') load(true);
          }, pollMs);
      }
    };
    const resume = () => {
      if (document.visibilityState === 'visible') {
        window.clearTimeout(timer);
        load(true);
      }
    };
    load();
    if (pollMs) document.addEventListener('visibilitychange', resume);
    return () => {
      ignore = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [key, path, pollMs]);
  return result.key === key
    ? { ...result, loading: false }
    : { data: null, error: null, loading: Boolean(path) };
}
