import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { isNonWorkingDay } from '../utils/holidays';

const DAY_LABELS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function GanttHeader({ weekDays, previewDays = [], isToday }) {
  return (
    <div className="gantt-header-row">
      {/* Columna sticky de nombre de técnico */}
      <div className="gantt-name-col gantt-header-cell gantt-name-header">
        Técnico
      </div>

      {/* Columnas de días activos */}
      {weekDays.map((day) => {
        const todayFlag = isToday(day);
        const { isNonWorking, type } = isNonWorkingDay(day);
        const nonWorkBg = isNonWorking
          ? (type === 'feriado'
              ? 'bg-yellow-500/10 border-b-2 border-yellow-500/30'
              : 'bg-red-500/10 border-b-2 border-red-500/30')
          : '';
        return (
          <div
            key={day.toISOString()}
            className={`gantt-day-header-cell ${todayFlag ? 'gantt-day-header-today' : ''} ${nonWorkBg}`}
          >
            <span className={`gantt-day-label ${isNonWorking ? (type === 'feriado' ? 'text-yellow-400/80' : 'text-red-400/80') : ''}`}>
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

      {/* Columnas de preview (siguiente semana) con efecto glass */}
      {previewDays.map((day, idx) => (
        <div
          key={`preview-h-${day.toISOString()}`}
          className="gantt-day-header-cell gantt-day-header-preview"
          style={{ opacity: 1 - idx * 0.28 }}
        >
          <span className="gantt-day-label">{DAY_LABELS_SHORT[day.getDay()]}</span>
          <span className="gantt-day-number">{format(day, 'd')}</span>
          <span className="gantt-day-month">{format(day, 'MMM', { locale: es })}</span>
        </div>
      ))}
    </div>
  );
}
