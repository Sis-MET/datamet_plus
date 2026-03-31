import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, LayoutList, Loader2, DatabaseZap, RefreshCw, ArrowRightLeft, Trash2
} from 'lucide-react';
import { sileo } from 'sileo';

import { useCalendar } from './hooks/useCalendar';
import { useGantt } from './hooks/useGantt';
import { LeftFilterSidebar } from './components/LeftFilterSidebar';
import { CellPopoverForm } from './components/CellPopoverForm';
import { GanttPage } from './GanttPage';
import { safeStorage } from '../../shared/utils/storage';

function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch (e) { return null; }
}

export function CalendarPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedArea, setSelectedArea] = useState('Todas');
  
  // Guardar la cede de click de la grilla (para nuevas tareas)
  const [prefilledDate, setPrefilledDate] = useState(new Date());
  const [prefilledResource, setPrefilledResource] = useState('');
  
  // UX: Modo Mover y ContextMenu
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, task: null, date: null, resourceId: null });

  useEffect(() => {
    const down = (e) => { if (e.key === 'Control') setIsCtrlPressed(true); };
    const up = (e) => { if (e.key === 'Control') setIsCtrlPressed(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', () => setIsCtrlPressed(false)); // Cortar si cambia de tab
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', () => setIsCtrlPressed(false));
    };
  }, []);

  useEffect(() => {
    const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, task: null, date: null, resourceId: null });
    if (contextMenu.visible) window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu.visible]);

  // Determinar permisos del usuario (Priorizar objeto guardado completo sobre el JWT limitado)
  let user = null;
  try {
    user = JSON.parse(safeStorage.getItem('rimmet_user') || 'null');
  } catch (e) {
    // ignore
  }
  if (!user) {
    const token = safeStorage.getItem('rimmet_token');
    user = token ? parseJwt(token) : null;
  }
  
  const isAdmin = String(user?.acceso_cron) === '1'; // 1 = Puede editar todo, 2 = Solo Lectura

  // ── Hook vista Gantt ── (Lo cargamos primero para tener las Tasks)
  const {
    tasks, 
    weekStart,
    weekEnd,
    weekDays,
    previewDays,
    tecnicos,
    loading,
    useMock,
    tasksForCell,
    upsertScheduleCell,
    nextWeek,
    prevWeek,
    goToCurrentWeek,
    goToDate,
    isToday: isTodayGantt,
    refetch,
  } = useGantt();

  // Filtrado de Técnicos Reactivo por Área
  const filteredTecnicos = React.useMemo(() => {
    if (!tecnicos) return [];
    if (selectedArea === 'Todas') return tecnicos;
    return tecnicos.filter(t => {
      const pArea = typeof t.area === 'string' && t.area.trim() !== '' ? t.area.trim() : 'Sin Área';
      return pArea === selectedArea;
    });
  }, [tecnicos, selectedArea]);

  // ── Hook vista mensual ──
  const {
    currentDate,
    selectedDay,
    calendarDays,
    selectedDayEvents,
    monthStats,
    eventsForDay,
    selectDay,
    nextMonth,
    prevMonth,
    goToToday,
    isToday,
    isSameDay,
    isSameMonth,
  } = useCalendar(tasks);

  // ── Auto-Refetch (cada 30 segundos) ──
  React.useEffect(() => {
    const intervalId = setInterval(() => {
      if (refetch) refetch();
    }, 30000);
    return () => clearInterval(intervalId);
  }, [refetch]);

  // Títulos dinámicos
  const monthTitle = format(currentDate, "MMMM yyyy", { locale: es });
  const monthTitleCapitalized = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);


  const handleOpenForm = (evt = null, date = new Date(), resourceId = '') => {
    setEditingEvent(evt);
    setPrefilledDate(date);
    setPrefilledResource(resourceId);
    setIsFormOpen(true);
  };

  const handleSaveForm = async (date, resource, text) => {
    try {
      await upsertScheduleCell(date, resource, text);
      setIsFormOpen(false);
      
      if (!text || (typeof text === 'object' && !text.morning && !text.afternoon) || (typeof text === 'string' && text.trim() === '')) {
        sileo.success({ description: "Celda limpiada correctamente." });
      } else {
        sileo.success({ description: "Actividad guardada correctamente." });
      }
    } catch (err) {
      const isConcurrencyError = err.message?.includes('Otro usuario') || err.message?.includes('otro proceso');
      sileo.error({ 
        description: err.message || "Error al guardar en el calendario",
        // Si es error de concurrencia, mostrarlo más tiempo para que el usuario lo lea
        duration: isConcurrencyError ? 8000 : 4000,
      });
      // Solo cerramos el form si NO es un problema de concurrencia
      // (en concurrencia, preferimos que el usuario pueda recargar antes de volver a intentar)
      if (!isConcurrencyError) {
        // El form permanece abierto si hay otro error técnico
      }
    }
  };

  // Eliminar turno rapido (Click Derecho)
  const handleDeleteTask = async (task, date, resourceId) => {
     setContextMenu({ visible: false, x: 0, y: 0, task: null, date: null, resourceId: null });
     sileo.success({ description: "Borrando turno...", duration: 500 }); // Usando success en vez de loading pq no existe loading
     try {
       const dateObj = new Date(date);
       await upsertScheduleCell(dateObj, resourceId, {
          morning: '', afternoon: '', colorAM: '', colorPM: ''
       }, true);
       await new Promise(r => setTimeout(r, 400));
       if (typeof refetch === 'function') refetch();
       sileo.success({ description: "Turno eliminado" });
     } catch (err) {
       sileo.error({ description: err.message || "Error al borrar turno" });
     }
  };

  const handleTaskDrop = async (sourceTask, targetDate, targetResource, isMoveKey) => {
    if (!sourceTask) return;
    
    // Buscar el nombre del técnico para un mensaje más amigable
    const targetTecnico = tecnicos.find(t => t.id === targetResource);
    const targetName = targetTecnico ? targetTecnico.nombre : targetResource;

    const executeAction = async () => {
      try {
        const targetDateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);
        
        if (isMoveKey && sourceTask.sourceDate) {
          const sourceDateObj = new Date(sourceTask.sourceDate);
          
          // Prevenir mover a la misma celda
          if (targetResource === sourceTask.sourceResource && targetDateObj.getTime() === sourceDateObj.getTime()) {
             return;
          }
          
          // 1. Escribir Destino
          await upsertScheduleCell(targetDateObj, targetResource, {
            morning: sourceTask.morning,
            afternoon: sourceTask.afternoon,
            colorAM: sourceTask.colorAM,
            colorPM: sourceTask.colorPM,
          }, true);
          
          // 2. Limpiar Origen
          await upsertScheduleCell(sourceDateObj, sourceTask.sourceResource, {
            morning: '',
            afternoon: '',
            colorAM: '',
            colorPM: ''
          }, true);
          
          await new Promise(r => setTimeout(r, 400));
          if (typeof refetch === 'function') refetch();
          sileo.success({ description: "Actividad movida correctamente." });
        } else {
          // Copia Normal
          await upsertScheduleCell(targetDateObj, targetResource, {
            morning: sourceTask.morning,
            afternoon: sourceTask.afternoon,
            colorAM: sourceTask.colorAM,
            colorPM: sourceTask.colorPM,
          }, true);

          await new Promise(r => setTimeout(r, 400));
          if (typeof refetch === 'function') refetch();
          sileo.success({ description: "Actividad copiada correctamente." });
        }
      } catch (err) {
        sileo.error({ description: err.message || "Error al procesar la actividad" });
      }
    };

    if (sourceTask.sourceResource && sourceTask.sourceResource !== targetResource) {
      // Diferente técnico: solicitar confirmación
      const handleConfirm = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        executeAction();
        sileo.clear();
      };

      const handleCancel = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        sileo.clear();
      };

      sileo.action({
        title: isMoveKey ? "¿Mover a otro técnico?" : "¿Copiar a otro técnico?",
        duration: 10000,
        description: (
          <div className="flex flex-col gap-3.5 mt-1" onPointerDown={(e) => e.stopPropagation()}>
            <span className="text-[13px] text-gray-600 leading-snug">
              Vas a {isMoveKey ? "mover" : "copiar"} esta actividad a <strong className="font-semibold text-gray-800">{targetName}</strong>. ¿Estás seguro?
            </span>
            <div className="flex items-center gap-2">
              <div
                role="button"
                tabIndex={0}
                onClick={handleConfirm}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleConfirm(e); }}
                className="flex-1 py-1.5 px-4 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl text-[13px] font-semibold transition-colors shadow-sm text-center cursor-pointer"
              >
                Sí, {isMoveKey ? "Mover" : "Copiar"}
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={handleCancel}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCancel(e); }}
                className="flex-1 py-1.5 px-4 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl text-[13px] font-semibold transition-colors shadow-sm text-center cursor-pointer"
              >
                Cancelar
              </div>
            </div>
          </div>
        )
      });
    } else {
      // Mismo técnico (diferente día), copiamos o movemos directo sin preguntar
      executeAction();
    }
  };

  return (
    <main 
      className="w-full h-full flex flex-col px-4 sm:px-6 2xl:px-12 py-6 relative"
      onDragOver={(e) => {
        if (isDragging) {
           e.preventDefault();
           setDragPos({ x: e.clientX, y: e.clientY });
        }
      }}
    >

      {/* ══ Encabezado unificado ══ */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">



          {/* Controles derechos — solo indicadores */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Badge datos de ejemplo (solo Gantt) */}
            {useMock && (
              <span className="gantt-mock-badge">
                <DatabaseZap size={10} />
                Datos Oficiales
              </span>
            )}

          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ══ Panel Lateral Izq — mini-cal + detalle + filtros + leyenda ══ */}
        <div className="order-2 lg:order-1 w-full lg:w-auto">
          <LeftFilterSidebar
            tecnicos={tecnicos}
            selectedArea={selectedArea}
            onSelectArea={setSelectedArea}
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

        {/* ══ Cronograma semanal (Gantt Principal) ══ */}
        <div className="order-1 lg:order-2 flex-1 min-w-0 w-full overflow-x-auto">
          <GanttPage
            weekDays={weekDays}
            previewDays={[]}
            tecnicos={filteredTecnicos}
            tasksForCell={tasksForCell}
            isToday={isTodayGantt}
            onTaskClick={isAdmin ? handleOpenForm : undefined}
            onTaskDrop={isAdmin ? handleTaskDrop : undefined}
            onTaskContextMenu={isAdmin ? (e, task, date, res) => {
               e.preventDefault();
               setContextMenu({ visible: true, x: e.clientX, y: e.clientY, task, date, resourceId: res });
            } : undefined}
            onTaskDragStart={isAdmin ? () => setIsDragging(true) : undefined}
            onTaskDragEnd={isAdmin ? () => setIsDragging(false) : undefined}
            currentWeekStart={weekStart}
            currentWeekEnd={weekEnd}
            goToCurrentWeek={goToCurrentWeek}
            prevWeek={prevWeek}
            nextWeek={nextWeek}
            onRefetch={() => {
               refetch();
               sileo.success({ description: "Cronograma actualizado", duration: 1500 });
            }}
            loading={loading}
          />
        </div>
      </div>

      {/* ══ Modal Flotante de Formulario (Crear/Editar Celda) ══ */}
      <CellPopoverForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveForm}
        event={editingEvent}
        prefilledDate={prefilledDate}
        prefilledResource={prefilledResource}
      />
      
      {/* ── UX Flotantes ── */}
      {isDragging && isCtrlPressed && (
         <div 
           className="fixed z-[9999] pointer-events-none px-2.5 py-1.5 rounded-md bg-blue-600/90 text-white text-[11px] font-bold shadow-lg flex items-center gap-1.5 transition-opacity"
           style={{ left: dragPos.x + 15, top: dragPos.y + 15 }}
         >
           <ArrowRightLeft className="w-3.5 h-3.5" /> Mover
         </div>
      )}

      {contextMenu.visible && (
         <div 
           className="fixed z-[9999] bg-[#1a1f2e] border border-white/20 shadow-2xl rounded-lg w-48 overflow-hidden animate-fade-in"
           style={{ top: contextMenu.y, left: contextMenu.x }}
         >
            <button 
              className="w-full text-left px-4 py-3 text-red-500 hover:bg-red-500/20 flex items-center gap-2.5 text-sm font-semibold transition-colors"
              onClick={(e) => { e.stopPropagation(); handleDeleteTask(contextMenu.task, contextMenu.date, contextMenu.resourceId); }}
            >
               <Trash2 className="w-4 h-4" />
               Eliminar turno
            </button>
         </div>
      )}

    </main>
  );
}
