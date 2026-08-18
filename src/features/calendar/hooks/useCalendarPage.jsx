import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { safeStorage } from '../../../shared/utils/storage';
import { useGantt } from './useGantt';
import { useCalendar } from './useCalendar';

function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
}

const normalizeScheduleText = (value) => String(value || '').trim().toLowerCase();

const scheduleTimeToMinutes = (value) => {
  const [hours, minutes] = String(value || '00:00').split(':').map(Number);
  return (hours * 60) + minutes;
};

const hasScheduleOverlap = (task, payload) => {
  const requestedStart = scheduleTimeToMinutes(payload.horaInicio || '00:00');
  const requestedEnd = scheduleTimeToMinutes(payload.horaFin || '23:59');
  const taskStart = scheduleTimeToMinutes(task.horaInicio || '00:00');
  const taskEnd = scheduleTimeToMinutes(task.horaFin || '23:59');
  return requestedStart < taskEnd && requestedEnd > taskStart;
};

const isSameTaskIdentity = (task, date, payload) => {
  return (
    isSameDay(task.fecha, date) &&
    normalizeScheduleText(task.tipoTarea || task.morning) === normalizeScheduleText(payload.tipo_tarea || payload.tipoTarea || payload.morning) &&
    normalizeScheduleText(task.cotizacion) === normalizeScheduleText(payload.cotizacion) &&
    normalizeScheduleText(task.descripcion) === normalizeScheduleText(payload.descripcion) &&
    normalizeScheduleText(task.cliente) === normalizeScheduleText(payload.cliente) &&
    normalizeScheduleText(task.planta) === normalizeScheduleText(payload.planta) &&
    normalizeScheduleText(task.horaInicio) === normalizeScheduleText(payload.horaInicio) &&
    normalizeScheduleText(task.horaFin) === normalizeScheduleText(payload.horaFin)
  );
};

const isSameLinkedTask = (task, sourceTask, date) => {
  return (
    isSameDay(task.fecha, date) &&
    normalizeScheduleText(task.tipoTarea || task.morning) === normalizeScheduleText(sourceTask.tipoTarea || sourceTask.morning) &&
    normalizeScheduleText(task.cotizacion) === normalizeScheduleText(sourceTask.cotizacion) &&
    normalizeScheduleText(task.descripcion) === normalizeScheduleText(sourceTask.descripcion) &&
    normalizeScheduleText(task.cliente) === normalizeScheduleText(sourceTask.cliente) &&
    normalizeScheduleText(task.planta) === normalizeScheduleText(sourceTask.planta)
  );
};

