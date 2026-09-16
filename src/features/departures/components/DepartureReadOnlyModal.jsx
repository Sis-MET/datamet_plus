import React, { useEffect, useRef } from 'react';
import { X, MapPin, Clock, Calendar, Info, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePageScrollLock } from '../../../shared/hooks/usePageScrollLock';

function getStateColor(estado) {
  switch (estado) {
    case 'Aprobado':
    case 'Completado': return 'bg-success/10 text-success ring-success/25';
    case 'Aceptado':
    case 'En Proceso': return 'bg-info/10 text-info ring-info/25';
    case 'Cancelado': return 'bg-danger/10 text-danger ring-danger/25';
    case 'Solicitud':
    default: return 'bg-warning/10 text-warning ring-warning/25';
  }
}

function Detail({ label, icon, children, className = '' }) {
  const Icon = icon;
  return (
    <div className={className}>
      <p className="mb-1 text-xs text-fg-subtle">{label}</p>
      <div className="flex items-center gap-2 text-sm font-medium text-fg">
        {Icon && <Icon size={15} className="shrink-0 text-fg-muted" aria-hidden="true" />}
        {children}
      </div>
    </div>
  );
}

export function DepartureReadOnlyModal({ task, date, resourceName, onClose }) {
  usePageScrollLock(Boolean(task));
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!task) return null;

  return (
    <div className="scrim fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="departure-detail-title"
        className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-[22px] border border-line bg-surface shadow-dialog animate-fade-in-up"
      >
        {/* Cabecera */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10" style={{ backgroundColor: task.colorAM || '#7c3aed' }} />
            <h3 id="departure-detail-title" className="truncate text-base font-semibold text-fg">
              Detalle de Salida Personal
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-5">
          <div className="grid grid-cols-2 gap-4">
            <Detail label="Personal" icon={User}>{resourceName || 'Desconocido'}</Detail>
            <Detail label="Fecha" icon={Calendar}>
              <span className="capitalize">{date ? format(date, "d MMM, yyyy", { locale: es }) : 'N/A'}</span>
            </Detail>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Detail label="Tipo de Salida" icon={MapPin}>{task.morning || 'No especificado'}</Detail>
            <div>
              <p className="mb-1 text-xs text-fg-subtle">Estado</p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${getStateColor(task.estadoAM)}`}>
                {task.estadoAM || 'Pendiente'}
              </span>
            </div>
          </div>

          <Detail label="Rango Horario" icon={Clock}>
            <span className="tabular-nums">{task.horaInicio || '08:30'} – {task.horaFin || '18:30'}</span>
          </Detail>

          <div>
            <p className="mb-1.5 text-xs text-fg-subtle">Motivo / Lugar</p>
            <div className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-fg">
              {task.descripcion || 'Sin descripción...'}
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="flex shrink-0 items-center justify-between border-t border-line px-5 py-3">
          <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <Info size={13} aria-hidden="true" />
            <span>Módulo de Salidas</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
