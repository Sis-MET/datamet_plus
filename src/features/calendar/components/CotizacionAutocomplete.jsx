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
 * @param {string}   className            - Clases adicionales para el input
 */
export function CotizacionAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'EJ: 260001.COT01',
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
            'field h-11 font-mono uppercase',
            isLoading && 'pr-10',
            className
          )}
        />
        {/* Spinner mientras busca */}
        {isLoading && (
          <div className="pointer-events-none absolute right-3.5 top-1/2 -mt-2 text-fg-subtle">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </div>

      {/* Pista visual del CLIENTE — solo informativo, no se guarda */}
      {clienteHint && (
        <div className="flex items-center gap-1 mt-1 px-1">
          <span className="truncate text-[11px] font-medium text-fg-subtle">
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
        className="glass rounded-xl border p-1"
      >
        <ul
          className="max-h-52 overflow-y-auto"
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
                className="menu-item cursor-pointer flex-col items-start gap-0.5"
              >
                {/* Fila 1: Código de cotización */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold tracking-wide text-fg">
                    {item.cod_cotizacion}
                  </span>
                  {item.cod_contacto && (
                    <span className="rounded bg-fg/[0.07] px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
                      {item.cod_contacto}
                    </span>
                  )}
                </div>
                {/* Fila 2: Cliente (negrita) + Planta (secundaria, solo visual) */}
                {(clienteLabel || plantaLabel) && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {clienteLabel && (
                      <span className="truncate text-xs font-medium text-fg">
                        {clienteLabel}
                      </span>
                    )}
                    {plantaLabel && (
                      <>
                        <span className="text-[10px] text-fg-subtle">·</span>
                        <span className="flex items-center gap-0.5 truncate text-[10px] text-fg-subtle">
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
