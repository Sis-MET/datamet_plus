import { cn } from '../../../shared/utils/cn';
import { formatDate, occurrenceWhen } from '../domain/format';
import { Glyph } from './primitives';

/** Próxima fecha pendiente de una serie, en una línea. */
export function NextDateInline({ occurrence }) {
  if (!occurrence) return <span className="w-36 flex-none text-right text-xs text-fg-subtle">Sin fechas pendientes</span>;
  const tone = occurrence.situacion === 'VENCIDO'
    ? 'text-danger'
    : occurrence.situacion === 'PROXIMO' ? 'text-warning' : 'text-fg-muted';
  return (
    <span className="flex w-36 flex-none items-center justify-end gap-2 text-right">
      <Glyph tipo={occurrence.tipo} situacion={occurrence.situacion} size={9} />
      <span className="flex flex-col">
        <span className="text-[13px] font-medium tabular-nums text-fg">{formatDate(occurrence.fechaPlan)}</span>
        <span className={cn('text-xs', tone)}>{occurrenceWhen(occurrence)}</span>
      </span>
    </span>
  );
}
