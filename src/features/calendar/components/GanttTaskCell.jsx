import React from 'react';

export function GanttTaskCell({ 
  tasks, 
  isToday: todayFlag, 
  isPreview, 
  previewOpacity, 
  onTaskClick,
  onTaskDrop,
  date,
  resourceId
}) {
  const cellStyle = isPreview ? { opacity: previewOpacity } : {};
  let baseClasses = `gantt-cell ${todayFlag ? 'gantt-cell-today-bg' : ''} ${isPreview ? 'gantt-cell-preview' : ''}`;

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
    
    // Convertimos la información relevante a string para pasarla en el Drag Event
    const dragData = JSON.stringify({ 
      sourceResource: resourceId,
      morning: task.morning, 
      afternoon: task.afternoon, 
      color: task.color 
    });
    e.dataTransfer.setData('application/json', dragData);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e) => {
    if (onTaskDrop) {
      e.preventDefault(); // Necesario para permitir el "Drop"
      e.dataTransfer.dropEffect = 'copy';
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
          onTaskDrop(sourceTask, date, resourceId);
        } catch (err) {
          console.error('Error parseando drag data', err);
        }
      }
    }
  };

  if (!tasks || tasks.length === 0) {
    return (
      <div 
        className={`${baseClasses} gantt-cell-empty relative group`} 
        style={cellStyle}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        title="Clic para agregar/modificar en este día"
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] text-gray-500 font-medium">+</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`${baseClasses} gantt-cell-filled p-[3px]`} 
      style={cellStyle}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {tasks.map((task) => (
        <div
          key={task.id}
          draggable={!!onTaskDrop}
          onDragStart={(e) => handleDragStart(e, task)}
          className="w-full h-[3.25rem] border border-white/10 rounded overflow-hidden text-[10px] text-white shadow-sm flex flex-col cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-white/20 transition-all font-mono tracking-tight"
          style={{ backgroundColor: task.color || '#37A65F' }}
          title={task.texto}
        >
          {/* Sub-celda MAÑANA */}
          <div className="flex-1 flex flex-col justify-center px-1 border-b border-white/15 bg-black/15">
            <div className="flex items-center gap-1">
              <span className="font-bold opacity-60 text-[8px] uppercase">AM</span>
              <span className="line-clamp-1 break-words font-semibold leading-tight">{task.morning || '-'}</span>
            </div>
          </div>
          {/* Sub-celda TARDE */}
          <div className="flex-1 flex flex-col justify-center px-1 bg-black/5">
            <div className="flex items-center gap-1">
              <span className="font-bold opacity-60 text-[8px] uppercase">PM</span>
              <span className="line-clamp-1 break-words font-semibold leading-tight">{task.afternoon || '-'}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
