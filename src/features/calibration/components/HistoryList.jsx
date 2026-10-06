import { useState } from 'react';
import { cn } from '../../../shared/utils/cn';

const dateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })
  : null);

const linkButton = 'text-[12.5px] font-medium text-fg underline decoration-fg/30 underline-offset-4 transition-colors hover:decoration-fg';

/**
 * Línea de tiempo de un historial: qué pasó, el detalle (antes → después), el
 * motivo si lo hubo y quién y cuándo. Muestra las primeras `visible` líneas.
 */
export function HistoryList({ items, visible = 5, className }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, visible);
  return (
    <div className={className}>
      <ol className="relative space-y-3 border-l border-line pl-4">
        {shown.map(item => (
          <li key={item.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-fg/40" aria-hidden="true" />
            <p className="text-[13px] font-medium text-fg">{item.title}</p>
            {item.detalle && <p className="mt-0.5 break-words text-xs leading-snug text-fg-muted">{item.detalle}</p>}
            {item.motivo && (
              <p className="mt-0.5 break-words text-xs leading-snug text-fg">
                <span className="text-fg-muted">Motivo: </span>{item.motivo}
              </p>
            )}
            <p className="mt-0.5 text-xs text-fg-subtle">{[item.usuario, dateTime(item.fecha)].filter(Boolean).join(' · ')}</p>
          </li>
        ))}
      </ol>
      {items.length > visible && (
        <button type="button" onClick={() => setShowAll(value => !value)} className={cn(linkButton, 'mt-3')}>
          {showAll ? 'Mostrar menos' : `Ver todo el historial (${items.length})`}
        </button>
      )}
    </div>
  );
}
