import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { safeStorage } from '../../../shared/utils/storage';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday,
  format,
} from 'date-fns';
import { api, ApiError, parseToken } from '../../../shared/api/client';
import { parseScheduleResponse, parseTechniciansResponse } from '../domain/scheduleContract';
import {
  applyOptimisticAssignments,
  hasUnconfirmedInserts,
  reconcileOptimisticAssignments,
} from '../domain/optimisticSchedule';

const EMPTY_TASKS = Object.freeze([]);

const toApiPayload = (payload) => {
  if (typeof payload === 'string' && payload.trim()) {
    return {
      tipo_tarea: payload.trim(),
      morning: payload.trim(),
      colorAM: '#10B981',
      estadoAM: 'Pendiente',
      autor: 'Sistema',
    };
  }
  if (!payload || typeof payload !== 'object') return null;

  const tokenData = parseToken();
  return {
    tipo_tarea: payload.tipo_tarea || payload.tipoTarea || payload.morning || '',
    cotizacion: payload.cotizacion || '',
    descripcion: payload.descripcion || '',
    cliente: payload.cliente || '',
    cod_cliente: payload.cod_cliente || '',
    planta: payload.planta || '',
    morning: payload.tipo_tarea || payload.tipoTarea || payload.morning || '',
    colorAM: payload.colorAM || '',
    estadoAM: payload.estadoAM || 'Pendiente',
    horaInicio: payload.horaInicio || '',
    horaFin: payload.horaFin || '',
    lastModified: payload.lastModified || null,
    rowId: payload.rowId || null,
    autor: tokenData?.nombre || tokenData?.usuario || 'Sistema',
    creado_en: 'CronoMET',
  };
};

