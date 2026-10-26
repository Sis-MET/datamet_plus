import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';
import { FloatingDropdown } from '../../../../shared/components/ui/FloatingDropdown';
import { getPlantOptionLabel } from '../../domain/taskFormDomain';
import { MENU, NATIVE_SELECT, SELECT_TRIGGER } from './taskFormStyles';

export function PlantaSelect({ value, onChange, plantas, clienteLabel, isLoading, disabled }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  const selectedPlanta = plantas.find(planta => planta.codigo_planta === value) || null;
  const isDropdownOpen = open && !disabled;

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handler = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isDropdownOpen]);

  const placeholder = isLoading
    ? 'Cargando plantas...'
    : disabled
      ? 'Selecciona un cliente primero...'
      : 'Seleccionar planta...';

  return (
    <div ref={containerRef} className="relative min-w-0">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || isLoading}
        aria-label="Planta"
        className={NATIVE_SELECT}
      >
        <option value="">{placeholder}</option>
        {plantas.map(planta => (
          <option key={planta.codigo_planta} value={planta.codigo_planta}>
            {getPlantOptionLabel(planta, clienteLabel)}
          </option>
        ))}
      </select>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!disabled && !isLoading && plantas.length > 0) {
            setOpen(current => !current);
          }
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isDropdownOpen && plantas.length > 0}
        className={SELECT_TRIGGER}
      >
        <span className={cn('truncate', !selectedPlanta && 'font-normal text-fg-subtle')}>
          {selectedPlanta ? getPlantOptionLabel(selectedPlanta, clienteLabel) : placeholder}
        </span>
        {isLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-fg-subtle" />
        ) : (
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-150', isDropdownOpen && 'rotate-180')} />
        )}
      </button>

      <FloatingDropdown
        open={isDropdownOpen && plantas.length > 0}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        maxHeight={250}
        ariaLabel="Plantas disponibles"
        className={MENU}
      >
          <div role="listbox" className="max-h-60 overflow-y-auto">
            {plantas.map(planta => {
              const plantaLabel = getPlantOptionLabel(planta, clienteLabel);
              const isSelected = planta.codigo_planta === value;

              return (
                <button
                  key={planta.codigo_planta}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected}
                  onClick={() => {
                    onChange(planta.codigo_planta);
                    setOpen(false);
                  }}
                  className="menu-item flex-col items-start gap-0.5"
                >
                  <span className="block w-full truncate text-[13px]">{plantaLabel}</span>
                  {planta.codigo_planta && (
                    <span className="block font-mono text-[11px] font-normal text-fg-subtle">
                      {planta.codigo_planta}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
      </FloatingDropdown>
    </div>
  );
}
