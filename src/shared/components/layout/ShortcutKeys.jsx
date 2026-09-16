import { IS_APPLE_PLATFORM, SIDEBAR_SHORTCUT_LABEL } from './shortcuts';

export function ShortcutKeys({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label={SIDEBAR_SHORTCUT_LABEL}>
      <kbd className="kbd">{IS_APPLE_PLATFORM ? '⌘' : 'Ctrl'}</kbd>
      <kbd className="kbd">B</kbd>
    </span>
  );
}
