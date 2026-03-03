import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../../../shared/utils/cn';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const STATUS_DOT = {
  pending: 'bg-yellow-400',
  in_progress: 'bg-blue-400',
  completed: 'bg-green-400',
};

export function CalendarGrid({
  calendarDays,
  currentDate,
  selectedDay,
  onSelectDay,
  eventsForDay,
  isSameMonth,
  isSameDay,
  isToday,
}) {
  return (
    <div className="w-full select-none">
      {/* Day labels */}
      <div className="grid grid-cols-7 mb-2">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const dayEvents = eventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = isSameDay(day, selectedDay);
          const todayFlag = isToday(day);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                'relative flex flex-col items-center justify-start pt-1.5 pb-2 rounded-xl transition-all duration-150 aspect-square text-sm font-medium',
                !isCurrentMonth && 'opacity-25',
                isSelected
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/40'
                  : todayFlag
                  ? 'bg-white/10 text-white ring-2 ring-primary-500/60'
                  : 'text-gray-300 hover:bg-white/8 hover:text-white'
              )}
            >
              <span className={cn('text-sm leading-none', todayFlag && !isSelected && 'font-bold text-primary-400')}>
                {format(day, 'd')}
              </span>
              {/* Event dots */}
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-full px-1">
                  {dayEvents.slice(0, 3).map((ev, i) => (
                    <span
                      key={i}
                      className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT[ev.status] || 'bg-gray-400')}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[9px] text-gray-400">+{dayEvents.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
