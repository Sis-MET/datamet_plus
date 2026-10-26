import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Search, Users, X } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

// Comparacion sin tildes ni mayusculas, para que "telleria" encuentre "Tellería".
const normalize = (text) => String(text || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .trim();

export function AdditionalResourcesPicker({
  grupos,
  isOpen,
  selectedResources,
  onToggleOpen,
  onToggleResource,
  onSelectArea,
}) {
  const [query, setQuery] = useState('');

  // Al cerrar el bloque se descarta el filtro, para que al reabrirlo se vea la
  // lista completa. Se ajusta en render (y no en un efecto) para no encadenar
  // un segundo render: https://react.dev/reference/react/useState
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen && query) setQuery('');
  }

  // Filtra por nombre de la persona o por nombre del area: escribir el area
  // completa deja visible a todo su personal.
  const filteredGrupos = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return grupos;

    return grupos
      .map(([area, tecnicos]) => [
        area,
        normalize(area).includes(needle)
          ? tecnicos
          : tecnicos.filter(tecnico => normalize(tecnico.nombre).includes(needle)),
      ])
      .filter(([, tecnicos]) => tecnicos.length > 0);
  }, [grupos, query]);

  const hasPersonnel = grupos.length > 0;
  const matchCount = filteredGrupos.reduce((total, [, tecnicos]) => total + tecnicos.length, 0);

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left shadow-xs transition-colors hover:border-fg/20"
      >
        <span className="flex items-center gap-3">
          <Users size={17} className={selectedResources.length > 0 ? 'text-fg' : 'text-fg-muted'} />
          <span className="text-[13px] font-medium text-fg">
            Asignar a más personal
            {selectedResources.length > 0 && (
              <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-accent-fg">
                {selectedResources.length}
              </span>
            )}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 text-fg-muted transition-transform duration-150', isOpen && 'rotate-180')} />
      </button>

      <div className={`task-disclosure ${isOpen ? 'is-open' : ''}`} aria-hidden={!isOpen}>
        <div>
          <div className="mt-2 flex w-full flex-col overflow-hidden rounded-xl border border-line bg-surface">

            {hasPersonnel && (
              <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                <Search size={14} className="shrink-0 text-fg-subtle" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar persona o área..."
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Buscar personal para asignar"
                  className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-fg outline-none placeholder:text-fg-subtle"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Limpiar búsqueda"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-fg/[0.06] hover:text-fg"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col overflow-y-auto" style={{ maxHeight: '200px' }}>
              {!hasPersonnel && (
                <p className="p-3 text-center text-xs text-fg-muted">No hay más personal disponible</p>
              )}
              {hasPersonnel && matchCount === 0 && (
                <p className="p-3 text-center text-xs text-fg-muted">
                  Sin resultados para “{query.trim()}”
                </p>
              )}
              {filteredGrupos.map(([area, tecnicos]) => {
                const allSelected = tecnicos.length > 0 && tecnicos.every(tecnico => selectedResources.includes(tecnico.id));
                return (
                  <div key={area}>
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface-2 px-3 py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{area}</span>
                      <button
                        type="button"
                        onClick={() => onSelectArea(tecnicos)}
                        className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-fg transition-colors hover:bg-fg/[0.07]"
                      >
                        {allSelected ? 'Quitar todos' : 'Todos'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-0.5 p-1">
                      {tecnicos.map(tecnico => {
                        const isSelected = selectedResources.includes(tecnico.id);
                        return (
                          <button
                            type="button"
                            key={tecnico.id}
                            onClick={() => onToggleResource(tecnico.id)}
                            aria-pressed={isSelected}
                            className={cn(
                              'flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
                              isSelected ? 'bg-fg/[0.06]' : 'hover:bg-fg/[0.04]'
                            )}
                          >
                            <span className={cn(
                              'flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors',
                              isSelected ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong bg-surface'
                            )}>
                              {isSelected && <Check size={10} strokeWidth={3} />}
                            </span>
                            <span className={cn('select-none truncate text-[13px]', isSelected ? 'font-medium text-fg' : 'text-fg-muted')}>
                              {tecnico.nombre}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
