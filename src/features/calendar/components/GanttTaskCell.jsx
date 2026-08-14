import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Truck, MapPin } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { isNonWorkingDay } from '../utils/holidays';
import { useTheme } from '../../../shared/context/ThemeContext';

const MAX_TASKS_PER_CELL = 4;

const normalizeTaskText = (value) => String(value || '').trim();
const normalizeForComparison = (value) => normalizeTaskText(value).toLocaleLowerCase();

/**
 * Calcula si el texto debe ser oscuro o claro según el color de fondo.
 * Usa la fórmula de luminancia relativa (WCAG 2.1).
 * @param {string} hexColor - Color en formato #RRGGBB o #RGB
 * @returns {{ text: string, textSecondary: string, shadow: string }}
 */
function getContrastColors(hexColor) {
  if (!hexColor) return { text: '#ffffff', textSecondary: 'rgba(255,255,255,0.85)', shadow: '0 1px 2px rgba(0,0,0,0.4)' };
  // Normalizar a #RRGGBB
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return { text: '#ffffff', textSecondary: 'rgba(255,255,255,0.85)', shadow: '0 1px 2px rgba(0,0,0,0.4)' };
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  // Linearizar canales
  const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  // Umbral: > 0.35 = fondo claro → texto oscuro
  const isDark = L > 0.35;
  return {
    text: isDark ? '#1a1a1a' : '#ffffff',
    textSecondary: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.85)',
    shadow: isDark ? '0 1px 1px rgba(255,255,255,0.3)' : '0 1px 2px rgba(0,0,0,0.4)',
  };
}

/**
 * Hook de long-press: dispara onLongPress tras `delay` ms de presion sostenida.
 * Cancela si el dedo se mueve mas de 10px (scroll). Solo actua en touch/pen.
 */
function useLongPress(onLongPress, delay = 500) {
  const timerRef  = useRef(null);
  const startPos  = useRef(null);
  const triggered = useRef(false);

  const start = useCallback((e) => {
    if (e.pointerType === 'mouse') return;
    triggered.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    timerRef.current = setTimeout(() => {
      triggered.current = true;
      onLongPress(e);
    }, delay);
  }, [onLongPress, delay]);

  const cancel = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const move = useCallback((e) => {
    if (!startPos.current) return;
    if (Math.abs(e.clientX - startPos.current.x) > 10 || Math.abs(e.clientY - startPos.current.y) > 10) cancel();
  }, [cancel]);

  const preventClick = useCallback((e) => {
    if (triggered.current) { e.stopPropagation(); triggered.current = false; }
  }, []);

  return { onPointerDown: start, onPointerUp: cancel, onPointerCancel: cancel, onPointerMove: move, onClick: preventClick };
}

