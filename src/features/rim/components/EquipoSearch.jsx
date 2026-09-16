import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Package, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { api } from '../../../shared/api/client';

/**
 * Buscador de equipos con lista siempre visible.
 * - Carga todos los equipos al montar (filtrados por planta o cliente)
 * - El input filtra la lista en el cliente (sin re-fetch)
 * - Al hacer clic en un ítem se auto-completan los campos del instrumento
 */
export function EquipoSearch({ planta, clienteId, onSelect }) {
  const [query, setQuery] = useState('');
  const [allEquipos, setAllEquipos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCode, setSelectedCode] = useState(null);

  // Carga la lista completa cuando cambia la planta seleccionada
  useEffect(() => {
    if (!planta) {
      // Sin planta seleccionada → limpiamos la lista
      setAllEquipos([]);
      setSelectedCode(null);
      setQuery('');
      return;
    }

    const fetchAll = async () => {
      setIsLoading(true);
      setError(null);
      setSelectedCode(null);
      setQuery('');
      try {
        // q vacío + planta = traer TODOS los equipos de esa planta
        const data = await api.get('/equipos/search', { q: '', planta });
        if (data.success) setAllEquipos(data.data);
        else setError('Error al cargar los equipos');
      } catch {
        setError('No se pudo conectar al servidor');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [planta]); // solo se recarga al cambiar de planta

  // Filtrado client-side por query
  const filtered = useMemo(() => {
    if (!query.trim()) return allEquipos;
    const q = query.toLowerCase();
    return allEquipos.filter(e =>
      (e.cod_metrica  || '').toLowerCase().includes(q) ||
      (e.instrumento  || '').toLowerCase().includes(q) ||
      (e.marca        || '').toLowerCase().includes(q) ||
      (e.modelo       || '').toLowerCase().includes(q) ||
      (e.serie        || '').toLowerCase().includes(q) ||
      (e.ubicacion    || '').toLowerCase().includes(q)
    );
  }, [allEquipos, query]);

  const handleSelect = (equipo) => {
    setSelectedCode(equipo.cod_metrica);
    onSelect?.(equipo);
  };

  // noContext = sin planta seleccionada (aunque haya cliente)
  const noContext = !planta;

  if (selectedCode) {
    const currentEquipo = allEquipos.find(e => e.cod_metrica === selectedCode);
    return (
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-success/25 bg-success/[0.06] p-4 animate-fade-in-up">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/[0.12] text-success">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold text-fg">{selectedCode}</p>
            <p className="mt-0.5 truncate text-xs text-fg-muted">
              {[currentEquipo?.instrumento, currentEquipo?.marca, currentEquipo?.modelo].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedCode(null);
            setQuery('');
          }}
          className="h-9 shrink-0 rounded-xl border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2"
        >
          Seleccionar otro
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 animate-fade-in-up">
      {/* Input de filtro */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={
            !clienteId
              ? 'Selecciona primero un cliente...'
              : !planta
              ? 'Activa "Asociar a Planta" y elige una planta...'
              : `Filtrar en planta ${planta}...`
          }
          aria-label="Filtrar instrumentos"
          disabled={!planta || isLoading}
          autoComplete="off"
          className={cn('field h-10 pl-10 pr-10', noContext && 'opacity-70')}
        />
        {isLoading && (
          <Loader2 className="absolute right-3.5 top-1/2 -mt-2 h-4 w-4 animate-spin text-fg-subtle" aria-hidden="true" />
        )}
        {query && !isLoading && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpiar filtro"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-fg/[0.06] hover:text-fg"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Lista de instrumentos */}
      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-4 py-2.5">
          <p className="text-xs font-medium text-fg-muted">Instrumentos disponibles</p>
          {!isLoading && allEquipos.length > 0 && (
            <p className="text-xs tabular-nums text-fg-subtle">
              {filtered.length} de {allEquipos.length}
            </p>
          )}
        </div>

        <div className="max-h-64 overflow-y-auto">
          {noContext ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <Package className="h-7 w-7 text-fg-subtle" strokeWidth={1.6} aria-hidden="true" />
              <p className="text-sm text-fg-muted">
                {!clienteId
                  ? 'Selecciona un cliente (Paso 1) para comenzar'
                  : 'Selecciona una planta para ver sus instrumentos'}
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-fg-muted" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cargando instrumentos...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-danger" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-fg-muted">
              {allEquipos.length === 0
                ? 'No se encontraron instrumentos registrados en esta planta'
                : `Sin resultados para "${query}"`}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((equipo) => (
                <li key={equipo.cod_metrica}>
                  <button
                    type="button"
                    onClick={() => handleSelect(equipo)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-fg/[0.03] active:bg-fg/[0.06]"
                  >
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" strokeWidth={1.8} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-semibold leading-tight text-fg">
                        {equipo.cod_metrica}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-fg-muted">
                        {[equipo.instrumento, equipo.marca, equipo.modelo].filter(Boolean).join(' · ')}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-fg-subtle">
                        {equipo.serie && <span>S/N: {equipo.serie}</span>}
                        {equipo.cap_max1 != null && <span>Cap: {equipo.cap_max1}</span>}
                        {equipo.ubicacion && <span className="max-w-[220px] truncate">{equipo.ubicacion}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
