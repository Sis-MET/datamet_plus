import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { safeStorage } from '../utils/storage';
import {
  THEME_STORAGE_KEY,
  ThemeContext,
  applyTheme,
  readThemePreference,
  subscribeToSystemTheme,
  systemPrefersDark,
} from './theme';

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readThemePreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => subscribeToSystemTheme(setSystemDark), []);

  // Mantiene sincronizadas las pestañas abiertas de la aplicación.
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === THEME_STORAGE_KEY) setPreference(readThemePreference());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const resolvedTheme = preference === 'system'
    ? (systemDark ? 'dark' : 'light')
    : preference;

  useLayoutEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((nextTheme) => {
    setPreference(nextTheme);
    if (nextTheme === 'light' || nextTheme === 'dark') {
      safeStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } else {
      safeStorage.removeItem(THEME_STORAGE_KEY);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const value = useMemo(() => ({
    theme: preference,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    // Nombre heredado que todavía leen algunos componentes.
    isDarkGantt: resolvedTheme === 'dark',
    setTheme,
    toggleTheme,
  }), [preference, resolvedTheme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
