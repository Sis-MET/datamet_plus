import React, { useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Clock, MapPin, Plus, X } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { isNonWorkingDay } from '../utils/holidays';
import { useTaskTooltip } from './taskTooltipStore';
import { TASK_CARD_HEIGHT, TASK_CARD_PADDING_Y } from '../utils/ganttRowLayout';
import { getPlantAddress, getTaskClientLabel, isPlantCode, serviceReferenceLabel } from '../domain/taskFormDomain';
import { getPlantDepartment } from '../domain/plantDepartment';

const MAX_TASKS_PER_CELL = 4;
const TOOLTIP_SCREEN_MARGIN = 8;

const normalizeTaskText = (value) => String(value || '').trim();
const normalizeForComparison = (value) => normalizeTaskText(value).toLocaleLowerCase();

/**
 * Calcula si el texto debe ser oscuro o claro según el color de fondo.
 * Usa la fórmula de luminancia relativa (WCAG 2.1).
 * @param {string} hexColor - Color en formato #RRGGBB o #RGB
 * @returns {{ text: string, textSecondary: string }}
 */
function getContrastColors(hexColor) {
  if (!hexColor) return { text: '#ffffff', textSecondary: 'rgba(255,255,255,0.85)' };
  // Normalizar a #RRGGBB
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  // Los colores predefinidos incluyen canal alfa (#RRGGBBAA): se ignora.
  if (hex.length === 8) hex = hex.slice(0, 6);
  if (hex.length !== 6) return { text: '#ffffff', textSecondary: 'rgba(255,255,255,0.85)' };
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  // Linearizar canales
  const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  // Umbral: > 0.35 = fondo claro → texto oscuro
  const isDark = L > 0.35;
  return {
    text: isDark ? '#161614' : '#ffffff',
    textSecondary: isDark ? 'rgba(22,22,20,0.72)' : 'rgba(255,255,255,0.86)',
  };
}

// Estado de la tarea: punto sobre el color de la ficha y etiqueta en el tooltip.
const STATE_DOT = {
  Completado: 'bg-emerald-400',
  Aprobado: 'bg-emerald-400',
  Cancelado: 'bg-red-400',
  Reprogramado: 'bg-sky-400',
  Aceptado: 'bg-sky-400',
};

