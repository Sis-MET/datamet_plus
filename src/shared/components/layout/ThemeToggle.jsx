import { Moon, Sun } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useTheme } from '../../context/ThemeContext';

export function ThemeToggle({ className }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-fg-muted transition-colors duration-150 hover:bg-fg/[0.06] hover:text-fg',
        className
      )}
    >
      <Sun
        className={cn(
          'absolute h-[18px] w-[18px] transition-[opacity,transform] duration-200 ease-out',
          isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-45 scale-75 opacity-0'
        )}
        strokeWidth={1.9}
        aria-hidden="true"
      />
      <Moon
        className={cn(
          'absolute h-[18px] w-[18px] transition-[opacity,transform] duration-200 ease-out',
          isDark ? 'rotate-45 scale-75 opacity-0' : 'rotate-0 scale-100 opacity-100'
        )}
        strokeWidth={1.9}
        aria-hidden="true"
      />
    </button>
  );
}
