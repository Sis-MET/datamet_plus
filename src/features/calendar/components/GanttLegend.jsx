import React from 'react';
import { TASK_TYPE_CONFIG } from './GanttTaskCell';

const LEGEND_ITEMS = [
  'carga', 'capacitacion', 'calibracion', 'comercial',
  'relevamiento', 'instalacion', 'yanbal', 'retorno', 'vacacion', 'soporte',
];

export function GanttLegend() {
  return (
    <div className="gantt-legend">
      {LEGEND_ITEMS.map((tipo) => {
        const cfg = TASK_TYPE_CONFIG[tipo];
        return (
          <div key={tipo} className="gantt-legend-item">
            <span className={`gantt-legend-dot ${cfg.bg}`} />
            <span className="gantt-legend-label">{cfg.label}</span>
          </div>
        );
      })}
    </div>
  );
}
