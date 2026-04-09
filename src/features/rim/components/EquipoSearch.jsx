import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Package, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { useTheme } from '../../../shared/context/ThemeContext';

const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

/**
 * Buscador de equipos con lista siempre visible.
 * - Carga todos los equipos al montar (filtrados por planta o cliente)
 * - El input filtra la lista en el cliente (sin re-fetch)
 * - Al hacer clic en un ítem se auto-completan los campos del instrumento
 */
export function EquipoSearch({ planta, clienteId, onSelect }) {
  const { isDarkGantt } = useTheme();
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
        const res = await fetch(
          `${API_URL}/api/equipos/search?q=&planta=${encodeURIComponent(planta)}`
        );
        const data = await res.json();
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
      <div className="flex flex-col gap-3 animate-fade-in-up">
        <div className={`flex items-center justify-between p-4 rounded-xl border shadow-inner ${isDarkGantt ? 'bg-[#141414] border-primary-500/30' : 'bg-primary-50 border-primary-200'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-full bg-primary-600/20 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-primary-400" />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold truncate ${isDarkGantt ? 'text-primary-300' : 'text-primary-700'}`}>
                {selectedCode}
              </p>
              <p className={`text-xs mt-0.5 truncate ${isDarkGantt ? 'text-gray-400' : 'text-gray-600'}`}>
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
            className="ml-4 shrink-0 px-4 py-2 text-xs font-medium text-white bg-primary-600 hover:bg-primary-500 rounded-lg transition-colors border border-primary-500 shadow-lg shadow-primary-900/40"
          >
            Seleccionar otro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 animate-fade-in-up">
      {/* Input de filtro */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
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
          disabled={!planta || isLoading}
          autoComplete="off"
          className={cn(
            'w-full h-10 pl-9 pr-10 text-sm rounded-md border focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
            isDarkGantt 
              ? 'bg-[#1e1e1e] text-gray-200 placeholder:text-gray-500 border-gray-600' 
              : 'bg-white text-gray-900 placeholder:text-gray-400 border-gray-300',
            noContext && (isDarkGantt ? 'border-gray-700 opacity-50 cursor-not-allowed' : 'opacity-50 cursor-not-allowed')
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 animate-spin" />
        )}
        {query && !isLoading && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Lista de instrumentos */}
      <div className={`border rounded-lg overflow-hidden shadow-2xl ${isDarkGantt ? 'border-gray-700/60' : 'border-gray-200 bg-white'}`}>
        {/* Header de la lista */}
        <div className={`flex items-center justify-between px-3 py-2 border-b ${isDarkGantt ? 'bg-[#252525] border-gray-700/60' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>
            Instrumentos disponibles
          </p>
          {!isLoading && allEquipos.length > 0 && (
            <p className="text-xs text-gray-500">
              {filtered.length} de {allEquipos.length}
            </p>
          )}
        </div>

        {/* Contenido de la lista */}
        <div className={`max-h-56 overflow-y-auto ${isDarkGantt ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
          {noContext ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <Package className={`h-8 w-8 ${isDarkGantt ? 'text-gray-700' : 'text-gray-300'}`} />
              <p className={`text-xs ${isDarkGantt ? 'text-gray-600' : 'text-gray-500'}`}>
                {!clienteId
                  ? 'Selecciona un cliente (Paso 1) para comenzar'
                  : 'Selecciona una planta para ver sus instrumentos'}
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando instrumentos...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <p className="text-sm text-gray-500">
                {allEquipos.length === 0
                  ? 'No se encontraron instrumentos registrados en esta planta'
                  : `Sin resultados para "${query}"`}
              </p>
            </div>
          ) : (
            <ul>
              {filtered.map((equipo, i) => {
                const isSelected = equipo.cod_metrica === selectedCode;
                return (
                  <li
                    key={equipo.cod_metrica}
                    onClick={() => handleSelect(equipo)}
                    className={cn(
                      'flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-all border-b last:border-0',
                      isDarkGantt 
                        ? 'border-gray-700/30 hover:bg-[#252528] active:bg-[#202022]'
                        : 'border-gray-100 hover:bg-gray-50 active:bg-gray-100'
                    )}
                  >
                    {/* Icono de estado */}
                    <div className="mt-0.5 shrink-0">
                      <Package className="h-4 w-4 text-gray-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Código Métrica */}
                      <p className={`text-sm font-mono font-semibold leading-tight ${isDarkGantt ? 'text-gray-200' : 'text-gray-800'}`}>
                        {equipo.cod_metrica}
                      </p>
                      {/* Descripción */}
                      <p className={`text-xs mt-0.5 truncate ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>
                        {[equipo.instrumento, equipo.marca, equipo.modelo].filter(Boolean).join(' · ')}
                      </p>
                      {/* Detalles secundarios */}
                      <div className="flex gap-3 mt-1 flex-wrap">
                        {equipo.serie && (
                          <span className="text-[10px] text-gray-500">S/N: {equipo.serie}</span>
                        )}
                        {equipo.cap_max1 != null && (
                          <span className="text-[10px] text-gray-500">Cap: {equipo.cap_max1}</span>
                        )}
                        {equipo.ubicacion && (
                          <span className="text-[10px] text-gray-500 truncate max-w-[200px]">{equipo.ubicacion}</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
