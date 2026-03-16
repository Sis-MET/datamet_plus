import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, User, Tag, Building2, X } from 'lucide-react';

// Paleta de colores por tipo de tarea (inspirada en el Excel)
export const TASK_TYPE_CONFIG = {
  // Calibración
  calibracion_tanques: { bg: 'gantt-cell-calibracion', label: '1 Calibración Tanques', short: 'TANQ' },
  calibracion_balanzas: { bg: 'gantt-cell-calibracion', label: '2 Calibración Balanzas', short: 'BAL' },
  calibracion_pesas: { bg: 'gantt-cell-calibracion', label: '3 Calibración Pesas', short: 'PESAS' },

  // Soporte Técnico
  mp_regular: { bg: 'gantt-cell-soporte', label: 'Mantenimiento PR', short: 'MPR' },
  mp_avanzado: { bg: 'gantt-cell-soporte', label: 'Mantenimiento PA', short: 'MPA' },
  mantenimiento_regular: { bg: 'gantt-cell-soporte', label: 'Mantenimiento R', short: 'MR' },
  diagnostico: { bg: 'gantt-cell-soporte', label: 'Diagnostico', short: 'DIAG' },
  verificaciones: { bg: 'gantt-cell-soporte', label: 'Verificaciones', short: 'VER' },
  ajustes: { bg: 'gantt-cell-soporte', label: 'Ajustes Met.', short: 'AJUS' },

  // Compartidos
  relevamiento: { bg: 'gantt-cell-relevamiento', label: 'Relevamiento', short: 'REL' },
  instalacion:  { bg: 'gantt-cell-instalacion',  label: 'Instalación',  short: 'INST' },
  visita_comercial: { bg: 'gantt-cell-comercial', label: 'Visita Comercial', short: 'V.COM' },

  // Legacy/Fallbacks
  carga:        { bg: 'gantt-cell-carga',        label: 'Carga/Cap.',   short: 'CARGA'    },
  capacitacion: { bg: 'gantt-cell-capacitacion',  label: 'Capacitación', short: 'CAP'      },
  calibracion:  { bg: 'gantt-cell-calibracion',   label: 'Calibración',  short: 'CALIB'    },
  comercial:    { bg: 'gantt-cell-comercial',      label: 'V. Comercial', short: 'V.COM'    },
  yanbal:       { bg: 'gantt-cell-yanbal',          label: 'YANBAL',       short: 'YANBAL'   },
  retorno:      { bg: 'gantt-cell-retorno',         label: 'Retorno',      short: 'RET'      },
  vacacion:     { bg: 'gantt-cell-vacacion',        label: 'Vacación',     short: 'VAC'      },
  soporte:      { bg: 'gantt-cell-soporte',         label: 'Soporte',      short: 'SOPO'     },
  default:      { bg: 'gantt-cell-default',         label: 'Otro',         short: 'OTRO'     },
};

function Tooltip({ task, onClose }) {
  const cfg = TASK_TYPE_CONFIG[task.tipo] || TASK_TYPE_CONFIG.default;
  return (
    <div className="gantt-tooltip" role="dialog" aria-label="Detalle de tarea">
      <div className="gantt-tooltip-header">
        <span className={`gantt-tooltip-badge ${cfg.bg}`}>{cfg.label}</span>
        <button onClick={onClose} className="gantt-tooltip-close" aria-label="Cerrar">
          <X size={12} />
        </button>
      </div>
      <p className="gantt-tooltip-desc">{task.descripcion || task.cod_metrica}</p>
      <div className="gantt-tooltip-row">
        <Tag size={11} className="text-gray-400" />
        <span>{task.cod_metrica}</span>
      </div>
      <div className="gantt-tooltip-row">
        <Building2 size={11} className="text-gray-400" />
        <span>{task.cliente}</span>
      </div>
      <div className="gantt-tooltip-row">
        <CalendarDays size={11} className="text-gray-400" />
        <span>
          {format(new Date(task.fecha_inicio), "d MMM", { locale: es })}
          {!isSameDate(task.fecha_inicio, task.fecha_fin) &&
            ` → ${format(new Date(task.fecha_fin), "d MMM", { locale: es })}`}
        </span>
      </div>
      <div className="gantt-tooltip-row">
        <User size={11} className="text-gray-400" />
        <span>{task.tecnico_nombre || task.Tecnico}</span>
      </div>
    </div>
  );
}

function isSameDate(a, b) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() &&
         da.getMonth()    === db.getMonth()    &&
         da.getDate()     === db.getDate();
}

export function GanttTaskCell({ tasks, isToday: todayFlag, isPreview, previewOpacity, onTaskClick }) {
  const [activeTask, setActiveTask] = useState(null);

  const cellStyle = isPreview ? { opacity: previewOpacity } : {};
  const baseClasses = `gantt-cell ${todayFlag ? 'gantt-cell-today-bg' : ''} ${isPreview ? 'gantt-cell-preview' : ''}`;

  if (!tasks || tasks.length === 0) {
    return (
      <div className={`${baseClasses} gantt-cell-empty`} style={cellStyle} />
    );
  }

  return (
    <div className={`${baseClasses} gantt-cell-filled`} style={cellStyle}>
      {tasks.map((task) => {
        const cfg = TASK_TYPE_CONFIG[task.tipo] || TASK_TYPE_CONFIG.default;
        const isInteractive = !!onTaskClick;
        return (
          <div
            key={task.id}
            className={`gantt-task-chip flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold font-mono text-white shadow-sm ring-1 ring-inset ring-white/10 ${cfg.bg} ${isInteractive ? 'cursor-pointer hover:brightness-110' : ''}`}
            onClick={(e) => {
              if (onTaskClick) {
                e.stopPropagation();
                onTaskClick(task);
              }
            }}
            onMouseEnter={() => setActiveTask(task)}
            onMouseLeave={() => setActiveTask(null)}
            title={task.descripcion || task.cod_metrica}
          >
            <span className="gantt-task-chip-text">{task.cod_metrica || cfg.short}</span>

            {activeTask?.id === task.id && (
              <Tooltip task={task} onClose={() => setActiveTask(null)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
