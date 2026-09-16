import { createContext } from 'react';
import { safeStorage } from '../utils/storage';

// La preferencia se guarda solo si la persona elige un tema; sin valor guardado
// la aplicación sigue al sistema operativo. index.html aplica la misma regla
// antes del primer pintado para evitar un destello del tema equivocado.
export const THEME_STORAGE_KEY = 'rimmet_theme';
export const ThemeContext = createContext(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_COLORS = { light: '#f6f6f3', dark: '#0c0c0d' };

export function readThemePreference() {
  const saved = safeStorage.getItem(THEME_STORAGE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

export function systemPrefersDark() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(DARK_QUERY).matches;
}

export function subscribeToSystemTheme(onChange) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const query = window.matchMedia(DARK_QUERY);
  const listener = (event) => onChange(event.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

export function applyTheme(resolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = resolvedTheme === 'dark';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[resolvedTheme]);

  if (root.classList.contains('dark') === isDark && root.style.colorScheme === resolvedTheme) {
    return;
  }

  // Se congelan las transiciones durante el cambio para que toda la interfaz
  // cambie a la vez, sin fundidos escalonados de cada control.
  root.classList.add('theme-switching');
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = resolvedTheme;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => root.classList.remove('theme-switching'));
  });
}
