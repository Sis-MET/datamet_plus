import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

/**
 * Input de autocompletado para cotizaciones.
 * Busca en /api/cotizaciones/search?q=... con debounce de 300ms.
 * Al seleccionar, construye el label: "260001.COT01 | EMBOL S.A. - EL ALTO"
 * También permite texto libre (compatible con valores legacy).
 *
 * @param {string}   value        - Valor controlado (texto actual del campo)
 * @param {Function} onChange     - Callback al cambiar el valor
 * @param {string}   placeholder  - Placeholder del input
 * @param {boolean}  isDarkGantt  - Tema oscuro/claro
 * @param {string}   className    - Clases adicionales para el input
 */
export function CotizacionAutocomplete({
  value,
  onChange,
  placeholder = 'EJ: 260001.COT01 · EMBOL',
  isDarkGantt = true,
  className = '',
}) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Sincronizar si el padre cambia el valor (ej: botón "Limpiar" o "Copiar a Tarde")
  useEffect(() => {
    setQuery(value || '');
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
      const token = localStorage.getItem('rimmet_token') || sessionStorage.getItem('rimmet_token') || '';
      const res = await fetch(
        `${API_URL}/api/cotizaciones/search?q=${encodeURIComponent(text)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error('Error al buscar cotizaciones');
      const data = await res.json();
      if (data.success) {
        setSuggestions(data.data || []);
        setShowDropdown((data.data || []).length > 0);
      }
    } catch (_err) {
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
    const plantaLabel  = (item.nombre_planta  || '').trim().toUpperCase();
    // Formato: "260001.COT01 | EMBOL S.A. - EL ALTO"
    const combined = plantaLabel
      ? `${item.cod_cotizacion} | ${clienteLabel} - ${plantaLabel}`
      : `${item.cod_cotizacion} | ${clienteLabel}`;

    setQuery(combined);
    onChange(combined);
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
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            'w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all font-mono uppercase shadow-inner',
            isDarkGantt
              ? 'bg-[#111111] border-white/5 text-gray-100 placeholder-gray-700'
              : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400',
            isLoading && 'pr-10',
            className
          )}
        />
        {/* Spinner mientras busca */}
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary-400 pointer-events-none" />
        )}
      </div>

      {/* Dropdown de sugerencias */}
      {showDropdown && suggestions.length > 0 && (
        <ul
          className={cn(
            'absolute z-[9999] w-full mt-1 border rounded-xl shadow-2xl overflow-hidden',
            isDarkGantt
              ? 'bg-[#1a1a1d] border-gray-700/50'
              : 'bg-white border-gray-200'
          )}
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
                {/* Fila 2: Cliente + Planta */}
                {(clienteLabel || plantaLabel) && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {clienteLabel && (
                      <span className={cn(
                        'text-xs font-semibold truncate',
                        isDarkGantt ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        {clienteLabel}
                      </span>
                    )}
                    {clienteLabel && plantaLabel && (
                      <span className={cn('text-[10px]', isDarkGantt ? 'text-gray-600' : 'text-gray-400')}>—</span>
                    )}
                    {plantaLabel && (
                      <span className={cn(
                        'text-xs truncate',
                        isDarkGantt ? 'text-gray-500' : 'text-gray-500'
                      )}>
                        {plantaLabel}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
