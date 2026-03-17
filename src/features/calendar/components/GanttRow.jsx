import React from 'react';
import { GanttTaskCell } from './GanttTaskCell';

export function GanttRow({ tecnico, weekDays, previewDays = [], tasksForCell, isToday, onTaskClick, onTaskDrop }) {
  return (
    <div className="gantt-row">
      {/* Sticky name column */}
      <div className="gantt-name-col">
        <div className="gantt-tecnico-name">{tecnico.nombre}</div>
        {tecnico.cargo && (
          <div className="gantt-tecnico-cargo">{tecnico.cargo}</div>
        )}
      </div>

      {/* Day cells activos */}
      {weekDays.map((day) => {
        const dayTasks = tasksForCell(tecnico.id, day);
        return (
          <GanttTaskCell
            key={day.toISOString()}
            tasks={dayTasks}
            isToday={isToday(day)}
            date={day}
            resourceId={tecnico.id}
            onTaskClick={onTaskClick}
            onTaskDrop={onTaskDrop}
          />
        );
      })}

      {/* Preview cells (siguiente semana) con efecto glass fadein */}
      {previewDays.map((day, idx) => {
        const dayTasks = tasksForCell(tecnico.id, day);
        return (
          <GanttTaskCell
            key={`preview-${day.toISOString()}`}
            tasks={dayTasks}
            isToday={false}
            isPreview
            previewOpacity={1 - idx * 0.28}
            date={day}
            resourceId={tecnico.id}
            onTaskClick={onTaskClick}
            onTaskDrop={onTaskDrop}
          />
        );
      })}
    </div>
  );
}
