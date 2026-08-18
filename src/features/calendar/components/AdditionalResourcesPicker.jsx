import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Search, Users, X } from 'lucide-react';

// Comparacion sin tildes ni mayusculas, para que "telleria" encuentre "Tellería".
const normalize = (text) => String(text || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .trim();

export function AdditionalResourcesPicker({
  grupos,
  isDarkGantt,
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
        className={`flex min-h-11 items-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors w-full justify-between border focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
          isDarkGantt ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-gray-200' : 'bg-slate-100/65 border-slate-500/20 hover:bg-white/55 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <Users size={14} className={selectedResources.length > 0 ? 'text-primary-500' : ''} />
          <span>Asignar a más personal {selectedResources.length > 0 && `(${selectedResources.length})`}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <div className={`task-disclosure ${isOpen ? 'is-open' : ''}`} aria-hidden={!isOpen}>
        <div>
          <div className={`mt-2 w-full rounded-xl border flex flex-col ${isDarkGantt ? 'bg-[#111111] border-[#1f1f23]' : 'bg-slate-100/90 border-slate-500/20 shadow-inner'}`}>

            {hasPersonnel && (
              <div className={`flex items-center gap-2 px-2.5 py-2 border-b ${isDarkGantt ? 'border-white/5' : 'border-slate-500/15'}`}>
                <Search size={13} className={`shrink-0 ${isDarkGantt ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar persona o área..."
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Buscar personal para asignar"
                  className={`min-w-0 flex-1 bg-transparent text-[11px] font-semibold outline-none ${
                    isDarkGantt ? 'text-gray-200 placeholder-gray-600' : 'text-slate-800 placeholder-slate-400'
                  }`}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Limpiar búsqueda"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors ${
                      isDarkGantt ? 'text-slate-500 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-black/5 hover:text-slate-800'
                    }`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            <div className="overflow-y-auto custom-scrollbar flex flex-col" style={{ maxHeight: '180px' }}>
              {!hasPersonnel && (
                <p className="text-xs text-center text-gray-500 p-3">No hay más personal disponible</p>
              )}
              {hasPersonnel && matchCount === 0 && (
                <p className="text-xs text-center text-gray-500 p-3">
                  Sin resultados para “{query.trim()}”
                </p>
              )}
              {filteredGrupos.map(([area, tecnicos], index) => {
                const allSelected = tecnicos.length > 0 && tecnicos.every(tecnico => selectedResources.includes(tecnico.id));
                return (
                  <div key={area} className={index > 0 ? 'mt-2' : ''}>
                    <div className={`flex items-center justify-between px-3 py-2 sticky top-0 z-10 border-b border-transparent ${isDarkGantt ? 'bg-[#1a1a1d]' : 'bg-gray-50'}`}>
                      <span className={`text-[9px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-slate-400' : 'text-slate-600'}`}>{area}</span>
                      <button type="button" onClick={() => onSelectArea(tecnicos)} className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${isDarkGantt ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-100'}`}>
                        {allSelected ? 'Quitar todos' : 'Todos'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-0.5 px-2 pb-1">
                      {tecnicos.map(tecnico => {
                        const isSelected = selectedResources.includes(tecnico.id);
                        return (
                          <button type="button" key={tecnico.id} onClick={() => onToggleResource(tecnico.id)} className={`flex min-h-10 w-full items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${isSelected ? (isDarkGantt ? 'bg-blue-500/20' : 'bg-blue-50') : (isDarkGantt ? 'hover:bg-white/5' : 'hover:bg-black/5')}`}>
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : (isDarkGantt ? 'border-gray-600 bg-transparent' : 'border-gray-300 bg-white')}`}>
                              {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                            </div>
                            <span className={`text-[11px] font-semibold truncate select-none ${isSelected ? (isDarkGantt ? 'text-blue-300' : 'text-blue-700') : (isDarkGantt ? 'text-gray-300' : 'text-gray-700')}`}>
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
