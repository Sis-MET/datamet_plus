import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
        return (
          <div
            key={day.toISOString()}
            className={`gantt-day-header-cell ${todayFlag ? 'gantt-day-header-today' : ''}`}
          >
            <span className="gantt-day-label">
              {DAY_LABELS_SHORT[day.getDay()]}
            </span>
            <span className={`gantt-day-number ${todayFlag ? 'gantt-day-number-today' : ''}`}>
              {format(day, 'd')}
            </span>
            <span className="gantt-day-month">
              {format(day, 'MMM', { locale: es })}
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
