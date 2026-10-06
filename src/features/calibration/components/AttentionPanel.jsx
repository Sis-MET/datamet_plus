import { useState } from 'react';
import { BellRing, CheckCircle2 } from 'lucide-react';
import { OccurrenceRow } from './AgendaList';

const VISIBLE = 4;

/**
 * Fechas vencidas o dentro de su periodo de aviso, de cualquier año. Es la
 * alerta dentro del cronograma: lo primero que ve el personal al entrar.
 */
export function AttentionPanel({ alertas, onSelectEvent, initialExpanded = false }) {
  const [expanded, setExpanded] = useState(initialExpanded);

  if (alertas.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-xs">
        <CheckCircle2 className="h-[18px] w-[18px] flex-none text-success" aria-hidden="true" />
        <p className="text-[13px] text-fg">
          <span className="font-semibold">Todo al día.</span>{' '}
          <span className="text-fg-muted">No hay calibraciones, verificaciones ni actividades vencidas o por llegar.</span>
        </p>
      </div>
    );
  }

  const vencidas = alertas.filter(alerta => alerta.situacion === 'VENCIDO').length;
  const proximas = alertas.length - vencidas;
  const sorted = [...alertas].sort((a, b) => (
    Number(b.situacion === 'VENCIDO') - Number(a.situacion === 'VENCIDO') || a.fechaPlan.localeCompare(b.fechaPlan)
  ));
  const visible = expanded ? sorted : sorted.slice(0, VISIBLE);

  return (
    <section aria-labelledby="cal-attention-title" className="card overflow-hidden shadow-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <BellRing className="h-[18px] w-[18px] flex-none text-warning" aria-hidden="true" />
        <h2 id="cal-attention-title" className="text-sm font-semibold text-fg">Requieren atención</h2>
        <p className="text-[13px] text-fg-muted">
          {[
            vencidas > 0 && `${vencidas} ${vencidas === 1 ? 'vencida o atrasada' : 'vencidas o atrasadas'}`,
            proximas > 0 && `${proximas} en periodo de aviso`,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>
      <ul className="divide-y divide-line">
        {visible.map(occurrence => (
          <li key={occurrence.id}>
            <OccurrenceRow occurrence={occurrence} onSelect={onSelectEvent} />
          </li>
        ))}
      </ul>
      {!initialExpanded && sorted.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          className="w-full border-t border-line px-4 py-2.5 text-left text-[13px] font-medium text-fg-muted transition-colors hover:bg-fg/[0.025] hover:text-fg"
          aria-expanded={expanded}
        >
          {expanded ? 'Mostrar menos' : `Ver las ${sorted.length}`}
        </button>
      )}
    </section>
  );
}
