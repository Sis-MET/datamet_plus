import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  addDays,
  subWeeks,
  isSameDay,
  isToday,
  format,
} from 'date-fns';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function useGantt() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [tasks, setTasks] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useMock, setUseMock] = useState(true);

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);

  const weekDays = useMemo(() =>
    eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd]
  );

  // 3 días de la siguiente semana (preview con efecto glass)
  const previewDays = useMemo(() =>
    [1, 2, 3].map(n => addDays(weekEnd, n)),
    [weekEnd]
  );

  // Intentar cargar del backend; si falla, conservar mock
  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('rimmet_token');
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const startStr = format(weekStart, 'yyyy-MM-dd');
      const endStr   = format(weekEnd,   'yyyy-MM-dd');

      const [scheduleRes, tecnicosRes] = await Promise.all([
        fetch(`${API_BASE}/calendar/schedule?start=${startStr}&end=${endStr}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/calendar/tecnicos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!scheduleRes.ok) console.error('Schedule fetch failed:', await scheduleRes.text());
      if (!tecnicosRes.ok) console.error('Tecnicos fetch failed:', await tecnicosRes.text());
      if (!scheduleRes.ok || !tecnicosRes.ok) throw new Error('Server error: Fallback to mock data');

      const scheduleData = await scheduleRes.json();
      const tecnicosData = await tecnicosRes.json();

      if (scheduleData.success) {
        setTasks(scheduleData.data.map(t => ({
          ...t,
          fecha_inicio: new Date(t.fecha_inicio),
          fecha_fin:    new Date(t.fecha_fin),
        })));
        setUseMock(false);
      }
      if (tecnicosData.success) {
        setTecnicos(tecnicosData.data);
        setUseMock(false);
      }
    } catch (err) {
      console.error("fetchData error:", err);
      // Removed silent fallback to mock data
      setUseMock(false);
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Tareas en un día específico para un técnico específico
  const tasksForCell = useCallback((tecnicoId, day) =>
    tasks.filter(t =>
      t.Tecnico === tecnicoId &&
      day >= new Date(new Date(t.fecha_inicio).setHours(0,0,0,0)) &&
      day <= new Date(new Date(t.fecha_fin).setHours(23,59,59,999))
    ),
    [tasks]
  );

  const createTask = async (data) => {
    const token = localStorage.getItem('rimmet_token');
    const res = await fetch(`${API_BASE}/calendar/schedule`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al crear tarea');
    await fetchData(); // Refetch
  };

  const updateTask = async (id, data) => {
    const token = localStorage.getItem('rimmet_token');
    const res = await fetch(`${API_BASE}/calendar/schedule/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al actualizar tarea');
    await fetchData(); // Refetch
  };

  const deleteTask = async (id) => {
    const token = localStorage.getItem('rimmet_token');
    const res = await fetch(`${API_BASE}/calendar/schedule/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Error al eliminar tarea');
    await fetchData(); // Refetch
  };

  return {
    tasks,
    weekStart,
    weekEnd,
    weekDays,
    previewDays,
    tasks,
    tecnicos,
    loading,
    error,
    useMock,
    tasksForCell,
    createTask,
    updateTask,
    deleteTask,
    nextWeek: () => setWeekStart(d => addWeeks(d, 1)),
    prevWeek: () => setWeekStart(d => subWeeks(d, 1)),
    goToCurrentWeek: () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })),
    isToday,
    isSameDay,
  };
}