export function useCalendarPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedArea, setSelectedArea] = useState('Todas');
  const [selectedDeparture, setSelectedDeparture] = useState(null);
  const [prefilledDate, setPrefilledDate] = useState(new Date());
  const [prefilledResource, setPrefilledResource] = useState('');
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState({
    visible: false, x: 0, y: 0, task: null, date: null, resourceId: null, showVehicles: false
  });
  const pendingAlertFiredRef = useRef(false);

  // Ctrl key tracking
  useEffect(() => {
    const down = (e) => { if (e.key === 'Control') setIsCtrlPressed(true); };
    const up = (e) => { if (e.key === 'Control') setIsCtrlPressed(false); };
    const blur = () => setIsCtrlPressed(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu({
      visible: false, x: 0, y: 0, task: null, date: null, resourceId: null, showVehicles: false
    });
    if (contextMenu.visible) window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu.visible]);

  // User permissions
  let user = null;
  try {
    user = JSON.parse(safeStorage.getItem('rimmet_user') || 'null');
  } catch { /* ignore */ }
  if (!user) {
    const token = safeStorage.getItem('rimmet_token');
    user = token ? parseJwt(token) : null;
  }
  const isAdmin = ['2', '3'].includes(String(user?.acceso_cron));
  const isDev = String(user?.acceso_cron) === '3';

  const isJefeDeArea = useMemo(() => {
    if (!user?.cargo) return false;
    const normalized = String(user.cargo)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    return normalized === 'jefe de area';
  }, [user?.cargo]);

  // Gantt hook
  const {
    tasks, weekStart, weekEnd, weekDays, tecnicos, loading, error, useMock,
    tasksForCell, upsertScheduleCell, upsertScheduleAssignments, nextWeek, prevWeek,
    goToCurrentWeek, goToDate, isToday: isTodayGantt, refetch,
  } = useGantt();

  const currentUserArea = useMemo(() => {
    const storedArea = typeof user?.area === 'string' && user.area.trim() ? user.area.trim() : '';
    if (storedArea) return storedArea;

    const userFullName = normalizeScheduleText(`${user?.nombre || ''} ${user?.apellido || ''}`);
    const userName = normalizeScheduleText(user?.usuario);
    const userId = user?.id;

    const currentTecnico = tecnicos.find(t => {
      const tecnicoName = normalizeScheduleText(t.nombre);
      const tecnicoId = normalizeScheduleText(t.id);

      return (
        (userId && String(t.user_id) === String(userId)) ||
        (userFullName && tecnicoName === userFullName) ||
        (userName && tecnicoId === userName)
      );
    });

    return typeof currentTecnico?.area === 'string' ? currentTecnico.area.trim() : '';
  }, [tecnicos, user?.apellido, user?.area, user?.id, user?.nombre, user?.usuario]);

  // Filtered tecnicos by area
  const filteredTecnicos = useMemo(() => {
    if (!tecnicos) return [];
    if (selectedArea === 'Todas') return tecnicos;
    return tecnicos.filter(t => {
      const pArea = typeof t.area === 'string' && t.area.trim() !== '' ? t.area.trim() : 'Sin Área';
      return pArea === selectedArea || pArea === 'VEHÍCULOS';
    });
  }, [tecnicos, selectedArea]);

  // Calendar hook
  const calendar = useCalendar(tasks);

  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  };

  const canModifyTask = (date) => {
    if (isDev) return true;
    if (isJefeDeArea) return true;
    if (!isAdmin) return false;
    if (isPastDate(date)) return false;
    return true;
  };

  // Pending task alert (once per session)
  useEffect(() => {
    if (!user || !user.id || !tasks || tasks.length === 0) return;
    if (pendingAlertFiredRef.current) return;

    const pastPendingTasks = tasks.filter(t => {
      if (t.estadoAM !== 'Pendiente' && t.estadoAM !== 'En Proceso') return false;
      if (!isPastDate(t.fecha)) return false;
      return String(t.id_usuario) === String(user.id);
    });

    if (pastPendingTasks.length > 0) {
      pendingAlertFiredRef.current = true;
      const alertTask = pastPendingTasks[0];
      const totalCount = pastPendingTasks.length;
      const taskDateStr = format(alertTask.fecha, "EEEE d 'de' MMMM", { locale: es });

      toast(`Tienes ${totalCount > 1 ? `${totalCount} tareas pendientes atrasadas` : 'una tarea pendiente atrasada'}`, {
        description: `La más reciente: ${alertTask.morning} del ${taskDateStr}. Por favor, actualiza su estado.`,
        duration: 12000,
        action: {
          label: "Ir a la tarea →",
          onClick: () => {
            goToDate(alertTask.fecha);
            setTimeout(() => {
              const taskEl = document.querySelector(`[data-task-id="${alertTask.id}"]`);
              let x = Math.max(10, window.innerWidth / 2 - 90);
              let y = Math.max(10, window.innerHeight / 2 - 60);
              if (taskEl) {
                const rect = taskEl.getBoundingClientRect();
                x = rect.left + (rect.width / 2);
                y = rect.bottom + 5;
              }
              const menuW = 180;
              const menuH = 220;
              if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 10;
              if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 10;
              setContextMenu({ visible: true, x, y, task: alertTask, date: alertTask.fecha, resourceId: alertTask.Tecnico, showVehicles: false });
            }, 400);
          }
        }
      });
    }
  }, [tasks, user, goToDate]);

  // Auto-refetch every 30s
  useEffect(() => {
    const intervalId = setInterval(() => { if (refetch) refetch(); }, 30000);
    return () => clearInterval(intervalId);
  }, [refetch]);

  const handleOpenForm = useCallback((evt = null, date = new Date(), resourceId = '') => {
    setEditingEvent(evt);
    setPrefilledDate(date);
    setPrefilledResource(resourceId);
    setIsFormOpen(true);
  }, []);

  const handleSaveForm = useCallback(async (date, resource, text) => {
    const doSave = async (finalText) => {
      try {
        const vehicleResource = finalText?.vehicleResource;
        const vehicleTasks = vehicleResource
          ? tasks.filter(task => task.Tecnico === vehicleResource && isSameDay(task.fecha, date))
          : [];
        const vehicleAlreadyLinked = vehicleTasks.some(task => isSameTaskIdentity(task, date, finalText));
        const vehicleConflict = vehicleTasks.find(task => (
          !isSameTaskIdentity(task, date, finalText) &&
          normalizeScheduleText(task.tipoTarea || task.morning || task.afternoon || task.descripcion) &&
          hasScheduleOverlap(task, finalText)
        ));

        if (vehicleResource && vehicleResource !== resource && vehicleConflict) {
          const vehicleName = tecnicos.find(item => item.id === vehicleResource)?.nombre || 'El vehículo seleccionado';
          const conflictLabel = vehicleConflict.tipoTarea || vehicleConflict.morning || vehicleConflict.descripcion || 'otra tarea';
          toast.error(`${vehicleName} ya no está disponible en ese horario.`, {
            description: `Se solapa con “${conflictLabel}” (${vehicleConflict.horaInicio || 'inicio del día'}–${vehicleConflict.horaFin || 'fin del día'}).`,
            duration: 6000,
          });
          return false;
        }

        const assignments = [{ resource, payload: finalText }];
        const additionalResources = finalText?.additionalResources || [];
        additionalResources.forEach(additionalRes => {
          if (additionalRes !== resource) {
            assignments.push({
              resource: additionalRes,
              payload: { ...finalText, rowId: null, additionalResources: undefined },
            });
          }
        });
        if (vehicleResource && vehicleResource !== resource && !vehicleAlreadyLinked) {
          assignments.push({
            resource: vehicleResource,
            payload: {
              ...finalText,
              rowId: null,
              additionalResources: undefined,
              vehicleResource: undefined,
            },
          });
        }
        await upsertScheduleAssignments(date, assignments);
        if (!finalText || (typeof finalText === 'object' && !finalText.morning && !finalText.afternoon) || (typeof finalText === 'string' && finalText.trim() === '')) {
          toast.success("Celda limpiada correctamente.");
        } else {
          const assignedCount = additionalResources.length + (vehicleResource && !vehicleAlreadyLinked ? 1 : 0);
          if (assignedCount > 0) {
            toast.success(`Tarea guardada y vinculada a ${assignedCount} recurso${assignedCount === 1 ? '' : 's'} adicional${assignedCount === 1 ? '' : 'es'}.`);
          } else {
            toast.success("Tarea guardada correctamente.");
          }
          if (typeof refetch === 'function') refetch();
        }
        return true;
      } catch (err) {
        const isConcurrencyError = err.message?.includes('Otro usuario') || err.message?.includes('otro proceso');
        toast.error(err.message || "Error al guardar en el calendario", { duration: isConcurrencyError ? 8000 : 4000 });
        return false;
      }
    };

    return doSave(text);
  }, [tasks, tecnicos, upsertScheduleAssignments, refetch]);

  const handleDeleteTask = useCallback(async (task, date, resourceId) => {
    setContextMenu({ visible: false, x: 0, y: 0, task: null, date: null, resourceId: null, showVehicles: false });
    const targetResourceObj = tecnicos.find(t => t.id === resourceId);
    const isVehiculoTarget = targetResourceObj?.area === 'VEHÍCULOS';

    if (isVehiculoTarget) {
      const authorName = (task.author || '').trim().toLowerCase();
      const currentNombre = (user?.nombre || '').trim().toLowerCase();
      const currentUsuario = (user?.usuario || '').trim().toLowerCase();
      const isSystem = authorName === 'sistema';
      const isMatch = (currentNombre && authorName === currentNombre) || (currentUsuario && authorName === currentUsuario);
      if (authorName && !isMatch && !isSystem && !isAdmin) {
        toast.error(`Acceso denegado: Solo el creador original (${task.author}) o un administrador puede borrar esta asignación.`, { duration: 6000 });
        return;
      }
    }

    toast.success("Borrando tarea...", { duration: 500 });
    try {
      const dateObj = new Date(date);
      await upsertScheduleCell(dateObj, resourceId, { rowId: task.rowId, tipo_tarea: '', morning: '' }, true);

      if (!isVehiculoTarget) {
        const vehicleTasks = tasks.filter(t => {
          if (!isSameDay(t.fecha, dateObj)) return false;
          const isVehiculo = tecnicos.find(tec => tec.id === t.Tecnico)?.area === 'VEHÍCULOS';
          return isVehiculo && isSameLinkedTask(t, task, dateObj);
        });
        for (const vTask of vehicleTasks) {
          await upsertScheduleCell(vTask.fecha, vTask.Tecnico, { rowId: vTask.rowId, tipo_tarea: '', morning: '' }, true);
        }
      }

      await new Promise(r => setTimeout(r, 400));
      if (typeof refetch === 'function') refetch();
      toast.success("Tarea eliminada");
    } catch (err) {
      toast.error(err.message || "Error al borrar tarea");
    }
  }, [tecnicos, user, isAdmin, tasks, upsertScheduleCell, refetch]);

  const handleTaskDrop = useCallback(async (sourceTask, targetDate, targetResource, isMoveKey) => {
    if (!sourceTask) return;
    const targetTecnico = tecnicos.find(t => t.id === targetResource);
    const targetName = targetTecnico ? targetTecnico.nombre : targetResource;
    const sourceTaskPayload = {
      tipo_tarea: sourceTask.tipoTarea || sourceTask.morning,
      morning: sourceTask.morning,
      cotizacion: sourceTask.cotizacion,
      descripcion: sourceTask.descripcion,
      cliente: sourceTask.cliente,
      cod_cliente: sourceTask.cod_cliente,
      planta: sourceTask.planta,
      colorAM: sourceTask.colorAM,
      estadoAM: sourceTask.estadoAM,
      horaInicio: sourceTask.horaInicio,
      horaFin: sourceTask.horaFin,
    };

    const executeAction = async (copyForOthers = false, otherTasks = []) => {
      try {
        const targetDateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);
        const buildPayload = (rowId) => ({ ...sourceTaskPayload, rowId });

        if (isMoveKey && sourceTask.sourceDate) {
          const sourceDateObj = new Date(sourceTask.sourceDate);
          if (targetResource === sourceTask.sourceResource && targetDateObj.getTime() === sourceDateObj.getTime()) return;
          await upsertScheduleCell(targetDateObj, targetResource, buildPayload(sourceTask.rowId), true);
          await new Promise(r => setTimeout(r, 400));
          if (typeof refetch === 'function') refetch();
          toast.success("Tarea movida correctamente.");
        } else {
          const promises = [upsertScheduleCell(targetDateObj, targetResource, buildPayload(null), true)];
          if (copyForOthers && otherTasks.length > 0) {
            otherTasks.forEach(t => {
              promises.push(upsertScheduleCell(targetDateObj, t.Tecnico, buildPayload(null), true));
            });
          }
          await Promise.all(promises);
          await new Promise(r => setTimeout(r, 400));
          if (typeof refetch === 'function') refetch();
          toast.success(
            copyForOthers && otherTasks.length > 0
              ? `Tarea copiada para ${otherTasks.length + 1} personas.`
              : 'Ficha copiada correctamente.',
            { duration: 5000 }
          );
        }
      } catch (err) { toast.error(err.message || "Error al procesar la tarea"); }
    };

    const targetDateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);
    const sourceDateObj = sourceTask.sourceDate ? new Date(sourceTask.sourceDate) : null;
    let otherUsersWithTask = [];
    if (!isMoveKey && sourceDateObj && sourceTask.morning) {
      otherUsersWithTask = tasks.filter(t =>
        t.Tecnico !== sourceTask.sourceResource && isSameLinkedTask(t, sourceTask, sourceDateObj)
      );
    }

    if (sourceTask.sourceResource && sourceTask.sourceResource !== targetResource) {
      toast(isMoveKey ? "¿Mover a otro técnico?" : "¿Copiar a otro técnico?", {
        duration: 10000,
        description: (
          <div className="flex flex-col gap-3.5 mt-1" onPointerDown={(e) => e.stopPropagation()}>
            <span className="text-[13px] text-gray-600 dark:text-gray-300 leading-snug">
              Vas a {isMoveKey ? "mover" : "copiar"} esta tarea a <strong className="font-semibold text-gray-800 dark:text-gray-100">{targetName}</strong>. ¿Estás seguro?
            </span>
            <div className="flex items-center gap-2">
              <div role="button" tabIndex={0} onClick={(e) => { e?.preventDefault(); e?.stopPropagation(); toast.dismiss(); executeAction(); }}
                className="flex-1 py-1.5 px-4 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 dark:text-blue-300 rounded-xl text-[13px] font-semibold transition-colors shadow-sm text-center cursor-pointer">
                Sí, {isMoveKey ? "Mover" : "Copiar"}
              </div>
              <div role="button" tabIndex={0} onClick={(e) => { e?.preventDefault(); e?.stopPropagation(); toast.dismiss(); }}
                className="flex-1 py-1.5 px-4 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-300 rounded-xl text-[13px] font-semibold transition-colors shadow-sm text-center cursor-pointer">
                Cancelar
              </div>
            </div>
          </div>
        )
      });
    } else if (!isMoveKey && otherUsersWithTask.length > 0) {
      const otherNames = otherUsersWithTask.map(t => {
        const tObj = tecnicos.find(tec => tec.id === t.Tecnico);
        return tObj ? tObj.nombre.split(' ')[0] : t.Tecnico;
      }).join(', ');

      toast("¿Copiar para todos los asignados?", {
        duration: 15000,
        description: (
          <div className="flex flex-col gap-3.5 mt-1" onPointerDown={(e) => e.stopPropagation()}>
            <span className="text-[13px] text-gray-600 dark:text-gray-300 leading-snug">
              Esta tarea también está asignada a <strong className="font-semibold text-gray-800 dark:text-gray-100">{otherNames}</strong>. ¿Deseas copiarla para todos al día {format(targetDateObj, 'd MMM', { locale: es })}?
            </span>
            <div className="flex flex-col gap-2">
              <div role="button" tabIndex={0} onClick={(e) => { e?.preventDefault(); e?.stopPropagation(); toast.dismiss(); executeAction(true, otherUsersWithTask); }}
                className="w-full py-1.5 px-4 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 dark:text-blue-300 rounded-xl text-[12px] font-semibold transition-colors shadow-sm text-center cursor-pointer">
                Sí, copiar para todos ({otherUsersWithTask.length + 1})
              </div>
              <div className="flex items-center gap-2">
                <div role="button" tabIndex={0} onClick={(e) => { e?.preventDefault(); e?.stopPropagation(); toast.dismiss(); executeAction(false, []); }}
                  className="flex-1 py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded-xl text-[12px] font-semibold transition-colors shadow-sm text-center cursor-pointer">
                  Solo para mí
                </div>
                <div role="button" tabIndex={0} onClick={(e) => { e?.preventDefault(); e?.stopPropagation(); toast.dismiss(); }}
                  className="flex-1 py-1.5 px-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-300 rounded-xl text-[12px] font-semibold transition-colors shadow-sm text-center cursor-pointer">
                  Cancelar
                </div>
              </div>
            </div>
          </div>
        )
      });
    } else {
      executeAction();
    }
  }, [tecnicos, tasks, upsertScheduleCell, refetch]);

  const executeIntelligentReschedule = useCallback(async (part, serviceStr, sourceTask, oldDate, newDate) => {
    const diffTime = Math.round((newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffTime === 0) return toast.success("No se seleccionó una fecha diferente.");

    const sourceCells = [];
    const isWithinCurrentWeek = (d) => d >= weekStart && d <= weekEnd;
    tasks.forEach(t => {
      if (!isWithinCurrentWeek(t.fecha)) return;
      if (isSameLinkedTask(t, sourceTask, sourceTask.fecha || oldDate)) sourceCells.push({ ...t, moveAM: true });
    });
    if (sourceCells.length === 0) sourceCells.push({ ...sourceTask, moveAM: true });

    const destinationCells = [];
    let collision = null;
    sourceCells.forEach(sc => {
      const destDate = new Date(sc.fecha.getTime());
      destDate.setDate(destDate.getDate() + diffTime);
      const existingTask = tasks.find(t => isSameDay(t.fecha, destDate) && t.Tecnico === sc.Tecnico);
      if (existingTask) {
        const isSource = sourceCells.find(src => src.id === existingTask.id);
        if (!isSource && existingTask.morning?.trim() && existingTask.morning !== sc.morning) {
          collision = { date: destDate, res: sc.Tecnico, part: 'Tarea' };
        }
      }
      destinationCells.push({ originCell: sc, destDate });
    });

    if (collision) {
      const tecName = tecnicos.find(t => t.id === collision.res)?.nombre || collision.res;
      return toast.error(`Colisión detectada: El ${format(collision.date, 'EEEE d', { locale: es })} hay otro servicio agendado por la ${collision.part} para ${tecName}. Reprogramación cancelada.`, { duration: 8000 });
    }

    toast.success(`Moviendo ${sourceCells.length} tarea(s)...`, { duration: 4000 });
    try {
      for (const sCell of sourceCells) {
        await upsertScheduleCell(sCell.fecha, sCell.Tecnico, { rowId: sCell.rowId, tipo_tarea: '', morning: '' }, true);
      }
      for (const { originCell: sCell, destDate } of destinationCells) {
        await upsertScheduleCell(destDate, sCell.Tecnico, {
          rowId: null, tipo_tarea: sCell.tipoTarea || sCell.morning, morning: sCell.morning,
          cotizacion: sCell.cotizacion, descripcion: sCell.descripcion, cliente: sCell.cliente,
          cod_cliente: sCell.cod_cliente, planta: sCell.planta, colorAM: sCell.colorAM,
          estadoAM: 'Reprogramado', horaInicio: sCell.horaInicio, horaFin: sCell.horaFin
        }, true);
      }
      if (typeof refetch === 'function') refetch();
      toast.success("Tareas reprogramadas exitosamente.");
    } catch (e) {
      toast.error(`Error al reprogramar: ${e.message}`);
      if (typeof refetch === 'function') refetch();
    }
  }, [tasks, tecnicos, weekStart, weekEnd, upsertScheduleCell, refetch]);

  const promptRescheduleDate = useCallback((part, serviceStr, task, date) => {
    let selectedDateStr = format(new Date(date), 'yyyy-MM-dd');
    const onSubmit = (e) => {
      e.preventDefault();
      toast.dismiss();
      const newDateObj = new Date(selectedDateStr + 'T12:00:00');
      const oldDateNoon = new Date(date);
      oldDateNoon.setHours(12, 0, 0, 0);
      executeIntelligentReschedule(part, serviceStr, task, oldDateNoon, newDateObj);
    };
    toast.dismiss();
    toast("Seleccionar nueva fecha", {
      duration: 30000,
      description: (
        <form onSubmit={onSubmit} className="flex flex-col gap-3 mt-2" onPointerDown={e => e.stopPropagation()}>
          <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-snug">Se reprogramarán las tareas vinculadas de la semana actual.</p>
          <input type="date" defaultValue={selectedDateStr} onChange={(e) => selectedDateStr = e.target.value} required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          <div className="flex gap-2 pt-1 border-t border-gray-200 dark:border-gray-700">
            <button type="submit" className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors">Continuar</button>
            <button type="button" onClick={() => toast.dismiss()} className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded-lg text-xs font-bold transition-colors">Cancelar</button>
          </div>
        </form>
      )
    });
  }, [executeIntelligentReschedule]);

  const handleStateChange = useCallback(async (newState) => {
    const { task, date, resourceId } = contextMenu;
    setContextMenu(prev => ({ ...prev, visible: false }));

    if (newState === 'Reprogramado') {
      return promptRescheduleDate('ambos', task.morning, task, date);
    }

    toast.success(`Marcando como ${newState}...`, { duration: 500 });
    try {
      const dateObj = new Date(date);
      await upsertScheduleCell(dateObj, resourceId, {
        rowId: task.rowId, tipo_tarea: task.tipoTarea || task.morning, morning: task.morning,
        cotizacion: task.cotizacion, descripcion: task.descripcion,
        cliente: task.cliente, cod_cliente: task.cod_cliente, planta: task.planta,
        colorAM: task.colorAM, estadoAM: newState,
        horaInicio: task.horaInicio, horaFin: task.horaFin,
        lastModified: task.timestampUpdated || null
      }, false);
      toast.success(`Estado actualizado a ${newState}`);
    } catch (err) { toast.error(err.message || "Error al actualizar estado"); }
  }, [contextMenu, upsertScheduleCell, promptRescheduleDate]);

  const executeIntelligentVehicleAssign = useCallback(async (part, serviceStr, sourceTask, sourceDateObj, technicianId, vehiculo) => {
    const isWithinCurrentWeek = (d) => d >= weekStart && d <= weekEnd;
    const associatedDates = [];
    tasks.forEach(t => {
      if (!isWithinCurrentWeek(t.fecha) || t.Tecnico !== technicianId) return;
      if (isSameLinkedTask(t, sourceTask, sourceDateObj)) associatedDates.push({ date: t.fecha, tCell: t });
    });
    if (associatedDates.length === 0) associatedDates.push({ date: sourceDateObj, tCell: sourceTask });

    let collision = null;
    associatedDates.forEach(dt => {
      const existingVehicleTask = tasks.find(t => isSameDay(t.fecha, dt.date) && t.Tecnico === vehiculo.id);
      if (existingVehicleTask) {
        const vehMorningText = existingVehicleTask.morning?.trim();
        if (vehMorningText) {
          const conflictTechTask = tasks.find(t =>
            isSameDay(t.fecha, dt.date) && t.Tecnico !== vehiculo.id &&
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
      return toast.error(`Cancelado: El ${format(collision.date, 'EEEE d', { locale: es })} el vehículo ya está en uso ocupando "${collision.service}" asignado por ${conflictMessage}.`, { duration: 9000 });
    }

    let techVehicleWarning = null;
    for (const dt of associatedDates) {
      const otherTechTasks = tasks.filter(t =>
        isSameDay(t.fecha, dt.date) && t.Tecnico === technicianId && !isSameLinkedTask(t, sourceTask, dt.date)
      );
      for (const oTask of otherTechTasks) {
        const assignedVehicleTask = tasks.find(t =>
          isSameDay(t.fecha, dt.date) && tecnicos.find(tec => tec.id === t.Tecnico)?.area === 'VEHÍCULOS' &&
          t.morning?.trim() === oTask.morning?.trim()
        );
        if (assignedVehicleTask) {
          const vehicleName = tecnicos.find(tec => tec.id === assignedVehicleTask.Tecnico)?.nombre || 'un vehículo';
          techVehicleWarning = { date: dt.date, activity: oTask.morning, vehicleName };
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
              rowId: null, tipo_tarea: dt.tCell.tipoTarea || dt.tCell.morning, morning: dt.tCell.morning,
              cotizacion: dt.tCell.cotizacion, descripcion: dt.tCell.descripcion,
              cliente: dt.tCell.cliente, cod_cliente: dt.tCell.cod_cliente, planta: dt.tCell.planta,
              colorAM: dt.tCell.colorAM, estadoAM: dt.tCell.estadoAM,
              horaInicio: dt.tCell.horaInicio, horaFin: dt.tCell.horaFin
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
      toast("Advertencia de Asignación Múltiple", {
        duration: 15000,
        description: (
          <div className="flex flex-col gap-3.5 mt-1" onPointerDown={(e) => e.stopPropagation()}>
            <span className="text-[13px] text-gray-600 dark:text-gray-300 leading-snug">
              <strong className="font-semibold text-gray-800 dark:text-gray-100">{targetName}</strong> ya está ocupando <strong className="font-semibold text-gray-800 dark:text-gray-100">{techVehicleWarning.vehicleName}</strong> para la tarea <strong className="font-semibold text-gray-800 dark:text-gray-100">"{techVehicleWarning.activity}"</strong> el {format(techVehicleWarning.date, 'EEEE d', { locale: es })}. ¿Deseas asignarle también este vehículo?
            </span>
            <div className="flex items-center gap-2">
              <div role="button" tabIndex={0} onClick={(e) => { e?.preventDefault(); e?.stopPropagation(); performAssignment(); toast.dismiss(); }}
                className="flex-1 py-1.5 px-3 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 dark:text-blue-300 rounded-xl text-[12px] font-semibold transition-colors shadow-sm text-center cursor-pointer">Sí, guardar</div>
              <div role="button" tabIndex={0} onClick={(e) => { e?.preventDefault(); e?.stopPropagation(); toast.dismiss(); }}
                className="flex-1 py-1.5 px-3 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-300 rounded-xl text-[12px] font-semibold transition-colors shadow-sm text-center cursor-pointer">Cancelar</div>
            </div>
          </div>
        )
      });
    } else {
      performAssignment();
    }
  }, [tasks, tecnicos, weekStart, weekEnd, upsertScheduleCell, refetch]);

  const handleAssignVehicleInit = useCallback((vehiculo) => {
    const { task, date, resourceId } = contextMenu;
    setContextMenu(prev => ({ ...prev, visible: false, showVehicles: false }));
    toast.dismiss();
    const oldDateNoon = new Date(date);
    oldDateNoon.setHours(12, 0, 0, 0);
    executeIntelligentVehicleAssign('ambos', task.morning, task, oldDateNoon, resourceId, vehiculo);
  }, [contextMenu, executeIntelligentVehicleAssign]);

  return {
    // Gantt state (pass-through)
    tasks, weekStart, weekEnd, weekDays, tecnicos, loading, error, useMock,
    tasksForCell, refetch, nextWeek, prevWeek, goToCurrentWeek, goToDate,
    isTodayGantt,
    currentUserArea,
    // Calendar state (pass-through)
    ...calendar,
    // Filtered
    filteredTecnicos, selectedArea, setSelectedArea,
    // Form/dialog state
    isFormOpen, editingEvent, prefilledDate, prefilledResource,
    selectedDeparture,
    // Drag state
    isDragging, dragPos, isCtrlPressed,
    // Context menu
    contextMenu,
    // Permissions
    isAdmin, isDev, isJefeDeArea, canModifyTask, user,
    // Handlers
    handleOpenForm, handleSaveForm, handleDeleteTask,
    handleTaskDrop, handleStateChange,
    handleAssignVehicleInit,
    promptRescheduleDate,
    // State setters (for JSX)
    setIsFormOpen, setSelectedDeparture, setContextMenu,
    setIsDragging, setDragPos,
  };
}
