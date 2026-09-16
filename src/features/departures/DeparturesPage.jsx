import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useDepartures } from './hooks/useDepartures';
import { DepartureSidebarForm } from './components/DepartureSidebarForm';
import { DeparturesPanels }     from './components/DeparturesPanels';

export function DeparturesPage() {
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

  const control = 'flex h-10 items-center rounded-xl border border-line bg-surface text-fg shadow-xs transition-colors';

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:h-[calc(100dvh-var(--topbar-height))] lg:flex-row 2xl:px-8">

      {/* ════════════════════════════════
          COLUMNA IZQUIERDA — Formulario
          ════════════════════════════════ */}
      <aside className="flex w-full flex-shrink-0 flex-col lg:w-[380px] xl:w-[420px]">
        <DepartureSidebarForm
          tecnicos={tecnicos}
          onSaved={handleSaved}
          saving={saving}
        />
      </aside>

      {/* ════════════════════════════════
          COLUMNA DERECHA — Paneles + toolbar
          ════════════════════════════════ */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">

          {/* Navegador mes */}
          <div className={`${control} overflow-hidden`}>
            <button onClick={() => setViewDate(d => subMonths(d, 1))} aria-label="Mes anterior"
              className="flex h-full items-center gap-1.5 border-r border-line px-3 text-xs text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg">
              <ChevronLeft className="h-4 w-4" />
              <span className="capitalize">{prevLabel}</span>
            </button>
            <span className="px-4 text-[13px] font-semibold capitalize">{periodLabelCap}</span>
            <button onClick={() => setViewDate(d => addMonths(d, 1))} aria-label="Mes siguiente"
              className="flex h-full items-center gap-1.5 border-l border-line px-3 text-xs text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg">
              <span className="capitalize">{nextLabel}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Refrescar */}
          <button onClick={() => fetchDepartures(periodStart, periodEnd)} disabled={loading} title="Recargar" aria-label="Recargar"
            className={`${control} w-10 justify-center hover:bg-surface-2 disabled:opacity-50`}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-fg-muted' : ''}`} />
          </button>

          {/* Búsqueda */}
          <div className={`${control} min-w-[180px] flex-1 gap-2 px-3 focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/15`}>
            <Search className="h-4 w-4 flex-shrink-0 text-fg-subtle" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar personal, tipo, motivo..."
              aria-label="Buscar salidas"
              className="h-full flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle" />
          </div>
        </div>

        {/* Paneles — ocupan el resto del alto disponible */}
        <div className="min-h-0 flex-1">
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
