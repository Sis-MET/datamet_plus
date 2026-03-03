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

// Datos mock — se reemplazarán con llamadas al backend cuando esté listo
const MOCK_EVENTS = [
  { id: 1, date: new Date(), title: 'RIM-SON-030326-0900', client: 'ABC S.A.', status: 'pending', type: 'rim' },
  { id: 2, date: new Date(), title: 'RIM-CAL-030326-1100', client: 'XYZ Ltda.', status: 'in_progress', type: 'calibration' },
  { id: 3, date: addMonths(new Date(), 0), title: 'RIM-SON-030326-1400', client: 'Tech Corp', status: 'completed', type: 'rim' },
];

// Agregar un evento 2 días en el futuro
MOCK_EVENTS.push({
  id: 4,
  date: new Date(new Date().setDate(new Date().getDate() + 2)),
  title: 'RIM-SON-050326-0800',
  client: 'EMBOL S.A.',
  status: 'pending',
  type: 'rim',
});

export function useCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const eventsForDay = (day) =>
    MOCK_EVENTS.filter(ev => isSameDay(ev.date, day));

  const selectedDayEvents = useMemo(
    () => eventsForDay(selectedDay),
    [selectedDay]
  );

  const monthStats = useMemo(() => {
    const monthEvents = MOCK_EVENTS.filter(ev => isSameMonth(ev.date, currentDate));
    return {
      total: monthEvents.length,
      pending: monthEvents.filter(e => e.status === 'pending').length,
      inProgress: monthEvents.filter(e => e.status === 'in_progress').length,
      completed: monthEvents.filter(e => e.status === 'completed').length,
    };
  }, [currentDate]);

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
