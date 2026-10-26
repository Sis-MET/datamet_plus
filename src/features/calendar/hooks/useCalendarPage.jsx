import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { safeStorage } from '../../../shared/utils/storage';
import { decodeJwtPayload } from '../../../shared/utils/jwt';
import { useGantt } from './useGantt';
import { useCalendar } from './useCalendar';
import { canManageVehicleReservation, isVehicleResource } from '../domain/vehicleAvailability';
import {
  clearPayload,
  createGroupId,
  findLinkedTasks,
  hasTaskContent,
  hasTimeOverlap,
  taskToPayload,
} from '../domain/taskLinks';

const normalizeScheduleText = (value) => String(value || '').trim().toLowerCase();

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
    user = JSON.parse(safeStorage.getItem('datamet_user') || 'null');
  } catch { /* ignore */ }
  if (!user) {
    user = decodeJwtPayload(safeStorage.getItem('datamet_token'));
  }
  // datamet_user no trae el id; el del token decide quién creó una reserva.
  const tokenUserId = decodeJwtPayload(safeStorage.getItem('datamet_token'))?.id ?? null;
  const actor = useMemo(() => ({
    id: tokenUserId,
    usuario: user?.usuario,
    nombre: user?.nombre,
    acceso_cron: user?.acceso_cron,
  }), [tokenUserId, user?.usuario, user?.nombre, user?.acceso_cron]);
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
      return pArea === selectedArea || isVehicleResource(t);
    });
  }, [tecnicos, selectedArea]);

  // Calendar hook
  const calendar = useCalendar(tasks);

  const isVehicleId = useCallback(
    (resourceId) => isVehicleResource(tecnicos.find(t => t.id === resourceId)),
    [tecnicos]
  );

  /** Mensaje de bloqueo si la tarea es una reserva de vehículo ajena; null si se puede tocar. */
  const getVehicleLockMessage = useCallback((task, resourceId) => {
    const vehicleId = resourceId ?? task?.Tecnico;
    if (!task || !isVehicleId(vehicleId)) return null;
    if (canManageVehicleReservation(task, actor)) return null;
    const vehicleName = tecnicos.find(t => t.id === vehicleId)?.nombre || 'Este vehículo';
    return `${vehicleName} está reservado por ${task.createdBy}. Solo esa persona puede modificar o eliminar la reserva.`;
  }, [actor, isVehicleId, tecnicos]);

  /**
   * Bloqueo para abrir una ficha: la propia fila si es una reserva ajena, o
   * cualquier vehículo ajeno de la misma ficha (editarla lo cambiaría).
   */
  const getTaskLockMessage = useCallback((task, resourceId, date) => {
    const ownLock = getVehicleLockMessage(task, resourceId);
    if (ownLock || !task) return ownLock;
    const lockedLink = findLinkedTasks(tasks, task, date || task.fecha)
      .find(linked => getVehicleLockMessage(linked, linked.Tecnico));
    if (!lockedLink) return null;
    const vehicleName = tecnicos.find(t => t.id === lockedLink.Tecnico)?.nombre || 'un vehículo';
    return `Esta ficha usa ${vehicleName}, reservado por ${lockedLink.createdBy}. Solo esa persona puede modificarla.`;
  }, [getVehicleLockMessage, tasks, tecnicos]);

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
    // El id sale del token: datamet_user no lo trae.
    if (!actor.id || !tasks || tasks.length === 0) return;
    if (pendingAlertFiredRef.current) return;

    const pastPendingTasks = tasks
      .filter(t => {
        if (t.estadoAM !== 'Pendiente' && t.estadoAM !== 'En Proceso') return false;
        if (!isPastDate(t.fecha)) return false;
        // Vehículos y personas pueden compartir el mismo id numérico.
        if (isVehicleId(t.Tecnico)) return false;
        return String(t.id_usuario) === String(actor.id);
      })
      .sort((a, b) => b.fecha - a.fecha);

    if (pastPendingTasks.length > 0) {
      pendingAlertFiredRef.current = true;
      const alertTask = pastPendingTasks[0];
      const totalCount = pastPendingTasks.length;
      const taskDateStr = format(alertTask.fecha, "EEEE d 'de' MMMM", { locale: es });

      toast(`Tienes ${totalCount > 1 ? `${totalCount} tareas pendientes atrasadas` : 'una tarea pendiente atrasada'}`, {
        description: `La más reciente: ${alertTask.morning} del ${taskDateStr}. Por favor, actualiza su estado.`,
        duration: 12000,
        action: {
          label: "Ir a la tarea",
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
  }, [actor.id, goToDate, isVehicleId, tasks]);

  const handleOpenForm = useCallback((evt = null, date = new Date(), resourceId = '') => {
    setEditingEvent(evt);
    setPrefilledDate(date);
    setPrefilledResource(resourceId);
    setIsFormOpen(true);
  }, []);

  // Filas de la ficha que se está editando (personas adicionales y vehículo):
  // el formulario las muestra preseleccionadas y el guardado las sincroniza.
  const editingLinkedTasks = useMemo(
    () => (editingEvent ? findLinkedTasks(tasks, editingEvent, prefilledDate) : []),
    [editingEvent, prefilledDate, tasks]
  );

  const confirmAction = useCallback((title, message, confirmLabel, onConfirm) => {
    toast(title, {
      duration: 15000,
      description: (
        <div className="flex flex-col gap-3.5 mt-1" onPointerDown={(e) => e.stopPropagation()}>
          <span className="text-[13px] leading-snug text-fg-muted">{message}</span>
          <div className="flex items-center gap-2">
            <div role="button" tabIndex={0} onClick={(e) => { e?.preventDefault(); e?.stopPropagation(); toast.dismiss(); onConfirm(); }}
              className="flex-1 cursor-pointer rounded-xl bg-brand px-4 py-2 text-center text-[13px] font-semibold text-brand-fg shadow-xs ring-1 ring-inset ring-black/5 transition-colors hover:bg-brand-hover">{confirmLabel}</div>
            <div role="button" tabIndex={0} onClick={(e) => { e?.preventDefault(); e?.stopPropagation(); toast.dismiss(); }}
              className="flex-1 cursor-pointer rounded-xl border border-line-strong bg-surface px-4 py-2 text-center text-[13px] font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2">Cancelar</div>
          </div>
        </div>
      )
    });
  }, []);

  const handleSaveForm = useCallback(async (date, resource, formPayload) => {
    const { additionalResources = [], vehicleResource = null, ...payload } = formPayload || {};
    const sourceTask = payload.rowId
      ? tasks.find(task => String(task.rowId) === String(payload.rowId)) || null
      : null;
    const linkedTasks = sourceTask ? findLinkedTasks(tasks, sourceTask, date) : [];

    const lockedLink = linkedTasks.find(task => getVehicleLockMessage(task, task.Tecnico));
    if (lockedLink) {
      toast.error(getVehicleLockMessage(lockedLink, lockedLink.Tecnico), { duration: 6000 });
      return false;
    }

    // La reserva que ya tiene esta ficha no cuenta como conflicto.
    const ownRowIds = new Set([payload.rowId, ...linkedTasks.map(task => task.rowId)].filter(Boolean).map(String));
    if (vehicleResource && vehicleResource !== resource) {
      const vehicleConflict = tasks.find(task => (
        task.Tecnico === vehicleResource &&
        isSameDay(task.fecha, date) &&
        !ownRowIds.has(String(task.rowId)) &&
        hasTaskContent(task) &&
        hasTimeOverlap(task, payload)
      ));
      if (vehicleConflict) {
        const vehicleName = tecnicos.find(item => item.id === vehicleResource)?.nombre || 'El vehículo seleccionado';
        const conflictLabel = vehicleConflict.tipoTarea || vehicleConflict.morning || vehicleConflict.descripcion || 'otra tarea';
        toast.error(`${vehicleName} ya no está disponible en ese horario.`, {
          description: `Se solapa con “${conflictLabel}” (${vehicleConflict.horaInicio || 'inicio del día'}–${vehicleConflict.horaFin || 'fin del día'}).`,
          duration: 6000,
        });
        return false;
      }
    }

    const groupPayload = { ...payload, grupo_id: sourceTask?.grupoId || createGroupId() };
    // El formulario muestra un solo vehículo (el primero de la ficha); si hay
    // otros, se mantienen y se sincronizan en vez de borrarse.
    const formVehicle = linkedTasks.find(task => isVehicleId(task.Tecnico));
    const extraVehicles = linkedTasks
      .filter(task => isVehicleId(task.Tecnico) && task.Tecnico !== formVehicle?.Tecnico)
      .map(task => task.Tecnico);
    const wantedResources = new Set(
      [...additionalResources, vehicleResource, ...extraVehicles].filter(item => item && item !== resource)
    );
    const assignments = [{ resource, payload: groupPayload }];

    // Las filas vinculadas que siguen seleccionadas se actualizan; las que se
    // quitaron se anulan; las nuevas se crean. Todo en una sola transacción.
    const pendingResources = new Set(wantedResources);
    linkedTasks.forEach(linked => {
      if (linked.Tecnico === resource) return;
      if (pendingResources.has(linked.Tecnico)) {
        pendingResources.delete(linked.Tecnico);
        assignments.push({
          resource: linked.Tecnico,
          payload: {
            ...groupPayload,
            rowId: linked.rowId,
            estadoAM: linked.estadoAM,
            lastModified: linked.timestampUpdated || null,
          },
        });
      } else {
        assignments.push({ resource: linked.Tecnico, payload: clearPayload(linked.rowId) });
      }
    });
    pendingResources.forEach(item => {
      assignments.push({ resource: item, payload: { ...groupPayload, rowId: null, lastModified: null } });
    });

    try {
      await upsertScheduleAssignments(date, assignments);
      const linkedCount = wantedResources.size;
      toast.success(linkedCount > 0
        ? `Tarea guardada y vinculada a ${linkedCount} recurso${linkedCount === 1 ? '' : 's'} adicional${linkedCount === 1 ? '' : 'es'}.`
        : 'Tarea guardada correctamente.');
      return true;
    } catch (err) {
      const isConcurrencyError = err.message?.includes('Otro usuario') || err.message?.includes('otro proceso');
      toast.error(err.message || "Error al guardar en el calendario", { duration: isConcurrencyError ? 8000 : 4000 });
      return false;
    }
  }, [getVehicleLockMessage, isVehicleId, tasks, tecnicos, upsertScheduleAssignments]);

  const handleDeleteTask = useCallback(async (task, date, resourceId) => {
    setContextMenu({ visible: false, x: 0, y: 0, task: null, date: null, resourceId: null, showVehicles: false });

    const lockMessage = getVehicleLockMessage(task, resourceId);
    if (lockMessage) {
      toast.error(lockMessage, { duration: 6000 });
      return;
    }

    const dateObj = new Date(date);
    const linkedTasks = findLinkedTasks(tasks, task, dateObj);
    // El vehículo se libera solo cuando ya no queda ninguna persona en la ficha.
    const someoneStaysOnTask = linkedTasks.some(linked => !isVehicleId(linked.Tecnico));
    const vehiclesToRelease = isVehicleId(resourceId) || someoneStaysOnTask
      ? []
      : linkedTasks.filter(linked => isVehicleId(linked.Tecnico));

    const lockedLink = vehiclesToRelease.find(linked => getVehicleLockMessage(linked, linked.Tecnico));
    if (lockedLink) {
      const vehicleName = tecnicos.find(t => t.id === lockedLink.Tecnico)?.nombre || 'un vehículo';
      toast.error(`Esta ficha reserva ${vehicleName} a nombre de ${lockedLink.createdBy}. Solo esa persona puede eliminarla.`, { duration: 6000 });
      return;
    }

    toast.success("Borrando tarea...", { duration: 500 });
    try {
      // La ficha y la reserva del vehículo se anulan juntas: o todo o nada.
      await upsertScheduleAssignments(dateObj, [
        { resource: resourceId, payload: clearPayload(task.rowId) },
        ...vehiclesToRelease.map(linked => ({ resource: linked.Tecnico, payload: clearPayload(linked.rowId) })),
      ]);
      toast.success("Tarea eliminada");
    } catch (err) {
      toast.error(err.message || "Error al borrar tarea");
    }
  }, [getVehicleLockMessage, isVehicleId, tecnicos, tasks, upsertScheduleAssignments]);

  const handleTaskDrop = useCallback(async (sourceTask, targetDate, targetResource, isMoveKey) => {
    if (!sourceTask) return;
    const targetTecnico = tecnicos.find(t => t.id === targetResource);
    const targetName = targetTecnico ? targetTecnico.nombre : targetResource;
    const targetDateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);
    const sourceDateObj = sourceTask.sourceDate ? new Date(sourceTask.sourceDate) : null;

    const executeAction = async (copyForOthers = false, otherTasks = []) => {
      try {
        if (isMoveKey && sourceDateObj) {
          if (targetResource === sourceTask.sourceResource && targetDateObj.getTime() === sourceDateObj.getTime()) return;
          await upsertScheduleCell(targetDateObj, targetResource, taskToPayload(sourceTask, {
            rowId: sourceTask.rowId,
            lastModified: null,
          }), true);
          toast.success("Tarea movida correctamente.");
          return;
        }

        // Una copia es una ficha nueva: nuevo grupo, compartido por todas sus filas.
        const copyPayload = taskToPayload(sourceTask, { rowId: null, lastModified: null, grupo_id: createGroupId() });
        const copies = copyForOthers ? otherTasks.filter(t => t.Tecnico !== targetResource) : [];
        await upsertScheduleAssignments(targetDateObj, [
          { resource: targetResource, payload: copyPayload },
          ...copies.map(t => ({ resource: t.Tecnico, payload: copyPayload })),
        ]);
        toast.success(
          copies.length > 0 ? `Tarea copiada para ${copies.length + 1} recursos.` : 'Ficha copiada correctamente.',
          { duration: 5000 }
        );
      } catch (err) { toast.error(err.message || "Error al procesar la tarea"); }
    };

    const otherUsersWithTask = !isMoveKey && sourceDateObj && sourceTask.morning
      ? findLinkedTasks(tasks, sourceTask, sourceDateObj).filter(t => t.Tecnico !== sourceTask.sourceResource)
      : [];

    if (sourceTask.sourceResource && sourceTask.sourceResource !== targetResource) {
      confirmAction(
        isMoveKey ? "¿Mover a otro técnico?" : "¿Copiar a otro técnico?",
        <>Vas a {isMoveKey ? "mover" : "copiar"} esta tarea a <strong className="font-semibold text-fg">{targetName}</strong>. ¿Estás seguro?</>,
        `Sí, ${isMoveKey ? "Mover" : "Copiar"}`,
        () => executeAction()
      );
    } else if (!isMoveKey && otherUsersWithTask.length > 0) {
      const otherNames = otherUsersWithTask.map(t => {
        const tObj = tecnicos.find(tec => tec.id === t.Tecnico);
        return tObj ? tObj.nombre.split(' ')[0] : t.Tecnico;
      }).join(', ');

      toast("¿Copiar para todos los asignados?", {
        duration: 15000,
        description: (
          <div className="flex flex-col gap-3.5 mt-1" onPointerDown={(e) => e.stopPropagation()}>
            <span className="text-[13px] leading-snug text-fg-muted">
              Esta tarea también está asignada a <strong className="font-semibold text-fg">{otherNames}</strong>. ¿Deseas copiarla para todos al día {format(targetDateObj, 'd MMM', { locale: es })}?
            </span>
            <div className="flex flex-col gap-2">
              <div role="button" tabIndex={0} onClick={(e) => { e?.preventDefault(); e?.stopPropagation(); toast.dismiss(); executeAction(true, otherUsersWithTask); }}
                className="w-full cursor-pointer rounded-xl bg-brand px-4 py-2 text-center text-[13px] font-semibold text-brand-fg shadow-xs ring-1 ring-inset ring-black/5 transition-colors hover:bg-brand-hover">
                Sí, copiar para todos ({otherUsersWithTask.length + 1})
              </div>
              <div className="flex items-center gap-2">
                <div role="button" tabIndex={0} onClick={(e) => { e?.preventDefault(); e?.stopPropagation(); toast.dismiss(); executeAction(false, []); }}
                  className="flex-1 cursor-pointer rounded-xl border border-line-strong bg-surface px-4 py-2 text-center text-[13px] font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2">
                  Solo para mí
                </div>
                <div role="button" tabIndex={0} onClick={(e) => { e?.preventDefault(); e?.stopPropagation(); toast.dismiss(); }}
                  className="flex-1 cursor-pointer rounded-xl border border-line-strong bg-surface px-4 py-2 text-center text-[13px] font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2">
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
  }, [confirmAction, tecnicos, tasks, upsertScheduleAssignments, upsertScheduleCell]);

  const executeIntelligentReschedule = useCallback(async (sourceTask, oldDate, newDate) => {
    const diffDays = Math.round((newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return toast.success("No se seleccionó una fecha diferente.");

    const sourceDate = sourceTask.fecha || oldDate;
    const sourceCells = [sourceTask, ...findLinkedTasks(tasks, sourceTask, sourceDate)];

    const lockedCell = sourceCells.find(cell => getVehicleLockMessage(cell, cell.Tecnico));
    if (lockedCell) {
      return toast.error(getVehicleLockMessage(lockedCell, lockedCell.Tecnico), { duration: 6000 });
    }

    const sourceRowIds = new Set(sourceCells.map(cell => String(cell.rowId)));
    const moves = sourceCells.map(cell => {
      const destDate = new Date(cell.fecha.getTime());
      destDate.setDate(destDate.getDate() + diffDays);
      return { cell, destDate };
    });

    // Choca solo si en destino hay otra tarea del mismo recurso en el mismo horario.
    for (const { cell, destDate } of moves) {
      const collision = tasks.find(t => (
        t.Tecnico === cell.Tecnico &&
        isSameDay(t.fecha, destDate) &&
        !sourceRowIds.has(String(t.rowId)) &&
        hasTaskContent(t) &&
        hasTimeOverlap(t, cell)
      ));
      if (collision) {
        const tecName = tecnicos.find(t => t.id === cell.Tecnico)?.nombre || cell.Tecnico;
        return toast.error(`Colisión detectada: el ${format(destDate, 'EEEE d', { locale: es })} ${tecName} ya tiene "${collision.morning}" de ${collision.horaInicio || 'inicio'} a ${collision.horaFin || 'fin'}. Reprogramación cancelada.`, { duration: 8000 });
      }
    }

    const grupoId = sourceTask.grupoId || createGroupId();
    toast.success(`Moviendo ${sourceCells.length} tarea(s)...`, { duration: 4000 });
    try {
      // Se anulan las filas originales (queda el historial) y se crean las nuevas,
      // todo en una sola transacción.
      await upsertScheduleAssignments(oldDate, [
        ...moves.map(({ cell }) => ({ date: cell.fecha, resource: cell.Tecnico, payload: clearPayload(cell.rowId) })),
        ...moves.map(({ cell, destDate }) => ({
          date: destDate,
          resource: cell.Tecnico,
          payload: taskToPayload(cell, { rowId: null, lastModified: null, estadoAM: 'Reprogramado', grupo_id: grupoId }),
        })),
      ]);
      toast.success("Tareas reprogramadas exitosamente.");
    } catch (e) {
      toast.error(`Error al reprogramar: ${e.message}`);
      if (typeof refetch === 'function') refetch();
    }
  }, [getVehicleLockMessage, tasks, tecnicos, upsertScheduleAssignments, refetch]);

  const promptRescheduleDate = useCallback((task, date) => {
    let selectedDateStr = format(new Date(date), 'yyyy-MM-dd');
    const onSubmit = (e) => {
      e.preventDefault();
      toast.dismiss();
      const newDateObj = new Date(selectedDateStr + 'T12:00:00');
      const oldDateNoon = new Date(date);
      oldDateNoon.setHours(12, 0, 0, 0);
      executeIntelligentReschedule(task, oldDateNoon, newDateObj);
    };
    toast.dismiss();
    toast("Seleccionar nueva fecha", {
      duration: 30000,
      description: (
        <form onSubmit={onSubmit} className="flex flex-col gap-3 mt-2" onPointerDown={e => e.stopPropagation()}>
          <p className="text-[13px] leading-snug text-fg-muted">Se reprogramarán juntas todas las filas de esta ficha.</p>
          <input type="date" defaultValue={selectedDateStr} onChange={(e) => selectedDateStr = e.target.value} required
            className="field h-10 font-medium" />
          <div className="flex gap-2 border-t border-line pt-3">
            <button type="submit" className="flex-1 cursor-pointer rounded-xl bg-brand px-4 py-2 text-center text-[13px] font-semibold text-brand-fg shadow-xs ring-1 ring-inset ring-black/5 transition-colors hover:bg-brand-hover">Continuar</button>
            <button type="button" onClick={() => toast.dismiss()} className="flex-1 cursor-pointer rounded-xl border border-line-strong bg-surface px-4 py-2 text-center text-[13px] font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2">Cancelar</button>
          </div>
        </form>
      )
    });
  }, [executeIntelligentReschedule]);

  const handleStateChange = useCallback(async (newState) => {
    const { task, date, resourceId } = contextMenu;
    setContextMenu(prev => ({ ...prev, visible: false }));

    if (newState === 'Reprogramado') {
      return promptRescheduleDate(task, date);
    }

    toast.success(`Marcando como ${newState}...`, { duration: 500 });
    try {
      await upsertScheduleCell(new Date(date), resourceId, taskToPayload(task, { estadoAM: newState }), false);
      toast.success(`Estado actualizado a ${newState}`);
    } catch (err) { toast.error(err.message || "Error al actualizar estado"); }
  }, [contextMenu, upsertScheduleCell, promptRescheduleDate]);

  const executeIntelligentVehicleAssign = useCallback(async (sourceTask, technicianId, vehiculo) => {
    const taskDate = sourceTask.fecha;
    const linkedTasks = findLinkedTasks(tasks, sourceTask, taskDate);

    if (linkedTasks.some(t => t.Tecnico === vehiculo.id)) {
      return toast.info(`${vehiculo.nombre} ya está asignado a esta ficha.`);
    }

    const lockedLink = linkedTasks.find(t => getVehicleLockMessage(t, t.Tecnico));
    if (lockedLink) {
      return toast.error(getVehicleLockMessage(lockedLink, lockedLink.Tecnico), { duration: 6000 });
    }

    // Ocupado solo si otra ficha usa el vehículo en un horario que se cruza.
    const collision = tasks.find(t => (
      t.Tecnico === vehiculo.id &&
      isSameDay(t.fecha, taskDate) &&
      hasTaskContent(t) &&
      hasTimeOverlap(t, sourceTask)
    ));
    if (collision) {
      return toast.error(`Cancelado: el ${format(taskDate, 'EEEE d', { locale: es })} ${vehiculo.nombre} ya está en uso por "${collision.morning}" (${collision.horaInicio || 'inicio'}–${collision.horaFin || 'fin'}), reservado por ${collision.createdBy || 'otro usuario'}.`, { duration: 9000 });
    }

    const performAssignment = async () => {
      const grupoId = sourceTask.grupoId || createGroupId();
      const assignments = [];
      // Ficha antigua sin grupo: se le asigna uno a todas sus filas para que el
      // vehículo quede vinculado de verdad.
      if (!sourceTask.grupoId) {
        [sourceTask, ...linkedTasks].forEach(t => {
          assignments.push({ resource: t.Tecnico, payload: taskToPayload(t, { grupo_id: grupoId }) });
        });
      }
      assignments.push({
        resource: vehiculo.id,
        payload: taskToPayload(sourceTask, { rowId: null, lastModified: null, grupo_id: grupoId }),
      });

      try {
        await upsertScheduleAssignments(taskDate, assignments);
        toast.success("Vehículo asignado correctamente.");
      } catch (err) {
        toast.error(`Error al asignar: ${err.message}`);
        if (typeof refetch === 'function') refetch();
      }
    };

    const currentVehicle = linkedTasks.find(t => isVehicleId(t.Tecnico));
    if (currentVehicle) {
      const currentName = tecnicos.find(t => t.id === currentVehicle.Tecnico)?.nombre || 'otro vehículo';
      const targetName = tecnicos.find(t => t.id === technicianId)?.nombre || 'El técnico';
      confirmAction(
        "Esta ficha ya tiene vehículo",
        <><strong className="font-semibold text-fg">{targetName}</strong> ya usa <strong className="font-semibold text-fg">{currentName}</strong> en esta ficha. ¿Deseas agregar también <strong className="font-semibold text-fg">{vehiculo.nombre}</strong>?</>,
        "Sí, agregar",
        performAssignment
      );
    } else {
      performAssignment();
    }
  }, [confirmAction, getVehicleLockMessage, isVehicleId, tasks, tecnicos, upsertScheduleAssignments, refetch]);

  const handleAssignVehicleInit = useCallback((vehiculo) => {
    const { task, resourceId } = contextMenu;
    setContextMenu(prev => ({ ...prev, visible: false, showVehicles: false }));
    toast.dismiss();
    executeIntelligentVehicleAssign(task, resourceId, vehiculo);
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
    isFormOpen, editingEvent, editingLinkedTasks, prefilledDate, prefilledResource,
    selectedDeparture,
    // Drag state
    isDragging, dragPos, isCtrlPressed,
    // Context menu
    contextMenu,
    // Permissions
    isAdmin, isDev, isJefeDeArea, canModifyTask, getVehicleLockMessage, getTaskLockMessage, user,
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
