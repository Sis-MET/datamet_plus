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
        // Transformar la tabla plana (filas por día) a un array de celdas "evento"
        const flatTasks = [];
        
        scheduleData.data.forEach(row => {
          // La fecha se construye a partir de gestion, mes, dia
          const rowDate = new Date(row.gestion, row.mes - 1, row.dia);
          
          // Iteramos todas las columnas válidas de técnicos/vehículos
          validTecnicos.forEach(tec => {
            const resourceId = tec.id; // Ej. richard_lopez, FURGON, etc
            const textValue = row[resourceId];
            
            if (textValue && textValue.trim() !== '') {
              // Extraer particiones: MAÑANA;TARDE;COLOR
              const parts = textValue.split(';');
              const m = parts[0] ? parts[0].trim() : '';
              const a = parts[1] ? parts[1].trim() : '';
              const c = parts[2] ? parts[2].trim() : '';

              flatTasks.push({
                id: `${row.id}_${resourceId}`,
                rowId: row.id,
                Tecnico: resourceId,
                fecha: rowDate,
                texto: textValue, // original
                morning: m,
                afternoon: a,
                color: c || '#37A65F' // default green si no hay
              });
            }
          });
        });

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

  // Tareas en un día específico para un técnico específico
  // Comparación por día exacto y técnico idético
  const tasksForCell = useCallback((tecnicoId, day) => {
    return tasks.filter(t => t.Tecnico === tecnicoId && isSameDay(t.fecha, day));
  }, [tasks]);

  // Ahora upsertScheduleCell recibe un objeto con morning, afternoon y color en vez de un solo texto
  const upsertScheduleCell = async (date, resource, payload) => {
    const token = localStorage.getItem('rimmet_token');
    const dateStr = format(date, 'yyyy-MM-dd');
    
    let textToSave = '';
    
    if (typeof payload === 'string') {
       // Compatibilidad hacia atrás o si se manda un string puro
       textToSave = payload;
    } else if (payload) {
       // Si no viene morning y afternoon está vacío, borrar celda
       if (!payload.morning && !payload.afternoon) {
         textToSave = '';
       } else {
         textToSave = `${payload.morning || ''};${payload.afternoon || ''};${payload.color || ''}`;
       }
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
        text: textToSave
      })
    });
    
    if (!res.ok) throw new Error('Error al guardar en el cronograma');
    await fetchData(); // Refetch para redibujar la grilla plana
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
    upsertScheduleCell,
    nextWeek: () => setWeekStart(d => addWeeks(d, 1)),
    prevWeek: () => setWeekStart(d => subWeeks(d, 1)),
    goToCurrentWeek: () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })),
    isToday,
    isSameDay,
  };
}
