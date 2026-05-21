import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { toast } from 'sonner';

import { API_BASE } from '../../../config/api';


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
  const fetchData = useCallback(async () => {
    const token = safeStorage.getItem('rimmet_token');
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const startStr = format(prevWeekStart, 'yyyy-MM-dd');
      const endStr   = format(nextWeekEnd,   'yyyy-MM-dd');

      const [scheduleRes, tecnicosRes] = await Promise.all([
        fetch(`${API_BASE}/calendar/cronograma?start=${startStr}&end=${endStr}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        }),
        fetch(`${API_BASE}/calendar/tecnicos`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
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
            codigoRegistro: row.codigo_reg || '',
            // cotizacion es el campo principal (antes: descripcion)
            morning: row.cotizacion || row.descripcion || '',
            descripcion: row.descripcion || '',
            cliente: row.cliente || '',
            cod_cliente: row.cod_cliente || '',
            colorAM: row.color || '#37A65F',
            estadoAM: mappedEstado,
            horaInicio: row.hora_inicio ? row.hora_inicio.substring(0, 5) : '',
            horaFin:    row.hora_fin    ? row.hora_fin.substring(0, 5)    : '',
            horaTotal: row.hora_total ?? null,
            author: row.actualizado_por || row.creado_por || '',
            timestampUpdated: formattedTimestamp,
            creadoEn: row.creado_en || ''
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
  }, [prevWeekStart, nextWeekEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Tareas para la celda de un técnico o vehículo (por recurso + día)
  const tasksForCell = useCallback((tecnicoId, day) => {
    return tasks.filter(t => t.Tecnico === tecnicoId && isSameDay(t.fecha, day));
  }, [tasks]);

  // Ahora upsertScheduleCell recibe un objeto con morning, afternoon y color en vez de un solo texto
  const upsertScheduleCell = async (date, resource, payload, skipFetch = false) => {
    const token = safeStorage.getItem('rimmet_token');
    // Formatear la fecha como YYYY-MM-DD local
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Convertir el payload (sea strig o objeto) a un objeto seguro.
    let payloadObj = null;
    if (typeof payload === 'string' && payload.trim() !== '') {
        payloadObj = {
           morning: payload.trim(),
           colorAM: '#10B981',
           estadoAM: 'Pendiente',
           autor: 'Sistema'
        };
    } else if (payload && typeof payload === 'object') {
        let autorText = 'Sistema';
        if (token) {
           try {
              const payloadToken = JSON.parse(atob(token.split('.')[1]));
              autorText = payloadToken.nombre || payloadToken.usuario || 'Sistema';
           } catch {
              // Mantener autor por defecto si el token no se puede decodificar.
           }
        }

        payloadObj = {
           cotizacion:   payload.cotizacion   || payload.morning || '',
           descripcion:  payload.descripcion  || '',
           cliente:      payload.cliente      || '',
           cod_cliente:  payload.cod_cliente  || '',
           // morning se mantiene para compatibilidad con el backend (fallback)
           morning:      payload.cotizacion   || payload.morning || '',
           colorAM:      payload.colorAM      || '',
           estadoAM:     payload.estadoAM     || 'Pendiente',
           horaInicio:   payload.horaInicio   || '',
           horaFin:      payload.horaFin      || '',
           lastModified: payload.lastModified || null,
           rowId:        payload.rowId        || null,
           autor: autorText,
           creado_en:    'CronoMET'
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
        } catch {
           // Mantener mensaje generico si la respuesta no es JSON.
        }
        throw new Error(errMsg);
    }
    
    // Alerta si falta el código de registro (es obligatorio para todas las tareas)
    try {
        const d = await res.json();
        if (d.data && d.data.codigo_reg == null) {
            toast.error('Atención: La actividad se guardó, pero no tiene asignado un código de registro (RSP).', { duration: 8000 });
        }
    } catch {
        // No bloquear el guardado si la respuesta ya fue consumida o no es JSON.
    }

    if (!skipFetch) {
       await fetchData(); // Refetch para redibujar la grilla plana
    }
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