export function useGantt() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [tasks, setTasks] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useMock, setUseMock] = useState(true);
  const tasksRef = useRef([]);
  const mutationSequenceRef = useRef(0);

  const commitTasks = useCallback((nextTasks) => {
    tasksRef.current = nextTasks;
    setTasks(nextTasks);
  }, []);

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);

  // Semana anterior y siguiente para la vista de 3 semanas
  const prevWeekStart = useMemo(() => startOfWeek(subWeeks(weekStart, 1), { weekStartsOn: 1 }), [weekStart]);
  const nextWeekEnd   = useMemo(() => endOfWeek(addWeeks(weekStart, 1), { weekStartsOn: 1 }), [weekStart]);

  // 21 días: semana anterior + actual + siguiente
  const weekDays = useMemo(() =>
    eachDayOfInterval({ start: prevWeekStart, end: nextWeekEnd }),
    [prevWeekStart, nextWeekEnd]
  );

  // previewDays ya no se usa pero lo mantenemos vacío para compatibilidad
  const previewDays = [];

  // Intentar cargar del backend; si falla, conservar mock
  const fetchData = useCallback(async ({ silent = false } = {}) => {
    const token = safeStorage.getItem('rimmet_token');
    if (!token) return;

    if (!silent) setLoading(true);
    setError(null);
    try {
      const startStr = format(prevWeekStart, 'yyyy-MM-dd');
      const endStr   = format(nextWeekEnd,   'yyyy-MM-dd');

      const [scheduleRaw, techniciansRaw] = await Promise.all([
        api.get('/calendar/cronograma', { start: startStr, end: endStr }),
        api.get('/calendar/tecnicos'),
      ]);
      const scheduleData = parseScheduleResponse(scheduleRaw);
      const tecnicosData = parseTechniciansResponse(techniciansRaw);

      let validTecnicos = [];
      if (tecnicosData.success) {
        validTecnicos = tecnicosData.data;
        setTecnicos(validTecnicos);
      }

      if (scheduleData.success && validTecnicos.length > 0) {
        // Mapear directamente el array normalizado
        const flatTasks = scheduleData.data.map(row => {
          let resourceId = row.id_usuario || row.usuario || '';
          if (row.id_usuario) {
            // MATCH EXACT: Some Vehicles and Users share the same database integer ID (e.g. both ID=8).
            // We use both ID and Name to distinguish them to avoid misplacing tasks on the Gantt chart.
            let tec = validTecnicos.find(t => t.user_id === row.id_usuario && (t.nombre === row.usuario || t.id === row.usuario));
            
            // FALLBACKS: In case naming changed or slight mismatch
            if (!tec) tec = validTecnicos.find(t => t.nombre === row.usuario); 
            if (!tec) tec = validTecnicos.find(t => t.user_id === row.id_usuario); 
            
            if (tec) resourceId = tec.id;
          }

          if (!resourceId) return null;

          // row.fecha viene como YYYY-MM-DD
          const rowDate = new Date(row.fecha + 'T12:00:00');
          
          if (row.estado && row.estado.toLowerCase() === 'anulado') return null;

          let formattedTimestamp = '';
          if (row.fecha_modificacion) {
             formattedTimestamp = `${row.fecha_modificacion} ${row.hora_modificacion || ''}`.trim();
          } else if (row.fecha_creacion) {
             formattedTimestamp = `${row.fecha_creacion} ${row.hora_creacion || ''}`.trim();
          }

          let mappedEstado = row.estado || 'Pendiente';
          if (row.creado_en !== 'Salida Personal' && row.creado_en !== 'SalidaMET') {
            if (mappedEstado.toLowerCase() === 'solicitud') mappedEstado = 'Pendiente';
            if (mappedEstado.toLowerCase() === 'aceptación' || mappedEstado.toLowerCase() === 'aceptacion') mappedEstado = 'Completado';
          }

          return {
            id: `task_${row.id}`,
            rowId: row.id,
            id_usuario: row.id_usuario,
            Tecnico: resourceId,
            fecha: rowDate,
            tipoTarea: row.tipo_tarea || row.cotizacion || row.descripcion || '',
            cotizacion: row.cotizacion || '',
            // morning se conserva como alias de presentación para la grilla.
            morning: row.tipo_tarea || row.cotizacion || row.descripcion || '',
            descripcion: row.descripcion || '',
            cliente: row.cliente || '',
            cod_cliente: row.cod_cliente || '',
            planta: row.planta || '',
            colorAM: row.color || '#37A65F',
            estadoAM: mappedEstado,
            horaInicio: row.hora_inicio ? row.hora_inicio.substring(0, 5) : '',
            horaFin:    row.hora_fin    ? row.hora_fin.substring(0, 5)    : '',
            horaTotal: row.hora_total ?? null,
            author: row.actualizado_por || row.creado_por || '',
            timestampUpdated: formattedTimestamp,
            createdBy: row.creado_por || '',
            createdAt: row.fecha_creacion && row.hora_creacion ? `${row.fecha_creacion} ${row.hora_creacion}`.trim() : '',
            updatedBy: row.actualizado_por || '',
            updatedAt: row.fecha_modificacion && row.hora_modificacion ? `${row.fecha_modificacion} ${row.hora_modificacion}`.trim() : '',
            creadoEn: row.creado_en || ''
          };
        }).filter(Boolean);

        commitTasks(flatTasks);
        setUseMock(false);
      } else {
        setUseMock(false);
      }
    } catch (err) {
      console.error("fetchData error:", err);
      setError(err?.message || 'No se pudo cargar el cronograma.');
      if (!silent) commitTasks([]);
      setUseMock(false);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [commitTasks, prevWeekStart, nextWeekEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tasksByResourceAndDay = useMemo(() => {
    const index = new Map();

    tasks.forEach((task) => {
      if (!task?.Tecnico || !task?.fecha) return;
      const key = `${task.Tecnico}|${format(task.fecha, 'yyyy-MM-dd')}`;
      const cellTasks = index.get(key);
      if (cellTasks) cellTasks.push(task);
      else index.set(key, [task]);
    });

    return index;
  }, [tasks]);

  // Consulta O(1) por celda; evita filtrar todas las tareas cientos de veces por render.
  const tasksForCell = useCallback((tecnicoId, day) => {
    const key = `${tecnicoId}|${format(day, 'yyyy-MM-dd')}`;
    return tasksByResourceAndDay.get(key) || EMPTY_TASKS;
  }, [tasksByResourceAndDay]);

  const upsertScheduleCell = useCallback(async (date, resource, payload) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const payloadObj = toApiPayload(payload);
    const assignments = [{ resource, payload: payloadObj }];
    const previousTasks = tasksRef.current;
    const mutationId = ++mutationSequenceRef.current;
    const optimistic = applyOptimisticAssignments(
      previousTasks,
      dateStr,
      assignments,
      tecnicos,
      mutationId
    );
    commitTasks(optimistic.tasks);

    try {
      const response = await api.post('/calendar/cronograma', {
        date: dateStr,
        resource,
        payload: payloadObj
      });
      const serverResults = response?.data ? [response.data] : [];
      commitTasks(reconcileOptimisticAssignments(
        tasksRef.current,
        optimistic.operations,
        serverResults
      ));
      if (hasUnconfirmedInserts(optimistic.operations, serverResults)) {
        await fetchData({ silent: true });
      }
    } catch (err) {
      commitTasks(previousTasks);
      let errMsg = 'Error al guardar en el cronograma';
      if (err instanceof ApiError && err.data?.message) {
        errMsg = err.data.message;
      }
      throw new Error(errMsg);
    }
  }, [commitTasks, fetchData, tecnicos]);

  const upsertScheduleAssignments = useCallback(async (date, assignments) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const normalizedAssignments = assignments.map(({ resource, payload }) => ({
      resource,
      payload: toApiPayload(payload),
    }));
    const previousTasks = tasksRef.current;
    const mutationId = ++mutationSequenceRef.current;
    const optimistic = applyOptimisticAssignments(
      previousTasks,
      dateStr,
      normalizedAssignments,
      tecnicos,
      mutationId
    );
    commitTasks(optimistic.tasks);

    try {
      const response = await api.post('/calendar/cronograma/asignaciones', {
        date: dateStr,
        assignments: normalizedAssignments.map(({ resource, payload }) => ({
          date: dateStr,
          resource,
          payload,
        })),
      });
      const serverResults = Array.isArray(response?.data) ? response.data : [];
      commitTasks(reconcileOptimisticAssignments(
        tasksRef.current,
        optimistic.operations,
        serverResults
      ));
      if (hasUnconfirmedInserts(optimistic.operations, serverResults)) {
        await fetchData({ silent: true });
      }
    } catch (err) {
      commitTasks(previousTasks);
      const message = err instanceof ApiError && err.data?.message
        ? err.data.message
        : err?.message || 'Error al guardar las asignaciones';
      throw new Error(message);
    }
  }, [commitTasks, fetchData, tecnicos]);

  return {
    tasks,
    weekStart,
    weekEnd,
    weekDays,
    previewDays,
    tecnicos,
    loading,
    error,
    useMock,
    tasksForCell,
    upsertScheduleCell,
    upsertScheduleAssignments,
    refetch: fetchData,
    nextWeek: () => setWeekStart(d => addWeeks(d, 1)),
    prevWeek: () => setWeekStart(d => subWeeks(d, 1)),
    goToCurrentWeek: () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })),
    goToDate: (date) => setWeekStart(startOfWeek(date, { weekStartsOn: 1 })),
    isToday,
    isSameDay,
  };
}
