import { ChevronRight, ArrowRightLeft, Trash2, CheckCircle2, CalendarClock, XCircle, Car, DatabaseZap } from 'lucide-react';
import { toast } from 'sonner';
import { useCalendarPage } from './hooks/useCalendarPage.jsx';
import { LeftFilterSidebar } from './components/LeftFilterSidebar';
import { CellPopoverForm } from './components/CellPopoverForm';
import { GanttPage } from './GanttPage';
import { DepartureReadOnlyModal } from '../departures/components/DepartureReadOnlyModal';

export function CalendarPage() {
  const {
    isDarkGantt,
    weekStart, weekEnd, weekDays, tecnicos, loading, useMock,
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

  return (
    <main
      className={`calendar-workspace ${isDarkGantt ? 'calendar-dark' : 'calendar-light'} w-full h-full flex flex-col px-2 sm:px-4 xl:px-6 2xl:px-8 py-2.5 sm:py-4 relative`}
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

      <div className="flex flex-col lg:flex-row gap-3 xl:gap-5 items-start">
        <div className="order-2 lg:order-1 w-full lg:w-auto lg:max-w-[280px]">
          <LeftFilterSidebar
            tecnicos={tecnicos}
            currentDate={currentDate}
            selectedDay={selectedDay}
            calendarDays={calendarDays}
            onSelectDay={(date) => { selectDay(date); goToDate(date); }}
            eventsForDay={eventsForDay}
            isSameMonth={isSameMonth}
            isSameDay={isSameDay}
            isToday={isToday}
            prevMonth={prevMonth}
            nextMonth={nextMonth}
            selectedDayEvents={selectedDayEvents}
          />
        </div>

        <div className="order-1 lg:order-2 flex-1 min-w-0 w-full">
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
          />
        </div>
      </div>

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
             className={`fixed z-[9999] border rounded-xl w-44 overflow-visible animate-fade-in ${isDarkGantt ? 'border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.8)]' : 'border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.15)]'}`}
             style={{
               top: contextMenu.y,
               left: contextMenu.x,
               background: isDarkGantt ? 'rgba(30, 30, 35, 0.95)' : 'rgba(225, 234, 243, 0.96)',
               backdropFilter: 'blur(18px) saturate(1.18)'
             }}
           >
              <div className={`px-3 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-widest pointer-events-none ${isDarkGantt ? 'text-gray-200' : 'text-gray-500'}`}>Cambiar Estado</div>
              <button
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] font-semibold transition-colors ${isDarkGantt ? 'text-emerald-400 hover:bg-white/10' : 'text-emerald-600 hover:bg-black/5'}`}
                onClick={(e) => { e.stopPropagation(); handleStateChange('Completado'); }}
              >
                 <CheckCircle2 className="w-3.5 h-3.5" /> Completado
              </button>
              <button
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] font-semibold transition-colors ${isDarkGantt ? 'text-blue-400 hover:bg-white/10' : 'text-blue-600 hover:bg-black/5'}`}
                onClick={(e) => { e.stopPropagation(); handleStateChange('Reprogramado'); }}
              >
                 <CalendarClock className="w-3.5 h-3.5" /> Reprogramar
              </button>
              <button
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] font-semibold transition-colors ${isDarkGantt ? 'text-gray-200 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}
                onClick={(e) => { e.stopPropagation(); handleStateChange('Cancelado'); }}
              >
                 <XCircle className="w-3.5 h-3.5" /> Cancelado
              </button>

              <div className={`h-[1px] w-full my-0.5 ${isDarkGantt ? 'bg-white/10' : 'bg-gray-200'}`} />

              <div className="relative">
                 <button
                   className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold transition-colors ${isDarkGantt ? 'text-emerald-300 hover:bg-white/10' : 'text-emerald-600 hover:bg-black/5'}`}
                   onClick={(e) => { e.stopPropagation(); setContextMenu(prev => ({...prev, showVehicles: !prev.showVehicles})) }}
                 >
                    <div className="flex items-center gap-2">
                       <Car className="w-3.5 h-3.5" /> Asignar Vehículo
                    </div>
                    <ChevronRight className="w-3.5 h-3.5" />
                 </button>

                 {contextMenu.showVehicles && (
                    <div className={`absolute top-0 ${(typeof window !== 'undefined' && contextMenu.x > window.innerWidth - 380) ? 'right-full mr-1' : 'left-full ml-1'} w-44 border rounded-xl overflow-hidden animate-fade-in ${isDarkGantt ? 'border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.8)]' : 'border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.15)]'}`}
                         style={{ background: isDarkGantt ? 'rgba(30,30,35,0.98)' : 'rgba(225,234,243,0.98)', backdropFilter: 'blur(18px) saturate(1.18)' }}
                    >
                       <div className={`px-3 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-widest pointer-events-none ${isDarkGantt ? 'text-emerald-300' : 'text-gray-500'}`}>Vehículos</div>
                       <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col py-0.5">
                          {tecnicos.filter(t => t.area === 'VEHÍCULOS').length === 0 && (
                            <span className={`px-3 py-2 text-[10px] ${isDarkGantt ? 'text-gray-300' : 'text-gray-500'}`}>Sin vehículos en el sistema</span>
                          )}
                          {tecnicos.filter(t => t.area === 'VEHÍCULOS').map(vehiculo => (
                             <button
                               key={vehiculo.id}
                               onClick={(e) => { e.stopPropagation(); handleAssignVehicleInit(vehiculo); }}
                                className={`w-full text-left px-3 py-2 text-[11px] font-semibold transition-colors truncate ${isDarkGantt ? 'text-gray-200 hover:bg-white/10 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                             >
                               {vehiculo.nombre}
                             </button>
                          ))}
                       </div>
                    </div>
                 )}
              </div>

              <div className={`h-[1px] w-full my-0.5 ${isDarkGantt ? 'bg-white/10' : 'bg-gray-200'}`} />

              <button
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-[11px] font-semibold transition-colors mb-0.5 ${isDarkGantt ? 'text-red-500 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}
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
