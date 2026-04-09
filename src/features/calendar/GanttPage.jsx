import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Truck, ChevronLeft, ChevronRight, RefreshCw, Filter, ChevronDown, Users } from 'lucide-react';
import { format, isBefore, isAfter, subWeeks, addWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { GanttHeader } from './components/GanttHeader';
import { GanttRow } from './components/GanttRow';
import { GanttLegend } from './components/GanttLegend';
import { useTheme } from '../../shared/context/ThemeContext';

/**
 * Componente presentacional puro: solo renderiza la grilla y la leyenda.
 * Toda la navegación y el título viven en CalendarPage.
 */
export function GanttPage({
  weekDays,
  previewDays = [],
  tecnicos,
  allTecnicos = [],
  selectedArea,
  onSelectArea,
  tasksForCell,
  isToday,
  selectedDay,
  onTaskClick,
  onTaskDrop,
  currentWeekStart,
  currentWeekEnd,
  goToCurrentWeek,
  prevWeek,
  nextWeek,
  onRefetch,
  loading,
  onTaskContextMenu,
  onTaskDragStart,
  onTaskDragEnd,
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { isDarkGantt } = useTheme();

  // ── Estadísticas de áreas ──
  const areaStats = useMemo(() => {
    const stats = {};
    let totalActivos = 0;
    allTecnicos.forEach(t => {
      const rawArea = typeof t.area === 'string' && t.area.trim() !== '' ? t.area.trim() : 'Sin Área';
      if (!stats[rawArea]) stats[rawArea] = 0;
      stats[rawArea]++;
      totalActivos++;
    });
    const areasArray = Object.keys(stats).map(areaName => ({
      name: areaName,
      count: stats[areaName]
    })).sort((a, b) => a.name.localeCompare(b.name));
    return { totalActivos, areasArray };
  }, [allTecnicos]);

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

  const scrollRef = useRef(null);

  useEffect(() => {
    if (selectedDay && scrollRef.current) {
      const dateStr = format(selectedDay, 'yyyy-MM-dd');
      const el = scrollRef.current.querySelector(`#gantt-day-${dateStr}`);
      if (el) {
        const containerRect = scrollRef.current.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        
        const stickyWidth = window.innerWidth <= 1023 ? 130 : 160;
        const visibleWidth = containerRect.width - stickyWidth;
        
        const elLeftInContent = elRect.left - containerRect.left + scrollRef.current.scrollLeft;
        const targetX = elLeftInContent - stickyWidth - (visibleWidth / 2) + (elRect.width / 2);

        scrollRef.current.scrollTo({
          left: Math.max(0, targetX),
          behavior: 'smooth'
        });
      }
    }
  }, [selectedDay, weekDays]);

  return (
    <div>
      {/* ── Controles de Semana y Recarga ── */}
      {currentWeekStart && (
        <div className="flex items-center gap-2 mb-2 px-0.5">
          <button
            onClick={goToCurrentWeek}
            className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-xl backdrop-blur-md shadow-sm transition-colors overflow-hidden border ${isDarkGantt ? 'text-gray-300 hover:text-white bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10' : 'text-gray-700 hover:text-gray-900 bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <span className={`relative z-10 font-bold ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>★ Hoy</span>
            <span className={`relative z-10 font-normal ${isDarkGantt ? 'text-gray-400' : 'text-gray-600'}`}>
              {fmtRange(currentWeekStart, currentWeekEnd)}
            </span>
          </button>
          
          <div className={`flex rounded-xl overflow-hidden backdrop-blur-md shadow-sm transition-colors group relative border ${isDarkGantt ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-white border-gray-200 hover:border-gray-300 shadow-gray-200/50'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <button
              onClick={prevWeek}
              className={`relative z-10 flex items-center gap-1 p-1.5 px-3 text-[10px] font-medium transition-colors border-r ${isDarkGantt ? 'text-gray-400 hover:text-white hover:bg-white/10 border-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-gray-200'}`}
            >
              <ChevronLeft className={`h-3.5 w-3.5 ${isDarkGantt ? 'text-gray-300' : 'text-gray-500'}`} />
              <span>{prevStart && prevEnd ? fmtRange(prevStart, prevEnd) : 'Anterior'}</span>
            </button>
            <button
              onClick={nextWeek}
              className={`relative z-10 flex items-center gap-1 p-1.5 px-3 text-[10px] font-medium transition-colors ${isDarkGantt ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
            >
              <span>{nextStart && nextEnd ? fmtRange(nextStart, nextEnd) : 'Próxima'}</span>
              <ChevronRight className={`h-3.5 w-3.5 ${isDarkGantt ? 'text-gray-300' : 'text-gray-500'}`} />
            </button>
          </div>

          <button
            onClick={onRefetch}
            disabled={loading}
            className={`group relative p-1.5 ml-1 rounded-xl backdrop-blur-md shadow-sm transition-colors overflow-hidden disabled:opacity-50 border ${isDarkGantt ? 'text-gray-300 hover:text-white bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
            title="Recargar datos"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <RefreshCw className={`relative z-10 h-4 w-4 ${loading ? 'animate-spin text-primary-400' : ''}`} />
          </button>

          {/* ── Filtro por Área Dropdown ── */}
          <div className={`relative ml-1 ${isFilterOpen ? 'z-50' : ''}`}>
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-xl backdrop-blur-md border shadow-sm transition-colors overflow-hidden ${
                selectedArea !== 'Todas' 
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30' 
                  : (isDarkGantt ? 'bg-white/5 text-gray-300 border-white/10 hover:border-white/20 hover:bg-white/10 hover:text-white' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900')
              }`}
              title="Filtrar por Área"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <Filter className={`relative z-10 h-3.5 w-3.5 transition-colors ${selectedArea !== 'Todas' ? 'text-blue-400' : (isDarkGantt ? 'text-gray-400 group-hover:text-white' : 'text-gray-500 group-hover:text-gray-700')}`} />
              <span className="relative z-10 truncate max-w-[100px]">{selectedArea === 'Todas' ? 'Todas las áreas' : selectedArea}</span>
              <ChevronDown className={`relative z-10 h-3.5 w-3.5 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                <div className={`absolute top-full left-0 mt-2 w-64 rounded-2xl border shadow-2xl overflow-hidden animate-fade-in z-50 transform origin-top-left ${isDarkGantt ? 'border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.8)]' : 'border-gray-200 shadow-gray-200/50'}`} 
                     style={{
                       background: isDarkGantt ? 'rgba(30, 30, 35, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                       backdropFilter: 'blur(16px)'
                     }}>
                  <div className="p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                    <button
                      onClick={() => { if(onSelectArea) onSelectArea('Todas'); setIsFilterOpen(false); }}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold transition-colors ${
                        selectedArea === 'Todas'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : (isDarkGantt ? 'text-gray-300 hover:bg-white/10 hover:text-white border border-transparent' : 'text-gray-700 hover:bg-gray-100 border border-transparent hover:text-gray-900')
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Users className={`w-3.5 h-3.5 ${selectedArea === 'Todas' ? 'opacity-80' : 'opacity-60'}`} />
                        <span>Todas las Áreas</span>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black tracking-wider ${selectedArea === 'Todas' ? 'bg-blue-500/20 text-blue-300' : (isDarkGantt ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-500')}`}>
                        {areaStats.totalActivos}
                      </span>
                    </button>
                    <div className={`h-[1px] w-full my-1 ${isDarkGantt ? 'bg-white/10' : 'bg-gray-200'}`} />
                    {areaStats.areasArray.map(area => (
                      <button
                        key={area.name}
                        onClick={() => { if(onSelectArea) onSelectArea(area.name); setIsFilterOpen(false); }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold transition-colors ${
                          selectedArea === area.name
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : (isDarkGantt ? 'text-gray-300 hover:bg-white/10 hover:text-white border border-transparent' : 'text-gray-700 hover:bg-gray-100 border border-transparent hover:text-gray-900')
                        }`}
                      >
                        <span className="truncate pr-2">{area.name}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black tracking-wider flex-shrink-0 ${selectedArea === area.name ? 'bg-blue-500/20 text-blue-300' : (isDarkGantt ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-500')}`}>
                          {area.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Gantt Grid ── */}
      <div className={`gantt-scroll-container${isDarkGantt ? '' : ' gantt-light'}`} ref={scrollRef}>
        <div className="gantt-grid">
          <GanttHeader
            weekDays={weekDays}
            previewDays={previewDays}
            isToday={isToday}
            currentWeekStart={currentWeekStart}
            currentWeekEnd={currentWeekEnd}
            selectedDay={selectedDay}
          />

          {/* ══ Técnicos agrupados por Área ══ */}
          {grupos.map(([area, tecnicosDelArea]) => (
            <React.Fragment key={area}>
              {/* ── Separador de Área ── */}
              {area === 'VEHÍCULOS' ? (
                <div
                  className={`flex items-center py-1.5 border-b ${isDarkGantt ? 'border-blue-500/20 bg-[#0f172a]' : 'border-blue-300/40 bg-[#e0e7ff]'}`}
                  style={{ gridColumn: '1 / -1' }}
                >
                  <div className={`sticky left-0 z-20 flex items-center gap-3 px-4 py-1 min-w-fit ${isDarkGantt ? 'bg-[#0f172a]' : 'bg-[#e0e7ff]'}`}>
                    <Truck className={`w-3.5 h-3.5 ${isDarkGantt ? 'text-blue-400/70' : 'text-blue-600/70'}`} />
                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${isDarkGantt ? 'text-blue-400/70' : 'text-blue-700/70'}`}>Vehículos</span>
                  </div>
                  <div className={`flex-1 h-[1px] bg-gradient-to-r ${isDarkGantt ? 'from-blue-500/20' : 'from-blue-400/30'} to-transparent ml-2`} />
                  <span className={`text-[9px] font-bold px-4 ${isDarkGantt ? 'text-blue-400/40' : 'text-blue-600/50'}`}>{tecnicosDelArea.length}</span>
                </div>
              ) : (
                <div
                  className={`flex items-center py-1.5 border-b ${isDarkGantt ? 'bg-[#111114] border-gray-700/30' : 'bg-[#dcdce6] border-gray-300/40'}`}
                  style={{ gridColumn: '1 / -1' }}
                >
                  <div className={`sticky left-0 z-20 flex items-center gap-3 px-4 py-1 min-w-fit ${isDarkGantt ? 'bg-[#111114]' : 'bg-[#dcdce6]'}`}>
                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${isDarkGantt ? 'text-gray-500' : 'text-gray-500'}`}>{area}</span>
                  </div>
                  <div className={`flex-1 h-[1px] bg-gradient-to-r ${isDarkGantt ? 'from-gray-700/40' : 'from-gray-400/40'} to-transparent ml-2`} />
                  <span className={`text-[9px] font-bold px-4 ${isDarkGantt ? 'text-gray-600' : 'text-gray-500'}`}>{tecnicosDelArea.length}</span>
                </div>
              )}

              {/* ── Filas del área ── */}
              {tecnicosDelArea.map((tecnico) => (
                <GanttRow
                  key={tecnico.id}
                  tecnico={tecnico}
                  weekDays={weekDays}
                  previewDays={previewDays}
                  tasksForCell={tasksForCell}
                  isToday={isToday}
                  selectedDay={selectedDay}
                  onTaskClick={onTaskClick}
                  onTaskDrop={onTaskDrop}
                  onTaskContextMenu={onTaskContextMenu}
                  onTaskDragStart={onTaskDragStart}
                  onTaskDragEnd={onTaskDragEnd}
                />
              ))}
            </React.Fragment>
          ))}


        </div>
      </div>

      {/* ── Leyenda ── */}
      <GanttLegend />
    </div>
  );
}

