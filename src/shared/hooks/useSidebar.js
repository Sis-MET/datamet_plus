import { useCallback, useEffect, useState } from 'react';
import { safeStorage } from '../utils/storage';

const STORAGE_KEY = 'datamet_sidebar';
const DESKTOP_QUERY = '(min-width: 1024px)';

const matchesDesktop = () => typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia(DESKTOP_QUERY).matches;

// Ctrl+B (Cmd+B en macOS) muestra u oculta la barra lateral, igual que en los
// editores de código. En escritorio la preferencia se recuerda; en pantallas
// angostas la barra es un panel flotante que empieza cerrado.
export function isSidebarShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false;
  return String(event.key).toLowerCase() === 'b' || (event.key === 'Unidentified' && event.code === 'KeyB');
}

export function useSidebar() {
  const [isDesktop, setIsDesktop] = useState(matchesDesktop);
  const [desktopOpen, setDesktopOpen] = useState(() => safeStorage.getItem(STORAGE_KEY) !== 'closed');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(DESKTOP_QUERY);
    const handleChange = (event) => {
      setIsDesktop(event.matches);
      if (event.matches) setMobileOpen(false);
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const setOpen = useCallback((next) => {
    if (isDesktop) {
      setDesktopOpen((current) => {
        const value = typeof next === 'function' ? next(current) : next;
        safeStorage.setItem(STORAGE_KEY, value ? 'open' : 'closed');
        return value;
      });
    } else {
      setMobileOpen((current) => (typeof next === 'function' ? next(current) : next));
    }
  }, [isDesktop]);

  const toggle = useCallback(() => setOpen((current) => !current), [setOpen]);
  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat || !isSidebarShortcut(event)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return {
    isDesktop,
    isOpen: isDesktop ? desktopOpen : mobileOpen,
    toggle,
    close,
  };
}
