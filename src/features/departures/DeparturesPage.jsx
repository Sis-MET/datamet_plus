import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useTheme } from '../../shared/context/ThemeContext';
import { useDepartures } from './hooks/useDepartures';
import { DepartureSidebarForm } from './components/DepartureSidebarForm';
import { DeparturesPanels }     from './components/DeparturesPanels';

export function DeparturesPage() {
  const { isDarkGantt } = useTheme();
  const [viewDate, setViewDate] = useState(new Date());
  const [search,   setSearch]   = useState('');

  const { departures, tecnicos, loading, saving, fetchDepartures, saveDeparture, updateDepartureState } = useDepartures();

  const periodStart = startOfMonth(viewDate);
  const periodEnd   = endOfMonth(viewDate);

  useEffect(() => {
    fetchDepartures(periodStart, periodEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate]);

  const filtered = useMemo(() => {
    if (!search.trim()) return departures;
    const q = search.toLowerCase();
    return departures.filter(dep => {
      const tec  = tecnicos.find(t => t.id === dep.tecnicoId);
      const name = (tec?.nombre || dep.tecnicoId || '').toLowerCase();
      return name.includes(q) || dep.tipoSalida.toLowerCase().includes(q) || dep.motivo.toLowerCase().includes(q);
    });
  }, [departures, search, tecnicos]);

  const handleSaved = async (payload) => {
    try {
      await saveDeparture(payload);
      toast.success(`Salida registrada en ${payload.dates.length} día${payload.dates.length > 1 ? 's' : ''} correctamente.`);
      await fetchDepartures(periodStart, periodEnd);
    } catch (err) {
      toast.error(err.message || 'Error al guardar la salida.');
    }
  };

  const handleChangeState = async (dep, newState) => {
    try {
      await updateDepartureState(dep, newState);
      toast.success(`Estado actualizado a "${newState}".`);
      await fetchDepartures(periodStart, periodEnd);
    } catch (err) {
      toast.error(err.message || 'Error al actualizar estado.');
    }
  };

  const periodLabelCap = (() => {
    const s = format(viewDate, 'MMMM yyyy', { locale: es });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();
  const prevLabel = format(subMonths(viewDate, 1), 'MMM yyyy', { locale: es });
  const nextLabel = format(addMonths(viewDate, 1), 'MMM yyyy', { locale: es });

  return (
    <div className="flex gap-4 px-4 sm:px-6 2xl:px-10 py-4 h-[calc(100vh-80px)]">

      {/* ════════════════════════════════
          COLUMNA IZQUIERDA — Formulario
          ════════════════════════════════ */}
      <aside className="w-[380px] xl:w-[420px] flex-shrink-0 flex flex-col">
        <DepartureSidebarForm
          tecnicos={tecnicos}
          onSaved={handleSaved}
          saving={saving}
        />
      </aside>

      {/* ════════════════════════════════
          COLUMNA DERECHA — Paneles + toolbar
          ════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">

        {/* Barra de controles — mismo estilo GanttPage */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">

          {/* Navegador mes */}
          <div className={`flex rounded-xl overflow-hidden backdrop-blur-md shadow-sm transition-colors group relative border ${isDarkGantt ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-white border-gray-200 hover:border-gray-300 shadow-gray-200/50'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <button onClick={() => setViewDate(d => subMonths(d, 1))}
              className={`relative z-10 flex items-center gap-1 p-1.5 px-3 text-[10px] font-medium transition-colors border-r ${isDarkGantt ? 'text-white hover:bg-white/10 border-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-gray-200'}`}>
              <ChevronLeft className={`h-3.5 w-3.5 ${isDarkGantt ? 'text-gray-300' : 'text-gray-500'}`} />
              <span className="capitalize">{prevLabel}</span>
            </button>
            <span className={`relative z-10 px-4 py-1.5 text-[11px] font-bold capitalize ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>{periodLabelCap}</span>
            <button onClick={() => setViewDate(d => addMonths(d, 1))}
              className={`relative z-10 flex items-center gap-1 p-1.5 px-3 text-[10px] font-medium transition-colors border-l ${isDarkGantt ? 'text-white hover:bg-white/10 border-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-gray-200'}`}>
              <span className="capitalize">{nextLabel}</span>
              <ChevronRight className={`h-3.5 w-3.5 ${isDarkGantt ? 'text-gray-300' : 'text-gray-500'}`} />
            </button>
          </div>

          {/* Refrescar */}
          <button onClick={() => fetchDepartures(periodStart, periodEnd)} disabled={loading} title="Recargar"
            className={`group relative p-1.5 rounded-xl backdrop-blur-md shadow-sm transition-colors overflow-hidden disabled:opacity-50 border ${isDarkGantt ? 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 text-white' : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <RefreshCw className={`relative z-10 h-4 w-4 ${loading ? 'animate-spin text-primary-400' : ''}`} />
          </button>

          {/* Búsqueda */}
          <div className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-md shadow-sm border flex-1 min-w-[160px] transition-colors ${isDarkGantt ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-white border-gray-200 hover:border-gray-300 shadow-gray-200/50'}`}>
            <Search className={`h-3.5 w-3.5 flex-shrink-0 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar personal, tipo, motivo..."
              className={`flex-1 bg-transparent text-[11px] font-medium outline-none ${isDarkGantt ? 'text-gray-200 placeholder-gray-600' : 'text-gray-800 placeholder-gray-400'}`} />
          </div>
        </div>

        {/* Paneles — ocupan el resto del alto disponible */}
        <div className="flex-1 min-h-0">
          <DeparturesPanels
            departures={filtered}
            tecnicos={tecnicos}
            loading={loading}
            onChangeState={handleChangeState}
            isAdmin={true}
          />
        </div>
      </div>
    </div>
  );
}
