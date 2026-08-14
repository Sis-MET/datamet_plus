import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { api } from '../../../shared/api/client';
import { FloatingDropdown } from './FloatingDropdown';

/**
 * Input de autocompletado para cotizaciones.
 * Busca en /api/cotizaciones/search?q=... con debounce de 300ms.
 * Al seleccionar:
 *   - El valor guardado es SOLO el código: "260001.COT01"
 *   - El cliente se muestra como ayuda visual bajo el input (NO se guarda)
 *
 * @param {string}   value                 - Valor controlado (código de cotización)
 * @param {Function} onChange              - Callback al cambiar el valor del código
 * @param {string}   placeholder          - Placeholder del input
 * @param {boolean}  isDarkGantt          - Tema oscuro/claro
 * @param {string}   className            - Clases adicionales para el input
 */
export function CotizacionAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'EJ: 260001.COT01',
  isDarkGantt = true,
  className = '',
}) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  // Cliente seleccionado — ayuda visual bajo el input (no se persiste)
  const [clienteHint, setClienteHint] = useState('');
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Sincronizar si el padre cambia el valor (ej: botón "Limpiar" o edición de tarea)
  useEffect(() => {
    setQuery(value || '');
    // Si el padre limpia el valor, también limpiamos el hint del cliente
    if (!value) setClienteHint('');
  }, [value]);

  // Cerrar dropdown al hacer click fuera del componente
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (text) => {
    if (text.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setIsLoading(false);
      return;
    }
    try {
      const data = await api.get('/cotizaciones/search', { q: text });
      setSuggestions(data.data || []);
      setShowDropdown((data.data || []).length > 0);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInput = (e) => {
    const text = e.target.value.toUpperCase();
    setQuery(text);
    onChange(text); // actualiza el padre de inmediato (texto libre)
    setClienteHint(''); // al tipear manualmente, limpiamos el hint del cliente

    clearTimeout(debounceRef.current);
    if (text.length >= 2) {
      setIsLoading(true);
      debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
    } else {
      setIsLoading(false);
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const handleSelect = (item) => {
    const clienteLabel = (item.nombre_cliente || '').trim().toUpperCase();

    const code = item.cod_cotizacion;

    setQuery(code);
    onChange(code);

    if (onSelect) onSelect(item);

    setClienteHint(clienteLabel);

    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleFocus = () => {
    if (suggestions.length > 0) setShowDropdown(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      {/* Input principal */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown && suggestions.length > 0}
          spellCheck={false}
          maxLength={90}
          className={cn(
            'w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all font-mono uppercase shadow-inner',
            isDarkGantt
              ? 'bg-[#111111] border-white/10 text-gray-100 placeholder-gray-400'
              : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500',
            isLoading && 'pr-10',
            className
          )}
        />
        {/* Spinner mientras busca */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-primary-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </div>

      {/* Pista visual del CLIENTE — solo informativo, no se guarda */}
      {clienteHint && (
        <div className="flex items-center gap-1 mt-1 px-1">
          <span className={cn(
            'text-[10px] font-semibold truncate',
            isDarkGantt ? 'text-gray-500' : 'text-gray-400'
          )}>
            {clienteHint}
          </span>
        </div>
      )}

      {/* Dropdown de sugerencias */}
      <FloatingDropdown
        open={showDropdown && suggestions.length > 0}
        anchorRef={inputRef}
        onClose={() => setShowDropdown(false)}
        maxHeight={216}
        ariaLabel="Resultados de cotizaciones"
        className={cn(
          'rounded-xl border shadow-2xl',
          isDarkGantt
            ? 'bg-[#1a1a1d] border-gray-700/50'
            : 'bg-white border-gray-200'
        )}
      >
        <ul
          className="max-h-52 overflow-y-auto custom-scrollbar"
        >
          {suggestions.map((item, idx) => {
            const clienteLabel = (item.nombre_cliente || '').trim();
            const plantaLabel  = (item.nombre_planta  || '').trim();

            return (
              <li
                key={`${item.cod_cotizacion}-${item.cod_contacto}-${idx}`}
                onMouseDown={(e) => {
                  // Usar mouseDown para evitar que onBlur se dispare antes
                  e.preventDefault();
                  handleSelect(item);
                }}
                className={cn(
                  'flex flex-col px-3 py-2 cursor-pointer border-b last:border-b-0 transition-colors',
                  isDarkGantt
                    ? 'border-gray-700/30 hover:bg-primary-600/15'
                    : 'border-gray-100 hover:bg-primary-50'
                )}
              >
                {/* Fila 1: Código de cotización */}
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'font-mono text-xs font-bold tracking-wide',
                    isDarkGantt ? 'text-primary-400' : 'text-primary-600'
                  )}>
                    {item.cod_cotizacion}
                  </span>
                  {item.cod_contacto && (
                    <span className={cn(
                      'text-[10px] font-mono px-1.5 py-0.5 rounded',
                      isDarkGantt ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'
                    )}>
                      {item.cod_contacto}
                    </span>
                  )}
                </div>
                {/* Fila 2: Cliente (negrita) + Planta (secundaria, solo visual) */}
                {(clienteLabel || plantaLabel) && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {clienteLabel && (
                      <span className={cn(
                        'text-xs font-semibold truncate',
                        isDarkGantt ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        {clienteLabel}
                      </span>
                    )}
                    {plantaLabel && (
                      <>
                        <span className={cn('text-[10px]', isDarkGantt ? 'text-gray-600' : 'text-gray-400')}>·</span>
                        <span className={cn(
                          'flex items-center gap-0.5 text-[10px] truncate',
                          isDarkGantt ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          {plantaLabel}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </FloatingDropdown>
    </div>
  );
}
