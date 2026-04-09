import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { safeStorage } from '../utils/storage';

const STORAGE_KEY = 'rimmet_gantt_theme';

const ThemeContext = createContext({
  isDarkGantt: true,
  toggleGanttTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [isDarkGantt, setIsDarkGantt] = useState(() => {
    const saved = safeStorage.getItem(STORAGE_KEY);
    if (saved === null) {
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return true;
    }
    return saved !== 'light';
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (safeStorage.getItem(STORAGE_KEY) === null) {
        setIsDarkGantt(e.matches);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
