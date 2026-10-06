import { useCallback, useState } from 'react';

/** Estado de la tarjeta flotante: qué fecha y sobre qué elemento. */
export function useHoverCard() {
  const [hover, setHover] = useState(null);
  const show = useCallback((occurrence, anchor) => {
    setHover(occurrence && anchor ? { occurrence, anchor } : null);
  }, []);
  const hide = useCallback(() => setHover(null), []);
  return [hover, show, hide];
}
