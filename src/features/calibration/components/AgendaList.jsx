import { useMemo, useState } from 'react';
import { CalendarCheck2, ChevronRight } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import {
  TIPOS,
  capitalize,
  formatDate,
  occurrenceSubtitle,
  occurrenceTitle,
  occurrenceWhen,
} from '../domain/format';
import { EmptyState, Glyph, Segmented, StatusBadge } from './primitives';

const whenTone = (occurrence) => {
  if (occurrence.proyectado) return 'text-fg-muted';
  if (occurrence.situacion === 'VENCIDO') return 'text-danger';
  if (occurrence.situacion === 'PROXIMO') return 'text-warning';
  return 'text-fg-muted';
};

/** Fila de una fecha del plan: tipo, qué, cuándo y situación. */
export function OccurrenceRow({ occurrence, onSelect, hideDate = false }) {
  // Una calibración enviada y aún sin certificado sigue vencida, pero en curso.
  const badgeSituacion = occurrence.estado === 'EN_PROCESO' ? 'EN_PROCESO' : occurrence.situacion;
  return (
    <button
      type="button"
      onClick={() => onSelect(occurrence)}
      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
    >
      {!hideDate && (
        <span className="flex w-11 flex-none flex-col items-center rounded-xl bg-surface-2 py-1.5 tabular-nums">
          <span className="text-[15px] font-semibold leading-none text-fg">{Number(occurrence.fecha.slice(8))}</span>
          <span className="mt-1 text-[10px] font-medium uppercase leading-none text-fg-muted">{formatDate(occurrence.fecha, 'MMM')}</span>
        </span>
      )}
      <Glyph tipo={occurrence.tipo} situacion={occurrence.situacion} proyectado={occurrence.proyectado} size={11} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-[13.5px] font-semibold text-fg">{occurrenceTitle(occurrence)}</span>
          <span className="hidden flex-none text-xs text-fg-muted sm:inline">{TIPOS[occurrence.tipo].label}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-fg-muted">
          {[occurrenceSubtitle(occurrence), occurrence.responsableNombre].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="hidden flex-none flex-col items-end gap-1 sm:flex">
        <StatusBadge situacion={badgeSituacion} tipo={occurrence.tipo} proyectado={occurrence.proyectado} />
        <span className={cn('text-xs font-medium tabular-nums', whenTone(occurrence))}>{occurrenceWhen(occurrence)}</span>
      </span>
      <span className={cn('flex-none text-xs font-medium tabular-nums sm:hidden', whenTone(occurrence))}>
        {occurrenceWhen(occurrence)}
      </span>
      <ChevronRight className="h-4 w-4 flex-none text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

const PENDIENTES = new Set(['VENCIDO', 'PROXIMO', 'EN_PROCESO', 'PROGRAMADO']);

/** Vista de agenda: todas las fechas del año agrupadas por mes. */
export function AgendaList({ eventos, onSelectEvent }) {
  const [scope, setScope] = useState('PENDIENTES');

  const months = useMemo(() => {
    const visible = scope === 'PENDIENTES' ? eventos.filter(occurrence => PENDIENTES.has(occurrence.situacion)) : eventos;
    const map = new Map();
    for (const occurrence of visible) {
      const key = occurrence.fecha.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(occurrence);
    }
    return [...map.entries()];
  }, [eventos, scope]);

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Fechas a mostrar"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'PENDIENTES', label: 'Pendientes' },
          { value: 'TODAS', label: 'Todas, incluso realizadas' },
        ]}
        className="self-start"
      />

      {months.length === 0 ? (
        <EmptyState icon={CalendarCheck2} title={scope === 'PENDIENTES' ? 'No hay fechas pendientes' : 'No hay fechas en este año'}>
          {scope === 'PENDIENTES'
            ? 'Todo lo planificado con estos filtros ya se realizó o se canceló.'
            : 'Configura la verificación interna de los equipos o agrega actividades para armar el plan.'}
        </EmptyState>
      ) : (
        months.map(([month, items]) => (
          <section key={month} aria-labelledby={`agenda-${month}`}>
            <h3 id={`agenda-${month}`} className="mb-2 flex items-baseline gap-2 px-1">
              <span className="text-[13px] font-semibold text-fg">{capitalize(formatDate(`${month}-01`, 'MMMM yyyy'))}</span>
              <span className="text-xs text-fg-muted">{items.length} {items.length === 1 ? 'fecha' : 'fechas'}</span>
            </h3>
            <ul className="card divide-y divide-line overflow-hidden shadow-xs">
              {items.map(occurrence => (
                <li key={occurrence.id}>
                  <OccurrenceRow occurrence={occurrence} onSelect={onSelectEvent} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