// Sub-componente: cada tarjeta con su propio tooltip
function TaskCard({ task, isDarkGantt, formattedDateTooltip, resourceName, resourceId, onTaskClick, onTaskDrop, onTaskContextMenu, onTaskDragStart, onTaskDragEnd, date }) {
  const [renderTooltip, setRenderTooltip] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null);
  const timeoutRef = useRef(null);

  // --- Datos normalizados para la tarjeta ---
  const clienteText = normalizeTaskText(task.cliente);
  const descriptionText = normalizeTaskText(task.descripcion);
  const activityText = normalizeTaskText(task.tipoTarea || task.morning);
  const quoteText = normalizeTaskText(task.cotizacion);
  const plantaText = normalizeTaskText(task.planta);
  const freeDescription = descriptionText;

  // Construir las líneas dinámicas en orden de prioridad:
  // 1. Cliente  2. Planta  3. Descripción
  // Si falta alguna, las siguientes suben de posición.
  const dynamicLines = [];
  if (clienteText) dynamicLines.push({ text: clienteText, role: 'primary' });
  if (plantaText) dynamicLines.push({ text: plantaText, role: dynamicLines.length === 0 ? 'primary' : 'secondary' });
  if (freeDescription && normalizeForComparison(freeDescription) !== normalizeForComparison(activityText)) {
    dynamicLines.push({ text: freeDescription, role: dynamicLines.length === 0 ? 'primary' : 'secondary' });
  }
  // Fallback: si no hay cliente, ni planta, ni descripción distinta de la actividad, usar activityText
  if (dynamicLines.length === 0 && activityText) {
    dynamicLines.push({ text: activityText, role: 'primary' });
  }

  // Para el tooltip (mantener textos completos)
  const getStateBadgeClass = (estado) => {
    switch(estado) {
      case 'Completado': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30';
      case 'En Proceso': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30';
      case 'Cancelado': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-red-500/20 text-red-400 ring-1 ring-red-500/30';
      case 'Aprobado': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30';
      case 'Aceptado': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30';
      case 'Solicitud': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30';
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

  // Long-press => menu contextual en touch/tablet
  const { onClick: longPressClick, ...otherLongPressHandlers } = useLongPress((e) => {
    if (onTaskContextMenu) {
      onTaskContextMenu(
        { preventDefault: () => {}, stopPropagation: () => {}, clientX: e.clientX, clientY: e.clientY },
        task, date, resourceId
      );
    }
  }, 500);

  return (
    <>
      <div
        data-task-id={task.id}
        draggable={!!onTaskDrop}
        {...otherLongPressHandlers}
        onClick={(e) => {
          longPressClick(e);
          if (e.isPropagationStopped()) return;
          
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
            tipoTarea: task.tipoTarea || task.morning,
            morning: task.morning,
            cotizacion: task.cotizacion,
            descripcion: task.descripcion,
            cliente: task.cliente,
            cod_cliente: task.cod_cliente,
            planta: task.planta,
            colorAM: task.colorAM,
            estadoAM: task.estadoAM,
            horaInicio: task.horaInicio,
            horaFin: task.horaFin,
            creadoEn: task.creadoEn
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
        style={{ touchAction: 'none' }}
        className={`w-full mt-0.5 min-h-[40px] border rounded-md overflow-hidden shadow-sm flex flex-col cursor-grab active:cursor-grabbing hover:ring-2 transition-all font-mono tracking-tight animate-fade-in select-none ${
          isDarkGantt
            ? 'border-white/10 hover:ring-white/30'
            : 'border-white/20 hover:ring-black/20'
        }`}
      >
        {(() => {
          const contrast = getContrastColors(task.colorAM);
          return (
            <div
              className={`flex-1 flex flex-col justify-center px-1.5 py-1 relative group/slot ${!(task.morning && task.colorAM) ? 'bg-transparent' : ''}`}
              style={task.morning && task.colorAM ? { backgroundColor: task.colorAM } : {}}
            >
              {task.morning && task.colorAM && <div className={`absolute inset-0 pointer-events-none opacity-40 bg-gradient-to-b from-white/20 to-transparent`} />}
              {task.morning && (
                <div className="flex items-start gap-1.5 relative z-10 w-full overflow-hidden">
                  <div 
                    className={`w-2 h-2 rounded-full shrink-0 mt-[4px] animate-pulse ${
                      (task.estadoAM === 'Completado' || task.estadoAM === 'Aprobado') ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]' :
                      task.estadoAM === 'Cancelado' ? 'bg-red-400 shadow-[0_0_5px_rgba(248,113,113,0.8)]' :
                      (task.estadoAM === 'Reprogramado' || task.estadoAM === 'Aceptado') ? 'bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.8)]' :
                      'bg-yellow-400 shadow-[0_0_5px_rgba(250,204,21,0.8)]'
                    }`}
                    title={task.estadoAM || 'Pendiente'}
                  />
                  <div className="flex flex-col flex-1 min-w-0 justify-center h-full">
                    {/* Líneas dinámicas: Cliente > Planta > Descripción */}
                    {dynamicLines.map((line, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          'line-clamp-1 break-all leading-tight',
                          line.role === 'primary'
                            ? 'font-bold text-xs'
                            : 'text-[10px] mt-[1px] opacity-80'
                        )}
                        style={{
                          color: task.colorAM
                            ? (line.role === 'primary' ? contrast.text : contrast.textSecondary)
                            : undefined,
                          textShadow: contrast.shadow
                        }}
                      >
                        {idx === 0 && task.creadoEn === 'Salida Personal' && <MapPin className="w-3 h-3 inline-block mr-1 opacity-80" />}
                        {line.text}
                      </span>
                    ))}
                    {/* Rango horario (siempre visible) */}
                    {(task.horaInicio || task.horaFin) && (
                      <span
                        className="text-[10px] leading-tight truncate font-bold font-mono tracking-tight mt-[1px]"
                        style={{ color: task.colorAM ? contrast.textSecondary : undefined, textShadow: contrast.shadow }}
                      >
                        {task.horaInicio || '08:30'} {task.horaFin ? `→ ${task.horaFin}` : ''}
                      </span>
                    )}
                    {/* Tipo de tarea (siempre visible, texto pequeño) */}
                    {activityText && (
                      <span
                        className="line-clamp-1 break-all text-[8px] leading-tight mt-[1px] opacity-60 uppercase tracking-wider"
                        style={{ color: task.colorAM ? contrast.textSecondary : undefined, textShadow: contrast.shadow }}
                      >
                        {activityText}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Tooltip por tarjeta - portalled */}
      {renderTooltip && tooltipPos && typeof document !== 'undefined' && createPortal(
        <div
          className={cn(
            "fixed z-[9999] w-[min(260px,calc(100vw-20px))] pointer-events-none transition-all duration-[120ms] ease-out",
            "backdrop-filter backdrop-blur-xl border rounded-2xl p-4 ring-1",
            isDarkGantt
              ? "bg-[#1a1a1d]/75 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] ring-white/5"
              : "bg-slate-100/92 border-slate-500/25 shadow-[0_20px_50px_rgba(15,23,42,0.24)] ring-white/60",
            tooltipPos.isTop ? "-translate-x-1/2 origin-top" : "-translate-x-1/2 -translate-y-full origin-bottom",
            showTooltip ? "opacity-100 scale-100 mt-0" : "opacity-0 scale-95",
            !showTooltip && tooltipPos.isTop ? "-mt-2" : "",
            !showTooltip && !tooltipPos.isTop ? "mt-2" : ""
          )}
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className={`border-b pb-3 mb-3 flex items-center justify-between gap-2 ${isDarkGantt ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="flex flex-col gap-1">
              <span className={`text-[10px] font-bold uppercase tracking-widest leading-none ${isDarkGantt ? 'text-primary-400' : 'text-primary-600'}`}>{resourceName || resourceId}</span>
              <span className={`text-[13px] font-semibold capitalize leading-tight ${isDarkGantt ? 'text-gray-100' : 'text-gray-900'}`}>{formattedDateTooltip}</span>
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>
              {activityText || 'Tarea'}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: task.colorAM || '#37A65F' }} />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-0.5">
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-slate-300' : 'text-slate-600'}`}>
                    {clienteText ? 'Cliente' : descriptionText ? 'Descripción' : 'Tarea'}
                  </p>
                  {task.morning && <span className={getStateBadgeClass(task.estadoAM)}>{task.estadoAM || 'Pendiente'}</span>}
                </div>
                {/* Cliente */}
                {clienteText && (
                  <p className={`text-sm font-bold break-words leading-snug font-mono ${isDarkGantt ? 'text-white' : 'text-gray-800'}`}>
                    {clienteText}
                  </p>
                )}
                {/* Planta / Descripción */}
                {descriptionText && (
                  <div className={clienteText ? 'mt-1.5' : ''}>
                    {clienteText && (
                      <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${isDarkGantt ? 'text-slate-400' : 'text-slate-600'}`}>
                        Descripción
                      </p>
                    )}
                    <p className={cn(
                      'break-words leading-snug font-mono',
                      clienteText
                        ? `text-xs ${isDarkGantt ? 'text-gray-300' : 'text-gray-600'}`
                        : `text-sm font-semibold ${isDarkGantt ? 'text-white' : 'text-gray-800'}`
                    )}>
                      {descriptionText}
                    </p>
                  </div>
                )}
                {/* Tipo de tarea */}
                {activityText && normalizeForComparison(activityText) !== normalizeForComparison(descriptionText) && (
                  <div className="mt-1.5">
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-slate-400' : 'text-slate-600'}`}>Tipo de tarea</p>
                    <p className={`text-xs break-words leading-snug font-mono ${isDarkGantt ? 'text-slate-300' : 'text-slate-700'}`}>
                      {activityText}
                    </p>
                  </div>
                )}
                {plantaText && (
                  <div className="mt-1.5">
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-white/55' : 'text-gray-500'}`}>Planta</p>
                    <p className={`text-xs break-words leading-snug ${isDarkGantt ? 'text-gray-200' : 'text-gray-700'}`}>{plantaText}</p>
                  </div>
                )}
                {quoteText && (
                  <div className="mt-1.5">
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-white/55' : 'text-gray-500'}`}>Cotización</p>
                    <p className={`text-xs break-words leading-snug font-mono ${isDarkGantt ? 'text-blue-300' : 'text-blue-700'}`}>{quoteText}</p>
                  </div>
                )}
                {/* Si no hay cliente ni descripcion, mostrar actividad como principal */}
                {!clienteText && !descriptionText && (
                  <p className={`text-sm font-semibold break-words leading-snug font-mono ${isDarkGantt ? 'text-white' : 'text-gray-800'}`}>
                    {activityText || '(Sin tarea)'}
                  </p>
                )}
                {/* Rango horario */}
                {task.horaFin && (
                  <p className={`text-[12px] font-mono mt-1.5 ${isDarkGantt ? 'text-blue-400/80' : 'text-blue-600/80'}`}>
                    ⏱ {task.horaInicio || '08:30'} → {task.horaFin}
                  </p>
                )}
              </div>
            </div>
          </div>

          {(task.author || task.timestampUpdated || task.creadoEn) && (
            <div className={`mt-4 pt-3 border-t ${isDarkGantt ? 'border-white/10' : 'border-gray-200'}`}>
              <p className={`text-[10px] font-mono tracking-wide leading-tight ${isDarkGantt ? 'text-slate-400' : 'text-slate-600'}`}>
                {task.author && <span>Actualizado por: <span className={`font-medium ${isDarkGantt ? 'text-gray-300' : 'text-gray-600'}`}>{task.author}</span><br/></span>}
                {task.timestampUpdated && <span>El {task.timestampUpdated}{task.creadoEn ? <br/> : null}</span>}
                {task.creadoEn && <span className="mt-1 inline-block">Origen: <span className={`font-bold px-1 rounded-sm ${isDarkGantt ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#10b981]/10 text-emerald-600'}`}>{task.creadoEn}</span></span>}
              </p>
            </div>
          )}

          {task.updatedBy && (
            <div className="mt-2 pt-2 border-t border-red-500/30">
              <div className={`rounded-lg p-2.5 border ${isDarkGantt ? 'bg-red-500/10 border-red-500/25' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${isDarkGantt ? 'text-red-400' : 'text-red-600'}`}>
                  <span>⚠</span> Editado fuera de fecha
                </p>
                <p className={`text-[10px] font-mono mt-1 leading-relaxed ${isDarkGantt ? 'text-red-300/90' : 'text-red-600/80'}`}>
                  {task.updatedBy && <span>Por: <strong className={isDarkGantt ? 'text-red-200' : 'text-red-700'}>{task.updatedBy}</strong></span>}
                  {task.updatedAt && <span className="block">El {task.updatedAt}</span>}
                </p>
              </div>
            </div>
          )}

          <div className={cn(
            "absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent backdrop-filter backdrop-blur-xl",
            tooltipPos.isTop
              ? (isDarkGantt ? "bottom-full border-b-[8px] border-b-[#1a1a1d]/75 mb-[-1px]" : "bottom-full border-b-[8px] border-b-slate-100/90 mb-[-1px]")
              : (isDarkGantt ? "top-full border-t-[8px] border-t-[#1a1a1d]/75 mt-[-1px]" : "top-full border-t-[8px] border-t-slate-100/90 mt-[-1px]")
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
    baseClasses += ` cursor-pointer transition-colors duration-100 ${isDarkGantt ? 'hover:bg-white/5' : 'hover:bg-white/30'}`;
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
          <span className={`text-[12px] font-semibold ${isDarkGantt ? 'text-slate-400' : 'text-slate-600'}`}>+</span>
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

      {/* Boton "+": hover en desktop, siempre visible en touch */}
      {canAddMore && onTaskClick && (
        <div
          onClick={(e) => { e.stopPropagation(); onTaskClick(null, date, resourceId); }}
          className={cn(
            'absolute bottom-0.5 right-0.5 rounded-md flex items-center justify-center cursor-pointer z-10 select-none',
            'transition-all duration-100 ease-out',
            // Desktop: oculto hasta hover, aparece con escala
            'w-5 h-5 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100',
            // Touch (sin hover): siempre visible
            '[@media(hover:none)]:opacity-100 [@media(hover:none)]:scale-100 [@media(hover:none)]:w-7 [@media(hover:none)]:h-7',
            // Estilo sólido y visible
            'bg-[#10b981] hover:bg-[#059669] text-white',
            'shadow-[0_2px_8px_rgba(16,185,129,0.5)] hover:shadow-[0_3px_12px_rgba(16,185,129,0.7)]'
          )}
          title={`Agregar Tarea (${validTasks.length}/${MAX_TASKS_PER_CELL})`}
        >
          <span className="text-[12px] font-bold leading-none">+</span>
        </div>
      )}

      {/* Indicador de cupo lleno cuando se alcanza el máximo */}
      {!canAddMore && onTaskClick && (
        <div
          className={cn(
            'absolute bottom-0.5 right-0.5 w-5 h-5 rounded-md flex items-center justify-center',
            'opacity-0 group-hover:opacity-100 transition-all duration-150 z-10 cursor-default',
            isDarkGantt
              ? 'bg-white/10 text-white/40 ring-1 ring-white/15'
              : 'bg-gray-200 text-gray-400 ring-1 ring-gray-300'
          )}
          title={`Máximo de tareas alcanzado (${MAX_TASKS_PER_CELL}/${MAX_TASKS_PER_CELL})`}
        >
          <span className="text-[9px] font-bold leading-none">✕</span>
        </div>
      )}
    </div>
  );
}
