import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, ArrowRightLeft, Trash2, CheckCircle2, CalendarClock, XCircle, Car, DatabaseZap, PanelLeftOpen, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCalendarPage } from './hooks/useCalendarPage.jsx';
import { LeftFilterSidebar } from './components/LeftFilterSidebar';
import { CellPopoverForm } from './components/CellPopoverForm';
import { CalendarSearch } from './components/CalendarSearch';
import { GanttPage } from './GanttPage';
import { DepartureReadOnlyModal } from '../departures/components/DepartureReadOnlyModal';
import { usePageScrollLock } from '../../shared/hooks/usePageScrollLock';
import { cn } from '../../shared/utils/cn';
import { isVehicleResource } from './domain/vehicleAvailability';

const menuItem = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-fg transition-colors hover:bg-fg/[0.06]';

const SALIDAS = new Set(['Salida Personal', 'SalidaMET']);
const FLASH_CLASS = 'gantt-search-flash';
const ESPERA_TAREA_MS = 9000;

/** Espera a que aparezca un elemento (las filas se dibujan al acercarse a la pantalla). */
const esperarElemento = (selector, tiempo = 1800) => new Promise((resolve) => {
  const limite = performance.now() + tiempo;
  const buscar = () => {
    const elemento = document.querySelector(selector);
    if (elemento || performance.now() > limite) resolve(elemento || null);
    else requestAnimationFrame(buscar);
  };
  buscar();
});

/** Resalta un elemento con un anillo que late, sin dejar la clase puesta. */
const destacar = (elemento) => {
  if (!elemento) return;
  elemento.classList.remove(FLASH_CLASS);
  // Reinicia la animación si ya estaba.
  void elemento.offsetWidth;
  elemento.classList.add(FLASH_CLASS);
  window.setTimeout(() => elemento.classList.remove(FLASH_CLASS), 2400);
};

/** Centra en la ventana la fila de una persona o vehículo. */
const centrarFila = (resourceId) => {
  const selector = `[data-resource-row="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(resourceId) : resourceId}"]`;
  const fila = document.querySelector(selector);
  if (!fila) return null;
  const rect = fila.getBoundingClientRect();
  const destino = window.scrollY + rect.top - (window.innerHeight / 2) + Math.min(rect.height, 220) / 2;
  window.scrollTo({ top: Math.max(0, destino), behavior: 'smooth' });
  return selector;
};

