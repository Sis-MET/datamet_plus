import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import { cn } from '../../../shared/utils/cn';
import {
  SITUACION_TONE,
  capitalize,
  formatDate,
  occurrenceTitle,
  toISODate,
} from '../domain/format';
import { Glyph } from './primitives';
import { OccurrenceRow } from './AgendaList';
import { OccurrenceHoverCard } from './HoverCard';
import { useHoverCard } from '../hooks/useHoverCard';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_CHIPS = 3;

const iconButton = 'flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-fg-muted shadow-xs transition-colors hover:bg-surface-2 hover:text-fg';

/** Vista mensual: cuadrícula de lunes a domingo y el detalle del día elegido. */
export function MonthCalendar({ anio, mes, hoy, eventos, onNavigate, onSelectEvent }) {
  const monthDate = useMemo(() => new Date(anio, mes, 1), [anio, mes]);
  const todayInMonth = hoy.startsWith(`${anio}-${String(mes + 1).padStart(2, '0')}`);
  const [selectedDay, setSelectedDay] = useState(() => (todayInMonth ? hoy : toISODate(monthDate)));
  const [monthKey, setMonthKey] = useState(`${anio}-${mes}`);
  const [hover, showHover, hideHover] = useHoverCard();

  // Al cambiar de mes el día elegido vuelve a hoy o al primer día del mes.
  if (monthKey !== `${anio}-${mes}`) {
    setMonthKey(`${anio}-${mes}`);
    setSelectedDay(todayInMonth ? hoy : toISODate(monthDate));
  }

  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 }),
  }).map(toISODate), [monthDate]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const occurrence of eventos) {
      if (!map.has(occurrence.fecha)) map.set(occurrence.fecha, []);
      map.get(occurrence.fecha).push(occurrence);
    }
    return map;
  }, [eventos]);

  const goTo = (offset) => {
    const target = new Date(anio, mes + offset, 1);
    onNavigate(target.getFullYear(), target.getMonth());
  };

  const selectedEvents = byDay.get(selectedDay) || [];
  const monthPrefix = `${anio}-${String(mes + 1).padStart(2, '0')}`;
  const monthTotal = eventos.filter(occurrence => occurrence.fecha.startsWith(monthPrefix)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button type="button" className={iconButton} onClick={() => goTo(-1)} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" className={iconButton} onClick={() => goTo(1)} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </button>
        <h3 className="ml-1 text-base font-semibold text-fg">{capitalize(formatDate(toISODate(monthDate), 'MMMM yyyy'))}</h3>
        <span className="text-[13px] text-fg-muted">
          {monthTotal === 0 ? 'Sin fechas' : `${monthTotal} ${monthTotal === 1 ? 'fecha' : 'fechas'}`}
        </span>
      </div>

      <div className="cal-month">
        <div className="cal-month-grid">
          {WEEKDAYS.map(day => <div key={day} className="cal-month-weekday" aria-hidden="true">{day}</div>)}
          {days.map((day) => {
            const items = byDay.get(day) || [];
            const outside = !day.startsWith(monthPrefix);
            const visible = items.slice(0, MAX_CHIPS);
            return (
              <div
                key={day}
                className={cn(
                  'cal-month-day cursor-pointer',
                  outside && 'cal-month-day-outside',
                  day === selectedDay && 'cal-month-day-selected'
                )}
                onClick={() => setSelectedDay(day)}
              >
                <button
                  type="button"
                  className={cn('cal-month-number', day === hoy && 'cal-month-number-today')}
                  aria-pressed={day === selectedDay}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedDay(day);
                  }}
                  aria-label={`${formatDate(day, "EEEE d 'de' MMMM")}${items.length ? `, ${items.length} ${items.length === 1 ? 'fecha' : 'fechas'}` : ''}`}
                >
                  {Number(day.slice(8))}
                </button>
                {visible.map(occurrence => (
                  <button
                    key={occurrence.id}
                    type="button"
                    className={cn(
                      'cal-chip',
                      `cal-tone-${occurrence.proyectado ? 'neutral' : SITUACION_TONE[occurrence.situacion]}`,
                      occurrence.situacion === 'CANCELADO' && 'cal-chip-cancelled'
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      hideHover();
                      onSelectEvent(occurrence);
                    }}
                    onMouseEnter={(event) => showHover(occurrence, event.currentTarget)}
                    onMouseLeave={hideHover}
                    onFocus={(event) => showHover(occurrence, event.currentTarget)}
                    onBlur={hideHover}
                  >
                    <Glyph tipo={occurrence.tipo} situacion={occurrence.situacion} proyectado={occurrence.proyectado} />
                    <span>{occurrenceTitle(occurrence)}</span>
                  </button>
                ))}
                {items.length > MAX_CHIPS && (
                  <span className="cal-month-more">+{items.length - MAX_CHIPS} más</span>
                )}
                {items.length > 0 && (
                  <span className="cal-month-dots" aria-hidden="true">
                    {items.slice(0, 6).map(occurrence => (
                      <Glyph key={occurrence.id} tipo={occurrence.tipo} situacion={occurrence.situacion} proyectado={occurrence.proyectado} />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <section aria-labelledby="cal-day-detail">
        <h3 id="cal-day-detail" className="mb-2 px-1 text-[13px] font-semibold text-fg">
          {capitalize(formatDate(selectedDay, "EEEE d 'de' MMMM"))}
        </h3>
        {selectedEvents.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-5 text-center text-[13px] text-fg-muted">
            Nada programado para este día.
          </p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden shadow-xs">
            {selectedEvents.map(occurrence => (
              <li key={occurrence.id}>
                <OccurrenceRow occurrence={occurrence} onSelect={onSelectEvent} hideDate />
              </li>
            ))}
          </ul>
        )}
      </section>
      <OccurrenceHoverCard hover={hover} onDismiss={hideHover} />
    </div>
  );
}
