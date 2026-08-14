import React from 'react';
import { format, isBefore, isAfter, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { isNonWorkingDay } from '../utils/holidays';
import { useTheme } from '../../../shared/context/ThemeContext';

const DAY_LABELS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function GanttHeader({ weekDays, isToday, currentWeekStart, currentWeekEnd, selectedDay }) {
  const { isDarkGantt } = useTheme();

  return (
    <div className="gantt-header-row">
      {/* Columna sticky de nombre de técnico */}
      <div className="gantt-name-col gantt-header-cell gantt-name-header">
        Técnico
      </div>

      {weekDays.map((day, idx) => {
        const todayFlag = isToday(day);
        const { isNonWorking, type } = isNonWorkingDay(day);

        // Determinar si el día es de la semana actual o no
        const isPast   = currentWeekStart && isBefore(day, currentWeekStart);
        const isFuture = currentWeekEnd   && isAfter(day, currentWeekEnd);
        const isCurrent = !isPast && !isFuture;

        // Borde izquierdo de separación entre semanas
        const isFirstOfWeek = idx === 0 || idx === 7 || idx === 14;

        const nonWorkBg = isNonWorking
          ? (type === 'feriado'
              ? 'bg-yellow-500/10 border-b-2 border-yellow-500/30'
              : 'bg-red-500/10 border-b-2 border-red-500/30')
          : '';

        const isSelectedDay = selectedDay && isSameDay(day, selectedDay);
        
        let weekAccentStyle = {};

        if (isSelectedDay) {
          weekAccentStyle = { backgroundColor: 'rgba(16, 185, 129, 0.25)' };
        }
        
        const dimClass   = !isCurrent && !isSelectedDay ? 'opacity-65' : '';
        const borderClass = isFirstOfWeek ? (isDarkGantt ? 'border-l-2 border-l-white/20' : 'border-l-2 border-l-slate-500/30') : '';
        const highlightClass = isSelectedDay ? 'ring-inset ring-2 ring-[#10b981]/80 shadow-[0_0_15px_rgba(16,185,129,0.3)] z-10 transition-all duration-150' : '';

        // Color del label del día: en modo oscuro verde tenue, en modo claro verde visible
        const currentDayLabelColor = isDarkGantt ? 'text-green-300/80' : 'text-green-700';

        return (
          <div
            key={day.toISOString()}
            id={`gantt-day-${format(day, 'yyyy-MM-dd')}`}
            className={`gantt-day-header-cell ${todayFlag ? 'gantt-day-header-today' : ''} ${nonWorkBg} ${dimClass} ${borderClass} ${highlightClass}`}
            style={weekAccentStyle}
          >
            <span className={`gantt-day-label ${isNonWorking ? (type === 'feriado' ? 'text-yellow-400/80' : 'text-red-400/80') : isCurrent ? currentDayLabelColor : ''}`}>
              {DAY_LABELS_SHORT[day.getDay()]}
            </span>
            <span className={`gantt-day-number ${todayFlag ? 'gantt-day-number-today' : ''} ${isNonWorking && !todayFlag ? (type === 'feriado' ? 'text-yellow-300/70' : 'text-red-300/70') : ''}`}>
              {format(day, 'd')}
            </span>
            <span className={`gantt-day-month ${isNonWorking ? 'opacity-60' : ''}`}>
              {format(day, 'MMMM', { locale: es })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
