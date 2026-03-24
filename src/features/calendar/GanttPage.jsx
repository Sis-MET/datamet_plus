import React from 'react';
import { Truck } from 'lucide-react';
import { GanttHeader } from './components/GanttHeader';
import { GanttRow } from './components/GanttRow';
import { GanttLegend } from './components/GanttLegend';
import { VEHICLES } from './hooks/useGantt';

/**
 * Componente presentacional puro: solo renderiza la grilla y la leyenda.
 * Toda la navegación y el título viven en CalendarPage.
 */
export function GanttPage({
  weekDays,
  previewDays = [],
  tecnicos,
  tasksForCell,
  isToday,
  onTaskClick,
  onTaskDrop
}) {

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

          {/* ══ Técnicos agrupados por Área ══ */}
          {grupos.map(([area, tecnicosDelArea]) => (
            <React.Fragment key={area}>
              {/* ── Separador de Área ── */}
              <div
                className="flex items-center gap-3 px-4 py-1.5 bg-[#111114] border-b border-gray-700/30"
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

          {/* ══ Sección VEHÍCULOS (Al final) ══ */}
          {VEHICLES.length > 0 && (
            <React.Fragment>
              <div
                className="flex items-center gap-3 px-4 py-1.5 border-b border-blue-500/20 bg-blue-950/30"
                style={{ gridColumn: '1 / -1' }}
              >
                <Truck className="w-3.5 h-3.5 text-blue-400/70" />
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-400/70">Vehículos</span>
                <div className="flex-1 h-[1px] bg-gradient-to-r from-blue-500/20 to-transparent" />
                <span className="text-[9px] text-blue-400/40 font-bold">{VEHICLES.length}</span>
              </div>

              {VEHICLES.map((vehiculo) => (
                <GanttRow
                  key={vehiculo.id}
                  tecnico={vehiculo}
                  weekDays={weekDays}
                  previewDays={previewDays}
                  tasksForCell={tasksForCell}
                  isToday={isToday}
                  onTaskClick={onTaskClick}
                  onTaskDrop={onTaskDrop}
                />
              ))}
            </React.Fragment>
          )}
        </div>
      </div>

      {/* ── Leyenda ── */}
      <GanttLegend />
    </div>
  );
}

