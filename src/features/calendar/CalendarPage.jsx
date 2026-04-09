import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, LayoutList, Loader2, DatabaseZap, RefreshCw, ArrowRightLeft, Trash2, CheckCircle2, CalendarClock, XCircle, Car
} from 'lucide-react';
import { sileo } from 'sileo';

import { useCalendar } from './hooks/useCalendar';
import { useGantt } from './hooks/useGantt';
import { LeftFilterSidebar } from './components/LeftFilterSidebar';
import { CellPopoverForm } from './components/CellPopoverForm';
import { GanttPage } from './GanttPage';
import { safeStorage } from '../../shared/utils/storage';
import { useTheme } from '../../shared/context/ThemeContext';

function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch (e) { return null; }
}

export function CalendarPage() {
  const { isDarkGantt } = useTheme();
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
      return pArea === selectedArea || pArea === 'VEHÍCULOS';
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

  const handleDeleteTask = async (task, date, resourceId) => {
     setContextMenu({ visible: false, x: 0, y: 0, task: null, date: null, resourceId: null, showVehicles: false });

     const targetResourceObj = tecnicos.find(t => t.id === resourceId);
     const isVehiculoTarget = targetResourceObj && targetResourceObj.area === 'VEHÍCULOS';

     if (isVehiculoTarget) {
         const authorName = task.author?.trim();
         const currentUserName = user?.nombre?.trim() || user?.usuario?.trim();
         if (authorName && currentUserName && authorName !== currentUserName && authorName !== 'Sistema') {
             sileo.error({ description: `Acceso denegado: Solo el creador original (${authorName}) puede borrar esta asignación de vehículo.`, duration: 6000 });
             return;
         }
     }

     sileo.success({ description: "Borrando ficha...", duration: 500 }); 
     try {
       const dateObj = new Date(date);
       await upsertScheduleCell(dateObj, resourceId, {
          morning: '', afternoon: '', colorAM: '', colorPM: ''
       }, true);

       // Clean up any vehicles assigned to this service if we are deleting a technician's service
       if (!isVehiculoTarget) {
           const vehicleTasksToClean = tasks.filter(t => {
               if (!isSameDay(t.fecha, dateObj)) return false;
               const isVehiculo = tecnicos.find(tec => tec.id === t.Tecnico)?.area === 'VEHÍCULOS';
               if (!isVehiculo) return false;
               
               const matchAM = task.morning && t.morning === task.morning;
               const matchPM = task.afternoon && t.afternoon === task.afternoon;
               return matchAM || matchPM;
           });

           for (const vTask of vehicleTasksToClean) {
               const cleanAM = task.morning && vTask.morning === task.morning;
               const cleanPM = task.afternoon && vTask.afternoon === task.afternoon;
               await upsertScheduleCell(vTask.fecha, vTask.Tecnico, {
                   morning: cleanAM ? '' : vTask.morning,
                   afternoon: cleanPM ? '' : vTask.afternoon,
                   colorAM: cleanAM ? '' : vTask.colorAM,
                   colorPM: cleanPM ? '' : vTask.colorPM,
                   estadoAM: cleanAM ? null : vTask.estadoAM,
                   estadoPM: cleanPM ? null : vTask.estadoPM
               }, true);
           }
       }

       await new Promise(r => setTimeout(r, 400));
       if (typeof refetch === 'function') refetch();
       sileo.success({ description: "Ficha eliminada" });
     } catch (err) {
       sileo.error({ description: err.message || "Error al borrar ficha" });
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

  // ── Cambio de Estado ──
  const handleStateChange = async (newState) => {
    const { task, date, resourceId } = contextMenu;
    setContextMenu({ ...contextMenu, visible: false });
    
    if (newState === 'Reprogramado') {
       return handleRescheduleInit(task, date, resourceId);
    }
    
    sileo.success({ description: `Marcando como ${newState}...`, duration: 500 });
    try {
      const dateObj = new Date(date);
      await upsertScheduleCell(dateObj, resourceId, {
         morning: task.morning,
         afternoon: task.afternoon,
         colorAM: task.colorAM,
         colorPM: task.colorPM,
         estadoAM: task.morning ? newState : null,
         estadoPM: task.afternoon ? newState : null,
         lastModified: task.timestampUpdated || null
      }, false);
      sileo.success({ description: `Estado actualizado a ${newState}` });
    } catch (err) {
      sileo.error({ description: err.message || "Error al actualizar estado" });
    }
  };

  const executeIntelligentReschedule = async (part, serviceStr, sourceTask, oldDate, newDate) => {
      const diffTime = Math.round((newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffTime === 0) return sileo.success({ description: "No se seleccionó una fecha diferente." });

      const sourceCells = [];
      const isWithinCurrentWeek = (d) => d >= weekStart && d <= weekEnd;

      tasks.forEach(t => {
         if (!isWithinCurrentWeek(t.fecha)) return;
         
         const matchAM = part === 'ambos' || part === 'am' ? t.morning?.trim() === serviceStr?.trim() : false;
         const matchPM = part === 'ambos' || part === 'pm' ? t.afternoon?.trim() === serviceStr?.trim() : false;
         
         if (part === 'ambos') {
            if (t.morning?.trim() === sourceTask.morning?.trim() && t.afternoon?.trim() === sourceTask.afternoon?.trim()) {
               sourceCells.push({ ...t, moveAM: true, movePM: true });
            }
         } else {
            if (matchAM || matchPM) {
               sourceCells.push({ ...t, moveAM: matchAM, movePM: matchPM });
            }
         }
      });

      if (sourceCells.length === 0) {
          sourceCells.push({ ...sourceTask, moveAM: part === 'am' || part === 'ambos', movePM: part === 'pm' || part === 'ambos' });
      }

      const destinationCells = []; 
      let collision = null;

      sourceCells.forEach(sc => {
         const destDate = new Date(sc.fecha.getTime());
         destDate.setDate(destDate.getDate() + diffTime);
         
         const existingTask = tasks.find(t => isSameDay(t.fecha, destDate) && t.Tecnico === sc.Tecnico);
         if (existingTask) {
            const isSource = sourceCells.find(src => src.id === existingTask.id);
            if (!isSource) {
               if (sc.moveAM && existingTask.morning?.trim() && existingTask.morning !== sc.morning) collision = { date: destDate, res: sc.Tecnico, part: 'Mañana' };
               if (sc.movePM && existingTask.afternoon?.trim() && existingTask.afternoon !== sc.afternoon) collision = { date: destDate, res: sc.Tecnico, part: 'Tarde' };
            }
         }
         destinationCells.push({ originCell: sc, destDate });
      });

      if (collision) {
         const tecName = tecnicos.find(t => t.id === collision.res)?.nombre || collision.res;
         return sileo.error({ 
            description: `Colisión detectada: El ${format(collision.date, 'EEEE d', { locale: es })} hay otro servicio agendado por la ${collision.part} para ${tecName}. Reprogramación cancelada.`,
            duration: 8000
         });
      }

      sileo.success({ description: `Moviendo ${sourceCells.length} ficha(s)...`, duration: 4000 });
      try {
         for (const sCell of sourceCells) {
            await upsertScheduleCell(sCell.fecha, sCell.Tecnico, {
               morning: sCell.moveAM ? '' : sCell.morning,
               afternoon: sCell.movePM ? '' : sCell.afternoon,
               colorAM: sCell.moveAM ? '' : sCell.colorAM,
               colorPM: sCell.movePM ? '' : sCell.colorPM,
               estadoAM: sCell.moveAM ? null : sCell.estadoAM,
               estadoPM: sCell.movePM ? null : sCell.estadoPM
            }, true);
         }
         
         for (const { originCell: sCell, destDate } of destinationCells) {
            const existingTask = tasks.find(t => isSameDay(t.fecha, destDate) && t.Tecnico === sCell.Tecnico) || { morning: '', afternoon: '', colorAM: '', colorPM: '' };
            await upsertScheduleCell(destDate, sCell.Tecnico, {
               morning: sCell.moveAM ? sCell.morning : existingTask.morning,
               afternoon: sCell.movePM ? sCell.afternoon : existingTask.afternoon,
               colorAM: sCell.moveAM ? sCell.colorAM : existingTask.colorAM,
               colorPM: sCell.movePM ? sCell.colorPM : existingTask.colorPM,
               estadoAM: sCell.moveAM ? 'Reprogramado' : existingTask.estadoAM,
               estadoPM: sCell.movePM ? 'Reprogramado' : existingTask.estadoPM
            }, true);
         }

         if (typeof refetch === 'function') refetch();
         sileo.success({ description: `Fichas reprogramadas exitosamente.` });
      } catch (e) {
         sileo.error({ description: `Error al reprogramar: ${e.message}` });
         if (typeof refetch === 'function') refetch();
      }
  };

  const promptRescheduleDate = (part, serviceStr, task, date, resourceId) => {
      let selectedDateStr = format(new Date(date), 'yyyy-MM-dd'); 

      const onSubmit = (e) => {
         e.preventDefault();
         sileo.clear();
         const newDateObj = new Date(selectedDateStr + 'T12:00:00');
         const oldDateNoon = new Date(date);
         oldDateNoon.setHours(12, 0, 0, 0);
         executeIntelligentReschedule(part, serviceStr, task, oldDateNoon, newDateObj);
      };

      sileo.action({
         title: "Seleccionar nueva fecha",
         duration: 30000,
         description: (
            <form onSubmit={onSubmit} className="flex flex-col gap-3 mt-2" onPointerDown={e => e.stopPropagation()}>
               <p className="text-[13px] text-gray-600 leading-snug">
                  Se reprogramarán inteligentemente todas las fichas vinculadas de la semana actual.
               </p>
               <input 
                 type="date" 
                 defaultValue={selectedDateStr}
                 onChange={(e) => selectedDateStr = e.target.value}
                 required
                 className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-800 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
               />
               <div className="flex gap-2 pt-1 border-t border-gray-200">
                 <button type="submit" className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors">
                    Continuar
                 </button>
                 <button type="button" onClick={() => sileo.clear()} className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold transition-colors">
                    Cancelar
                 </button>
               </div>
            </form>
         )
      });
  };

  const handleRescheduleInit = (task, date, resourceId) => {
      const hasAM = !!task.morning?.trim();
      const hasPM = !!task.afternoon?.trim();
      
      const proceed = (part, serviceStr) => {
         sileo.clear();
         promptRescheduleDate(part, serviceStr, task, date, resourceId);
      };

      if (hasAM && hasPM) {
         sileo.action({
            title: "¿Qué turno deseas reprogramar?",
            duration: 15000,
            description: (
               <div className="flex flex-col gap-2 mt-2" onPointerDown={e => e.stopPropagation()}>
                  <button onClick={() => proceed('am', task.morning)} className="py-2 px-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-semibold transition-colors text-left truncate">
                     Solo Mañana
                  </button>
                  <button onClick={() => proceed('pm', task.afternoon)} className="py-2 px-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-semibold transition-colors text-left truncate">
                     Solo Tarde
                  </button>
                  <button onClick={() => proceed('ambos', null)} className="py-2 px-3 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-semibold transition-colors text-left">
                     Ficha Completa
                  </button>
                  <button onClick={() => sileo.clear()} className="mt-1 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-semibold transition-colors">
                     Cancelar
                  </button>
               </div>
            )
         });
      } else {
         const targetPart = hasAM ? 'am' : 'pm';
         const serviceStr = hasAM ? task.morning : task.afternoon;
         promptRescheduleDate(targetPart, serviceStr, task, date, resourceId);
      }
  };

  const handleAssignVehicleInit = (vehiculo) => {
      const { task, date, resourceId } = contextMenu;
      setContextMenu({ ...contextMenu, visible: false, showVehicles: false });

      const hasAM = !!task.morning?.trim();
      const hasPM = !!task.afternoon?.trim();

      const proceed = (part, serviceStr) => {
         sileo.clear();
         const oldDateNoon = new Date(date);
         oldDateNoon.setHours(12, 0, 0, 0);
         executeIntelligentVehicleAssign(part, serviceStr, task, oldDateNoon, resourceId, vehiculo);
      };

      if (hasAM && hasPM) {
         sileo.action({
            title: `Asignar ${vehiculo.nombre}`,
            duration: 15000,
            description: (
               <div className="flex flex-col gap-2 mt-2" onPointerDown={e => e.stopPropagation()}>
                  <button onClick={() => proceed('am', task.morning)} className="py-2 px-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-semibold transition-colors text-left truncate">
                     Solo Mañana
                  </button>
                  <button onClick={() => proceed('pm', task.afternoon)} className="py-2 px-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-semibold transition-colors text-left truncate">
                     Solo Tarde
                  </button>
                  <button onClick={() => proceed('ambos', null)} className="py-2 px-3 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-semibold transition-colors text-left">
                     Ficha Completa
                  </button>
                  <button onClick={() => sileo.clear()} className="mt-1 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-semibold transition-colors">
                     Cancelar
                  </button>
               </div>
            )
         });
      } else {
         const targetPart = hasAM ? 'am' : 'pm';
         const serviceStr = hasAM ? task.morning : task.afternoon;
         proceed(targetPart, serviceStr);
      }
  };

  const executeIntelligentVehicleAssign = async (part, serviceStr, sourceTask, sourceDateObj, technicianId, vehiculo) => {
      const isWithinCurrentWeek = (d) => d >= weekStart && d <= weekEnd;
      const associatedDates = [];

      tasks.forEach(t => {
         if (!isWithinCurrentWeek(t.fecha) || t.Tecnico !== technicianId) return;
         
         const matchAM = part === 'ambos' || part === 'am' ? t.morning?.trim() === serviceStr?.trim() : false;
         const matchPM = part === 'ambos' || part === 'pm' ? t.afternoon?.trim() === serviceStr?.trim() : false;
         
         if (part === 'ambos') {
            if (t.morning?.trim() === sourceTask.morning?.trim() && t.afternoon?.trim() === sourceTask.afternoon?.trim()) {
               associatedDates.push({ date: t.fecha, tCell: t, assignAM: true, assignPM: true });
            }
         } else {
            if (matchAM || matchPM) {
               associatedDates.push({ date: t.fecha, tCell: t, assignAM: matchAM, assignPM: matchPM });
            }
         }
      });

      if (associatedDates.length === 0) {
         associatedDates.push({ 
             date: sourceDateObj, 
             tCell: sourceTask, 
             assignAM: part === 'am' || part === 'ambos', 
             assignPM: part === 'pm' || part === 'ambos' 
         });
      }

      let collision = null;

      associatedDates.forEach(dt => {
         const existingVehicleTask = tasks.find(t => isSameDay(t.fecha, dt.date) && t.Tecnico === vehiculo.id);
         
         if (existingVehicleTask) {
             const vehMorningText = existingVehicleTask.morning?.trim();
             const vehAfternoonText = existingVehicleTask.afternoon?.trim();
             
             if (vehMorningText || vehAfternoonText) {
                 const conflictTechTask = tasks.find(t => 
                     isSameDay(t.fecha, dt.date) && 
                     t.Tecnico !== vehiculo.id && 
                     tecnicos.find(tec => tec.id === t.Tecnico)?.area !== 'VEHÍCULOS' &&
                     (t.morning?.trim() === (vehMorningText || vehAfternoonText) || t.afternoon?.trim() === (vehMorningText || vehAfternoonText))
                 );

                 const conflictService = vehMorningText || vehAfternoonText;
                 const conflictTechId = conflictTechTask ? conflictTechTask.Tecnico : null;

                 if (conflictService !== serviceStr || (conflictTechId && conflictTechId !== technicianId)) {
                     collision = { date: dt.date, conflictTechId, service: conflictService };
                 }
             }
         }
      });

      if (collision) {
         let conflictMessage = "un usuario no identificado";
         if (collision.conflictTechId) {
             const culprit = tecnicos.find(t => t.id === collision.conflictTechId);
             if (culprit) conflictMessage = `${culprit.nombre} (${culprit.area})`;
         }

         return sileo.error({
             description: `Cancelado: El ${format(collision.date, 'EEEE d', { locale: es })} el vehículo ya está en uso ocupando "${collision.service}" asignado por ${conflictMessage}.`,
             duration: 9000
         });
      }

      sileo.success({ description: `Asignando vehículo en ${associatedDates.length} jornada(s)...`, duration: 4000 });
      try {
         for (const dt of associatedDates) {
             const existingV = tasks.find(t => isSameDay(t.fecha, dt.date) && t.Tecnico === vehiculo.id) || { morning: '', afternoon: '', colorAM: '', colorPM: '' };
             
             await upsertScheduleCell(dt.date, vehiculo.id, {
                 morning: dt.assignAM ? dt.tCell.morning : existingV.morning,
                 afternoon: dt.assignPM ? dt.tCell.afternoon : existingV.afternoon,
                 colorAM: dt.assignAM ? dt.tCell.colorAM : existingV.colorAM,
                 colorPM: dt.assignPM ? dt.tCell.colorPM : existingV.colorPM,
                 estadoAM: dt.assignAM ? dt.tCell.estadoAM : existingV.estadoAM,
                 estadoPM: dt.assignPM ? dt.tCell.estadoPM : existingV.estadoPM
             }, true);
         }
         
         if (typeof refetch === 'function') refetch();
         sileo.success({ description: "Vehículo asignado correctamente." });
      } catch (err) {
         sileo.error({ description: `Error al asignar: ${err.message}` });
         if (typeof refetch === 'function') refetch();
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
            allTecnicos={tecnicos}
            selectedArea={selectedArea}
            onSelectArea={setSelectedArea}
            tasksForCell={tasksForCell}
            isToday={isTodayGantt}
            selectedDay={selectedDay}
            onTaskClick={isAdmin ? handleOpenForm : undefined}
            onTaskDrop={isAdmin ? handleTaskDrop : undefined}
            onTaskContextMenu={isAdmin ? (e, task, date, res) => {
               e.preventDefault();
               const menuW = 180;
               const menuH = 220;
               const x = e.clientX + menuW > window.innerWidth ? window.innerWidth - menuW - 10 : e.clientX;
               const y = e.clientY + menuH > window.innerHeight ? window.innerHeight - menuH - 10 : e.clientY;
               setContextMenu({ visible: true, x, y, task, date, resourceId: res, showVehicles: false });
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
           <ArrowRightLeft className="w-3.5 h-3.5" /> Mover Ficha
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
               background: isDarkGantt ? 'rgba(30, 30, 35, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
               backdropFilter: 'blur(16px)'
             }}
           >
              <div className="px-3 pt-2.5 pb-1 text-[9px] font-bold text-gray-500 uppercase tracking-widest pointer-events-none">Cambiar Estado</div>
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
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] font-semibold transition-colors ${isDarkGantt ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}
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
                         style={{ background: isDarkGantt ? 'rgba(30,30,35,0.98)' : 'rgba(255,255,255,0.98)', backdropFilter: 'blur(16px)' }}
                    >
                       <div className="px-3 pt-2.5 pb-1 text-[9px] font-bold text-gray-500 uppercase tracking-widest pointer-events-none">Vehículos</div>
                       <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col py-0.5">
                          {tecnicos.filter(t => t.area === 'VEHÍCULOS').length === 0 && (
                            <span className="px-3 py-2 text-[10px] text-gray-500">Sin vehículos en el sistema</span>
                          )}
                          {tecnicos.filter(t => t.area === 'VEHÍCULOS').map(vehiculo => (
                             <button 
                               key={vehiculo.id}
                               onClick={(e) => { e.stopPropagation(); handleAssignVehicleInit(vehiculo); }}
                               className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold transition-colors truncate ${isDarkGantt ? 'text-gray-300 hover:bg-emerald-500/20 hover:text-emerald-300' : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600'}`}
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
                 <Trash2 className="w-3.5 h-3.5" /> Eliminar Ficha
              </button>
           </div>
         </>
      )}

    </main>
  );
}
