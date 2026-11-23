import { createContext, useContext, useSyncExternalStore } from 'react';

export const TaskTooltipContext = createContext(null);

const TOOLTIP_ESTIMATED_HEIGHT = 460;

export function createTaskTooltipStore() {
  let tooltip = null;
  let closeTimer = null;
  let animationFrame = null;
  const listeners = new Set();
  const emit = () => listeners.forEach(listener => listener());

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot(key) {
      return tooltip?.key === key ? tooltip : null;
    },
    show(anchor, key) {
      if (!anchor) return;
      if (closeTimer) clearTimeout(closeTimer);
      if (animationFrame) cancelAnimationFrame(animationFrame);

      const rect = anchor.getBoundingClientRect();
      // Va arriba de la ficha si cabe; si no, del lado con más espacio.
      const spaceBelow = window.innerHeight - rect.bottom;
      const isTop = rect.top < TOOLTIP_ESTIMATED_HEIGHT && spaceBelow > rect.top;
      tooltip = {
        key,
        visible: false,
        position: {
          x: rect.left + (rect.width / 2),
          y: isTop ? rect.bottom + 10 : rect.top - 10,
          isTop,
        },
      };
      emit();

      animationFrame = requestAnimationFrame(() => {
        if (tooltip?.key === key) tooltip = { ...tooltip, visible: true };
        animationFrame = null;
        emit();
      });
    },
    hide(key) {
      if (tooltip?.key === key) {
        tooltip = { ...tooltip, visible: false };
        emit();
      }
      closeTimer = setTimeout(() => {
        if (tooltip?.key === key) tooltip = null;
        closeTimer = null;
        emit();
      }, 120);
    },
    destroy() {
      if (closeTimer) clearTimeout(closeTimer);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      listeners.clear();
      tooltip = null;
    },
  };
}

export function useTaskTooltip(key) {
  const store = useContext(TaskTooltipContext);
  if (!store) throw new Error('useTaskTooltip debe usarse dentro de TaskTooltipProvider');
  const tooltip = useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot(key),
    () => null
  );

  return {
    tooltip,
    showTaskTooltip: anchor => store.show(anchor, key),
    hideTaskTooltip: () => store.hide(key),
  };
}
