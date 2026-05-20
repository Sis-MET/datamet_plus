import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function TimeSelect({ value, onChange, slots, isDarkGantt }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const listRef = useRef(null);

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
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className={`w-full flex items-center justify-between gap-1 py-2 text-xs font-semibold bg-transparent border-none outline-none cursor-pointer ${
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

      {open && (
        <div
          className={`absolute z-[200] bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-24 rounded-xl border shadow-2xl overflow-hidden animate-fade-in ${
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
        </div>
      )}
    </div>
  );
}
