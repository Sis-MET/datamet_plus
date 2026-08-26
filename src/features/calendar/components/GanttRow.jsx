import React from 'react';
import { Truck } from 'lucide-react';
import { GanttTaskCell } from './GanttTaskCell';
import { getGanttRowLayout } from '../utils/ganttRowLayout';

export const GanttRow = React.memo(function GanttRow({ tecnico, weekDays, previewDays = [], tasksForCell, layout, isToday, selectedDay, onTaskClick, onTaskDrop, readOnly = false, onTaskContextMenu, onTaskDragStart, onTaskDragEnd }) {
  const rawName = (tecnico.nombre || '').replace(/_/g, ' ').trim();
  const nameParts = rawName.split(' ');
  const lastName = nameParts.pop() || '';
  const firstName = nameParts.join(' ');
  const computedLayout = React.useMemo(
    () => layout || getGanttRowLayout(tecnico.id, weekDays, previewDays, tasksForCell),
    [layout, previewDays, tasksForCell, tecnico.id, weekDays]
  );
  const { activeCells, previewCells, rowHeight } = computedLayout;

  return (
    <div
      className={`gantt-row ${readOnly ? 'bg-blue-950/10' : ''}`}
      style={{ '--gantt-row-height': `${rowHeight}px` }}
    >
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
      {activeCells.map(({ day, tasks }) => {
        return (
          <GanttTaskCell
            key={day.toISOString()}
            tasks={tasks}
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
      {previewCells.map(({ day, tasks }, idx) => {
        return (
          <GanttTaskCell
            key={`preview-${day.toISOString()}`}
            tasks={tasks}
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
});