export function CalendarPage() {
  const {
    tasks,
    weekStart, weekEnd, weekDays, tecnicos, loading, error, useMock,
    tasksForCell, refetch, nextWeek, prevWeek, goToCurrentWeek, goToDate, isTodayGantt,
    currentUserArea,
    currentDate, selectedDay, calendarDays, selectedDayEvents,
    eventsForDay, selectDay, showDay, nextMonth, prevMonth, isToday, isSameDay, isSameMonth,
    filteredTecnicos, selectedArea, setSelectedArea,
    isFormOpen, editingEvent, editingLinkedTasks, prefilledDate, prefilledResource,
    selectedDeparture,
    isDragging, dragPos, isCtrlPressed,
    contextMenu,
    isAdmin, isJefeDeArea, canModifyTask, getVehicleLockMessage, getTaskLockMessage, user,
    handleOpenForm, handleSaveForm, handleDeleteTask,
    handleTaskDrop, handleStateChange,
    handleAssignVehicleInit,
    setIsFormOpen, setSelectedDeparture, setContextMenu,
    setIsDragging, setDragPos,
  } = useCalendarPage();
  const [isAgendaOpen, setIsAgendaOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // Tarea elegida en el buscador que se espera ver cargada para ubicarla.
  const focusRef = useRef(null);
  const [focusSeq, setFocusSeq] = useState(0);
  const canEdit = isAdmin || isJefeDeArea;

  usePageScrollLock(isAgendaOpen);

  /** Abre la ficha de una tarea (o la salida, de solo lectura); mismo camino que un clic en la grilla. */
  const openTask = useCallback((evt, date, res) => {
    if (evt && SALIDAS.has(evt.creadoEn)) {
      setSelectedDeparture({ task: evt, date, resourceId: res });
      return;
    }
    if (!canModifyTask(date)) {
      toast.error('No puedes modificar tareas de fechas pasadas.', { duration: 3000 });
      return;
    }
    const vehicleLock = getTaskLockMessage(evt, res, date);
    if (vehicleLock) {
      toast.error(vehicleLock, { duration: 5000 });
      return;
    }
    handleOpenForm(evt, date, res);
  }, [canModifyTask, getTaskLockMessage, handleOpenForm, setSelectedDeparture]);

  // Ctrl + K (⌘ K) abre o cierra el buscador; no con una ficha abierta.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== 'k') return;
      if (isFormOpen || selectedDeparture) return;
      event.preventDefault();
      setIsSearchOpen(open => !open);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFormOpen, selectedDeparture]);

  /** Muestra la fila del recurso si el filtro de área la oculta. */
  const revealResource = useCallback((resourceId) => {
    if (selectedArea === 'Todas') return;
    const visible = filteredTecnicos.some(t => t.id === resourceId);
    if (!visible) setSelectedArea('Todas');
  }, [filteredTecnicos, selectedArea, setSelectedArea]);

  const handleSearchTask = useCallback((task, { abrir }) => {
    setIsSearchOpen(false);
    revealResource(task.Tecnico);
    showDay(task.fecha);
    goToDate(task.fecha);
    focusRef.current = { rowId: task.rowId, abrir };
    setFocusSeq(n => n + 1);
  }, [goToDate, revealResource, showDay]);

  const handleSearchResource = useCallback(async (recurso) => {
    setIsSearchOpen(false);
    revealResource(recurso.id);
    await new Promise(resolve => requestAnimationFrame(resolve));
    const selector = centrarFila(recurso.id);
    if (!selector) return;
    destacar(await esperarElemento(`${selector} .gantt-name-col`));
  }, [revealResource]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Las funciones vigentes para abrir la ficha, sin reiniciar la espera.
  const openTaskRef = useRef(openTask);
  const canModifyRef = useRef(canModifyTask);
  useEffect(() => {
    openTaskRef.current = openTask;
    canModifyRef.current = canModifyTask;
  });

  const revealTask = useCallback(async (task, abrir) => {
    await new Promise(resolve => requestAnimationFrame(resolve));
    const selector = centrarFila(task.Tecnico);
    if (selector) destacar(await esperarElemento(`[data-task-id="${task.id}"]`));
    if (!mountedRef.current || !abrir) return;
    if (!canEdit) {
      toast.info('Tarea ubicada en el cronograma.', { description: 'Tu acceso permite verla, no editarla.', duration: 3000 });
      return;
    }
    if (!SALIDAS.has(task.creadoEn) && !canModifyRef.current(task.fecha)) {
      toast.info('Tarea ubicada en el cronograma.', { description: 'Es de una fecha pasada: no se puede editar.', duration: 3500 });
      return;
    }
    window.setTimeout(() => {
      if (mountedRef.current) openTaskRef.current(task, task.fecha, task.Tecnico);
    }, 320);
  }, [canEdit]);

  // Cuando la tarea buscada ya está en las semanas cargadas: se centra su
  // fila, se resalta su ficha y, si se pidió, se abre.
  useEffect(() => {
    const pending = focusRef.current;
    if (!pending || loading) return;
    const task = tasks.find(t => String(t.rowId) === String(pending.rowId));
    if (!task) return;
    focusRef.current = null;
    revealTask(task, pending.abrir);
  }, [focusSeq, loading, revealTask, tasks]);

  // Si la tarea no llega (anulada o borrada mientras tanto), se avisa.
  useEffect(() => {
    if (!focusSeq) return undefined;
    const timer = window.setTimeout(() => {
      if (!focusRef.current) return;
      focusRef.current = null;
      toast.error('No se encontró la tarea en el cronograma.', { description: 'Puede haberse anulado. Recarga e intenta de nuevo.' });
    }, ESPERA_TAREA_MS);
    return () => window.clearTimeout(timer);
  }, [focusSeq]);

  const agendaProps = {
    tecnicos,
    currentDate,
    selectedDay,
    calendarDays,
    onSelectDay: (date) => {
      selectDay(date);
      goToDate(date);
      setIsAgendaOpen(false);
    },
    eventsForDay,
    isSameMonth,
    isSameDay,
    isToday,
    prevMonth,
    nextMonth,
    selectedDayEvents,
  };

  const closeContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, task: null, date: null, resourceId: null, showVehicles: false });

  return (
    <main
      className="calendar-workspace relative flex h-full w-full flex-col px-3 py-3 sm:px-5 sm:py-5 xl:px-6"
      onDragOver={(e) => {
        if (isDragging) {
           e.preventDefault();
           setDragPos({ x: e.clientX, y: e.clientY });
        }
      }}
    >
      {useMock && (
        <div className="mb-3">
          <span className="gantt-mock-badge">
            <DatabaseZap size={12} />
            Datos Oficiales
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsAgendaOpen(true)}
        className="calendar-agenda-trigger mb-3 min-h-11 w-full items-center justify-between rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2"
        aria-haspopup="dialog"
        aria-expanded={isAgendaOpen}
      >
        <span className="flex items-center gap-2"><PanelLeftOpen size={17} className="text-fg-muted" /> Agenda y detalle del día</span>
        <span className="text-xs font-medium text-fg-muted">Abrir</span>
      </button>

      <div className="flex items-start gap-5 xl:gap-6">
        <div className="calendar-agenda-column sticky top-[calc(var(--topbar-height)+1.25rem)] -mx-1 max-h-[calc(100dvh-var(--topbar-height)-2.5rem)] w-[288px] flex-none overflow-y-auto overscroll-contain px-1 pb-1 xl:w-[308px]">
          <LeftFilterSidebar {...agendaProps} />
        </div>

        <div className="min-w-0 flex-1">
          <GanttPage
            weekDays={weekDays}
            previewDays={[]}
            tecnicos={filteredTecnicos}
            allTecnicos={tecnicos}
            currentUserArea={currentUserArea}
            selectedArea={selectedArea}
            onSelectArea={setSelectedArea}
            tasksForCell={tasksForCell}
            isToday={isTodayGantt}
            selectedDay={selectedDay}
            onTaskClick={canEdit ? openTask : undefined}
            onOpenSearch={() => setIsSearchOpen(true)}
            onTaskDrop={isAdmin || isJefeDeArea ? (sourceTask, targetDate, targetResource, isMoveKey) => {
               if (sourceTask?.creadoEn === 'Salida Personal' || sourceTask?.creadoEn === 'SalidaMET' || sourceTask?.estadoAM === 'Salida Personal') {
                  toast.error('Las salidas del personal no se pueden mover ni copiar desde el calendario.', { duration: 3000 });
                  return;
               }
               if (!canModifyTask(targetDate)) {
                  toast.error('No puedes mover o copiar a fechas pasadas.', { duration: 3000 });
                  return;
               }
               if (sourceTask?.sourceDate && !canModifyTask(sourceTask.sourceDate)) {
                  toast.error('No puedes mover tareas de fechas pasadas.', { duration: 3000 });
                  return;
               }
               const vehicleLock = isMoveKey && getVehicleLockMessage(sourceTask, sourceTask?.sourceResource);
               if (vehicleLock) {
                  toast.error(vehicleLock, { duration: 5000 });
                  return;
               }
               handleTaskDrop(sourceTask, targetDate, targetResource, isMoveKey);
            } : undefined}
            onTaskContextMenu={isAdmin || isJefeDeArea ? (e, task, date, res) => {
               e.preventDefault();
               const isOwnPendingTask = String(task?.id_usuario) === String(user?.id) && (task?.estadoAM === 'Pendiente' || task?.estadoAM === 'En Proceso');
               if (!canModifyTask(date) && !isOwnPendingTask) {
                  toast.error('No puedes modificar tareas de fechas pasadas.', { duration: 3000 });
                  return;
               }
               const vehicleLock = getVehicleLockMessage(task, res);
               if (vehicleLock) {
                  toast.error(vehicleLock, { duration: 5000 });
                  return;
               }
               const menuW = 200, menuH = 240;
               const x = e.clientX + menuW > window.innerWidth ? window.innerWidth - menuW - 10 : e.clientX;
               const y = e.clientY + menuH > window.innerHeight ? window.innerHeight - menuH - 10 : e.clientY;
               setContextMenu({ visible: true, x, y, task, date, resourceId: res, showVehicles: false });
            } : undefined}
            onTaskDragStart={isAdmin || isJefeDeArea ? () => setIsDragging(true) : undefined}
            onTaskDragEnd={isAdmin || isJefeDeArea ? () => setIsDragging(false) : undefined}
            currentWeekStart={weekStart}
            currentWeekEnd={weekEnd}
            goToCurrentWeek={goToCurrentWeek}
            prevWeek={prevWeek}
            nextWeek={nextWeek}
            onRefetch={() => {
               refetch();
               toast.success("Cronograma actualizado", { duration: 1500 });
            }}
            loading={loading}
            error={error}
          />
        </div>
      </div>

      {isAgendaOpen && (
        <div className="calendar-agenda-layer fixed inset-0 z-[45]" role="presentation">
          <button
            type="button"
            className="scrim absolute inset-0"
            onClick={() => setIsAgendaOpen(false)}
            aria-label="Cerrar agenda"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-agenda-title"
            className="calendar-agenda-sheet glass absolute inset-x-2 bottom-2 max-h-[86dvh] overflow-y-auto rounded-[22px] border px-3 pb-3 sm:inset-y-2 sm:left-auto sm:right-2 sm:max-h-none sm:w-[360px] sm:px-4 sm:pb-4"
          >
            <div className="calendar-agenda-sheet-header sticky top-0 z-20 -mx-3 mb-3 flex items-center justify-between rounded-t-[20px] px-3 pb-2 pt-3 sm:-mx-4 sm:px-4 sm:pt-4">
              <h2 id="calendar-agenda-title" className="text-sm font-semibold text-fg">Agenda y detalle</h2>
              <button type="button" onClick={() => setIsAgendaOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <LeftFilterSidebar {...agendaProps} />
          </section>
        </div>
      )}

      <CalendarSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        tasks={tasks}
        tecnicos={tecnicos}
        onSelectTask={handleSearchTask}
        onSelectResource={handleSearchResource}
      />

      {isFormOpen && (
        <CellPopoverForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSaveForm}
          event={editingEvent}
          prefilledDate={prefilledDate}
          prefilledResource={prefilledResource}
          existingTasks={tasksForCell(prefilledResource, prefilledDate)}
          linkedTasks={editingLinkedTasks}
          getTasksForResource={tasksForCell}
          tecnicos={tecnicos}
        />
      )}

      {selectedDeparture && (
        <DepartureReadOnlyModal
          task={selectedDeparture.task}
          date={selectedDeparture.date}
          resourceName={
            selectedDeparture.resourceId
              ? (tecnicos.find(t => t.id === selectedDeparture.resourceId)?.nombre || selectedDeparture.resourceId)
              : null
          }
          onClose={() => setSelectedDeparture(null)}
        />
      )}

      {isDragging && isCtrlPressed && (
         <div
           className="pointer-events-none fixed z-[9999] flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-fg shadow-pop"
           style={{ left: dragPos.x + 15, top: dragPos.y + 15 }}
         >
           <ArrowRightLeft className="h-3.5 w-3.5" /> Mover Tarea
         </div>
      )}

      {contextMenu.visible && (
         <>
           <div
             className="fixed inset-0 z-[9998]"
             onPointerDown={closeContextMenu}
             onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
           />
           <div
             role="menu"
             aria-label="Acciones de la tarea"
             className="glass fixed z-[9999] w-[200px] overflow-visible rounded-2xl border p-1.5 animate-pop-in"
             style={{ top: contextMenu.y, left: contextMenu.x }}
           >
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-fg-subtle">Cambiar estado</p>
              <button
                role="menuitem"
                className={menuItem}
                onClick={(e) => { e.stopPropagation(); handleStateChange('Completado'); }}
              >
                 <CheckCircle2 className="h-4 w-4 text-success" /> Completado
              </button>
              <button
                role="menuitem"
                className={menuItem}
                onClick={(e) => { e.stopPropagation(); handleStateChange('Reprogramado'); }}
              >
                 <CalendarClock className="h-4 w-4 text-info" /> Reprogramar
              </button>
              <button
                role="menuitem"
                className={menuItem}
                onClick={(e) => { e.stopPropagation(); handleStateChange('Cancelado'); }}
              >
                 <XCircle className="h-4 w-4 text-fg-muted" /> Cancelado
              </button>

              <div className="mx-1 my-1 h-px bg-line" />

              <div className="relative">
                 <button
                   role="menuitem"
                   aria-haspopup="menu"
                   aria-expanded={contextMenu.showVehicles}
                   className={cn(menuItem, 'justify-between')}
                   onClick={(e) => { e.stopPropagation(); setContextMenu(prev => ({...prev, showVehicles: !prev.showVehicles})) }}
                 >
                    <span className="flex items-center gap-2.5">
                       <Car className="h-4 w-4 text-fg-muted" /> Asignar Vehículo
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-fg-subtle" />
                 </button>

                 {contextMenu.showVehicles && (
                    <div
                      role="menu"
                      aria-label="Vehículos"
                      className={`glass absolute top-0 ${(typeof window !== 'undefined' && contextMenu.x > window.innerWidth - 420) ? 'right-full mr-2' : 'left-full ml-2'} w-[210px] overflow-hidden rounded-2xl border p-1.5 animate-pop-in`}
                    >
                       <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-fg-subtle">Vehículos</p>
                       <div className="flex max-h-48 flex-col overflow-y-auto">
                          {tecnicos.filter(isVehicleResource).length === 0 && (
                            <span className="px-2.5 py-2 text-xs text-fg-muted">Sin vehículos en el sistema</span>
                          )}
                          {tecnicos.filter(isVehicleResource).map(vehiculo => (
                             <button
                               key={vehiculo.id}
                               role="menuitem"
                               onClick={(e) => { e.stopPropagation(); handleAssignVehicleInit(vehiculo); }}
                               className={cn(menuItem, 'block truncate')}
                             >
                               {vehiculo.nombre}
                             </button>
                          ))}
                       </div>
                    </div>
                 )}
              </div>

              <div className="mx-1 my-1 h-px bg-line" />

              <button
                role="menuitem"
                className={cn(menuItem, 'text-danger hover:bg-danger/10')}
                onClick={(e) => { e.stopPropagation(); handleDeleteTask(contextMenu.task, contextMenu.date, contextMenu.resourceId); }}
              >
                 <Trash2 className="h-4 w-4" /> Eliminar Tarea
              </button>
           </div>
         </>
      )}
    </main>
  );
}
