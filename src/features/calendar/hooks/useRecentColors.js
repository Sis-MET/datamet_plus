import { useCallback, useState } from 'react';
import { safeStorage } from '../../../shared/utils/storage';
import { PRESET_COLORS } from '../domain/taskFormDomain';

const STORAGE_KEY = 'datamet_recent_colors';

/** Hasta cinco colores propios (no predefinidos) usados en las últimas fichas. */
export function useRecentColors() {
  const [recentColors, setRecentColors] = useState(() => {
    if (typeof window === 'undefined') return [];

    try {
      const saved = safeStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveToRecent = useCallback((color) => {
    setRecentColors(prev => {
      let updated = [...prev];

      if (color && !PRESET_COLORS.includes(color)) {
        updated = updated.filter(item => item !== color);
        updated.unshift(color);
      }

      updated = updated.slice(0, 5);
      safeStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return [recentColors, saveToRecent];
}
