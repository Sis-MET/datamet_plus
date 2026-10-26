import { useEffect, useRef, useState } from 'react';
import { usePageScrollLock } from '../../shared/hooks/usePageScrollLock';
import { exitDelay } from '../../shared/utils/motion';

// Mantiene el diálogo modal durante su salida (EXIT_MS): no se pierde el
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
    timer.current = setTimeout(() => {
      timer.current = null;
      setClosing(false);
      callback.current();
    }, exitDelay());
  };
  return { closing, close };
}
