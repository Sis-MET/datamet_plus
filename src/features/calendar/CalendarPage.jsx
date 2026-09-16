import { useState } from 'react';
import { ChevronRight, ArrowRightLeft, Trash2, CheckCircle2, CalendarClock, XCircle, Car, DatabaseZap, PanelLeftOpen, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCalendarPage } from './hooks/useCalendarPage.jsx';
import { LeftFilterSidebar } from './components/LeftFilterSidebar';
import { CellPopoverForm } from './components/CellPopoverForm';
import { GanttPage } from './GanttPage';
import { DepartureReadOnlyModal } from '../departures/components/DepartureReadOnlyModal';
import { usePageScrollLock } from '../../shared/hooks/usePageScrollLock';
import { cn } from '../../shared/utils/cn';

const menuItem = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-fg transition-colors hover:bg-fg/[0.06]';

export function CalendarPage() {
  const {
    weekStart, weekEnd, weekDays, tecnicos, loading, error, useMock,
    tasksForCell, refetch, nextWeek, prevWeek, goToCurrentWeek, goToDate, isTodayGantt,
    currentUserArea,
    currentDate, selectedDay, calendarDays, selectedDayEvents,
    eventsForDay, selectDay, nextMonth, prevMonth, isToday, isSameDay, isSameMonth,
    filteredTecnicos, selectedArea, setSelectedArea,
    isFormOpen, editingEvent, prefilledDate, prefilledResource,
    selectedDeparture,
    isDragging, dragPos, isCtrlPressed,
    contextMenu,
    isAdmin, isJefeDeArea, canModifyTask, user,
    handleOpenForm, handleSaveForm, handleDeleteTask,
    handleTaskDrop, handleStateChange,
    handleAssignVehicleInit,
    setIsFormOpen, setSelectedDeparture, setContextMenu,
    setIsDragging, setDragPos,
  } = useCalendarPage();
  const [isAgendaOpen, setIsAgendaOpen] = useState(false);

  usePageScrollLock(isAgendaOpen);

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
            onTaskClick={isAdmin || isJefeDeArea ? (evt, date, res) => {
               if (evt && (evt.creadoEn === 'Salida Personal' || evt.creadoEn === 'SalidaMET')) {
                 setSelectedDeparture({ task: evt, date, resourceId: res });
                 return;
               }
               if (!canModifyTask(date)) {
                  toast.error('No puedes modificar tareas de fechas pasadas.', { duration: 3000 });
                  return;
               }
               handleOpenForm(evt, date, res);
            } : undefined}
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
               handleTaskDrop(sourceTask, targetDate, targetResource, isMoveKey);
            } : undefined}
            onTaskContextMenu={isAdmin || isJefeDeArea ? (e, task, date, res) => {
               e.preventDefault();
               const isOwnPendingTask = String(task?.id_usuario) === String(user?.id) && (task?.estadoAM === 'Pendiente' || task?.estadoAM === 'En Proceso');
               if (!canModifyTask(date) && !isOwnPendingTask) {
                  toast.error('No puedes modificar tareas de fechas pasadas.', { duration: 3000 });
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
            className="calendar-agenda-sheet glass absolute inset-x-2 bottom-2 max-h-[86dvh] overflow-y-auto rounded-[22px] border p-3 sm:inset-y-2 sm:left-auto sm:right-2 sm:max-h-none sm:w-[360px] sm:p-4"
          >
            <div className="sticky top-0 z-20 -mx-1 mb-3 flex items-center justify-between px-1 py-1">
              <h2 id="calendar-agenda-title" className="text-sm font-semibold text-fg">Agenda y detalle</h2>
              <button type="button" onClick={() => setIsAgendaOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <LeftFilterSidebar {...agendaProps} />
          </section>
        </div>
      )}

      {isFormOpen && (
        <CellPopoverForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSaveForm}
          event={editingEvent}
          prefilledDate={prefilledDate}
          prefilledResource={prefilledResource}
          existingTasks={tasksForCell(prefilledResource, prefilledDate)}
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
           className="pointer-events-none fixed z-[9999] flex items-center gap-1.5 rounded-lg bg-fg px-2.5 py-1.5 text-xs font-semibold text-canvas shadow-pop"
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
                          {tecnicos.filter(t => t.area === 'VEHÍCULOS').length === 0 && (
                            <span className="px-2.5 py-2 text-xs text-fg-muted">Sin vehículos en el sistema</span>
                          )}
                          {tecnicos.filter(t => t.area === 'VEHÍCULOS').map(vehiculo => (
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
