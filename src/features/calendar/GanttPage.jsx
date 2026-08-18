import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { Truck, ChevronLeft, ChevronRight, RefreshCw, Filter, ChevronDown, Users, WifiOff } from 'lucide-react';
import { format, subWeeks, addWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { GanttHeader } from './components/GanttHeader';
import { GanttRow } from './components/GanttRow';
import { GanttHelpButton } from './components/GanttHelpButton';

const getAreaLabel = (area) => (typeof area === 'string' && area.trim() !== '' ? area.trim() : 'Sin Área');

const sortAreasWithPriority = (preferredArea) => ([areaA], [areaB]) => {
  if (preferredArea) {
    if (areaA === preferredArea && areaB !== preferredArea) return -1;
    if (areaB === preferredArea && areaA !== preferredArea) return 1;
  }

  return areaA.localeCompare(areaB);
};

/**
 * Componente presentacional puro: solo renderiza la grilla y la leyenda.
 * Toda la navegación y el título viven en CalendarPage.
 */
export function GanttPage({
  weekDays,
  previewDays = [],
  tecnicos,
  allTecnicos = [],
  currentUserArea = '',
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
  error,
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const scrollFrameRef = useRef(null);
  const isDarkGantt = true;
  const preferredArea = currentUserArea ? getAreaLabel(currentUserArea) : '';

  // ── Estadísticas de áreas ──
  const areaStats = useMemo(() => {
    const stats = {};
    let totalActivos = 0;
    allTecnicos.forEach(t => {
      const rawArea = getAreaLabel(t.area);
      if (!stats[rawArea]) stats[rawArea] = 0;
      stats[rawArea]++;
      totalActivos++;
    });
    const areasArray = Object.entries(stats).sort(sortAreasWithPriority(preferredArea)).map(([areaName, count]) => ({
      name: areaName,
      count
    }));
    return { totalActivos, areasArray };
  }, [allTecnicos, preferredArea]);

  // Agrupar técnicos por área, priorizando el área del usuario y luego orden alfabético.
  const grupos = React.useMemo(() => {
    const map = {};
    tecnicos.forEach(t => {
      const area = getAreaLabel(t.area);
      if (!map[area]) map[area] = [];
      map[area].push(t);
    });
    return Object.entries(map).sort(sortAreasWithPriority(preferredArea));
  }, [tecnicos, preferredArea]);

  // Etiquetas de rango para las 3 semanas
  const fmtRange = (start, end) =>
    `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM", { locale: es })}`;
  const prevStart = currentWeekStart ? startOfWeek(subWeeks(currentWeekStart, 1), { weekStartsOn: 1 }) : null;
  const prevEnd   = currentWeekStart ? endOfWeek(subWeeks(currentWeekStart, 1), { weekStartsOn: 1 }) : null;
  const nextStart = currentWeekEnd   ? startOfWeek(addWeeks(currentWeekEnd, 1), { weekStartsOn: 1 }) : null;
  const nextEnd   = currentWeekEnd   ? endOfWeek(addWeeks(currentWeekEnd, 1), { weekStartsOn: 1 }) : null;

  const scrollRef = useRef(null);

  const updateScrollState = useCallback(() => {
    if (scrollFrameRef.current !== null) return;

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const element = scrollRef.current;
      if (!element) return;
      const maxScroll = element.scrollWidth - element.clientWidth;
      const nextState = {
        left: element.scrollLeft > 4,
        right: element.scrollLeft < maxScroll - 4,
      };

      setScrollState(current => (
        current.left === nextState.left && current.right === nextState.right
          ? current
          : nextState
      ));
    });
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    updateScrollState();
    element.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [updateScrollState, weekDays, grupos.length]);

  useEffect(() => {
    if (selectedDay && scrollRef.current) {
      const dateStr = format(selectedDay, 'yyyy-MM-dd');
      const el = scrollRef.current.querySelector(`#gantt-day-${dateStr}`);
      if (el) {
        const containerRect = scrollRef.current.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        
        const stickyWidth = scrollRef.current.querySelector('.gantt-name-col')?.getBoundingClientRect().width
          || (window.innerWidth <= 1023 ? 130 : 160);
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
        <div className="calendar-toolbar mb-2.5 px-0.5 sm:mb-3">
          <div className="calendar-toolbar-group">
          <button
            onClick={goToCurrentWeek}
            className={`calendar-toolbar-control group relative flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-xl shadow-sm transition-colors overflow-hidden border ${isDarkGantt ? 'text-slate-200 hover:text-white bg-[#1b1c22] border-white/10 hover:border-white/20 hover:bg-[#24262d]' : 'text-slate-700 hover:text-slate-950 bg-slate-100 border-slate-500/20 hover:border-slate-500/35 hover:bg-white'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <span className={`relative z-10 font-bold ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>★ Hoy</span>
            <span className={`toolbar-range relative z-10 font-normal ${isDarkGantt ? 'text-slate-200' : 'text-slate-700'}`}>
              {fmtRange(currentWeekStart, currentWeekEnd)}
            </span>
          </button>
          
          <div className={`calendar-toolbar-control flex rounded-xl overflow-hidden shadow-sm transition-colors group relative border ${isDarkGantt ? 'bg-[#1b1c22] border-white/10 hover:border-white/20' : 'bg-slate-100 border-slate-500/20 hover:border-slate-500/35 shadow-slate-700/10'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <button
              onClick={prevWeek}
              className={`relative z-10 flex items-center gap-1 px-2.5 text-[10px] font-medium transition-colors border-r ${isDarkGantt ? 'text-slate-200 hover:text-white hover:bg-white/10 border-white/10' : 'text-slate-700 hover:text-slate-950 hover:bg-white/30 border-slate-500/20'}`}
              title="Semana anterior"
            >
              <ChevronLeft className={`h-3.5 w-3.5 ${isDarkGantt ? 'text-slate-300' : 'text-slate-600'}`} />
              <span className="toolbar-nav-label">{prevStart && prevEnd ? fmtRange(prevStart, prevEnd) : 'Anterior'}</span>
            </button>
            <button
              onClick={nextWeek}
              className={`relative z-10 flex items-center gap-1 px-2.5 text-[10px] font-medium transition-colors ${isDarkGantt ? 'text-slate-200 hover:text-white hover:bg-white/10' : 'text-slate-700 hover:text-slate-950 hover:bg-white/30'}`}
              title="Semana siguiente"
            >
              <span className="toolbar-nav-label">{nextStart && nextEnd ? fmtRange(nextStart, nextEnd) : 'Próxima'}</span>
              <ChevronRight className={`h-3.5 w-3.5 ${isDarkGantt ? 'text-slate-300' : 'text-slate-600'}`} />
            </button>
          </div>

          <button
            onClick={onRefetch}
            disabled={loading}
            className={`calendar-toolbar-control group relative min-w-10 p-2 rounded-xl shadow-sm transition-colors overflow-hidden disabled:opacity-50 border ${isDarkGantt ? 'text-slate-200 hover:text-white bg-[#1b1c22] border-white/10 hover:border-white/20 hover:bg-[#24262d]' : 'text-slate-700 hover:text-slate-950 bg-slate-100 border-slate-500/20 hover:border-slate-500/35 hover:bg-white'}`}
            title="Recargar datos"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <RefreshCw className={`relative z-10 h-4 w-4 ${loading ? 'animate-spin text-primary-400' : ''}`} />
          </button>
          </div>

          {/* ── Filtro por Área Dropdown ── */}
          <div className={`toolbar-filter relative sm:ml-auto ${isFilterOpen ? 'z-50' : ''}`}>
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`calendar-toolbar-control group relative flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-xl border shadow-sm transition-colors overflow-hidden ${
                selectedArea !== 'Todas' 
                  ? isDarkGantt ? 'bg-blue-500/20 text-blue-100 border-blue-500/30 hover:bg-blue-500/30' : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                  : (isDarkGantt ? 'bg-[#1b1c22] text-white border-white/10 hover:border-white/20 hover:bg-[#24262d] hover:text-white' : 'bg-slate-100 text-slate-700 border-slate-500/20 hover:border-slate-500/35 hover:bg-white hover:text-slate-950')
              }`}
              title="Filtrar por Área"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <Filter className={`relative z-10 h-3.5 w-3.5 transition-colors ${selectedArea !== 'Todas' ? 'text-blue-400' : (isDarkGantt ? 'text-white group-hover:text-white' : 'text-gray-500 group-hover:text-gray-700')}`} />
              <span className="relative z-10 truncate max-w-[100px]">{selectedArea === 'Todas' ? 'Todas las áreas' : selectedArea}</span>
              <ChevronDown className={`relative z-10 h-3.5 w-3.5 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                <div className={`absolute right-0 top-full mt-2 w-64 rounded-2xl border shadow-2xl overflow-hidden animate-fade-in z-50 transform origin-top-right ${isDarkGantt ? 'border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.8)]' : 'border-gray-200 shadow-gray-200/50'}`}
                     style={{
                       background: isDarkGantt ? '#18181e' : '#e1eaf3'
                     }}>
                  <div className="p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                    <button
                      onClick={() => { if(onSelectArea) onSelectArea('Todas'); setIsFilterOpen(false); }}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold transition-colors ${
                        selectedArea === 'Todas'
                          ? isDarkGantt ? 'bg-blue-500/20 text-blue-100 border border-blue-500/30' : 'bg-blue-50 text-blue-800 border border-blue-200'
                          : (isDarkGantt ? 'text-gray-200 hover:bg-white/10 hover:text-white border border-transparent' : 'text-gray-700 hover:bg-gray-100 border border-transparent hover:text-gray-900')
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Users className={`w-3.5 h-3.5 ${selectedArea === 'Todas' ? 'opacity-80' : 'opacity-60'}`} />
                        <span>Todas las Áreas</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider ${selectedArea === 'Todas' ? 'bg-blue-500/20 text-blue-200' : 'bg-white/10 text-white/80'}`}>
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
                        <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider ${selectedArea === area.name ? 'bg-blue-500/20 text-blue-200' : 'bg-white/10 text-white/80'}`}>
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

      {error && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-100" role="alert">
          <span className="flex min-w-0 items-center gap-2"><WifiOff size={16} className="shrink-0" /><span className="truncate">{error}</span></span>
          <button type="button" onClick={onRefetch} className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15">Reintentar</button>
        </div>
      )}

      {/* ── Gantt Grid ── */}
      <div className="gantt-scroll-shell">
        <div className="gantt-scroll-tools" aria-label="Desplazamiento horizontal del calendario">
          <span className="hidden text-[11px] text-slate-400 sm:inline">21 días · desplaza para explorar</span>
          <button type="button" onClick={() => scrollRef.current?.scrollBy({ left: -440, behavior: 'smooth' })} disabled={!scrollState.left} aria-label="Ver días anteriores"><ChevronLeft size={15} /></button>
          <button type="button" onClick={() => scrollRef.current?.scrollBy({ left: 440, behavior: 'smooth' })} disabled={!scrollState.right} aria-label="Ver días siguientes"><ChevronRight size={15} /></button>
        </div>
        <div className="gantt-scroll-viewport">
          <div className={`gantt-scroll-edge gantt-scroll-edge-left ${scrollState.left ? 'is-visible' : ''}`} aria-hidden="true" />
          <div className={`gantt-scroll-edge gantt-scroll-edge-right ${scrollState.right ? 'is-visible' : ''}`} aria-hidden="true" />
          <div className="gantt-scroll-container" ref={scrollRef} tabIndex={0} aria-label="Cronograma desplazable horizontalmente">
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
          {!loading && grupos.length === 0 && (
            <div className="gantt-empty-state" role="status">
              <Users size={20} />
              <strong>No hay recursos para este filtro</strong>
              <span>Selecciona otra área o recarga el cronograma.</span>
            </div>
          )}

          {grupos.map(([area, tecnicosDelArea]) => (
            <React.Fragment key={area}>
              {/* ── Separador de Área ── */}
              {area === 'VEHÍCULOS' ? (
                <div className="gantt-area-separator gantt-area-separator-vehicles">
                  <div className={`sticky left-0 z-20 flex items-center gap-3 px-3 sm:px-4 py-1 min-w-fit ${isDarkGantt ? 'bg-[#0f172a]' : 'bg-[#ccdcec]'}`}>
                    <Truck className={`w-3.5 h-3.5 ${isDarkGantt ? 'text-blue-400/70' : 'text-blue-600/70'}`} />
                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${isDarkGantt ? 'text-blue-400/70' : 'text-blue-700/70'}`}>Vehículos</span>
                  </div>
                  <div className={`flex-1 h-[1px] bg-gradient-to-r ${isDarkGantt ? 'from-blue-500/20' : 'from-blue-400/30'} to-transparent ml-2`} />
                  <span className={`text-[9px] font-bold px-4 ${isDarkGantt ? 'text-blue-400/40' : 'text-blue-600/50'}`}>{tecnicosDelArea.length}</span>
                </div>
              ) : (
                <div className="gantt-area-separator">
                  <div className={`sticky left-0 z-20 flex items-center gap-3 px-3 sm:px-4 py-1 min-w-fit ${isDarkGantt ? 'bg-[#111114]' : 'bg-[#ced9e5]'}`}>
                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${isDarkGantt ? 'text-slate-400' : 'text-slate-700'}`}>{area}</span>
                  </div>
                  <div className={`flex-1 h-[1px] bg-gradient-to-r ${isDarkGantt ? 'from-gray-700/40' : 'from-gray-400/40'} to-transparent ml-2`} />
                  <span className={`text-[9px] font-bold px-4 ${isDarkGantt ? 'text-slate-500' : 'text-slate-600'}`}>{tecnicosDelArea.length}</span>
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
        </div>
      </div>

      {/* ── Botón de ayuda flotante ── */}
      <GanttHelpButton />
    </div>
  );
}
