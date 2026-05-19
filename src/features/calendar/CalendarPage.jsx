import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, LayoutList, Loader2, DatabaseZap, RefreshCw, ArrowRightLeft, Trash2, CheckCircle2, CalendarClock, XCircle, Car
} from 'lucide-react';

import { toast } from 'sonner';

import { useCalendar } from './hooks/useCalendar';
import { useGantt } from './hooks/useGantt';
import { LeftFilterSidebar } from './components/LeftFilterSidebar';
import { CellPopoverForm } from './components/CellPopoverForm';
import { GanttPage } from './GanttPage';
import { safeStorage } from '../../shared/utils/storage';
import { useTheme } from '../../shared/context/ThemeContext';
import { DepartureReadOnlyModal } from '../departures/components/DepartureReadOnlyModal';

function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch (e) { return null; }
}

export function CalendarPage() {
  const { isDarkGantt } = useTheme();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedArea, setSelectedArea] = useState('Todas');
  const [selectedDeparture, setSelectedDeparture] = useState(null);
  
  // Guardar la cede de click de la grilla (para nuevas tareas)
  const [prefilledDate, setPrefilledDate] = useState(new Date());
  const [prefilledResource, setPrefilledResource] = useState('');
  
  // UX: Modo Mover y ContextMenu
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, task: null, date: null, resourceId: null });

  // Ref para disparar la alerta de tareas pendientes solo una vez por sesión
  const pendingAlertFiredRef = React.useRef(false);

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
  
  const isAdmin = ['2', '3'].includes(String(user?.acceso_cron)); // 2 = Admin, 3 = Dev
  const isDev = String(user?.acceso_cron) === '3'; // Dev con selector DB

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

  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  };

  const canModifyTask = (date) => {
    if (isDev) return true; // Dev puede todo
    if (!isAdmin) return false; // Normales no pueden
    if (isPastDate(date)) return false; // Admins no pueden editar pasado
    return true;
  };

  // Alerta de tareas pasadas pendientes del usuario (solo se dispara una vez por sesión)
  React.useEffect(() => {
    if (!user || !user.id || !tasks || tasks.length === 0) return;
    // Ya se notificó en esta sesión: no volver a molestar al usuario
    if (pendingAlertFiredRef.current) return;
    
    // Buscar tareas pendientes de fechas pasadas para el usuario logueado
    const pastPendingTasks = tasks.filter(t => {
       if (t.estadoAM !== 'Pendiente' && t.estadoAM !== 'En Proceso') return false;
       if (!isPastDate(t.fecha)) return false;
       return String(t.id_usuario) === String(user.id);
    });

    if (pastPendingTasks.length > 0) {
      pendingAlertFiredRef.current = true; // Marcar como disparado para no repetir
      const alertTask = pastPendingTasks[0];
      const totalCount = pastPendingTasks.length;
      const taskDateStr = format(alertTask.fecha, "EEEE d 'de' MMMM", { locale: es });
      
      toast(`Tienes ${totalCount > 1 ? `${totalCount} tareas pendientes atrasadas` : 'una tarea pendiente atrasada'}`, {
        description: `La más reciente: ${alertTask.morning} del ${taskDateStr}. Por favor, actualiza su estado.`,
        duration: 12000,
        action: {
          label: "Ir a la tarea →",
          onClick: () => {
            // Navegar a la semana de la tarea y luego abrir el context menu
            goToDate(alertTask.fecha);
            // Pequeño delay para que el Gantt se re-renderice en la semana correcta
            setTimeout(() => {
              const taskEl = document.querySelector(`[data-task-id="${alertTask.id}"]`);
              let x = Math.max(10, window.innerWidth / 2 - 90);
              let y = Math.max(10, window.innerHeight / 2 - 60);

              if (taskEl) {
                const rect = taskEl.getBoundingClientRect();
                // Posicionar justo debajo y centrado horizontalmente
                x = rect.left + (rect.width / 2);
                y = rect.bottom + 5;
              }

              // Prevenir que el menú se salga de los bordes de la ventana
              const menuW = 180;
              const menuH = 220;
              if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 10;
              if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 10;

              setContextMenu({
                visible: true, 
                x, 
                y, 
                task: alertTask, 
                date: alertTask.fecha, 
                resourceId: alertTask.Tecnico, 
                showVehicles: false
              });
            }, 400); // 400ms para asegurar que el Gantt haya transicionado la fecha
          }
        }
      });
    }
  }, [tasks, user, goToDate]);

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
        toast.success("Celda limpiada correctamente.");
      } else {
        toast.success("Tarea guardada correctamente.");
      }
    } catch (err) {
      const isConcurrencyError = err.message?.includes('Otro usuario') || err.message?.includes('otro proceso');
      toast.error(err.message || "Error al guardar en el calendario", { 
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
         const authorName = (task.author || '').trim().toLowerCase();
         const currentNombre = (user?.nombre || '').trim().toLowerCase();
         const currentUsuario = (user?.usuario || '').trim().toLowerCase();
         
         const isSystem = authorName === 'sistema';
         const isMatch = (currentNombre && authorName === currentNombre) || (currentUsuario && authorName === currentUsuario);
         
         // Permitimos borrar si es el creador original, si el creador fue 'Sistema', o si el usuario actual es un Administrador
         if (authorName && !isMatch && !isSystem && !isAdmin) {
             toast.error(`Acceso denegado: Solo el creador original (${task.author}) o un administrador puede borrar esta asignación.`, { duration: 6000 });
             return;
         }
     }

     toast.success("Borrando tarea...", { duration: 500 }); 
     try {
       const dateObj = new Date(date);
       await upsertScheduleCell(dateObj, resourceId, {
          rowId: task.rowId,
          morning: ''
       }, true);

       // Clean up any vehicles assigned to this service if we are deleting a technician's service
       if (!isVehiculoTarget) {
           const vehicleTasksToClean = tasks.filter(t => {
               if (!isSameDay(t.fecha, dateObj)) return false;
               const isVehiculo = tecnicos.find(tec => tec.id === t.Tecnico)?.area === 'VEHÍCULOS';
               if (!isVehiculo) return false;
               
               return task.morning && t.morning === task.morning;
           });

           for (const vTask of vehicleTasksToClean) {
               await upsertScheduleCell(vTask.fecha, vTask.Tecnico, {
                   rowId: vTask.rowId,
                   morning: ''
               }, true);
           }
       }

       await new Promise(r => setTimeout(r, 400));
       if (typeof refetch === 'function') refetch();
       toast.success("Tarea eliminada");
     } catch (err) {
       toast.error(err.message || "Error al borrar tarea");
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
          
          // 1. Mover: Mantiene el rowId
          await upsertScheduleCell(targetDateObj, targetResource, {
            rowId: sourceTask.rowId,
            morning: sourceTask.morning,
            descripcion: sourceTask.descripcion,
            colorAM: sourceTask.colorAM,
            estadoAM: sourceTask.estadoAM,
            horaInicio: sourceTask.horaInicio,
            horaFin: sourceTask.horaFin
          }, true);
          
          await new Promise(r => setTimeout(r, 400));
          if (typeof refetch === 'function') refetch();
          toast.success("Tarea movida correctamente.");
        } else {
          // Copia Normal: Crea un nuevo rowId
          await upsertScheduleCell(targetDateObj, targetResource, {
            rowId: null,
            morning: sourceTask.morning,
            descripcion: sourceTask.descripcion,
            colorAM: sourceTask.colorAM,
            estadoAM: sourceTask.estadoAM,
            horaInicio: sourceTask.horaInicio,
            horaFin: sourceTask.horaFin
          }, true);

          await new Promise(r => setTimeout(r, 400));
          if (typeof refetch === 'function') refetch();
          toast.success("Tarea copiada correctamente.");
        }
      } catch (err) {
        toast.error(err.message || "Error al procesar la tarea");
      }
    };

    if (sourceTask.sourceResource && sourceTask.sourceResource !== targetResource) {
      // Diferente técnico: solicitar confirmación
      const handleConfirm = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        executeAction();
        toast.dismiss();
      };

      const handleCancel = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        toast.dismiss();
      };

      toast(isMoveKey ? "¿Mover a otro técnico?" : "¿Copiar a otro técnico?", {
        duration: 10000,
        description: (
          <div className="flex flex-col gap-3.5 mt-1" onPointerDown={(e) => e.stopPropagation()}>
            <span className="text-[13px] text-gray-600 leading-snug">
              Vas a {isMoveKey ? "mover" : "copiar"} esta tarea a <strong className="font-semibold text-gray-800">{targetName}</strong>. ¿Estás seguro?
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
    
    toast.success(`Marcando como ${newState}...`, { duration: 500 });
    try {
      const dateObj = new Date(date);
      await upsertScheduleCell(dateObj, resourceId, {
         rowId: task.rowId,
         morning: task.morning,
         descripcion: task.descripcion,
         colorAM: task.colorAM,
         estadoAM: newState,
         horaInicio: task.horaInicio,
         horaFin: task.horaFin,
         lastModified: task.timestampUpdated || null
      }, false);
      toast.success(`Estado actualizado a ${newState}`);
    } catch (err) {
      toast.error(err.message || "Error al actualizar estado");
    }
  };

  const executeIntelligentReschedule = async (part, serviceStr, sourceTask, oldDate, newDate) => {
      const diffTime = Math.round((newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffTime === 0) return toast.success("No se seleccionó una fecha diferente.");

      const sourceCells = [];
      const isWithinCurrentWeek = (d) => d >= weekStart && d <= weekEnd;

      tasks.forEach(t => {
         if (!isWithinCurrentWeek(t.fecha)) return;
         
         if (t.morning?.trim() === sourceTask.morning?.trim()) {
            sourceCells.push({ ...t, moveAM: true });
         }
      });

      if (sourceCells.length === 0) {
          sourceCells.push({ ...sourceTask, moveAM: true });
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
               if (existingTask.morning?.trim() && existingTask.morning !== sc.morning) collision = { date: destDate, res: sc.Tecnico, part: 'Tarea' };
            }
         }
         destinationCells.push({ originCell: sc, destDate });
      });

      if (collision) {
         const tecName = tecnicos.find(t => t.id === collision.res)?.nombre || collision.res;
         return toast.error(
            `Colisión detectada: El ${format(collision.date, 'EEEE d', { locale: es })} hay otro servicio agendado por la ${collision.part} para ${tecName}. Reprogramación cancelada.`,
            { duration: 8000 }
         );
      }

      toast.success(`Moviendo ${sourceCells.length} tarea(s)...`, { duration: 4000 });
      try {
         for (const sCell of sourceCells) {
            await upsertScheduleCell(sCell.fecha, sCell.Tecnico, {
               rowId: sCell.rowId,
               morning: ''
            }, true);
         }
         
         for (const { originCell: sCell, destDate } of destinationCells) {
            await upsertScheduleCell(destDate, sCell.Tecnico, {
               rowId: null,
               morning: sCell.morning,
               descripcion: sCell.descripcion,
               colorAM: sCell.colorAM,
               estadoAM: 'Reprogramado',
               horaInicio: sCell.horaInicio,
               horaFin: sCell.horaFin
            }, true);
         }

         if (typeof refetch === 'function') refetch();
         toast.success(`Tareas reprogramadas exitosamente.`);
      } catch (e) {
         toast.error(`Error al reprogramar: ${e.message}`);
         if (typeof refetch === 'function') refetch();
      }
  };

  const promptRescheduleDate = (part, serviceStr, task, date, resourceId) => {
      let selectedDateStr = format(new Date(date), 'yyyy-MM-dd'); 

      const onSubmit = (e) => {
         e.preventDefault();
         toast.dismiss();
         const newDateObj = new Date(selectedDateStr + 'T12:00:00');
         const oldDateNoon = new Date(date);
         oldDateNoon.setHours(12, 0, 0, 0);
         executeIntelligentReschedule(part, serviceStr, task, oldDateNoon, newDateObj);
      };

      // Limpiar cualquier notificación previa antes de mostrar el formulario
      toast.dismiss();
      toast("Seleccionar nueva fecha", {
         duration: 30000,
         description: (
            <form onSubmit={onSubmit} className="flex flex-col gap-3 mt-2" onPointerDown={e => e.stopPropagation()}>
               <p className="text-[13px] text-gray-600 leading-snug">
                  Se reprogramarán las tareas vinculadas de la semana actual.
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
                 <button type="button" onClick={() => toast.dismiss()} className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold transition-colors">
                    Cancelar
                 </button>
               </div>
            </form>
         )
      });
  };

  const handleRescheduleInit = (task, date, resourceId) => {
      promptRescheduleDate('ambos', task.morning, task, date, resourceId);
  };

  const handleAssignVehicleInit = (vehiculo) => {
      const { task, date, resourceId } = contextMenu;
      setContextMenu({ ...contextMenu, visible: false, showVehicles: false });

      toast.dismiss();
      const oldDateNoon = new Date(date);
      oldDateNoon.setHours(12, 0, 0, 0);
      executeIntelligentVehicleAssign('ambos', task.morning, task, oldDateNoon, resourceId, vehiculo);
  };

  const executeIntelligentVehicleAssign = async (part, serviceStr, sourceTask, sourceDateObj, technicianId, vehiculo) => {
      const isWithinCurrentWeek = (d) => d >= weekStart && d <= weekEnd;
      const associatedDates = [];

      tasks.forEach(t => {
         if (!isWithinCurrentWeek(t.fecha) || t.Tecnico !== technicianId) return;
         
         if (t.morning?.trim() === sourceTask.morning?.trim()) {
            associatedDates.push({ date: t.fecha, tCell: t });
         }
      });

      if (associatedDates.length === 0) {
         associatedDates.push({ date: sourceDateObj, tCell: sourceTask });
      }

      let collision = null;

      associatedDates.forEach(dt => {
         const existingVehicleTask = tasks.find(t => isSameDay(t.fecha, dt.date) && t.Tecnico === vehiculo.id);
         
         if (existingVehicleTask) {
             const vehMorningText = existingVehicleTask.morning?.trim();
             
             if (vehMorningText) {
                 const conflictTechTask = tasks.find(t => 
                     isSameDay(t.fecha, dt.date) && 
                     t.Tecnico !== vehiculo.id && 
                     tecnicos.find(tec => tec.id === t.Tecnico)?.area !== 'VEHÍCULOS' &&
                     (t.morning?.trim() === vehMorningText)
                 );

                 const conflictService = vehMorningText;
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

         return toast.error(
             `Cancelado: El ${format(collision.date, 'EEEE d', { locale: es })} el vehículo ya está en uso ocupando "${collision.service}" asignado por ${conflictMessage}.`,
             { duration: 9000 }
         );
      }

      // Check for existing vehicle assignment for the SAME technician on the SAME days for DIFFERENT activities
      let techVehicleWarning = null;
      for (const dt of associatedDates) {
          const otherTechTasks = tasks.filter(t => 
              isSameDay(t.fecha, dt.date) && 
              t.Tecnico === technicianId && 
              t.morning?.trim() !== sourceTask.morning?.trim()
          );

          for (const oTask of otherTechTasks) {
              const assignedVehicleTask = tasks.find(t => 
                  isSameDay(t.fecha, dt.date) &&
                  tecnicos.find(tec => tec.id === t.Tecnico)?.area === 'VEHÍCULOS' &&
                  t.morning?.trim() === oTask.morning?.trim()
              );

              if (assignedVehicleTask) {
                  const vehicleName = tecnicos.find(tec => tec.id === assignedVehicleTask.Tecnico)?.nombre || 'un vehículo';
                  techVehicleWarning = {
                      date: dt.date,
                      activity: oTask.morning,
                      vehicleName: vehicleName
                  };
                  break;
              }
          }
          if (techVehicleWarning) break;
      }

      const performAssignment = async () => {
          toast.success(`Asignando vehículo en ${associatedDates.length} jornada(s)...`, { duration: 4000 });
          try {
             for (const dt of associatedDates) {
                 if (!tasks.find(t => isSameDay(t.fecha, dt.date) && t.Tecnico === vehiculo.id && t.morning === dt.tCell.morning)) {
                     await upsertScheduleCell(dt.date, vehiculo.id, {
                         rowId: null, // Create new row for the vehicle
                         morning: dt.tCell.morning,
                         descripcion: dt.tCell.descripcion,
                         colorAM: dt.tCell.colorAM,
                         estadoAM: dt.tCell.estadoAM,
                         horaInicio: dt.tCell.horaInicio,
                         horaFin: dt.tCell.horaFin
                     }, true);
                 }
             }
             
             if (typeof refetch === 'function') refetch();
             toast.success("Vehículo asignado correctamente.");
          } catch (err) {
             toast.error(`Error al asignar: ${err.message}`);
             if (typeof refetch === 'function') refetch();
          }
      };

      if (techVehicleWarning) {
          const targetName = tecnicos.find(t => t.id === technicianId)?.nombre || 'El técnico';
          
          const handleConfirm = (e) => {
              if (e) { e.preventDefault(); e.stopPropagation(); }
              performAssignment();
              toast.dismiss();
          };

          const handleCancel = (e) => {
              if (e) { e.preventDefault(); e.stopPropagation(); }
              toast.dismiss();
          };

          toast("Advertencia de Asignación Múltiple", {
            duration: 15000,
            description: (
              <div className="flex flex-col gap-3.5 mt-1" onPointerDown={(e) => e.stopPropagation()}>
                <span className="text-[13px] text-gray-600 leading-snug">
                  <strong className="font-semibold text-gray-800">{targetName}</strong> ya está ocupando <strong className="font-semibold text-gray-800">{techVehicleWarning.vehicleName}</strong> para la tarea <strong className="font-semibold text-gray-800">"{techVehicleWarning.activity}"</strong> el {format(techVehicleWarning.date, 'EEEE d', { locale: es })}. ¿Deseas asignarle también este vehículo?
                </span>
                <div className="flex items-center gap-2">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={handleConfirm}
                    className="flex-1 py-1.5 px-3 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl text-[12px] font-semibold transition-colors shadow-sm text-center cursor-pointer"
                  >
                    Sí, guardar
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={handleCancel}
                    className="flex-1 py-1.5 px-3 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl text-[12px] font-semibold transition-colors shadow-sm text-center cursor-pointer"
                  >
                    Cancelar
                  </div>
                </div>
              </div>
            )
          });
      } else {
          performAssignment();
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
            onTaskClick={isAdmin ? (evt, date, res) => {
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
            onTaskDrop={isAdmin ? (sourceTask, targetDate, targetResource, isMoveKey) => {
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
            onTaskContextMenu={isAdmin ? (e, task, date, res) => {
               e.preventDefault();
               
               // Permitir context menu si es una alerta pendiente (la validación del estado se omitirá para cambiar de estado)
               // En este caso dejamos abrir el context menu, pero si intentan reprogramar (mover), fallará.
               // Validemos:
               const isOwnPendingTask = String(task?.id_usuario) === String(user?.id) && (task?.estadoAM === 'Pendiente' || task?.estadoAM === 'En Proceso');
               
               if (!canModifyTask(date) && !isOwnPendingTask) {
                  toast.error('No puedes modificar tareas de fechas pasadas.', { duration: 3000 });
                  return;
               }

               const menuW = 180;
               const menuH = 220;
               const x = e.clientX + menuW > window.innerWidth ? window.innerWidth - menuW - 10 : e.clientX;
               const y = e.clientY + menuH > window.innerHeight ? window.innerHeight - menuH - 10 : e.clientY;
               setContextMenu({ visible: true, x, y, task, date, resourceId: res, showVehicles: false });
            } : undefined}
            onTaskDragStart={isAdmin ? () => {
               setIsDragging(true);
            } : undefined}
            onTaskDragEnd={isAdmin ? () => setIsDragging(false) : undefined}
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

      {/* ══ Modal Flotante de Formulario (Crear/Editar Celda) ══ */}
      {isFormOpen && (
        <CellPopoverForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSaveForm}
          event={editingEvent}
          prefilledDate={prefilledDate}
          prefilledResource={prefilledResource}
          existingTasks={tasksForCell(prefilledResource, prefilledDate)}
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
      
      {/* ── UX Flotantes ── */}
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
               background: isDarkGantt ? 'rgba(30, 30, 35, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
               backdropFilter: 'blur(16px)'
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
                         style={{ background: isDarkGantt ? 'rgba(30,30,35,0.98)' : 'rgba(255,255,255,0.98)', backdropFilter: 'blur(16px)' }}
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
                               className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold transition-colors truncate ${isDarkGantt ? 'text-gray-200 hover:bg-emerald-500/20 hover:text-emerald-300' : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600'}`}
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
