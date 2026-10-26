import { useEffect, useRef } from 'react';
import { Palette, X } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { cn } from '../../../../shared/utils/cn';
import { FloatingDropdown } from '../../../../shared/components/ui/FloatingDropdown';
import { PRESET_COLORS } from '../../domain/taskFormDomain';

const SWATCH = 'h-6 w-6 rounded-full ring-1 ring-inset ring-black/10 transition-transform duration-150 hover:scale-110';

/** Color de la ficha: botón con el color elegido y selector con predefinidos y recientes. */
export function TaskColorPicker({ value, onChange, isOpen, onOpenChange, recentColors }) {
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(e.target)) {
        onOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={value ? `Cambiar color de la ficha, actual ${value}` : 'Elegir color de la ficha, obligatorio'}
        title="Elegir color de la ficha"
        className={cn(
          'relative flex h-11 w-11 items-center justify-center rounded-xl border transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px',
          value
            ? 'border-black/10 shadow-xs'
            : 'border-dashed border-danger/60 bg-surface text-fg-subtle hover:border-danger'
        )}
        style={{ backgroundColor: value || undefined }}
      >
        {value ? (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-white/80 shadow-xs" aria-hidden="true" />
        ) : (
          <>
            <Palette className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-surface" aria-hidden="true" />
          </>
        )}
      </button>

      <FloatingDropdown
        open={isOpen}
        anchorRef={buttonRef}
        onClose={() => onOpenChange(false)}
        width={232}
        maxHeight={340}
        align="end"
        ariaLabel="Selector de color"
        className="glass rounded-2xl border p-3"
      >
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[13px] font-medium text-fg">Color de la ficha</span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Cerrar selector de color"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
            >
              <X size={14} />
            </button>
          </div>

          <HexColorPicker
            color={value || PRESET_COLORS[1]}
            onChange={onChange}
            style={{ width: '100%', height: '124px' }}
          />

          <div className="mt-3">
            <span className="mb-2 block text-[11px] font-medium text-fg-subtle">Predefinidos</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange(color)}
                  aria-label={`Usar color ${color}`}
                  className={cn(SWATCH, value === color && 'ring-2 ring-fg ring-offset-2 ring-offset-surface')}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {recentColors.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <span className="mb-2 block text-[11px] font-medium text-fg-subtle">Recientes</span>
              <div className="flex flex-wrap gap-2">
                {recentColors.map((color, index) => (
                  <button
                    key={`recent-${color}-${index}`}
                    type="button"
                    onClick={() => onChange(color)}
                    aria-label={`Usar color ${color}`}
                    className={cn(SWATCH, value === color && 'ring-2 ring-fg ring-offset-2 ring-offset-surface')}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
      </FloatingDropdown>
    </div>
  );
}
