import { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
} from 'date-fns';

export function useCalendar(tasks = []) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Un evento ocurre en 'day' si 'day' está entre fecha_inicio y fecha_fin
  const eventsForDay = (day) => {
    return tasks.filter(task => {
      const dayStart = new Date(day).setHours(0,0,0,0);
      const taskStart = new Date(task.fecha_inicio).setHours(0,0,0,0);
      const taskEnd = new Date(task.fecha_fin).setHours(23,59,59,999);
      return dayStart >= taskStart && dayStart <= taskEnd;
    }).map(t => ({
      ...t,
      // Map properties for UI compatibility
      title: t.cod_metrica || t.tipo,
      client: t.cliente,
      status: t.estado,
    }));
  };

  const selectedDayEvents = useMemo(
    () => eventsForDay(selectedDay),
    [selectedDay, tasks] // depends on tasks array now
  );

  const monthStats = useMemo(() => {
    // Tareas del mes seleccionado (si alguna de sus fechas cruza o toca el mes)
    const currentMonthStart = startOfMonth(currentDate).setHours(0,0,0,0);
    const currentMonthEnd = endOfMonth(currentDate).setHours(23,59,59,999);

    const monthEvents = tasks.filter(t => {
      const tStart = new Date(t.fecha_inicio).setHours(0,0,0,0);
      const tEnd = new Date(t.fecha_fin).setHours(23,59,59,999);
      return (tStart <= currentMonthEnd && tEnd >= currentMonthStart);
    });

    return {
      total: monthEvents.length,
      pending: monthEvents.filter(e => e.estado === 'pendiente').length,
      inProgress: monthEvents.filter(e => e.estado === 'en_proceso').length,
      completed: monthEvents.filter(e => e.estado === 'completado').length,
    };
  }, [currentDate, tasks]);

  return {
    currentDate,
    selectedDay,
    calendarDays,
    selectedDayEvents,
    monthStats,
    eventsForDay,
    selectDay: setSelectedDay,
    nextMonth: () => setCurrentDate(d => addMonths(d, 1)),
    prevMonth: () => setCurrentDate(d => subMonths(d, 1)),
    goToToday: () => { setCurrentDate(new Date()); setSelectedDay(new Date()); },
    isToday,
    isSameDay,
    isSameMonth,
  };
}
