import { useEffect, useRef, useState } from 'react';
import { usePageScrollLock } from '../../shared/hooks/usePageScrollLock';

// Mantiene el diálogo modal durante los 100 ms de salida: no se pierde el
// bloqueo de foco ni se pueden pulsar controles de la pantalla de fondo.
export function useDialogMotion(dialog, onClose, active = true) {
  usePageScrollLock(active);
  const [closing, setClosing] = useState(false);
  const timer = useRef(null);
  const callback = useRef(onClose);
  useEffect(() => {
    callback.current = onClose;
  });
  useEffect(() => {
    const element = dialog.current;
    if (active && element && !element.open) element.showModal();
    return () => {
      clearTimeout(timer.current);
      timer.current = null;
      if (element?.open) element.close();
    };
  }, [active, dialog]);

  const close = () => {
    if (timer.current !== null) return;
    setClosing(true);
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 100;
    timer.current = setTimeout(() => {
      timer.current = null;
      setClosing(false);
      callback.current();
    }, delay);
  };
  return { closing, close };
}
