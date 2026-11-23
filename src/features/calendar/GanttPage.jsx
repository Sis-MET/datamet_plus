import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { Check, Minus, Truck, ChevronLeft, ChevronRight, RefreshCw, Users, WifiOff, CalendarDays, Search, Filter } from 'lucide-react';
import { format, subWeeks, addWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { GanttHeader } from './components/GanttHeader';
import { GanttCompactHeader } from './components/GanttCompactHeader';
import { GanttRow } from './components/GanttRow';
import { GanttHelpButton } from './components/GanttHelpButton';
import { TaskTooltipProvider } from './components/TaskTooltipProvider';
import { getGanttRowLayout } from './utils/ganttRowLayout';
import { cn } from '../../shared/utils/cn';
import { IS_APPLE_PLATFORM } from '../../shared/components/layout/shortcuts';
import { isVehicleResource } from './domain/vehicleAvailability';
import { getAreaLabel } from './domain/areaFilter';
import { useEdgeAutoScroll } from './hooks/useEdgeAutoScroll';

const EDGE_CLICK_SCROLL = 440;

const sortAreasWithPriority = (preferredArea) => ([areaA], [areaB]) => {
  if (preferredArea) {
    if (areaA === preferredArea && areaB !== preferredArea) return -1;
    if (areaB === preferredArea && areaA !== preferredArea) return 1;
  }

  return areaA.localeCompare(areaB);
};

/** Nombre que se muestra de un área: la de vehículos se ve como «Vehículos». */
const areaDisplayName = (area) => (isVehicleResource({ area }) ? 'Vehículos' : area);

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
      data-resource-row={props.tecnico.id}
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
  selectedAreas = [],
  onToggleArea,
  onToggleAllAreas,
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
  onOpenSearch,
  error,
}) {
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const scrollFrameRef = useRef(null);
  const shellRef = useRef(null);
  const headerRef = useRef(null);
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
  const viewportRef = useRef(null);
  const leftCueRef = useRef(null);
  const rightCueRef = useRef(null);

  useEdgeAutoScroll({ viewportRef, scrollRef, leftCueRef, rightCueRef });

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

  const allAreasSelected = areaStats.areasArray.length > 0
    && areaStats.areasArray.every(area => selectedAreas.includes(area.name));
  const someAreasSelected = selectedAreas.length > 0 && !allAreasSelected;
  const noAreaSelected = areaStats.areasArray.length > 0 && selectedAreas.length === 0;

  return (
    <TaskTooltipProvider>
    <div>
      {/* ── Controles de Semana, búsqueda y Recarga ── */}
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

          {/* ── Buscador (Ctrl + K) ── */}
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              className={cn(controlClass, 'calendar-search-trigger gap-2.5 px-3 text-[13px] text-fg-muted hover:bg-surface-2 hover:text-fg sm:ml-auto')}
              aria-keyshortcuts={IS_APPLE_PLATFORM ? 'Meta+K' : 'Control+K'}
              title="Buscar en el cronograma"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="calendar-search-trigger-label">Buscar cliente, OTST, SECA, persona…</span>
              <span className="ml-auto flex items-center gap-1" aria-hidden="true">
                <kbd className="kbd">{IS_APPLE_PLATFORM ? '⌘' : 'Ctrl'}</kbd>
                <kbd className="kbd">K</kbd>
              </span>
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger/[0.07] px-3.5 py-2.5 text-sm text-danger" role="alert">
          <span className="flex min-w-0 items-center gap-2"><WifiOff size={16} className="shrink-0" /><span className="truncate">{error}</span></span>
          <button type="button" onClick={onRefetch} className="shrink-0 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2">Reintentar</button>
        </div>
      )}

      {/* ── Gantt Grid ── */}
      <div className="gantt-scroll-shell" ref={shellRef}>
        <div className="gantt-scroll-tools">
          {/* ── Filtro por área: siempre a la vista, justo sobre la grilla ── */}
          {currentWeekStart && (
            <div className="gantt-area-filter" role="group" aria-label="Filtrar el cronograma por una o varias áreas">
              <span className="gantt-area-filter-label">
                <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                Áreas
              </span>
              <div className="gantt-area-chips">
                <button
                  type="button"
                  aria-pressed={allAreasSelected ? true : someAreasSelected ? 'mixed' : false}
                  onClick={() => onToggleAllAreas?.()}
                  className={cn('gantt-area-chip', allAreasSelected && 'is-active')}
                  title={allAreasSelected ? 'Desmarcar todas las áreas' : 'Marcar todas las áreas'}
                >
                  <span className={cn('gantt-area-chip-check', someAreasSelected && 'is-mixed')} aria-hidden="true">
                    {allAreasSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                    {someAreasSelected && <Minus className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  Todas
                  <span className="gantt-area-chip-count">{areaStats.totalActivos}</span>
                </button>
                {areaStats.areasArray.map(area => {
                  const isSelected = selectedAreas.includes(area.name);
                  const label = areaDisplayName(area.name);
                  return (
                    <button
                      key={area.name}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onToggleArea?.(area.name)}
                      className={cn('gantt-area-chip', isSelected && 'is-active')}
                      title={isSelected ? `Quitar ${label} del filtro` : `Agregar ${label} al filtro`}
                    >
                      <span className="gantt-area-chip-check" aria-hidden="true">
                        {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      {isVehicleResource({ area: area.name }) && <Truck className="h-3.5 w-3.5" aria-hidden="true" />}
                      <span className="truncate">{label}</span>
                      {area.name === preferredArea && <span className="gantt-area-chip-mine">Mi área</span>}
                      <span className="gantt-area-chip-count">{area.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Fechas reducidas que quedan fijas al bajar por el cronograma. */}
        <GanttCompactHeader
          weekDays={weekDays}
          isToday={isToday}
          currentWeekStart={currentWeekStart}
          currentWeekEnd={currentWeekEnd}
          selectedDay={selectedDay}
          scrollRef={scrollRef}
          headerRef={headerRef}
          shellRef={shellRef}
        />

        <div className="gantt-scroll-viewport" ref={viewportRef}>
          <div className={`gantt-scroll-edge gantt-scroll-edge-left ${scrollState.left ? 'is-visible' : ''}`} aria-hidden="true" />
          <div className={`gantt-scroll-edge gantt-scroll-edge-right ${scrollState.right ? 'is-visible' : ''}`} aria-hidden="true" />
          {/* Flechas dentro del calendario: acercar el cursor al borde recorre los días. */}
          <div ref={leftCueRef} className="gantt-edge-cue gantt-edge-cue-left">
            <button
              type="button"
              className="gantt-edge-handle"
              onClick={() => scrollRef.current?.scrollBy({ left: -EDGE_CLICK_SCROLL, behavior: 'smooth' })}
              disabled={!scrollState.left}
              aria-label="Ver días anteriores"
              title="Días anteriores"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          </div>
          <div ref={rightCueRef} className="gantt-edge-cue gantt-edge-cue-right">
            <button
              type="button"
              className="gantt-edge-handle"
              onClick={() => scrollRef.current?.scrollBy({ left: EDGE_CLICK_SCROLL, behavior: 'smooth' })}
              disabled={!scrollState.right}
              aria-label="Ver días siguientes"
              title="Días siguientes"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="gantt-scroll-container" ref={scrollRef} tabIndex={0} aria-label="Cronograma desplazable horizontalmente">
            <div className="gantt-grid">
              <GanttHeader
                weekDays={weekDays}
                previewDays={previewDays}
                isToday={isToday}
                currentWeekStart={currentWeekStart}
                currentWeekEnd={currentWeekEnd}
                selectedDay={selectedDay}
                headerRef={headerRef}
              />

              {/* ══ Técnicos agrupados por Área ══ */}
              {!loading && grupos.length === 0 && (
                <div className="gantt-empty-state" role="status">
                  <Users size={20} />
                  <strong>{noAreaSelected ? 'Ninguna área marcada' : 'No hay recursos para este filtro'}</strong>
                  <span>{noAreaSelected ? 'Marca una o varias áreas para ver a su personal.' : 'Marca otras áreas o recarga el cronograma.'}</span>
                </div>
              )}

              {grupos.map(([area, tecnicosDelArea]) => (
                <React.Fragment key={area}>
                  {/* ── Separador de Área ── */}
                  <div className={cn('gantt-area-separator', isVehicleResource({ area }) && 'gantt-area-separator-vehicles')}>
                    <div className="gantt-area-label">
                      {isVehicleResource({ area }) && <Truck className="h-3.5 w-3.5" aria-hidden="true" />}
                      <span>{areaDisplayName(area)}</span>
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
