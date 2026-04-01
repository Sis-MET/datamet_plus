import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Truck } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { isNonWorkingDay } from '../utils/holidays';

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
  const [renderTooltip, setRenderTooltip] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null);
  const timeoutRef = useRef(null);

  const getStateBadgeClass = (estado) => {
    switch(estado) {
      case 'Completado': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30';
      case 'En Proceso': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30';
      case 'Cancelado': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-red-500/20 text-red-400 ring-1 ring-red-500/30';
      default: return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30'; // Pendiente
    }
  };

  const handleMouseEnter = (e) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Position parsing logic remains same, just set render and then opacity
    const rect = e.currentTarget.getBoundingClientRect();
    const isTop = rect.top < 250;
    
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: isTop ? rect.bottom + 10 : rect.top - 10,
      isTop
    });
    
    setRenderTooltip(true);
    // Un simple frame para que la clase opacity-0 aplique primero, y luego la transición inicie
    setTimeout(() => {
       setShowTooltip(true);
    }, 10);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
    timeoutRef.current = setTimeout(() => {
       setRenderTooltip(false);
       setTooltipPos(null);
    }, 200); // Wait for transition duration
  };

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
      const taskObj = tasks && tasks.length > 0 ? tasks[0] : null;
      onTaskClick(taskObj, date, resourceId);
    }
  };

  // ----- Drag and Drop Handlers -----
  const handleDragStart = (e, task) => {
    e.stopPropagation();
    if (!onTaskDrop) return; // solo si tiene permisos
    
    if (onTaskDragStart) onTaskDragStart();

    // Convertimos la información relevante a string para pasarla en el Drag Event
    const dragData = JSON.stringify({ 
      sourceResource: resourceId,
      sourceDate: date,
      morning: task.morning, 
      afternoon: task.afternoon, 
      colorAM: task.colorAM,
      colorPM: task.colorPM
    });
    e.dataTransfer.setData('application/json', dragData);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

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
  const isEmptyTask = (t) => !t.morning && !t.afternoon;
  const validTasks = tasks ? tasks.filter(t => !isEmptyTask(t)) : [];

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
          <span className="text-[10px] text-gray-500 font-medium">+</span>
        </div>
      </div>
    );
  }

  const primaryTask = tasks[0];

  return (
    <div 
      className={`${baseClasses} gantt-cell-filled p-[3px] relative`} 
      style={cellStyle}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {tasks.map((task) => (
        <div
          key={task.id}
          draggable={!!onTaskDrop}
          onDragStart={(e) => handleDragStart(e, task)}
          onDragEnd={() => onTaskDragEnd && onTaskDragEnd()}
          onContextMenu={(e) => {
            if (onTaskContextMenu) {
              e.preventDefault();
              e.stopPropagation();
              onTaskContextMenu(e, task, date, resourceId);
            }
          }}
          className="w-full h-[3.25rem] border border-white/10 rounded-lg overflow-hidden text-[10px] text-white shadow-lg flex flex-col cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-white/30 transition-all font-mono tracking-tight animate-fade-in"
        >
          {/* Sub-celda MAÑANA */}
          <div 
            className={`flex-1 flex flex-col justify-center px-1.5 border-b border-white/5 relative group/slot ${!(task.morning && task.colorAM) ? 'bg-transparent' : ''}`}
            style={task.morning && task.colorAM ? { backgroundColor: task.colorAM } : {}}
          >
            {task.morning && task.colorAM && <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none opacity-50" />}
            {task.morning && (
              <div className="flex items-center gap-1.5 relative z-10">
                <span className="font-extrabold opacity-40 text-[7px] uppercase tracking-tighter">AM</span>
                <span className="line-clamp-1 break-words font-bold leading-none">{task.morning}</span>
              </div>
            )}
          </div>
          {/* Sub-celda TARDE */}
          <div 
            className={`flex-1 flex flex-col justify-center px-1.5 relative group/slot ${!(task.afternoon && task.colorPM) ? 'bg-transparent' : ''}`}
            style={task.afternoon && task.colorPM ? { backgroundColor: task.colorPM } : {}}
          >
            {task.afternoon && task.colorPM && <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none opacity-30" />}
            {task.afternoon && (
              <div className="flex items-center gap-1.5 relative z-10">
                <span className="font-extrabold opacity-40 text-[7px] uppercase tracking-tighter">PM</span>
                <span className="line-clamp-1 break-words font-bold leading-none">{task.afternoon}</span>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Tooltip Profesional Ultra-Premium portalled to body to escape overflow: hidden */}
      {renderTooltip && tooltipPos && typeof document !== 'undefined' && createPortal(
        <div 
          className={cn(
            "fixed z-[9999] w-[260px] pointer-events-none transition-all duration-200 ease-out",
            "backdrop-filter backdrop-blur-xl bg-[#1a1a1d]/75 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-4 ring-1 ring-white/5",
            tooltipPos.isTop ? "-translate-x-1/2 origin-top" : "-translate-x-1/2 -translate-y-full origin-bottom",
            showTooltip ? "opacity-100 scale-100 mt-0" : "opacity-0 scale-95",
            !showTooltip && tooltipPos.isTop ? "-mt-2" : "",
            !showTooltip && !tooltipPos.isTop ? "mt-2" : ""
          )}
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y
          }}
        >
           <div className="border-b border-white/10 pb-3 mb-3 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-primary-400 uppercase tracking-widest leading-none">{resourceName || resourceId}</span>
              <span className="text-[13px] font-semibold text-gray-100 capitalize leading-tight">{formattedDateTooltip}</span>
           </div>
           
           <div className="space-y-3">
               <div className="flex gap-3">
                 <div className="w-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: primaryTask.colorAM || '#37A65F' }} />
                 <div className="flex-1">
                    <div className="flex justify-between items-center mb-0.5">
                       <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Mañana</p>
                       {primaryTask.morning && <span className={getStateBadgeClass(primaryTask.estadoAM)}>{primaryTask.estadoAM || 'Pendiente'}</span>}
                    </div>
                    <p className="text-sm text-white font-medium break-words leading-snug">{primaryTask.morning || '(Sin actividad)'}</p>
                 </div>
              </div>
              
              <div className="flex gap-3 pt-1">
                 <div className="w-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: primaryTask.colorPM || primaryTask.colorAM || '#37A65F' }} />
                 <div className="flex-1">
                    <div className="flex justify-between items-center mb-0.5">
                       <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Tarde</p>
                       {primaryTask.afternoon && <span className={getStateBadgeClass(primaryTask.estadoPM)}>{primaryTask.estadoPM || 'Pendiente'}</span>}
                    </div>
                    <p className="text-sm text-white font-medium break-words leading-snug">{primaryTask.afternoon || '(Sin actividad)'}</p>
                 </div>
              </div>
           </div>
           
           {(primaryTask.author || primaryTask.timestampUpdated) && (
             <div className="mt-4 pt-3 border-t border-white/10">
               <p className="text-[9px] text-gray-500 font-mono tracking-wide leading-tight">
                 {primaryTask.author && <span>Actualizado por: <span className="text-gray-300 font-medium">{primaryTask.author}</span><br/></span>}
                 {primaryTask.timestampUpdated && <span>El {primaryTask.timestampUpdated}</span>}
               </p>
             </div>
           )}
           
           {/* Flechita del tooltip orientada según la posición */}
           <div className={cn(
             "absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent backdrop-filter backdrop-blur-xl",
             tooltipPos.isTop 
               ? "bottom-full border-b-[8px] border-b-[#1a1a1d]/75 mb-[-1px]" 
               : "top-full border-t-[8px] border-t-[#1a1a1d]/75 mt-[-1px]"
           )} />
        </div>,
        document.body
      )}
    </div>
  );
}
