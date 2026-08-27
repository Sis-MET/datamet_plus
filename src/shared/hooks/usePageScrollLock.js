import { useLayoutEffect } from 'react';
import { lockPageScroll } from '../utils/pageScrollLock';

// active debe mantenerse durante la salida animada, no solo mientras el
// formulario acepta interacción. La limpieza también cubre el desmontaje.
export function usePageScrollLock(active = true) {
  useLayoutEffect(() => {
    if (active) return lockPageScroll();
  }, [active]);
}
