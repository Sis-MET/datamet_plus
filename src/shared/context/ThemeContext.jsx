import { useContext } from 'react';
import { ThemeContext } from './theme';

const noop = () => {};

// Fuera del ThemeProvider (por ejemplo, en fixtures de prueba) se lee el tema
// que ya aplicó index.html sobre <html>.
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context) return context;

  const isDark = typeof document !== 'undefined'
    && document.documentElement.classList.contains('dark');
  return {
    theme: 'system',
    resolvedTheme: isDark ? 'dark' : 'light',
    isDark,
    isDarkGantt: isDark,
    setTheme: noop,
    toggleTheme: noop,
  };
}
