import { useState } from 'react';
import { ChevronRight, ArrowRightLeft, Trash2, CheckCircle2, CalendarClock, XCircle, Car, DatabaseZap, PanelLeftOpen, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCalendarPage } from './hooks/useCalendarPage.jsx';
import { LeftFilterSidebar } from './components/LeftFilterSidebar';
import { CellPopoverForm } from './components/CellPopoverForm';
import { GanttPage } from './GanttPage';
import { DepartureReadOnlyModal } from '../departures/components/DepartureReadOnlyModal';
import { usePageScrollLock } from '../../shared/hooks/usePageScrollLock';

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

  return (
    <main
      className="calendar-workspace calendar-dark w-full h-full flex flex-col px-2 sm:px-4 xl:px-6 2xl:px-8 py-2.5 sm:py-4 relative"
      onDragOver={(e) => {
        if (isDragging) {
           e.preventDefault();
           setDragPos({ x: e.clientX, y: e.clientY });
        }
      }}
    >
      <div className={useMock ? 'mb-3' : ''}>
        <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {useMock && (
              <span className="gantt-mock-badge">
                <DatabaseZap size={10} />
                Datos Oficiales
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsAgendaOpen(true)}
        className="calendar-agenda-trigger mb-2.5 flex min-h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.06] px-3.5 text-sm font-semibold text-slate-100 lg:hidden"
        aria-haspopup="dialog"
        aria-expanded={isAgendaOpen}
      >
        <span className="flex items-center gap-2"><PanelLeftOpen size={17} /> Agenda y detalle del día</span>
        <span className="text-xs font-medium text-slate-300">Abrir</span>
      </button>

      <div className="flex items-start gap-5 xl:gap-6">
        <div className="hidden lg:sticky lg:top-[92px] lg:block lg:w-[280px] lg:flex-none xl:w-[300px]">
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
               const menuW = 180, menuH = 220;
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
        <div className="calendar-agenda-layer fixed inset-0 z-40 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
            onClick={() => setIsAgendaOpen(false)}
            aria-label="Cerrar agenda"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-agenda-title"
            className="calendar-agenda-sheet absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-2xl border border-white/15 bg-[#14161d]/90 p-3 shadow-[0_-18px_55px_-24px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[360px] sm:rounded-none sm:border-y-0 sm:border-r-0 sm:p-4"
          >
            <div className="sticky top-0 z-20 mb-3 flex items-center justify-between rounded-xl bg-[#17181e]/95 px-1 py-1 backdrop-blur-lg">
              <h2 id="calendar-agenda-title" className="text-sm font-semibold text-white">Agenda y detalle</h2>
              <button type="button" onClick={() => setIsAgendaOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Cerrar">
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
           className="fixed z-[9999] pointer-events-none px-2.5 py-1.5 rounded-md bg-blue-600/90 text-white text-[11px] font-bold shadow-lg flex items-center gap-1.5 transition-opacity"
           style={{ left: dragPos.x + 15, top: dragPos.y + 15 }}
         >
           <ArrowRightLeft className="w-3.5 h-3.5" /> Mover Tarea
         </div>
      )}

      {contextMenu.visible && (
         <>
           <div
             className="fixed inset-0 z-[9998]"
             onPointerDown={() => setContextMenu({ visible: false, x: 0, y: 0, task: null, date: null, resourceId: null, showVehicles: false })}
             onContextMenu={(e) => { e.preventDefault(); setContextMenu({ visible: false, x: 0, y: 0, task: null, date: null, resourceId: null, showVehicles: false }); }}
           />
           <div
             className="fixed z-[9999] w-44 overflow-visible rounded-xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.8)] animate-fade-in"
             style={{
               top: contextMenu.y,
               left: contextMenu.x,
               background: 'rgba(30, 30, 35, 0.95)',
               backdropFilter: 'blur(18px) saturate(1.18)'
             }}
           >
              <div className="pointer-events-none px-3 pb-1 pt-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-200">Cambiar Estado</div>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-white/10"
                onClick={(e) => { e.stopPropagation(); handleStateChange('Completado'); }}
              >
                 <CheckCircle2 className="w-3.5 h-3.5" /> Completado
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-semibold text-blue-400 transition-colors hover:bg-white/10"
                onClick={(e) => { e.stopPropagation(); handleStateChange('Reprogramado'); }}
              >
                 <CalendarClock className="w-3.5 h-3.5" /> Reprogramar
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-semibold text-gray-200 transition-colors hover:bg-white/10"
                onClick={(e) => { e.stopPropagation(); handleStateChange('Cancelado'); }}
              >
                 <XCircle className="w-3.5 h-3.5" /> Cancelado
              </button>

              <div className="my-0.5 h-px w-full bg-white/10" />

              <div className="relative">
                 <button
                   className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-white/10"
                   onClick={(e) => { e.stopPropagation(); setContextMenu(prev => ({...prev, showVehicles: !prev.showVehicles})) }}
                 >
                    <div className="flex items-center gap-2">
                       <Car className="w-3.5 h-3.5" /> Asignar Vehículo
                    </div>
                    <ChevronRight className="w-3.5 h-3.5" />
                 </button>

                 {contextMenu.showVehicles && (
                    <div className={`absolute top-0 ${(typeof window !== 'undefined' && contextMenu.x > window.innerWidth - 380) ? 'right-full mr-1' : 'left-full ml-1'} w-44 overflow-hidden rounded-xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.8)] animate-fade-in`}
                         style={{ background: 'rgba(30,30,35,0.98)', backdropFilter: 'blur(18px) saturate(1.18)' }}
                    >
                       <div className="pointer-events-none px-3 pb-1 pt-2.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300">Vehículos</div>
                       <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col py-0.5">
                          {tecnicos.filter(t => t.area === 'VEHÍCULOS').length === 0 && (
                            <span className="px-3 py-2 text-[10px] text-gray-300">Sin vehículos en el sistema</span>
                          )}
                          {tecnicos.filter(t => t.area === 'VEHÍCULOS').map(vehiculo => (
                             <button
                               key={vehiculo.id}
                               onClick={(e) => { e.stopPropagation(); handleAssignVehicleInit(vehiculo); }}
                                className="w-full truncate px-3 py-2 text-left text-[11px] font-semibold text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
                             >
                               {vehiculo.nombre}
                             </button>
                          ))}
                       </div>
                    </div>
                 )}
              </div>

              <div className="my-0.5 h-px w-full bg-white/10" />

              <button
                className="mb-0.5 flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-red-500 transition-colors hover:bg-red-500/10"
                onClick={(e) => { e.stopPropagation(); handleDeleteTask(contextMenu.task, contextMenu.date, contextMenu.resourceId); }}
              >
                 <Trash2 className="w-3.5 h-3.5" /> Eliminar Tarea
              </button>
           </div>
         </>
      )}
    </main>
  );
}
