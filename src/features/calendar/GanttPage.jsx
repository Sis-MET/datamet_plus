import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { Truck, ChevronLeft, ChevronRight, RefreshCw, Filter, ChevronDown, Users, WifiOff, CalendarDays } from 'lucide-react';
import { format, subWeeks, addWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { GanttHeader } from './components/GanttHeader';
import { GanttRow } from './components/GanttRow';
import { GanttHelpButton } from './components/GanttHelpButton';
import { TaskTooltipProvider } from './components/TaskTooltipProvider';
import { getGanttRowLayout } from './utils/ganttRowLayout';
import { cn } from '../../shared/utils/cn';
import { isVehicleResource } from './domain/vehicleAvailability';

const getAreaLabel = (area) => (typeof area === 'string' && area.trim() !== '' ? area.trim() : 'Sin Área');

const sortAreasWithPriority = (preferredArea) => ([areaA], [areaB]) => {
  if (preferredArea) {
    if (areaA === preferredArea && areaB !== preferredArea) return -1;
    if (areaB === preferredArea && areaA !== preferredArea) return 1;
  }

  return areaA.localeCompare(areaB);
};

const controlClass = 'calendar-toolbar-control flex items-center rounded-xl border border-line bg-surface text-fg shadow-xs transition-colors duration-150';

const VirtualizedGanttRow = React.memo(function VirtualizedGanttRow(props) {
  const placeholderRef = useRef(null);
  const [isNearViewport, setIsNearViewport] = useState(
    () => typeof IntersectionObserver === 'undefined'
  );
  const layout = useMemo(
    () => getGanttRowLayout(
      props.tecnico.id,
      props.weekDays,
      props.previewDays || [],
      props.tasksForCell
    ),
    [props.previewDays, props.tasksForCell, props.tecnico.id, props.weekDays]
  );

  useEffect(() => {
    const element = placeholderRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { rootMargin: '700px 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={placeholderRef}
      className="gantt-virtual-row"
      style={{ height: `${layout.rowHeight}px` }}
    >
      {isNearViewport && <GanttRow {...props} layout={layout} />}
    </div>
  );
});

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
          || (window.innerWidth <= 1023 ? 136 : 172);
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
    <TaskTooltipProvider>
    <div>
      {/* ── Controles de Semana y Recarga ── */}
      {currentWeekStart && (
        <div className="calendar-toolbar mb-3">
          <div className="calendar-toolbar-group">
            <button
              onClick={goToCurrentWeek}
              className={cn(controlClass, 'gap-2 px-3 text-[13px] hover:bg-surface-2')}
              title="Volver a la semana actual"
            >
              <CalendarDays className="h-4 w-4 text-fg-muted" aria-hidden="true" />
              <span className="font-semibold">Hoy</span>
              <span className="toolbar-range text-fg-muted">
                {fmtRange(currentWeekStart, currentWeekEnd)}
              </span>
            </button>

            <div className={cn(controlClass, 'overflow-hidden')}>
              <button
                onClick={prevWeek}
                className="flex h-full items-center gap-1.5 border-r border-line px-2.5 text-xs text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                title="Semana anterior"
                aria-label="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span className="toolbar-nav-label">{prevStart && prevEnd ? fmtRange(prevStart, prevEnd) : 'Anterior'}</span>
              </button>
              <button
                onClick={nextWeek}
                className="flex h-full items-center gap-1.5 px-2.5 text-xs text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                title="Semana siguiente"
                aria-label="Semana siguiente"
              >
                <span className="toolbar-nav-label">{nextStart && nextEnd ? fmtRange(nextStart, nextEnd) : 'Próxima'}</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <button
              onClick={onRefetch}
              disabled={loading}
              className={cn(controlClass, 'min-w-[38px] justify-center hover:bg-surface-2 disabled:opacity-50')}
              title="Recargar datos"
              aria-label="Recargar datos"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin text-fg-muted')} aria-hidden="true" />
            </button>
          </div>

          {/* ── Filtro por Área ── */}
          <div className={cn('toolbar-filter relative sm:ml-auto', isFilterOpen && 'z-50')}>
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              aria-haspopup="listbox"
              aria-expanded={isFilterOpen}
              className={cn(controlClass, 'gap-2 px-3 text-[13px] hover:bg-surface-2', selectedArea !== 'Todas' && 'border-fg/40')}
              title="Filtrar por Área"
            >
              <Filter className={cn('h-4 w-4', selectedArea !== 'Todas' ? 'text-fg' : 'text-fg-muted')} aria-hidden="true" />
              <span className="max-w-[160px] truncate font-medium">{selectedArea === 'Todas' ? 'Todas las áreas' : selectedArea}</span>
              <ChevronDown className={cn('h-4 w-4 text-fg-subtle transition-transform duration-150', isFilterOpen && 'rotate-180')} aria-hidden="true" />
            </button>

            {isFilterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                <div className="glass absolute right-0 top-full z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border animate-pop-in">
                  <div role="listbox" aria-label="Áreas" className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto p-1.5">
                    <button
                      role="option"
                      aria-selected={selectedArea === 'Todas'}
                      onClick={() => { if(onSelectArea) onSelectArea('Todas'); setIsFilterOpen(false); }}
                      className="menu-item justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                        Todas las Áreas
                      </span>
                      <span className="rounded-full bg-fg/[0.07] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-fg-muted">
                        {areaStats.totalActivos}
                      </span>
                    </button>
                    <div className="mx-1 my-1 h-px bg-line" />
                    {areaStats.areasArray.map(area => (
                      <button
                        key={area.name}
                        role="option"
                        aria-selected={selectedArea === area.name}
                        onClick={() => { if(onSelectArea) onSelectArea(area.name); setIsFilterOpen(false); }}
                        className="menu-item justify-between"
                      >
                        <span className="truncate pr-2">{area.name}</span>
                        <span className="shrink-0 rounded-full bg-fg/[0.07] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-fg-muted">
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
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger/[0.07] px-3.5 py-2.5 text-sm text-danger" role="alert">
          <span className="flex min-w-0 items-center gap-2"><WifiOff size={16} className="shrink-0" /><span className="truncate">{error}</span></span>
          <button type="button" onClick={onRefetch} className="shrink-0 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2">Reintentar</button>
        </div>
      )}

      {/* ── Gantt Grid ── */}
      <div className="gantt-scroll-shell">
        <div className="gantt-scroll-tools" aria-label="Desplazamiento horizontal del calendario">
          <span className="mr-auto hidden pl-0.5 text-xs text-fg-subtle sm:inline">21 días · desplaza para explorar</span>
          <button type="button" onClick={() => scrollRef.current?.scrollBy({ left: -440, behavior: 'smooth' })} disabled={!scrollState.left} aria-label="Ver días anteriores"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => scrollRef.current?.scrollBy({ left: 440, behavior: 'smooth' })} disabled={!scrollState.right} aria-label="Ver días siguientes"><ChevronRight size={16} /></button>
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
                  <div className={cn('gantt-area-separator', isVehicleResource({ area }) && 'gantt-area-separator-vehicles')}>
                    <div className="gantt-area-label">
                      {isVehicleResource({ area }) && <Truck className="h-3.5 w-3.5" aria-hidden="true" />}
                      <span>{isVehicleResource({ area }) ? 'Vehículos' : area}</span>
                      <span className="rounded-full bg-fg/[0.07] px-1.5 py-px text-[10px] font-semibold normal-case tabular-nums tracking-normal text-fg-muted">
                        {tecnicosDelArea.length}
                      </span>
                    </div>
                  </div>

                  {/* ── Filas del área ── */}
                  {tecnicosDelArea.map((tecnico) => (
                    <VirtualizedGanttRow
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
    </TaskTooltipProvider>
  );
}
