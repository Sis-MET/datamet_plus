import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FloatingDropdown } from './FloatingDropdown';

export function TimeSelect({ value, onChange, slots }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const listRef = useRef(null);
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

  useEffect(() => {
    if (open && listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      if (selected) selected.scrollIntoView({ block: 'nearest' });
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Hora"
        className="w-full bg-transparent py-1.5 text-sm font-semibold tabular-nums text-fg outline-none sm:hidden"
      >
        {slots.map(time => <option key={time} value={time}>{time}</option>)}
      </select>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="hidden w-full cursor-pointer items-center justify-between gap-1 rounded-md border-none bg-transparent py-1.5 text-sm font-semibold text-fg outline-none sm:flex"
      >
        <span className="tabular-nums">{value}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <FloatingDropdown
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        width={104}
        maxHeight={200}
        align="center"
        preferredPlacement="auto"
        ariaLabel="Horas disponibles"
        className="glass rounded-xl border p-1"
      >
          <div ref={listRef} role="listbox" className="max-h-48 overflow-y-auto">
            {slots.map(time => (
              <button
                key={time}
                type="button"
                role="option"
                aria-selected={time === value}
                data-selected={time === value}
                onClick={() => {
                  onChange(time);
                  setOpen(false);
                }}
                className="menu-item justify-center py-1.5 tabular-nums"
              >
                {time}
              </button>
            ))}
          </div>
      </FloatingDropdown>
    </div>
  );
}
