import React, { createContext, useContext, useState, useCallback } from 'react';
import { safeStorage } from '../utils/storage';

const STORAGE_KEY = 'rimmet_gantt_theme';

const ThemeContext = createContext({
  isDarkGantt: true,
  toggleGanttTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [isDarkGantt, setIsDarkGantt] = useState(() => {
    const saved = safeStorage.getItem(STORAGE_KEY);
    // null/undefined → default oscuro (true)
    return saved === null ? true : saved !== 'light';
  });

  const toggleGanttTheme = useCallback(() => {
    setIsDarkGantt((prev) => {
      const next = !prev;
      safeStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ isDarkGantt, toggleGanttTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