function getStateBadgeClass(estado) {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset';
  switch (estado) {
    case 'Completado':
    case 'Aprobado':
      return `${base} bg-success/10 text-success ring-success/25`;
    case 'En Proceso':
    case 'Aceptado':
      return `${base} bg-info/10 text-info ring-info/25`;
    case 'Cancelado':
      return `${base} bg-danger/10 text-danger ring-danger/25`;
    default:
      return `${base} bg-warning/10 text-warning ring-warning/25`;
  }
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

function TooltipField({ label, children }) {
  return (
    <div>
      <p className="text-[11px] text-fg-subtle">{label}</p>
      <div className="mt-0.5 break-words text-[13px] leading-snug text-fg">{children}</div>
    </div>
  );
}

// Sub-componente: cada tarjeta con su propio tooltip
function TaskCard({ task, formattedDateTooltip, resourceName, resourceId, onTaskClick, onTaskDrop, onTaskContextMenu, onTaskDragStart, onTaskDragEnd, date }) {
  const tooltipKey = `${resourceId}:${task.id}`;
  const { tooltip, showTaskTooltip, hideTaskTooltip } = useTaskTooltip(tooltipKey);
  const renderTooltip = Boolean(tooltip);
  const showTooltip = Boolean(tooltip?.visible);
  const tooltipPos = tooltip?.position || null;
  const tooltipRef = useRef(null);
  const cardRef = useRef(null);
  const lastPointerType = useRef('mouse');
  const openedByTap = useRef(false);

  // Abierto con un toque, se cierra al tocar fuera o al desplazar la pantalla.
  useEffect(() => {
    if (!showTooltip || !openedByTap.current) return undefined;
    const close = (event) => {
      if (event.type === 'pointerdown' && cardRef.current?.contains(event.target)) return;
      openedByTap.current = false;
      hideTaskTooltip();
    };
    document.addEventListener('pointerdown', close, true);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', close, true);
      window.removeEventListener('scroll', close, { capture: true });
    };
  }, [hideTaskTooltip, showTooltip]);

  // El resumen creció con la dirección: se corre lo justo para no salir de la pantalla.
  useLayoutEffect(() => {
    const element = tooltipRef.current;
    if (!element || !tooltipPos) return;
    const { offsetWidth: width, offsetHeight: height } = element;
    const top = tooltipPos.isTop ? tooltipPos.y : tooltipPos.y - height;
    const left = tooltipPos.x - width / 2;
    const maxTop = window.innerHeight - height - TOOLTIP_SCREEN_MARGIN;
    const maxLeft = window.innerWidth - width - TOOLTIP_SCREEN_MARGIN;
    const shiftY = Math.max(TOOLTIP_SCREEN_MARGIN, Math.min(top, maxTop)) - top;
    const shiftX = Math.max(TOOLTIP_SCREEN_MARGIN, Math.min(left, maxLeft)) - left;
    element.style.marginTop = shiftY ? `${shiftY}px` : '';
    element.style.marginLeft = shiftX ? `${shiftX}px` : '';
  }, [tooltipPos]);

  // --- Datos normalizados para la tarjeta ---
  const clienteLabel = getTaskClientLabel(task);
  const plantAddress = getPlantAddress({ dir: task.plantaDir });
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

  // Solo un mouse real abre el resumen al pasar: un toque también simula ese
  // paso y abriría el resumen junto con la ficha.
  const handlePointerEnter = (e) => {
    e.stopPropagation();
    if (e.pointerType === 'mouse') showTaskTooltip(e.currentTarget);
  };

  const handlePointerLeave = (e) => {
    e.stopPropagation();
    if (e.pointerType === 'mouse') hideTaskTooltip();
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

  const contrast = getContrastColors(task.colorAM);
  const hasColor = Boolean(task.morning && task.colorAM);
  const primaryColor = hasColor ? contrast.text : undefined;
  const secondaryColor = hasColor ? contrast.textSecondary : undefined;

  // La ficha muestra hasta cuatro líneas: las dos primeras dinámicas, el horario
  // y el tipo de tarea. El resto del detalle queda en el tooltip.
  const [titleLine, detailLine] = dynamicLines;
  const titleText = titleLine?.text || '';
  const detailText = detailLine?.text || '';
  const hasTimeRange = Boolean(task.horaInicio || task.horaFin);
  const showActivity = Boolean(activityText)
    && normalizeForComparison(activityText) !== normalizeForComparison(titleText);

  // Departamento abreviado antes del cliente: «LPZ - EMPACAR».
  const department = getPlantDepartment(plantaText);
  const cardTitle = department ? `${department.code} - ${titleText}` : titleText;

  return (
    <>
      <div
        ref={cardRef}
        data-task-id={task.id}
        draggable={!!onTaskDrop}
        {...otherLongPressHandlers}
        onPointerDown={(e) => {
          lastPointerType.current = e.pointerType;
          otherLongPressHandlers.onPointerDown(e);
        }}
        onClick={(e) => {
          longPressClick(e);
          if (e.isPropagationStopped()) return;

          if (onTaskClick) {
            e.stopPropagation();
            hideTaskTooltip();
            onTaskClick(task, date, resourceId);
            return;
          }

          // Sin permiso de edición no hay ficha: en táctil, el toque abre o cierra el resumen.
          if (lastPointerType.current === 'mouse') return;
          if (showTooltip) {
            openedByTap.current = false;
            hideTaskTooltip();
          } else {
            openedByTap.current = true;
            showTaskTooltip(e.currentTarget);
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
            plantaDir: task.plantaDir,
            plantaLocalidad: task.plantaLocalidad,
            colorAM: task.colorAM,
            estadoAM: task.estadoAM,
            horaInicio: task.horaInicio,
            horaFin: task.horaFin,
            creadoEn: task.creadoEn,
            createdBy: task.createdBy,
            createdById: task.createdById,
            grupoId: task.grupoId
          });
          e.dataTransfer.setData('application/json', dragData);
          e.dataTransfer.effectAllowed = 'copyMove';
        }}
        onDragEnd={() => onTaskDragEnd && onTaskDragEnd()}
        onContextMenu={(e) => {
          if (onTaskContextMenu) {
            e.preventDefault();
            e.stopPropagation();
            hideTaskTooltip();
            onTaskContextMenu(e, task, date, resourceId);
          }
        }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className={cn(
          'relative flex w-full shrink-0 cursor-grab select-none flex-col justify-center overflow-hidden rounded-lg px-2 shadow-xs ring-1 ring-inset ring-black/10 transition-[box-shadow,transform] duration-150 ease-out active:cursor-grabbing',
          'hover:-translate-y-px hover:shadow-card hover:ring-black/25',
          !hasColor && 'bg-surface-2 text-fg'
        )}
        style={{
          touchAction: 'none',
          height: TASK_CARD_HEIGHT,
          paddingBlock: TASK_CARD_PADDING_Y,
          ...(hasColor ? { backgroundColor: task.colorAM } : {}),
        }}
      >
        {task.morning && (
          <div className="flex w-full min-w-0 items-start gap-1.5">
            <span
              className={cn('mt-1 h-2 w-2 shrink-0 rounded-full ring-1 ring-black/25', STATE_DOT[task.estadoAM] || 'bg-yellow-300')}
              title={task.estadoAM || 'Pendiente'}
            />
            {/* Cada línea tiene una altura fija algo mayor que su cuerpo de letra:
                acentos y descendentes no se recortan y las cuatro líneas posibles
                (16 + 14 + 14 + 12 px) caben en la ficha sin desbordarla. */}
            <div className="min-w-0 flex-1">
              {/* Título: Cliente > Planta > Descripción > Tipo de tarea */}
              <span className="block truncate text-xs font-semibold leading-4" style={{ color: primaryColor }}>
                {task.creadoEn === 'Salida Personal' && <MapPin className="-mt-0.5 mr-1 inline-block h-3 w-3 align-middle opacity-80" />}
                {cardTitle}
              </span>
              {detailText && (
                <span className="block truncate text-[11px] leading-[14px]" style={{ color: secondaryColor }}>
                  {detailText}
                </span>
              )}
              {hasTimeRange && (
                <span className="block truncate text-[11px] font-medium leading-[14px] tabular-nums" style={{ color: secondaryColor }}>
                  {task.horaInicio || '08:30'}{task.horaFin ? ` – ${task.horaFin}` : ''}
                </span>
              )}
              {showActivity && (
                <span className="gantt-card-activity block truncate text-[9px] font-semibold uppercase leading-3 tracking-wide opacity-80" style={{ color: secondaryColor }}>
                  {activityText}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tooltip por tarjeta - portalled */}
      {renderTooltip && tooltipPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          className={cn(
            'glass pointer-events-none fixed z-[9999] max-h-[calc(100dvh-16px)] w-[min(300px,calc(100vw-20px))] overflow-hidden rounded-2xl border p-4 transition-[opacity,transform] duration-150 ease-out',
            tooltipPos.isTop ? '-translate-x-1/2 origin-top' : '-translate-x-1/2 -translate-y-full origin-bottom',
            showTooltip ? 'scale-100 opacity-100' : 'scale-[0.97] opacity-0',
            !showTooltip && tooltipPos.isTop ? '-mt-1.5' : '',
            !showTooltip && !tooltipPos.isTop ? 'mt-1.5' : ''
          )}
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-line pb-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-fg-muted">{(resourceName || resourceId || '').replace(/_/g, ' ')}</p>
              <p className="mt-0.5 text-sm font-semibold leading-tight text-fg first-letter:uppercase">{formattedDateTooltip}</p>
            </div>
            {task.morning && <span className={cn(getStateBadgeClass(task.estadoAM), 'shrink-0')}>{task.estadoAM || 'Pendiente'}</span>}
          </div>

          <div className="flex gap-3">
            <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: task.colorAM || '#37A65F' }} aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-2.5">
              {clienteText && (
                <TooltipField label="Cliente">
                  <span className="font-semibold">{clienteLabel}</span>
                </TooltipField>
              )}
              {plantAddress && (
                <TooltipField label="Dirección">
                  <span className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
                    <span className="min-w-0">{plantAddress}</span>
                  </span>
                </TooltipField>
              )}
              {descriptionText && (
                <TooltipField label="Descripción">{descriptionText}</TooltipField>
              )}
              {activityText && normalizeForComparison(activityText) !== normalizeForComparison(descriptionText) && (
                <TooltipField label="Tipo de tarea">{activityText}</TooltipField>
              )}
              {plantaText && (
                <TooltipField label={isPlantCode(plantaText) ? 'Código de planta' : 'Planta'}>{plantaText}</TooltipField>
              )}
              {quoteText && (
                <TooltipField label={serviceReferenceLabel(quoteText)}>
                  <span className="font-mono text-xs">{quoteText}</span>
                </TooltipField>
              )}
              {/* Si no hay cliente ni descripcion, mostrar actividad como principal */}
              {!clienteText && !descriptionText && !activityText && (
                <TooltipField label="Tarea">(Sin tarea)</TooltipField>
              )}
              {/* Rango horario */}
              {task.horaFin && (
                <p className="flex items-center gap-1.5 text-[13px] font-medium tabular-nums text-fg">
                  <Clock className="h-3.5 w-3.5 text-fg-muted" aria-hidden="true" />
                  {task.horaInicio || '08:30'} – {task.horaFin}
                </p>
              )}
            </div>
          </div>

          {(task.author || task.timestampUpdated || task.creadoEn) && (
            <div className="mt-3 space-y-1 border-t border-line pt-3 text-[11px] leading-snug text-fg-muted">
              {task.author && <p>Actualizado por <span className="font-medium text-fg">{task.author}</span></p>}
              {task.timestampUpdated && <p>El {task.timestampUpdated}</p>}
              {task.creadoEn && (
                <p>
                  Origen{' '}
                  <span className="rounded-md bg-fg/[0.07] px-1.5 py-0.5 font-medium text-fg">{task.creadoEn}</span>
                </p>
              )}
            </div>
          )}

          {task.updatedBy && (
            <div className="mt-3 rounded-xl border border-danger/25 bg-danger/[0.07] p-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-danger">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Editado fuera de fecha
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                {task.updatedBy && <span>Por: <strong className="font-semibold text-fg">{task.updatedBy}</strong></span>}
                {task.updatedAt && <span className="block">El {task.updatedAt}</span>}
              </p>
            </div>
          )}
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
  isWeekStart,
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
  const cellStyle = isPreview ? { opacity: previewOpacity } : {};

  const { isNonWorking } = isNonWorkingDay(date);
  const isSelectedDay = selectedDay && isSameDay(date, selectedDay);

  const baseClasses = cn(
    'gantt-cell',
    todayFlag && 'gantt-cell-today-bg',
    isPreview && 'gantt-cell-preview',
    isNonWorking && 'gantt-cell-nonworking',
    isSelectedDay && 'gantt-cell-selected',
    isWeekStart && 'gantt-week-start',
    onTaskClick && 'cursor-pointer transition-colors duration-100 hover:bg-fg/[0.03]'
  );

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
  const allValidTasks = tasks ? tasks.filter(t => !isEmptyTask(t)) : [];
  const validTasks = allValidTasks;
  const canAddMore = allValidTasks.length < MAX_TASKS_PER_CELL;

  if (validTasks.length === 0) {
    return (
      <div
        className={cn(baseClasses, 'gantt-cell-empty group relative')}
        style={cellStyle}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {onTaskClick && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface text-fg-muted">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(baseClasses, 'gantt-cell-filled group relative')}
      style={cellStyle}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {validTasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
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
            'gantt-cell-add absolute bottom-1 right-1 z-10 flex cursor-pointer select-none items-center justify-center rounded-md',
            'transition-[opacity,transform,background-color] duration-150 ease-out',
            // Desktop: oculto hasta hover, aparece con escala
            'h-5 w-5 scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100',
            // Touch (sin hover): siempre visible y en la última línea, sin tapar el horario.
            '[@media(hover:none)]:bottom-[3px] [@media(hover:none)]:h-3.5 [@media(hover:none)]:w-3.5 [@media(hover:none)]:scale-100 [@media(hover:none)]:rounded [@media(hover:none)]:opacity-100',
            'bg-brand text-brand-fg shadow-card ring-1 ring-inset ring-black/10 hover:bg-brand-hover'
          )}
          title={`Agregar tarea (${allValidTasks.length}/${MAX_TASKS_PER_CELL})`}
        >
          <Plus className="h-3.5 w-3.5 [@media(hover:none)]:h-2.5 [@media(hover:none)]:w-2.5" strokeWidth={2.6} aria-hidden="true" />
        </div>
      )}

      {/* Indicador de cupo lleno cuando se alcanza el máximo */}
      {!canAddMore && onTaskClick && (
        <div
          className="absolute bottom-1 right-1 z-10 flex h-5 w-5 cursor-default items-center justify-center rounded-md bg-surface text-fg-subtle opacity-0 shadow-xs ring-1 ring-line transition-opacity duration-150 group-hover:opacity-100"
          title={`Máximo de tareas alcanzado (${MAX_TASKS_PER_CELL}/${MAX_TASKS_PER_CELL})`}
        >
          <X className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
