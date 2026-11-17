import { useEffect, useRef, useState } from 'react';
import { format, isAfter, isBefore, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { isNonWorkingDay } from '../utils/holidays';
import { cn } from '../../../shared/utils/cn';

const DAY_LABELS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Alto de la barra superior de la app (--topbar-height), en píxeles. */
const alturaBarraSuperior = () => {
  if (typeof window === 'undefined') return 56;
  const valor = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-height'));
  return Number.isFinite(valor) ? valor : 56;
};

/**
 * Fila de fechas reducida que queda fija bajo la barra superior cuando la
 * cabecera grande del cronograma sale de la pantalla al bajar. Así no se
 * pierde de vista qué día es cada columna.
 *
 * Vive fuera del contenedor con desplazamiento horizontal (un `sticky` dentro
 * de él no se pegaría a la ventana), por eso copia su desplazamiento: las
 * columnas se mueven con un `transform` sin volver a renderizar.
 */
export function GanttCompactHeader({
  weekDays,
  isToday,
  currentWeekStart,
  currentWeekEnd,
  selectedDay,
  scrollRef,
  headerRef,
  shellRef,
}) {
  const [visible, setVisible] = useState(false);
  const trackRef = useRef(null);

  // Aparece cuando la cabecera grande ya pasó por debajo de la barra superior
  // y desaparece al llegar al final del cronograma.
  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const header = headerRef.current;
      const shell = shellRef.current;
      if (!header || !shell) return;
      const tope = alturaBarraSuperior();
      const cabecera = header.getBoundingClientRect();
      const cronograma = shell.getBoundingClientRect();
      const next = cabecera.bottom < tope + 6 && cronograma.bottom > tope + 96;
      setVisible(current => (current === next ? current : next));
    };
    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [headerRef, shellRef]);

  // Las columnas siguen al desplazamiento horizontal de la grilla.
  useEffect(() => {
    const element = scrollRef.current;
    const track = trackRef.current;
    if (!element || !track) return undefined;
    const sync = () => {
      track.style.transform = `translate3d(${-element.scrollLeft}px, 0, 0)`;
    };
    sync();
    element.addEventListener('scroll', sync, { passive: true });
    return () => element.removeEventListener('scroll', sync);
  }, [scrollRef, weekDays]);

  const middleDay = weekDays[Math.floor(weekDays.length / 2)];
  const monthLabel = middleDay ? format(middleDay, 'MMM yyyy', { locale: es }) : '';

  return (
    <div className="gantt-compact-anchor" aria-hidden={!visible}>
      <div className={cn('gantt-compact-header', visible && 'is-visible')}>
        <div className="gantt-compact-name">
          <span>{monthLabel}</span>
        </div>
        <div className="gantt-compact-viewport">
          <div ref={trackRef} className="gantt-compact-track">
            <div className="gantt-compact-spacer" />
            {weekDays.map((day, idx) => {
              const todayFlag = isToday(day);
              const { isNonWorking } = isNonWorkingDay(day);
              const isPast = currentWeekStart && isBefore(day, currentWeekStart);
              const isFuture = currentWeekEnd && isAfter(day, currentWeekEnd);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'gantt-compact-day',
                    todayFlag && 'is-today',
                    isNonWorking && 'is-nonworking',
                    isSelected && 'is-selected',
                    (isPast || isFuture) && !isSelected && !todayFlag && 'is-outside',
                    (idx === 7 || idx === 14) && 'gantt-week-start'
                  )}
                >
                  <span className="gantt-compact-label">{DAY_LABELS_SHORT[day.getDay()]}</span>
                  <span className="gantt-compact-number">{format(day, 'd')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
