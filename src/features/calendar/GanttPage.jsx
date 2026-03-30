import React from 'react';
import { Truck, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { format, isBefore, isAfter, subWeeks, addWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { GanttHeader } from './components/GanttHeader';
import { GanttRow } from './components/GanttRow';
import { GanttLegend } from './components/GanttLegend';
import { VEHICLES } from './hooks/useGantt';

/**
 * Componente presentacional puro: solo renderiza la grilla y la leyenda.
 * Toda la navegación y el título viven en CalendarPage.
 */
export function GanttPage({
  weekDays,
  previewDays = [],
  tecnicos,
  tasksForCell,
  isToday,
  onTaskClick,
  onTaskDrop,
  currentWeekStart,
  currentWeekEnd,
  goToCurrentWeek,
  prevWeek,
  nextWeek,
  onRefetch,
  loading,
}) {

  // Agrupar técnicos por área, ordenados alfabéticamente por área
  const grupos = React.useMemo(() => {
    const map = {};
    tecnicos.forEach(t => {
      const area = (typeof t.area === 'string' && t.area.trim()) ? t.area.trim() : 'Sin Área';
      if (!map[area]) map[area] = [];
      map[area].push(t);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [tecnicos]);

  // Etiquetas de rango para las 3 semanas
  const fmtRange = (start, end) =>
    `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM", { locale: es })}`;
  const prevStart = currentWeekStart ? startOfWeek(subWeeks(currentWeekStart, 1), { weekStartsOn: 1 }) : null;
  const prevEnd   = currentWeekStart ? endOfWeek(subWeeks(currentWeekStart, 1), { weekStartsOn: 1 }) : null;
  const nextStart = currentWeekEnd   ? startOfWeek(addWeeks(currentWeekEnd, 1), { weekStartsOn: 1 }) : null;
  const nextEnd   = currentWeekEnd   ? endOfWeek(addWeeks(currentWeekEnd, 1), { weekStartsOn: 1 }) : null;

  return (
    <div>
      {/* ── Controles de Semana y Recarga ── */}
      {currentWeekStart && (
        <div className="flex items-center gap-2 mb-2 px-0.5">
          <button
            onClick={goToCurrentWeek}
            className="group relative flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-gray-300 hover:text-white rounded-xl backdrop-blur-md bg-white/5 border border-white/10 shadow-sm hover:border-white/20 hover:bg-white/10 transition-colors overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <span className="relative z-10 font-bold text-white">★ Hoy</span>
            <span className="relative z-10 text-gray-400 font-normal">
              {fmtRange(currentWeekStart, currentWeekEnd)}
            </span>
          </button>
          
          <div className="flex rounded-xl overflow-hidden backdrop-blur-md bg-white/5 border border-white/10 shadow-sm hover:border-white/20 transition-colors group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <button
              onClick={prevWeek}
              className="relative z-10 flex items-center gap-1 p-1.5 px-3 text-[10px] text-gray-400 font-medium hover:text-white hover:bg-white/10 transition-colors border-r border-white/10"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-gray-300" />
              <span>{prevStart && prevEnd ? fmtRange(prevStart, prevEnd) : 'Anterior'}</span>
            </button>
            <button
              onClick={nextWeek}
              className="relative z-10 flex items-center gap-1 p-1.5 px-3 text-[10px] text-gray-400 font-medium hover:text-white hover:bg-white/10 transition-colors"
            >
              <span>{nextStart && nextEnd ? fmtRange(nextStart, nextEnd) : 'Próxima'}</span>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            </button>
          </div>

          <button
            onClick={onRefetch}
            disabled={loading}
            className="group relative p-1.5 ml-1 text-gray-300 hover:text-white rounded-xl backdrop-blur-md bg-white/5 border border-white/10 shadow-sm hover:border-white/20 hover:bg-white/10 transition-colors overflow-hidden disabled:opacity-50"
            title="Recargar datos"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <RefreshCw className={`relative z-10 h-4 w-4 ${loading ? 'animate-spin text-primary-400' : ''}`} />
          </button>
        </div>
      )}

      {/* ── Gantt Grid ── */}
      <div className="gantt-scroll-container">
        <div className="gantt-grid">
          <GanttHeader
            weekDays={weekDays}
            previewDays={previewDays}
            isToday={isToday}
            currentWeekStart={currentWeekStart}
            currentWeekEnd={currentWeekEnd}
          />

          {/* ══ Técnicos agrupados por Área ══ */}
          {grupos.map(([area, tecnicosDelArea]) => (
            <React.Fragment key={area}>
              {/* ── Separador de Área ── */}
              <div
                className="flex items-center gap-3 px-4 py-1.5 bg-[#111114] border-b border-gray-700/30"
                style={{ gridColumn: '1 / -1' }}
              >
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">{area}</span>
                <div className="flex-1 h-[1px] bg-gradient-to-r from-gray-700/40 to-transparent" />
                <span className="text-[9px] text-gray-600 font-bold">{tecnicosDelArea.length}</span>
              </div>

              {/* ── Filas del área ── */}
              {tecnicosDelArea.map((tecnico) => (
                <GanttRow
                  key={tecnico.id}
                  tecnico={tecnico}
                  weekDays={weekDays}
                  previewDays={previewDays}
                  tasksForCell={tasksForCell}
                  isToday={isToday}
                  onTaskClick={onTaskClick}
                  onTaskDrop={onTaskDrop}
                />
              ))}
            </React.Fragment>
          ))}

          {/* ══ Sección VEHÍCULOS (Al final) ══ */}
          {VEHICLES.length > 0 && (
            <React.Fragment>
              <div
                className="flex items-center gap-3 px-4 py-1.5 border-b border-blue-500/20 bg-blue-950/30"
                style={{ gridColumn: '1 / -1' }}
              >
                <Truck className="w-3.5 h-3.5 text-blue-400/70" />
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-400/70">Vehículos</span>
                <div className="flex-1 h-[1px] bg-gradient-to-r from-blue-500/20 to-transparent" />
                <span className="text-[9px] text-blue-400/40 font-bold">{VEHICLES.length}</span>
              </div>

              {VEHICLES.map((vehiculo) => (
                <GanttRow
                  key={vehiculo.id}
                  tecnico={vehiculo}
                  weekDays={weekDays}
                  previewDays={previewDays}
                  tasksForCell={tasksForCell}
                  isToday={isToday}
                  onTaskClick={onTaskClick}
                  onTaskDrop={onTaskDrop}
                />
              ))}
            </React.Fragment>
          )}
        </div>
      </div>

      {/* ── Leyenda ── */}
      <GanttLegend />
    </div>
  );
}

