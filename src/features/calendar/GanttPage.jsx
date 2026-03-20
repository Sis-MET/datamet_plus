import React from 'react';
import { GanttHeader } from './components/GanttHeader';
import { GanttRow } from './components/GanttRow';
import { GanttLegend } from './components/GanttLegend';

/**
 * Componente presentacional puro: solo renderiza la grilla y la leyenda.
 * Toda la navegación y el título viven en CalendarPage.
 */
export function GanttPage({ weekDays, previewDays = [], tecnicos, tasksForCell, isToday, onTaskClick, onTaskDrop }) {

  // Agrupar técnicos por área, ordenados alfabéticamente por área
  const grupos = React.useMemo(() => {
    const map = {};
    tecnicos.forEach(t => {
      const area = (typeof t.area === 'string' && t.area.trim()) ? t.area.trim() : 'Sin Área';
      if (!map[area]) map[area] = [];
      map[area].push(t);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [tecnicos]);

  return (
    <div>
      {/* ── Gantt Grid ── */}
      <div className="gantt-scroll-container">
        <div className="gantt-grid">
          <GanttHeader weekDays={weekDays} previewDays={previewDays} isToday={isToday} />
          {grupos.map(([area, tecnicosDelArea]) => (
            <React.Fragment key={area}>
              {/* ── Separador de Área ── */}
              <div
                className="flex items-center gap-3 px-4 py-1.5 bg-[#111114] border-b border-gray-700/30 sticky left-0"
                style={{ gridColumn: '1 / -1' }}
              >
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">{area}</span>
                <div className="flex-1 h-[1px] bg-gradient-to-r from-gray-700/40 to-transparent" />
                <span className="text-[9px] text-gray-600 font-bold">{tecnicosDelArea.length}</span>
              </div>

              {/* ── Filas del área ── */}
              {tecnicosDelArea.map((tecnico) => (
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
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Leyenda ── */}
      <GanttLegend />
    </div>
  );
}
