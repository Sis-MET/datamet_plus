import { useId, useMemo, useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { CancelButton, FieldLabel, Modal } from '../../calibration/components/primitives';
import { systemApi } from '../api/system';
import { fechaHora, pierdenAlRevocar } from '../domain/permisos';

/**
 * Revocar una concesión con su motivo. No se borra: queda con quién la revocó,
 * cuándo y por qué, y el historial guarda quiénes tenían el permiso antes.
 */
export function RevocarPermisoModal({ gestion, concesion, onClose, onSaved }) {
  const baseId = useId();
  const [motivo, setMotivo] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const permiso = gestion.catalogo.find(item => item.clave === concesion.permiso);
  const pierden = useMemo(() => pierdenAlRevocar(concesion, gestion.personal), [concesion, gestion.personal]);
  const error = motivo.trim() ? null : 'Escribe por qué se revoca el permiso.';

  const revocar = async (cerrar) => {
    setIntentado(true);
    if (error) {
      toast.error(error);
      return;
    }
    setGuardando(true);
    try {
      await systemApi.revocarPermiso(concesion.id, { motivo: motivo.trim() });
      toast.success(`Permiso revocado a ${concesion.sujeto}`);
      setGuardando(false);
      onSaved();
      cerrar();
    } catch (fallo) {
      toast.error(fallo.message || 'No se pudo revocar el permiso.');
      setGuardando(false);
    }
  };

  return (
    <Modal
      size="md"
      onClose={onClose}
      title="Revocar permiso"
      subtitle={permiso?.nombre || concesion.permiso}
      busy={guardando}
      footer={(cerrar) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={cerrar} disabled={guardando} />
          <button
            type="button"
            onClick={() => revocar(cerrar)}
            disabled={guardando}
            className="flex h-10 min-w-[128px] items-center justify-center gap-2 rounded-xl bg-danger px-4 text-sm font-semibold text-white shadow-xs transition-[background-color,transform] duration-150 hover:bg-danger/90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {guardando ? 'Revocando' : 'Revocar'}
          </button>
        </div>
      )}
    >
      <div className="space-y-5 px-5 py-6 sm:px-6">
        <dl className="grid gap-4 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-fg-subtle">Concedido a</dt>
            <dd className="mt-0.5 font-semibold text-fg">{concesion.sujeto}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-fg-subtle">Desde</dt>
            <dd className="mt-0.5 text-fg">{fechaHora(concesion.concedidoEn)} · {concesion.concedidoPor}</dd>
          </div>
          {concesion.motivo && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-fg-subtle">Motivo de la concesión</dt>
              <dd className="mt-0.5 leading-relaxed text-fg-muted">{concesion.motivo}</dd>
            </div>
          )}
        </dl>
        <p className="flex gap-2.5 rounded-xl border border-warning/35 bg-warning/[0.06] px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-muted">
          <Info className="mt-0.5 h-4 w-4 flex-none text-warning" aria-hidden="true" />
          <span>
            {pierden.length === 0
              ? 'Nadie lo pierde: quienes alcanza lo tienen también por otra concesión o por ser Sistemas.'
              : `Lo pierden ${pierden.length === 1 ? '1 persona' : `${pierden.length} personas`}: ${pierden.map(persona => persona.nombre).join(', ')}.`}
            {' '}Rige en su siguiente petición, sin cerrar su sesión.
          </span>
        </p>
        <div>
          <FieldLabel htmlFor={`${baseId}-motivo`}>Motivo</FieldLabel>
          <textarea
            id={`${baseId}-motivo`}
            data-autofocus
            value={motivo}
            maxLength={300}
            onChange={event => setMotivo(event.target.value)}
            placeholder="Por qué ya no corresponde, quién lo pidió."
            disabled={guardando}
            aria-invalid={intentado && error ? true : undefined}
            className={cn('field min-h-[84px] resize-y py-3 leading-relaxed', intentado && error && 'field-invalid')}
          />
          {intentado && error && <p className="field-error">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}
