import React from 'react';
import { GanttHeader } from './components/GanttHeader';
import { GanttRow } from './components/GanttRow';
import { GanttLegend } from './components/GanttLegend';

/**
 * Componente presentacional puro: solo renderiza la grilla y la leyenda.
 * Toda la navegación y el título viven en CalendarPage.
 */
export function GanttPage({ weekDays, previewDays = [], tecnicos, tasksForCell, isToday, onTaskClick, onTaskDrop }) {
  return (
    <div>
      {/* ── Gantt Grid ── */}
      <div className="gantt-scroll-container">
        <div className="gantt-grid">
          <GanttHeader weekDays={weekDays} previewDays={previewDays} isToday={isToday} />
          {tecnicos.map((tecnico) => (
            <GanttRow
              key={tecnico.id}
              tecnico={tecnico}
              weekDays={weekDays}
              previewDays={previewDays}
              tasksForCell={tasksForCell}
              isToday={isToday}
              onTaskClick={onTaskClick}
              onTaskDrop={onTaskDrop}
            />
          ))}
        </div>
      </div>

      {/* ── Leyenda ── */}
      <GanttLegend />
    </div>
  );
}
