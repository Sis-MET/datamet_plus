import React from 'react';
import { format, isBefore, isAfter, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { isNonWorkingDay } from '../utils/holidays';
import { cn } from '../../../shared/utils/cn';

const DAY_LABELS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function GanttHeader({ weekDays, isToday, currentWeekStart, currentWeekEnd, selectedDay }) {
  return (
    <div className="gantt-header-row">
      {/* Columna sticky de nombre de técnico */}
      <div className="gantt-name-col gantt-header-cell gantt-name-header">
        Técnico
      </div>

      {weekDays.map((day, idx) => {
        const todayFlag = isToday(day);
        const { isNonWorking, type } = isNonWorkingDay(day);

        // Días fuera de la semana actual se atenúan.
        const isPast   = currentWeekStart && isBefore(day, currentWeekStart);
        const isFuture = currentWeekEnd   && isAfter(day, currentWeekEnd);
        const isCurrent = !isPast && !isFuture;
        const isSelectedDay = selectedDay && isSameDay(day, selectedDay);

        return (
          <div
            key={day.toISOString()}
            id={`gantt-day-${format(day, 'yyyy-MM-dd')}`}
            title={isNonWorking ? (type === 'feriado' ? 'Feriado' : 'Domingo') : undefined}
            className={cn(
              'gantt-day-header-cell',
              todayFlag && 'gantt-day-header-today',
              isNonWorking && 'gantt-day-header-nonworking',
              isSelectedDay && 'gantt-day-header-selected',
              (idx === 7 || idx === 14) && 'gantt-week-start'
            )}
          >
            <span className={cn('gantt-day-label', !isCurrent && !isSelectedDay && 'opacity-60')}>
              {DAY_LABELS_SHORT[day.getDay()]}
            </span>
            <span
              className={cn(
                'gantt-day-number',
                todayFlag && 'gantt-day-number-today',
                !isCurrent && !isSelectedDay && !todayFlag && 'opacity-55'
              )}
            >
              {format(day, 'd')}
            </span>
            <span className={cn('gantt-day-month', !isCurrent && !isSelectedDay && 'opacity-70')}>
              {format(day, 'MMMM', { locale: es })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
