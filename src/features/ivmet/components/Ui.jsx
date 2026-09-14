import React from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Inbox,
  Loader2,
  Search,
} from 'lucide-react';

const labels = {
  NEW: 'Recibido', IN_REVIEW: 'En revisión', WAITING_CLIENT: 'Esperando al cliente', RESOLVED: 'Resuelto',
  DRAFT: 'Borrador', PUBLISHED: 'Publicado', RETIRED: 'Retirado', PASS: 'Conforme', FAIL: 'No conforme', OMITTED: 'Omitida',
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  PENDING: 'Pendiente',
  GRACE: 'En gracia',
  SCHEDULED: 'Vigencia futura',
  PAST_DUE: 'En mora',
  EXPIRED: 'Vencido',
  SUSPENDED: 'Suspendido',
  CANCELLED: 'Cancelado',
  READY: 'Validado',
  REQUIRES_REVIEW: 'Revisar datos',
  QUARANTINED: 'En cuarentena',
  REVOKED: 'Revocado',
  PAID: 'Pagado',
  PARTIALLY_PAID: 'Pago parcial',
  VOID: 'Anulado',
  OVERDUE: 'Vencida',
  REQUESTED: 'En cola',
  QUEUED: 'Pendiente de importar',
  RETRYING: 'Recuperando importación',
  SUCCEEDED: 'Completado',
  PARTIAL: 'Parcial',
  FAILED: 'Fallido',
  RUNNING: 'En curso',
  ANNULLED: 'Anulado',
  MONTHLY: 'Mensual',
  ANNUAL: 'Anual',
};
export function Badge({ value, children }) {
  const tone = ['ACTIVE', 'READY', 'PAID', 'SUCCEEDED', 'PASS', 'RESOLVED', 'PUBLISHED'].includes(value)
    ? 'good'
    : [
          'PENDING',
          'GRACE',
          'PAST_DUE',
          'REQUIRES_REVIEW',
          'PARTIALLY_PAID',
          'REQUESTED',
          'QUEUED',
          'RETRYING',
          'RUNNING',
          'NEW', 'IN_REVIEW', 'WAITING_CLIENT',
        ].includes(value)
      ? 'warn'
      : [
            'SUSPENDED',
            'CANCELLED',
            'QUARANTINED',
            'FAILED',
            'OVERDUE',
            'EXPIRED',
            'FAIL',
          ].includes(value)
        ? 'bad'
        : 'muted';
  return (
    <span className={`iv-badge ${tone}`}>
      <i />
      {children || labels[value] || value}
    </span>
  );
}
export function Loading() {
  return (
    <div className="iv-loading" role="status">
      <Loader2 className="animate-spin" size={22} />
      <span>Cargando información…</span>
    </div>
  );
}
export function Empty({ title = 'Sin registros', text, action }) {
  return (
    <div className="iv-empty">
      <span className="iv-empty-icon">
        <Inbox size={25} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function ErrorBox({ error }) {
  return (
    <div className="iv-error" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>No pudimos completar la consulta</strong>
        <p>{error?.message || String(error)}</p>
      </div>
    </div>
  );
}
export function QueryState({ query, children }) {
  return query.loading ? (
    <Loading />
  ) : query.error ? (
    <>
      <ErrorBox error={query.error} />
      {query.data && (
        <>
          <p className="iv-subtle">
            Mostrando la última información recibida; no se pudo actualizar.
          </p>
          {children}
        </>
      )}
    </>
  ) : (
    children
  );
}
export function SearchInput({ value, onChange, placeholder = 'Buscar…' }) {
  return (
    <div className="iv-search">
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function Pagination({ page, total, pageSize = 20, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="iv-pagination">
      <span>
        {total} registros · Página {page} de {pages}
      </span>
      <div>
        <button
          type="button"
          className="iv-icon-button"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          type="button"
          className="iv-icon-button"
          aria-label="Página siguiente"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function Stat({ label, value, note, icon }) {
  return (
    <article className="iv-stat">
      <span>{label}</span>
      <div>
        <strong>{value ?? '—'}</strong>
        {icon}
      </div>
      {note && <small>{note}</small>}
    </article>
  );
}
export function SectionTitle({ eyebrow, title, description, action }) {
  return (
    <div className="iv-section-heading">
      <div>
        {eyebrow && <span className="iv-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
