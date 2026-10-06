import { useId, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import {
  CancelButton,
  FieldLabel,
  Modal,
  ModalSection,
  PrimaryButton,
  Segmented,
} from '../../calibration/components/primitives';
import { systemApi } from '../api/system';
import { boliviaToday } from '../domain/system';

const STEPS = {
  validacion: {
    title: 'Registrar validación',
    heading: 'Cómo se comprobó que funciona',
    description: 'Casos probados, datos usados y resultado. Si no es conforme, el cambio vuelve a quedar por validar.',
    confirm: 'Registrar validación',
  },
  aprobacion: {
    title: 'Aprobar o rechazar',
    heading: 'Decisión sobre el cambio',
    description: 'La aprobación autoriza implementarlo. Un cambio aprobado o rechazado ya no se edita.',
    confirm: 'Registrar decisión',
  },
  implementacion: {
    title: 'Registrar implementación',
    heading: 'Puesta en producción',
    description: 'Desde cuándo el cambio está en uso.',
    confirm: 'Registrar implementación',
  },
};

/** Validación, aprobación o implementación de un cambio. */
export function ChangeStepModal({ step, cambio, onClose, onSaved }) {
  const baseId = useId();
  const config = STEPS[step];
  const [validacion, setValidacion] = useState('');
  const [resultado, setResultado] = useState('CONFORME');
  const [decision, setDecision] = useState('APROBAR');
  const [fecha, setFecha] = useState(boliviaToday());
  const [observaciones, setObservaciones] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const error = step === 'validacion' && !validacion.trim()
    ? 'Describe cómo se validó.'
    : step === 'aprobacion' && decision === 'RECHAZAR' && !observaciones.trim()
      ? 'Escribe por qué se rechaza.'
      : step === 'implementacion' && !fecha ? 'Indica la fecha.' : null;

  const save = async (close) => {
    setAttempted(true);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const notes = observaciones.trim() || null;
      if (step === 'validacion') await systemApi.validarCambio(cambio.id, { validacion: validacion.trim(), resultado });
      if (step === 'aprobacion') await systemApi.aprobarCambio(cambio.id, { decision, observaciones: notes });
      if (step === 'implementacion') await systemApi.implementarCambio(cambio.id, { fecha, observaciones: notes });
      toast.success(`${cambio.codigo}: ${step === 'validacion' ? 'validación registrada' : step === 'aprobacion' ? (decision === 'APROBAR' ? 'aprobado' : 'rechazado') : 'implementación registrada'}`);
      setSaving(false);
      onSaved();
      close();
    } catch (saveError) {
      toast.error(saveError.message || 'No se pudo registrar.');
      setSaving(false);
    }
  };

  const notesField = (label, placeholder, required = false) => (
    <div>
      <FieldLabel htmlFor={`${baseId}-obs`} hint={required ? undefined : '(opcional)'}>{label}</FieldLabel>
      <textarea
        id={`${baseId}-obs`}
        value={observaciones}
        maxLength={500}
        onChange={(event) => setObservaciones(event.target.value)}
        placeholder={placeholder}
        disabled={saving}
        aria-invalid={attempted && required && error ? true : undefined}
        className={cn('field min-h-[96px] resize-y py-3 leading-relaxed', attempted && required && error && 'field-invalid')}
      />
    </div>
  );

  return (
    <Modal
      onClose={onClose}
      size="md"
      title={config.title}
      subtitle={`${cambio.codigo} · ${cambio.titulo}`}
      busy={saving}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={saving} />
          <PrimaryButton onClick={() => save(close)} busy={saving}>{config.confirm}</PrimaryButton>
        </div>
      )}
    >
      <ModalSection title={config.heading} description={config.description}>
        <div className="space-y-5">
          {step === 'validacion' && (
            <>
              <div>
                <FieldLabel htmlFor={`${baseId}-validacion`}>Validación</FieldLabel>
                <textarea
                  id={`${baseId}-validacion`}
                  data-autofocus
                  value={validacion}
                  maxLength={2000}
                  onChange={(event) => setValidacion(event.target.value)}
                  placeholder="Ej.: pruebas automáticas del módulo y prueba manual del alta, la corrección y la revisión con la base de prueba."
                  disabled={saving}
                  aria-invalid={attempted && error ? true : undefined}
                  className={cn('field min-h-[148px] resize-y py-3 leading-relaxed', attempted && error && 'field-invalid')}
                />
                {attempted && error && <p className="field-error">{error}</p>}
              </div>
              <div>
                <p className="field-label">Resultado</p>
                <Segmented
                  label="Resultado"
                  value={resultado}
                  onChange={setResultado}
                  options={[{ value: 'CONFORME', label: 'Conforme' }, { value: 'NO_CONFORME', label: 'No conforme' }]}
                  className="cal-segmented-fill"
                />
              </div>
            </>
          )}

          {step === 'aprobacion' && (
            <>
              <Segmented
                label="Decisión"
                value={decision}
                onChange={setDecision}
                options={[{ value: 'APROBAR', label: 'Aprobar' }, { value: 'RECHAZAR', label: 'Rechazar' }]}
                className="cal-segmented-fill"
              />
              {cambio.aPosteriori && decision === 'APROBAR' && (
                <p className="cal-hint">Se aprueba a posteriori: el cambio ya está en uso y queda constancia de su validación y aprobación.</p>
              )}
              {notesField(decision === 'RECHAZAR' ? 'Motivo del rechazo' : 'Observaciones', decision === 'RECHAZAR' ? 'Qué falta o por qué no se implementa.' : 'Condiciones o comentarios de la aprobación.', decision === 'RECHAZAR')}
              {attempted && error && <p className="field-error">{error}</p>}
            </>
          )}

          {step === 'implementacion' && (
            <>
              <div>
                <FieldLabel htmlFor={`${baseId}-fecha`}>En producción desde</FieldLabel>
                <input
                  id={`${baseId}-fecha`}
                  type="date"
                  value={fecha}
                  max={boliviaToday()}
                  onChange={(event) => setFecha(event.target.value)}
                  disabled={saving}
                  className="field h-11 font-medium tabular-nums"
                />
              </div>
              {notesField('Observaciones', 'Ej.: desplegado en el servidor del laboratorio y migración 007 aplicada.')}
            </>
          )}
        </div>
      </ModalSection>
    </Modal>
  );
}
