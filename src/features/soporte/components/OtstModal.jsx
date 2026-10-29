import { useId, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { CancelButton, FieldLabel, Modal, PrimaryButton } from '../../calibration/components/primitives';
import { FORMATO_OTST, normalizarOtst, numeroInforme } from '../domain/informe';

/**
 * Cambia la OTST del informe con su motivo. La fila de ServiceMET no se
 * modifica: la OTST nueva queda en el informe, su número se recalcula y el
 * historial guarda la anterior, la nueva, quién, cuándo y el motivo
 * (NB/ISO/IEC 17025, 7.5.2).
 */
export function OtstModal({ informe, onClose, onConfirm }) {
  const baseId = useId();
  const [otst, setOtst] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const actual = informe.otst || '';
  const nueva = normalizarOtst(otst);
  const valida = FORMATO_OTST.test(nueva) && nueva.length <= 50;
  const numeroNuevo = valida ? numeroInforme(nueva, informe.fuente?.cod_metrica) : null;
  const revisionAbierta = informe.revisionAbierta?.revision ?? null;

  const confirmar = async (close) => {
    if (!nueva) return setError('Escriba la nueva OTST.');
    if (!valida) return setError('La OTST lleva letras, números y guiones, por ejemplo 26-0285-51-S01.');
    if (nueva === actual) return setError(`La OTST del informe ya es ${actual}.`);
    if (motivo.trim().length < 10) return setError('Escriba el motivo (al menos 10 caracteres).');
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ otst: nueva, motivo: motivo.trim() });
      close();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Modal
      size="md"
      title="Cambiar la OTST"
      subtitle={`Informe N° ${informe.numero}`}
      onClose={onClose}
      busy={busy}
      footer={(close) => (
        <>
          <CancelButton onClick={close} disabled={busy} />
          <div className="ml-auto">
            <PrimaryButton onClick={() => confirmar(close)} busy={busy}>Cambiar OTST</PrimaryButton>
          </div>
        </>
      )}
    >
      <form
        className="space-y-4 px-5 py-5 sm:px-6"
        onSubmit={(event) => { event.preventDefault(); }}
      >
        <p className="text-[13px] leading-relaxed text-fg-muted">
          El registro de ServiceMET no se modifica. La OTST nueva queda en el informe, su número se recalcula y el historial guarda
          la anterior, la nueva, quién la cambió, cuándo y el motivo.
          {revisionAbierta !== null && ` El cambio va en el borrador de la Rev. ${revisionAbierta}; la Rev. ${informe.revision} conserva su número.`}
        </p>

        <dl className="grid gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-fg-muted">OTST actual</dt>
            <dd className="mt-0.5 font-mono font-semibold text-fg">{actual || 'Sin OTST'}</dd>
          </div>
          {informe.otstOriginal && informe.otstOriginal !== actual && (
            <div>
              <dt className="text-fg-muted">Registrada en ServiceMET</dt>
              <dd className="mt-0.5 font-mono text-fg">{informe.otstOriginal}</dd>
            </div>
          )}
        </dl>

        <div>
          <FieldLabel htmlFor={`${baseId}-otst`}>Nueva OTST</FieldLabel>
          <input
            id={`${baseId}-otst`}
            value={otst}
            onChange={(event) => { setOtst(event.target.value.toUpperCase()); setError(null); }}
            maxLength={60}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            data-autofocus
            placeholder="26-0285-51-S01"
            className="field h-11 font-mono font-medium uppercase tracking-wide"
          />
          {numeroNuevo && nueva !== actual && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-fg-muted">
              Número del informe:
              <span className="font-mono text-fg-subtle line-through decoration-fg/30">{informe.numero}</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
              <span className="font-mono font-semibold text-fg">{numeroNuevo}</span>
            </p>
          )}
        </div>

        <div>
          <FieldLabel htmlFor={`${baseId}-motivo`}>Motivo del cambio</FieldLabel>
          <textarea
            id={`${baseId}-motivo`}
            value={motivo}
            onChange={(event) => { setMotivo(event.target.value); setError(null); }}
            rows={3}
            maxLength={500}
            disabled={busy}
            placeholder="Por ejemplo: ServiceMET registró la OTST de otra visita; la orden correcta es la del cliente."
            className="field resize-y py-3 leading-relaxed"
          />
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
