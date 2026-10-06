import { useId, useState } from 'react';
import { toast } from 'sonner';
import { CancelButton, FieldLabel, Modal, ModalSection } from './primitives';

/**
 * Confirmación de una acción que se explica y, si corresponde, pide motivo:
 * dar de baja, anular un certificado o reactivar un equipo.
 */
export function ReasonModal({
  title,
  subtitle,
  heading,
  description,
  children,
  confirmLabel,
  danger = false,
  requireReason = true,
  reasonLabel = 'Motivo',
  reasonPlaceholder,
  onConfirm,
  onClose,
}) {
  const baseId = useId();
  const [motivo, setMotivo] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const missing = requireReason && motivo.trim().length < 3;

  const confirm = async (close) => {
    setAttempted(true);
    if (missing) return;
    setSaving(true);
    try {
      await onConfirm(motivo.trim() || null);
      setSaving(false);
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo completar la acción.');
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      title={title}
      subtitle={subtitle}
      busy={saving}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={saving} />
          <button
            type="button"
            onClick={() => confirm(close)}
            disabled={saving}
            className={danger
              ? 'flex h-10 min-w-[128px] items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-red-700 disabled:opacity-50'
              : 'flex h-10 min-w-[128px] items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg shadow-xs ring-1 ring-inset ring-black/5 transition-colors hover:bg-brand-hover disabled:opacity-50'}
          >
            {saving ? 'Guardando' : confirmLabel}
          </button>
        </div>
      )}
    >
      <ModalSection title={heading} description={description}>
        {children && <div className="mb-5">{children}</div>}
        <div>
          <FieldLabel htmlFor={`${baseId}-motivo`} hint={requireReason ? undefined : '(opcional)'}>{reasonLabel}</FieldLabel>
          <textarea
            id={`${baseId}-motivo`}
            data-autofocus
            value={motivo}
            maxLength={300}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder={reasonPlaceholder}
            disabled={saving}
            aria-invalid={attempted && missing ? true : undefined}
            className={attempted && missing ? 'field field-invalid min-h-[96px] resize-y py-3 leading-relaxed' : 'field min-h-[96px] resize-y py-3 leading-relaxed'}
          />
          {attempted && missing && <p className="field-error">Escribe el motivo (al menos 3 caracteres).</p>}
        </div>
      </ModalSection>
    </Modal>
  );
}
