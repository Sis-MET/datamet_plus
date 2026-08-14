import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FloatingDropdown } from './FloatingDropdown';

export function TimeSelect({ value, onChange, slots, isDarkGantt }) {
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
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Hora"
        className={`w-full bg-transparent py-2 text-xs font-semibold outline-none sm:hidden ${
          isDarkGantt ? 'text-gray-100' : 'text-gray-800'
        }`}
      >
        {slots.map(time => <option key={time} value={time}>{time}</option>)}
      </select>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`hidden w-full items-center justify-between gap-1 border-none bg-transparent py-2 text-xs font-semibold outline-none cursor-pointer sm:flex ${
          isDarkGantt ? 'text-gray-100' : 'text-gray-800'
        }`}
      >
        <span className="font-mono tracking-wide">{value}</span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          } ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}
        />
      </button>

      <FloatingDropdown
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        width={96}
        maxHeight={184}
        align="center"
        preferredPlacement="auto"
        ariaLabel="Horas disponibles"
        className={`rounded-xl border shadow-2xl ${
            isDarkGantt
              ? 'bg-[#1e1e24] border-white/10 shadow-black/80'
              : 'bg-white border-gray-200 shadow-gray-300/40'
          }`}
      >
          <div ref={listRef} className="max-h-44 overflow-y-auto py-1 custom-scrollbar">
            {slots.map(time => (
              <button
                key={time}
                type="button"
                data-selected={time === value}
                onClick={() => {
                  onChange(time);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-[5px] text-xs font-mono font-semibold transition-colors ${
                  time === value
                    ? isDarkGantt
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-blue-50 text-blue-600'
                    : isDarkGantt
                      ? 'text-gray-300 hover:bg-white/6 hover:text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {time}
              </button>
            ))}
          </div>
      </FloatingDropdown>
    </div>
  );
}
