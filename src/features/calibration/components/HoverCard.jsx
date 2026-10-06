import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import {
  SITUACION_TONE,
  TIPOS,
  capitalize,
  formatDate,
  occurrenceTitle,
  occurrenceWhen,
} from '../domain/format';
import { StatusBadge } from './primitives';

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[11px] text-fg-subtle">{label}</p>
      <div className="mt-0.5 break-words text-[13px] leading-snug text-fg">{children}</div>
    </div>
  );
}

/**
 * Tarjeta de vidrio al pasar sobre una fecha del plan; misma anatomía que la de
 * las fichas del Cronograma (cabecera con fecha y estado, barra de color y datos).
 */
export function OccurrenceHoverCard({ hover, onDismiss }) {
  const ref = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!hover || !ref.current) return;
    const anchor = hover.anchor.getBoundingClientRect();
    const box = ref.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(10, anchor.left + (anchor.width / 2) - (box.width / 2)),
      window.innerWidth - box.width - 10
    );
    const above = anchor.top - box.height - 10;
    setPosition({ left, top: above > 10 ? above : Math.min(anchor.bottom + 10, window.innerHeight - box.height - 10) });
  }, [hover]);

  // Al desplazar, la tarjeta quedaría desprendida de su fecha.
  useEffect(() => {
    if (!hover) return undefined;
    window.addEventListener('scroll', onDismiss, true);
    return () => window.removeEventListener('scroll', onDismiss, true);
  }, [hover, onDismiss]);

  if (!hover) return null;
  const { occurrence } = hover;
  const tone = occurrence.proyectado ? 'muted' : (SITUACION_TONE[occurrence.situacion] || 'neutral');
  const isActivity = occurrence.tipo === 'ACTIVIDAD';
  const pendiente = occurrence.situacion !== 'REALIZADO' && occurrence.situacion !== 'CANCELADO';

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="glass pointer-events-none fixed z-[9999] w-[min(280px,calc(100vw-20px))] animate-pop-in rounded-2xl border p-4"
      style={position ? { left: position.left, top: position.top } : { left: -9999, top: -9999 }}
    >
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-fg-muted">
            {[TIPOS[occurrence.tipo].label, occurrence.planta].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-fg">
            {capitalize(formatDate(occurrence.fecha, "EEEE d 'de' MMMM"))}
          </p>
        </div>
        <span className="shrink-0">
          <StatusBadge situacion={occurrence.situacion} tipo={occurrence.tipo} proyectado={occurrence.proyectado} />
        </span>
      </div>

      <div className="flex gap-3">
        <span className={`cal-tone-${tone} w-1 shrink-0 rounded-full`} style={{ backgroundColor: 'var(--tone)' }} aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Field label={isActivity ? 'Actividad' : 'Equipo'}>
            <span className="font-semibold">{occurrenceTitle(occurrence)}</span>
            {!isActivity && occurrence.instrumento && <span className="text-fg-muted"> · {occurrence.instrumento}</span>}
          </Field>
          {isActivity && occurrence.categoria && <Field label="Categoría">{occurrence.categoria}</Field>}
          <Field label="Responsable">{occurrence.responsableNombre || 'Sin asignar'}</Field>
          {occurrence.certificado && <Field label="Certificado">{occurrence.certificado}</Field>}
          {occurrence.observaciones && <Field label="Observaciones">{occurrence.observaciones}</Field>}
          <p className="flex items-center gap-1.5 text-[13px] font-medium tabular-nums text-fg">
            <Clock className="h-3.5 w-3.5 text-fg-muted" aria-hidden="true" />
            {pendiente && occurrence.proyectado ? 'Fecha estimada' : occurrenceWhen(occurrence)}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
