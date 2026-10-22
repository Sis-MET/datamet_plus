import { useId, useState } from 'react';
import { CancelButton, FieldLabel, Modal, PrimaryButton } from '../../calibration/components/primitives';

/**
 * Pide el motivo de un cambio en un informe emitido (NB/ISO/IEC 17025,
 * 7.5.2): queda en el historial junto con el dato anterior y el nuevo.
 */
export function MotivoModal({
  titulo, descripcion, accion = 'Guardar corrección', etiqueta = 'Motivo del cambio',
  placeholder = 'Por ejemplo: el técnico registró mal la serie del instrumento.', onClose, onConfirm,
}) {
  const baseId = useId();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const confirmar = async (close) => {
    const texto = motivo.trim();
    if (texto.length < 10) {
      setError('Escriba el motivo (al menos 10 caracteres).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(texto);
      close();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      size="md"
      title={titulo}
      subtitle="El informe ya fue emitido"
      onClose={onClose}
      busy={busy}
      footer={(close) => (
        <>
          <CancelButton onClick={close} disabled={busy} />
          <div className="ml-auto">
            <PrimaryButton onClick={() => confirmar(close)} busy={busy}>{accion}</PrimaryButton>
          </div>
        </>
      )}
    >
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <p className="text-[13px] leading-relaxed text-fg-muted">
          {descripcion || 'Un informe emitido no se sobrescribe: el cambio queda en su historial con el dato anterior, el nuevo, quién lo hizo, cuándo y este motivo, y el informe pasa a la siguiente revisión.'}
        </p>
        <div>
          <FieldLabel htmlFor={`${baseId}-motivo`}>{etiqueta}</FieldLabel>
          <textarea
            id={`${baseId}-motivo`}
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            rows={3}
            maxLength={500}
            disabled={busy}
            data-autofocus
            placeholder={placeholder}
            className="field resize-y py-3 leading-relaxed"
          />
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
