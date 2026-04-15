import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Truck } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { isNonWorkingDay } from '../utils/holidays';
import { useTheme } from '../../../shared/context/ThemeContext';

const MAX_TASKS_PER_CELL = 4;

// Sub-componente: cada tarjeta con su propio tooltip
function TaskCard({ task, isDarkGantt, formattedDateTooltip, resourceName, resourceId, onTaskClick, onTaskDrop, onTaskContextMenu, onTaskDragStart, onTaskDragEnd, date }) {
  const [renderTooltip, setRenderTooltip] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null);
  const timeoutRef = useRef(null);

  const getStateBadgeClass = (estado) => {
    switch(estado) {
      case 'Completado': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30';
      case 'En Proceso': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30';
      case 'Cancelado': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-red-500/20 text-red-400 ring-1 ring-red-500/30';
      default: return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30';
    }
  };

  const handleMouseEnter = (e) => {
    e.stopPropagation();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const isTop = rect.top < 250;
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: isTop ? rect.bottom + 10 : rect.top - 10,
      isTop
    });
    setRenderTooltip(true);
    setTimeout(() => setShowTooltip(true), 10);
  };

  const handleMouseLeave = (e) => {
    e.stopPropagation();
    setShowTooltip(false);
    timeoutRef.current = setTimeout(() => {
      setRenderTooltip(false);
      setTooltipPos(null);
    }, 200);
  };

  return (
    <>
      <div
        draggable={!!onTaskDrop}
        onClick={(e) => {
          if (onTaskClick) {
            e.stopPropagation();
            onTaskClick(task, date, resourceId);
          }
        }}
        onDragStart={(e) => {
          e.stopPropagation();
          if (!onTaskDrop) return;
          if (onTaskDragStart) onTaskDragStart();
          const dragData = JSON.stringify({
            sourceResource: resourceId,
            sourceDate: date,
            rowId: task.rowId,
            morning: task.morning,
            colorAM: task.colorAM,
            estadoAM: task.estadoAM
          });
          e.dataTransfer.setData('application/json', dragData);
          e.dataTransfer.effectAllowed = 'copyMove';
        }}
        onDragEnd={() => onTaskDragEnd && onTaskDragEnd()}
        onContextMenu={(e) => {
          if (onTaskContextMenu) {
            e.preventDefault();
            e.stopPropagation();
            onTaskContextMenu(e, task, date, resourceId);
          }
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`w-full mt-0.5 h-8 border rounded-md overflow-hidden text-[10px] shadow-sm flex flex-col cursor-grab active:cursor-grabbing hover:ring-2 transition-all font-mono tracking-tight animate-fade-in ${
          isDarkGantt
            ? 'border-white/10 text-white hover:ring-white/30'
            : 'border-white/20 text-white hover:ring-black/20'
        }`}
      >
        <div
          className={`flex-1 flex flex-col justify-center px-1.5 relative group/slot ${!(task.morning && task.colorAM) ? 'bg-transparent' : ''}`}
          style={task.morning && task.colorAM ? { backgroundColor: task.colorAM } : {}}
        >
          {task.morning && task.colorAM && <div className={`absolute inset-0 pointer-events-none opacity-50 bg-gradient-to-b ${isDarkGantt ? 'from-white/10 to-transparent' : 'from-white/20 to-transparent'}`} />}
          {task.morning && (
            <div className="flex items-center gap-1.5 relative z-10 w-full">
              <span className="line-clamp-1 break-all font-bold leading-none">{task.morning}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tooltip por tarjeta - portalled */}
      {renderTooltip && tooltipPos && typeof document !== 'undefined' && createPortal(
        <div
          className={cn(
            "fixed z-[9999] w-[260px] pointer-events-none transition-all duration-200 ease-out",
            "backdrop-filter backdrop-blur-xl border rounded-2xl p-4 ring-1",
            isDarkGantt
              ? "bg-[#1a1a1d]/75 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] ring-white/5"
              : "bg-white/90 border-gray-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-black/5",
            tooltipPos.isTop ? "-translate-x-1/2 origin-top" : "-translate-x-1/2 -translate-y-full origin-bottom",
            showTooltip ? "opacity-100 scale-100 mt-0" : "opacity-0 scale-95",
            !showTooltip && tooltipPos.isTop ? "-mt-2" : "",
            !showTooltip && !tooltipPos.isTop ? "mt-2" : ""
          )}
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className={`border-b pb-3 mb-3 flex flex-col gap-1 ${isDarkGantt ? 'border-white/10' : 'border-gray-200'}`}>
            <span className={`text-[10px] font-bold uppercase tracking-widest leading-none ${isDarkGantt ? 'text-primary-400' : 'text-primary-600'}`}>{resourceName || resourceId}</span>
            <span className={`text-[13px] font-semibold capitalize leading-tight ${isDarkGantt ? 'text-gray-100' : 'text-gray-900'}`}>{formattedDateTooltip}</span>
          </div>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: task.colorAM || '#37A65F' }} />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-0.5">
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-white/50' : 'text-gray-400'}`}>Actividad</p>
                  {task.morning && <span className={getStateBadgeClass(task.estadoAM)}>{task.estadoAM || 'Pendiente'}</span>}
                </div>
                <p className={`text-sm font-medium break-words leading-snug ${isDarkGantt ? 'text-white' : 'text-gray-800'}`}>{task.morning || '(Sin actividad)'}</p>
              </div>
            </div>
          </div>

          {(task.author || task.timestampUpdated) && (
            <div className={`mt-4 pt-3 border-t ${isDarkGantt ? 'border-white/10' : 'border-gray-200'}`}>
              <p className={`text-[9px] font-mono tracking-wide leading-tight ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>
                {task.author && <span>Actualizado por: <span className={`font-medium ${isDarkGantt ? 'text-gray-300' : 'text-gray-600'}`}>{task.author}</span><br/></span>}
                {task.timestampUpdated && <span>El {task.timestampUpdated}</span>}
              </p>
            </div>
          )}

          <div className={cn(
            "absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent backdrop-filter backdrop-blur-xl",
            tooltipPos.isTop
              ? (isDarkGantt ? "bottom-full border-b-[8px] border-b-[#1a1a1d]/75 mb-[-1px]" : "bottom-full border-b-[8px] border-b-white/90 mb-[-1px]")
              : (isDarkGantt ? "top-full border-t-[8px] border-t-[#1a1a1d]/75 mt-[-1px]" : "top-full border-t-[8px] border-t-white/90 mt-[-1px]")
          )} />
        </div>,
        document.body
      )}
    </>
  );
}

export function GanttTaskCell({ 
  tasks, 
  isToday: todayFlag, 
  isPreview, 
  previewOpacity, 
  onTaskClick,
  onTaskDrop,
  onTaskContextMenu,
  onTaskDragStart,
  onTaskDragEnd,
  date,
  selectedDay,
  resourceId,
  resourceName
}) {
  const { isDarkGantt } = useTheme();

  const cellStyle = isPreview ? { opacity: previewOpacity } : {};
  
  const { isNonWorking, type } = isNonWorkingDay(date);
  const isSelectedDay = selectedDay && isSameDay(date, selectedDay);
  
  const nonWorkClass = isNonWorking
    ? (type === 'feriado' ? 'bg-yellow-500/10' : 'bg-red-500/10')
    : '';
  
  let baseClasses = `gantt-cell ${todayFlag ? 'gantt-cell-today-bg' : ''} ${isPreview ? 'gantt-cell-preview' : ''} ${nonWorkClass}`;

  if (isSelectedDay) {
    baseClasses += ' bg-[#10b981]/[0.15] ring-[1px] ring-inset ring-[#10b981]/50 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)] z-[5] transition-all duration-300';
  }

  if (onTaskClick) {
    baseClasses += ' cursor-pointer hover:bg-white/5 transition-colors';
  }

  const handleClick = (e) => {
    if (onTaskClick) {
      e.stopPropagation();
      onTaskClick(null, date, resourceId);
    }
  };

  // ----- Drag and Drop Handlers (drop target only, drag is handled by TaskCard) -----
  const handleDragOver = (e) => {
    if (onTaskDrop) {
      e.preventDefault(); // Necesario para permitir el "Drop"
      e.dataTransfer.dropEffect = e.ctrlKey ? 'move' : 'copy';
    }
  };

  const handleDrop = (e) => {
    if (onTaskDrop) {
      e.preventDefault();
      e.stopPropagation();
      const rawData = e.dataTransfer.getData('application/json');
      if (rawData) {
        try {
          const sourceTask = JSON.parse(rawData);
          onTaskDrop(sourceTask, date, resourceId, e.ctrlKey);
        } catch (err) {
          console.error('Error parseando drag data', err);
        }
      }
    }
  };

  const formattedDateTooltip = date ? format(date, "EEEE, d 'de' MMMM", { locale: es }) : '';

  // Determinar si todos los eventos pasados están logitamente purgados (vaciados)
  const isEmptyTask = (t) => !t.morning;
  // Limitar a máximo MAX_TASKS_PER_CELL fichas por celda
  const validTasks = tasks ? tasks.filter(t => !isEmptyTask(t)).slice(0, MAX_TASKS_PER_CELL) : [];
  const canAddMore = validTasks.length < MAX_TASKS_PER_CELL;

  if (validTasks.length === 0) {
    return (
      <div 
        className={`${baseClasses} gantt-cell-empty relative group`} 
        style={cellStyle}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className={`text-[10px] font-medium ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>+</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`${baseClasses} gantt-cell-filled p-[3px] relative group`} 
      style={cellStyle}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {validTasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          isDarkGantt={isDarkGantt}
          formattedDateTooltip={formattedDateTooltip}
          resourceName={resourceName}
          resourceId={resourceId}
          onTaskClick={onTaskClick}
          onTaskDrop={onTaskDrop}
          onTaskContextMenu={onTaskContextMenu}
          onTaskDragStart={onTaskDragStart}
          onTaskDragEnd={onTaskDragEnd}
          date={date}
        />
      ))}

      {/* Botón "+" visible cuando hay al menos 1 ficha y aún hay espacio (< 4) */}
      {canAddMore && onTaskClick && (
        <div
          onClick={(e) => { e.stopPropagation(); onTaskClick(null, date, resourceId); }}
          className={cn(
            'absolute bottom-1 right-1 w-4 h-4 rounded flex items-center justify-center',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer z-10',
            isDarkGantt
              ? 'bg-white/10 hover:bg-white/20 text-white/60 hover:text-white'
              : 'bg-black/10 hover:bg-black/20 text-gray-600 hover:text-gray-900'
          )}
          title={`Agregar ficha (${validTasks.length}/${MAX_TASKS_PER_CELL})`}
        >
          <span className="text-[10px] font-bold leading-none">+</span>
        </div>
      )}

      {/* Indicador de cupo lleno cuando se alcanza el máximo */}
      {!canAddMore && onTaskClick && (
        <div
          className={cn(
            'absolute bottom-1 right-1 w-4 h-4 rounded flex items-center justify-center',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 cursor-default',
            isDarkGantt ? 'bg-white/5 text-white/30' : 'bg-black/5 text-gray-400'
          )}
          title={`Máximo de fichas alcanzado (${MAX_TASKS_PER_CELL}/${MAX_TASKS_PER_CELL})`}
        >
          <span className="text-[8px] font-bold leading-none">✕</span>
        </div>
      )}
    </div>
  );
}
