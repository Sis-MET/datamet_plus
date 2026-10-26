import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';
import { FloatingDropdown } from '../../../../shared/components/ui/FloatingDropdown';
import { MENU, NATIVE_SELECT, SELECT_TRIGGER } from './taskFormStyles';

export function ActivitySelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handler = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Tipo de tarea"
        className={NATIVE_SELECT}
      >
        <option value="" disabled>Seleccionar...</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={SELECT_TRIGGER}
      >
        <span className={cn('truncate', !value && 'font-normal text-fg-subtle')}>
          {value || 'Seleccionar...'}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-150', open && 'rotate-180')} />
      </button>

      <FloatingDropdown
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        maxHeight={220}
        ariaLabel="Tipos de tarea"
        className={MENU}
      >
          <div role="listbox" className="max-h-52 overflow-y-auto">
            {options.map(option => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === value}
                data-selected={option === value}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className="menu-item"
              >
                {option}
              </button>
            ))}
          </div>
      </FloatingDropdown>
    </div>
  );
}
