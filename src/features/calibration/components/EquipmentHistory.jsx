import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { ACCIONES_EQUIPO, formatDate } from '../domain/format';
import { ToneBadge } from './primitives';

const dateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })
  : null);

const linkButton = 'text-[12.5px] font-medium text-fg underline decoration-fg/30 underline-offset-4 transition-colors hover:decoration-fg';

function SectionTitle({ children, count }) {
  return (
    <h4 className="mb-2.5 flex items-baseline gap-2 text-[13px] font-semibold text-fg">
      {children}
      {count != null && <span className="text-xs font-normal text-fg-muted">{count}</span>}
    </h4>
  );
}

function CertificateItem({ certificado, canEdit, puedeAnular, onCorregir, onAnular }) {
  const { vigente, anulado } = certificado;
  const registro = certificado.origen === 'EXTERNO' && !certificado.registradoPor
    ? 'Registrado fuera del módulo'
    : [certificado.registradoPor && `Registrado por ${certificado.registradoPor}`, certificado.registradoEn && formatDate(certificado.registradoEn.slice(0, 10))]
      .filter(Boolean).join(' · ');
  return (
    <li className={cn('rounded-xl border bg-surface px-3.5 py-3', vigente ? 'border-fg/20 shadow-xs' : 'border-line', anulado && 'opacity-75')}>
      <div className="flex items-start justify-between gap-3">
        <span className={cn('min-w-0 break-words text-[13px] font-semibold text-fg', anulado && 'line-through decoration-fg/40')}>
          {certificado.numero || 'Sin número'}
        </span>
        {/* «Actual» y no «Vigente»: el certificado actual puede estar vencido. */}
        {vigente && <ToneBadge tone="info">Actual</ToneBadge>}
        {anulado && <ToneBadge tone="danger">Anulado</ToneBadge>}
        {!vigente && !anulado && <ToneBadge tone="neutral">Anterior</ToneBadge>}
      </div>
      <p className="mt-1 text-xs tabular-nums text-fg-muted">
        Emitido {formatDate(certificado.fecha)} · vence {formatDate(certificado.vence)}
        {certificado.ente && ` · ${certificado.ente}`}
      </p>
      {registro && <p className="mt-0.5 text-xs text-fg-subtle">{registro}</p>}
      {certificado.observaciones && <p className="mt-1.5 text-xs leading-snug text-fg-muted">{certificado.observaciones}</p>}
      {anulado && (
        <p className="mt-1.5 text-xs leading-snug text-danger">
          Anulado{certificado.anuladoPor ? ` por ${certificado.anuladoPor}` : ''}{certificado.anuladoEn ? ` el ${dateTime(certificado.anuladoEn)}` : ''}
          {certificado.motivoAnulacion ? `: ${certificado.motivoAnulacion}` : ''}
        </p>
      )}
      {vigente && canEdit && (
        <div className="mt-2.5 flex gap-4">
          <button type="button" onClick={onCorregir} className={linkButton}>Corregir</button>
          {puedeAnular && (
            <button type="button" onClick={onAnular} className={cn(linkButton, 'text-danger decoration-danger/30 hover:decoration-danger')}>
              Anular
            </button>
          )}
        </div>
      )}
    </li>
  );
}

const ACTIVITY_VISIBLE = 5;

/** Historial del equipo dentro de su ficha. */
export function EquipmentHistory({ historial, loading, error, canEdit, onCorregir, onAnular }) {
  const [showAll, setShowAll] = useState(false);

  if (!historial && loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-[13px] text-fg-muted" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando historial…
      </div>
    );
  }
  if (!historial && error) {
    return <p className="text-[13px] text-danger" role="alert">No se pudo cargar el historial: {error.message}</p>;
  }
  if (!historial) return null;

  const { certificados, verificaciones, actividad, puedeAnular } = historial;
  const anterior = certificados.find(item => !item.vigente && !item.anulado);
  const actividadVisible = showAll ? actividad : actividad.slice(0, ACTIVITY_VISIBLE);

  return (
    <div className="space-y-6">
      <section aria-label="Historial de certificados">
        <SectionTitle count={certificados.length}>Historial de certificados</SectionTitle>
        {certificados.length === 0 ? (
          <p className="text-[13px] text-fg-muted">Aún no tiene certificados registrados.</p>
        ) : (
          <ul className="space-y-2">
            {certificados.map((certificado, index) => (
              <CertificateItem
                key={certificado.id ?? `externo-${index}`}
                certificado={certificado}
                canEdit={canEdit}
                puedeAnular={puedeAnular}
                onCorregir={onCorregir}
                onAnular={() => onAnular(anterior)}
              />
            ))}
          </ul>
        )}
      </section>

      {verificaciones.length > 0 && (
        <section aria-label="Verificaciones internas realizadas">
          <SectionTitle count={verificaciones.length}>Verificaciones internas</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {verificaciones.map(item => (
              <li key={`${item.fechaProgramada}-${item.fechaRealizada}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium tabular-nums text-fg">{formatDate(item.fechaRealizada)}</span>
                  {item.observaciones && <span className="block truncate text-xs text-fg-muted">{item.observaciones}</span>}
                </span>
                {item.resultado
                  ? <ToneBadge tone={item.resultado === 'CONFORME' ? 'success' : 'danger'}>{item.resultado === 'CONFORME' ? 'Conforme' : 'No conforme'}</ToneBadge>
                  : <ToneBadge tone="neutral">Realizada</ToneBadge>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Actividad del equipo">
        <SectionTitle>Actividad</SectionTitle>
        {actividad.length === 0 ? (
          <p className="text-[13px] text-fg-muted">Sin cambios registrados desde el módulo.</p>
        ) : (
          <>
            <ol className="relative space-y-3 border-l border-line pl-4">
              {actividadVisible.map(item => (
                <li key={item.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-fg/40" aria-hidden="true" />
                  <p className="text-[13px] font-medium text-fg">{ACCIONES_EQUIPO[item.accion] || item.accion}</p>
                  {item.detalle && <p className="mt-0.5 break-words text-xs leading-snug text-fg-muted">{item.detalle}</p>}
                  <p className="mt-0.5 text-xs text-fg-subtle">{[item.usuario, dateTime(item.fecha)].filter(Boolean).join(' · ')}</p>
                </li>
              ))}
            </ol>
            {actividad.length > ACTIVITY_VISIBLE && (
              <button type="button" onClick={() => setShowAll(value => !value)} className={cn(linkButton, 'mt-3')}>
                {showAll ? 'Mostrar menos' : `Ver toda la actividad (${actividad.length})`}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
