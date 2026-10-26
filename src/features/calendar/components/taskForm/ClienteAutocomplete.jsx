import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../../../shared/api/client';
import { FloatingDropdown } from '../../../../shared/components/ui/FloatingDropdown';
import { MENU } from './taskFormStyles';

export function ClienteAutocomplete({ value, onChange, onSelect }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  // Secuencia de peticiones: solo la ultima en salir puede tocar el estado.
  const requestIdRef = useRef(0);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handler = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    // Invalida cualquier respuesta que llegue despues de desmontar.
    requestIdRef.current += 1;
  }, []);

  const searchClientes = async (text) => {
    const requestId = ++requestIdRef.current;

    if (text.length < 1) {
      setResults([]);
      setOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.get('/clientes/search', { q: text });
      if (requestId !== requestIdRef.current) return;
      const items = data.success ? data.data || [] : [];
      setResults(items);
      setOpen(items.length > 0);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setResults([]);
      setOpen(false);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  };

  const handleInput = (event) => {
    const text = event.target.value;
    setQuery(text);
    onChange(text);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClientes(text), 300);
  };

  const handleSelect = (item) => {
    setQuery(item.cliente || '');
    setResults([]);
    setOpen(false);
    onSelect(item);
  };

  return (
    <div ref={containerRef} className="relative min-w-0">
      <div className="relative">
        <input
          ref={inputRef}
          id="task-client"
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder="Buscar cliente..."
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          spellCheck={false}
          className="field h-11 pr-10 font-medium"
        />
        {isLoading && (
          /* El centrado va por margen y no por -translate-y-1/2: `animate-spin`
             reemplaza el transform completo y el icono se descolgaba hacia abajo. */
          <Loader2 className="pointer-events-none absolute right-3.5 top-1/2 -mt-2 h-4 w-4 animate-spin text-fg-subtle" />
        )}
      </div>

      <FloatingDropdown
        open={open && results.length > 0}
        anchorRef={inputRef}
        onClose={() => setOpen(false)}
        maxHeight={220}
        ariaLabel="Resultados de clientes"
        className={MENU}
      >
          <div role="listbox" className="max-h-52 overflow-y-auto">
            {results.map(item => (
              <button
                key={item.codigo_cliente || item.cliente}
                type="button"
                role="option"
                onClick={() => handleSelect(item)}
                className="menu-item flex-col items-start gap-0.5"
              >
                <span className="block w-full truncate text-[13px] font-medium">{item.cliente}</span>
                {item.codigo_cliente && (
                  <span className="block font-mono text-[11px] text-fg-subtle">
                    {item.codigo_cliente}
                  </span>
                )}
              </button>
            ))}
          </div>
      </FloatingDropdown>
    </div>
  );
}
