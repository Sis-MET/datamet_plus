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

// Vehículos de la flota — recursos de solo lectura en el Gantt
export const VEHICLES = [
  { id: 'Furgón',    nombre: 'Furgón',    tipo: 'vehiculo', area: 'VEHÍCULOS' },
  { id: 'Camioneta', nombre: 'Camioneta', tipo: 'vehiculo', area: 'VEHÍCULOS' },
];

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
        fetch(`${API_BASE}/calendar/cronograma?start=${startStr}&end=${endStr}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/calendar/tecnicos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!scheduleRes.ok) console.error('Schedule fetch failed:', await scheduleRes.text());
      if (!tecnicosRes.ok) console.error('Tecnicos fetch failed:', await tecnicosRes.text());
      if (!scheduleRes.ok || !tecnicosRes.ok) throw new Error('Server error');

      const scheduleData = await scheduleRes.json();
      const tecnicosData = await tecnicosRes.json();

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
            const tec = validTecnicos.find(t => t.user_id === row.id_usuario);
            if (tec) resourceId = tec.id;
          }

          if (!resourceId) return null;

          // row.fecha viene como YYYY-MM-DD
          const rowDate = new Date(row.fecha + 'T12:00:00');

          let formattedTimestamp = '';
          if (row.fecha_modificacion) {
             formattedTimestamp = `${row.fecha_modificacion} ${row.hora_modificacion || ''}`.trim();
          } else if (row.fecha_creacion) {
             formattedTimestamp = `${row.fecha_creacion} ${row.hora_creacion || ''}`.trim();
          }

          return {
            id: `task_${row.id}`,
            rowId: row.id,
            Tecnico: resourceId,
            fecha: rowDate,
            morning: row.manana || '',
            afternoon: row.tarde || '',
            colorAM: row.color_am || '#37A65F',
            colorPM: row.color_pm || '#37A65F',
            author: row.actualizado_por || row.creado_por || '',
            timestampUpdated: formattedTimestamp
          };
        }).filter(Boolean);

        setTasks(flatTasks);
        setUseMock(false);
      } else {
        setUseMock(false);
      }
    } catch (err) {
      console.error("fetchData error:", err);
      // Fallback a array vacio
      setTasks([]);
      setUseMock(false);
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Tareas para la celda de un técnico o vehículo (por recurso + día)
  const tasksForCell = useCallback((tecnicoId, day) => {
    return tasks.filter(t => t.Tecnico === tecnicoId && isSameDay(t.fecha, day));
  }, [tasks]);

  // Ahora upsertScheduleCell recibe un objeto con morning, afternoon y color en vez de un solo texto
  const upsertScheduleCell = async (date, resource, payload) => {
    const token = localStorage.getItem('rimmet_token');
    // Formatear la fecha como YYYY-MM-DD local
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Convertir el payload (sea strig o objeto) a un objeto seguro.
    let payloadObj = null;
    if (typeof payload === 'string' && payload.trim() !== '') {
        const parts = payload.split(';');
        payloadObj = {
           morning: parts[0] ? parts[0].trim() : '',
           afternoon: parts[1] ? parts[1].trim() : '',
           colorAM: parts[2] ? parts[2].trim() : '',
           colorPM: parts[3] ? parts[3].trim() : '',
           autor: parts[4] ? parts[4].trim() : 'Sistema'
        };
    } else if (payload && typeof payload === 'object') {
        let autorText = 'Sistema';
        if (token) {
           try {
              const payloadToken = JSON.parse(atob(token.split('.')[1]));
              autorText = payloadToken.nombre || payloadToken.usuario || 'Sistema';
           } catch(e) {}
        }
        
        payloadObj = {
           morning: payload.morning || '',
           afternoon: payload.afternoon || '',
           colorAM: payload.colorAM || '',
           colorPM: payload.colorPM || '',
           lastModified: payload.lastModified || null,
           autor: autorText
        };
    }

    const res = await fetch(`${API_BASE}/calendar/cronograma`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        date: dateStr,
        resource,
        payload: payloadObj
      })
    });

    if (!res.ok) {
        let errMsg = 'Error al guardar en el cronograma';
        try {
           const d = await res.json();
           if (d.message) errMsg = d.message;
        } catch(e) {}
        throw new Error(errMsg);
    }
    await fetchData(); // Refetch para redibujar la grilla plana
  };

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
    refetch: fetchData,
    nextWeek: () => setWeekStart(d => addWeeks(d, 1)),
    prevWeek: () => setWeekStart(d => subWeeks(d, 1)),
    goToCurrentWeek: () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })),
    goToDate: (date) => setWeekStart(startOfWeek(date, { weekStartsOn: 1 })),
    isToday,
    isSameDay,
  };
}
