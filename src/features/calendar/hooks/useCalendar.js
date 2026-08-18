import { useCallback, useState, useMemo } from 'react';
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

  // Un evento ocurre en 'day' si coinciden las fechas (ahora son días discretos, no rangos)
  const eventsForDay = useCallback((day) => {
    const filteredTasks = tasks.filter(task => {
      if (!task.fecha) return false;
      const dayStart = new Date(day).setHours(0,0,0,0);
      const taskStart = new Date(task.fecha).setHours(0,0,0,0);
      return dayStart === taskStart;
    });

    const eventsArray = [];
    filteredTasks.forEach(t => {
       if (t.morning) {
         eventsArray.push({
           ...t,
           id: `${t.id}-act`,
           title: t.morning,
           client: t.Tecnico,
           status: 'completado',
           shiftIndicator: ''
         });
       }
    });

    return eventsArray;
  }, [tasks]);

  const selectedDayEvents = useMemo(
    () => eventsForDay(selectedDay),
    [eventsForDay, selectedDay]
  );

  const monthStats = useMemo(() => {
    // Tareas del mes seleccionado
    const currentMonthStart = startOfMonth(currentDate).setHours(0,0,0,0);    
    const currentMonthEnd = endOfMonth(currentDate).setHours(23,59,59,999);

    const monthEvents = tasks.filter(t => {
      if (!t.fecha) return false;
      const tStart = new Date(t.fecha).setHours(0,0,0,0);
      return (tStart >= currentMonthStart && tStart <= currentMonthEnd);
    });

    return {
      total: monthEvents.length,
      pending: monthEvents.length, // Todo es "pendiente" o sin estado real ahora
      inProgress: 0,
      completed: 0,
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
