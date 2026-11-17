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
import { mapScheduleRow } from '../domain/scheduleRows';
import {
  applyOptimisticAssignments,
  hasUnconfirmedInserts,
  reconcileOptimisticAssignments,
} from '../domain/optimisticSchedule';

const EMPTY_TASKS = Object.freeze([]);
const POLL_INTERVAL_MS = 30000;

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
    grupo_id: payload.grupo_id || null,
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
  const scheduleVersionRef = useRef(null);

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

  const rangeParams = useMemo(() => ({
    start: format(prevWeekStart, 'yyyy-MM-dd'),
    end: format(nextWeekEnd, 'yyyy-MM-dd'),
  }), [prevWeekStart, nextWeekEnd]);

  // Huella del rango en el servidor; null si el backend aún no expone el endpoint.
  const fetchScheduleVersion = useCallback(async () => {
    try {
      const response = await api.get('/calendar/cronograma/version', rangeParams);
      return response?.data?.version ?? null;
    } catch {
      return null;
    }
  }, [rangeParams]);

  // Intentar cargar del backend; si falla, conservar mock
  const fetchData = useCallback(async ({ silent = false } = {}) => {
    const token = safeStorage.getItem('datamet_token');
    if (!token) return;

    if (!silent) setLoading(true);
    setError(null);
    try {
      const [scheduleRaw, techniciansRaw, version] = await Promise.all([
        api.get('/calendar/cronograma', rangeParams),
        api.get('/calendar/tecnicos'),
        fetchScheduleVersion(),
      ]);
      scheduleVersionRef.current = version;
      const scheduleData = parseScheduleResponse(scheduleRaw);
      const tecnicosData = parseTechniciansResponse(techniciansRaw);

      let validTecnicos = [];
      if (tecnicosData.success) {
        validTecnicos = tecnicosData.data;
        setTecnicos(validTecnicos);
      }

      if (scheduleData.success && validTecnicos.length > 0) {
        // Mapear directamente el array normalizado
        const flatTasks = scheduleData.data.map(row => mapScheduleRow(row, validTecnicos)).filter(Boolean);

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
  }, [commitTasks, fetchScheduleVersion, rangeParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sondeo liviano: pregunta solo la huella y descarga el cronograma completo
  // cuando cambió. Con la pestaña oculta no consulta; al volver, revisa enseguida.
  useEffect(() => {
    const pollForChanges = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!safeStorage.getItem('datamet_token')) return;
      const version = await fetchScheduleVersion();
      if (version && version === scheduleVersionRef.current) return;
      await fetchData({ silent: true });
    };

    const intervalId = setInterval(pollForChanges, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', pollForChanges);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', pollForChanges);
    };
  }, [fetchData, fetchScheduleVersion]);

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

  /**
   * Guarda varias filas en una sola transacción: o se aplican todas o ninguna.
   * Cada asignación puede traer su propia `date`; si no, usa `date`.
   */
  const upsertScheduleAssignments = useCallback(async (date, assignments) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const normalizedAssignments = assignments.map(assignment => ({
      date: assignment.date ? format(assignment.date, 'yyyy-MM-dd') : dateStr,
      resource: assignment.resource,
      payload: toApiPayload(assignment.payload),
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
        assignments: normalizedAssignments,
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
