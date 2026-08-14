import React from 'react';
import { Truck } from 'lucide-react';
import { GanttTaskCell } from './GanttTaskCell';

export function GanttRow({ tecnico, weekDays, previewDays = [], tasksForCell, isToday, selectedDay, onTaskClick, onTaskDrop, readOnly = false, onTaskContextMenu, onTaskDragStart, onTaskDragEnd }) {
  const rawName = (tecnico.nombre || '').replace(/_/g, ' ').trim();
  const nameParts = rawName.split(' ');
  const lastName = nameParts.pop() || '';
  const firstName = nameParts.join(' ');

  return (
    <div className={`gantt-row ${readOnly ? 'bg-blue-950/10' : ''}`}>
      {/* Sticky name column */}
      <div className="gantt-name-col" style={readOnly ? { background: '#0d1424' } : {}}>
        <div className="flex items-center gap-1.5 leading-tight">
          {readOnly && <Truck className="w-3 h-3 text-blue-400/60 flex-shrink-0" />}
          <div className="gantt-tecnico-name truncate" title={rawName}>
            {firstName && <span>{firstName} </span>}
            <span>{lastName}</span>
          </div>
        </div>
        {tecnico.cargo && (
          <div className="gantt-tecnico-cargo truncate">{tecnico.cargo}</div>
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
            selectedDay={selectedDay}
            resourceId={tecnico.id}
            resourceName={tecnico.nombre}
            onTaskClick={readOnly ? null : onTaskClick}
            onTaskDrop={readOnly ? null : onTaskDrop}
            onTaskContextMenu={readOnly ? null : onTaskContextMenu}
            onTaskDragStart={readOnly ? null : onTaskDragStart}
            onTaskDragEnd={readOnly ? null : onTaskDragEnd}
            readOnly={readOnly}
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
            selectedDay={selectedDay}
            resourceId={tecnico.id}
            resourceName={tecnico.nombre}
            onTaskClick={readOnly ? null : onTaskClick}
            onTaskDrop={readOnly ? null : onTaskDrop}
            onTaskContextMenu={readOnly ? null : onTaskContextMenu}
            onTaskDragStart={readOnly ? null : onTaskDragStart}
            onTaskDragEnd={readOnly ? null : onTaskDragEnd}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
}
