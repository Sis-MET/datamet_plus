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

const FREEZE_CLASS = 'theme-switching';

let hasAppliedTheme = false;
// Identifica el cambio en curso: si llegan dos seguidos, el primero se descarta
// y su descongelado no debe soltar el congelado del segundo.
let switchToken = 0;

/** Doble rAF para soltar el congelado ya pintado; con la pestaña oculta rAF no
 *  corre, así que un temporizador de respaldo evita dejar la clase puesta. */
const afterNextPaint = (callback) => {
  let done = false;
  const run = () => { if (!done) { done = true; callback(); } };
  window.requestAnimationFrame(() => window.requestAnimationFrame(run));
  window.setTimeout(run, 150);
};

const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

export function applyTheme(resolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = resolvedTheme === 'dark';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[resolvedTheme]);

  if (root.classList.contains('dark') === isDark && root.style.colorScheme === resolvedTheme) {
    hasAppliedTheme = true;
    return;
  }

  const commit = () => {
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = resolvedTheme;
  };

  // Las transiciones de cada componente quedan congeladas mientras dura el
  // cambio: cada una tiene su propia duración y, sueltas, escalonan el tema.
  root.classList.add(FREEZE_CLASS);
  const token = ++switchToken;
  const unfreeze = () => {
    if (token === switchToken) root.classList.remove(FREEZE_CLASS);
  };

  // El primer cambio no se anima: index.html ya dejó el tema correcto antes del
  // primer pintado y un fundido al montar se vería como un destello.
  // El fundido lo dibuja la View Transition (ver index.css); donde no exista, el
  // cambio es instantáneo, que es preferible a una animación a tirones.
  const animate = hasAppliedTheme
    && typeof document.startViewTransition === 'function'
    && !prefersReducedMotion();
  hasAppliedTheme = true;

  if (!animate) {
    commit();
    afterNextPaint(unfreeze);
    return;
  }

  // `finished` se rechaza si el navegador descarta la transición (pestaña
  // oculta, o dos cambios seguidos); el tema ya está aplicado igualmente.
  // Si la API fallara, se aplica igual: dejar el congelado puesto mataría las
  // transiciones de toda la interfaz hasta recargar.
  try {
    document.startViewTransition(commit).finished.catch(() => {}).then(unfreeze);
  } catch {
    commit();
    afterNextPaint(unfreeze);
  }
}
