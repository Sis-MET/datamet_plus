import { useId, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { boliviaToday } from '../../system/domain/system';
import { calibrationApi } from '../api/calibration';
import { CLASES_VERSION } from '../domain/servicemet';
import {
  CancelButton,
  FieldLabel,
  Modal,
  ModalSection,
  PrimaryButton,
  Segmented,
  ToneBadge,
} from './primitives';

const STEPS = {
  validacion: {
    title: 'Registrar validación',
    heading: 'Cómo se comprobó que funciona',
    description: 'Pruebas automáticas, casos funcionales con datos de referencia y, si aplica, ida y vuelta contra DataMET y migración sobre la versión anterior. Si no es conforme, la versión no se puede aprobar.',
    confirm: 'Registrar validación',
  },
  decision: {
    title: 'Decisión del jefe de Calibración',
    heading: '¿Se puede usar en los servicios?',
    description: 'Tu aprobación autoriza distribuirla a los teléfonos de los técnicos. Una versión aprobada o no aprobada ya no se edita.',
    confirm: 'Registrar decisión',
  },
  puesta: {
    title: 'Registrar puesta en uso',
    heading: 'Desde cuándo la usan los técnicos',
    description: 'La fecha en que se instaló en los teléfonos.',
    confirm: 'Registrar puesta en uso',
  },
};

/** Validación (Sistemas), decisión (jefe de Calibración) o puesta en uso de una versión. */
export function ServiceMetStepModal({ step, version, onClose, onSaved }) {
  const baseId = useId();
  const config = STEPS[step];
  const puedeAprobar = Boolean(version.acciones.aprobar);
  const [validacion, setValidacion] = useState('');
  const [resultado, setResultado] = useState('CONFORME');
  const [registro, setRegistro] = useState(version.registroValidacion || `VAL-${version.version}`);
  const [decision, setDecision] = useState(puedeAprobar ? 'APROBAR' : 'RECHAZAR');
  const [fecha, setFecha] = useState(boliviaToday());
  const [dispositivos, setDispositivos] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const error = step === 'validacion' && !validacion.trim()
    ? 'Describe cómo se validó.'
    : step === 'decision' && decision === 'RECHAZAR' && !observaciones.trim()
      ? 'Escribe por qué no se aprueba.'
      : step === 'puesta' && !fecha
        ? 'Indica la fecha.'
        : step === 'puesta' && fecha < version.fecha
          ? 'La versión no puede estar en uso antes de su fecha.'
          : null;

  const save = async (close) => {
    setAttempted(true);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const notes = observaciones.trim() || null;
      if (step === 'validacion') {
        await calibrationApi.validarServicemet(version.id, { validacion: validacion.trim(), resultado, registro: registro.trim() || null });
      }
      if (step === 'decision') await calibrationApi.decidirServicemet(version.id, { decision, observaciones: notes });
      if (step === 'puesta') {
        await calibrationApi.ponerServicemetEnUso(version.id, { fecha, dispositivos: dispositivos.trim() || null, observaciones: notes });
      }
      toast.success(`ServiceMET ${version.version}: ${step === 'validacion'
        ? 'validación registrada'
        : step === 'decision' ? (decision === 'APROBAR' ? 'aprobada para uso' : 'no aprobada') : 'puesta en uso registrada'}`);
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

  const clase = CLASES_VERSION[version.clase];

  return (
    <Modal
      onClose={onClose}
      size="md"
      title={config.title}
      subtitle={`ServiceMET ${version.version}`}
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
                  placeholder="Ej.: flutter test 507 aprobadas / 0 fallidas y backend 115 / 0 (20/10/2026). Casos funcionales F-01 a F-06 conformes en un Samsung A54 con Android 14. Ida y vuelta contra DataMET conforme."
                  disabled={saving}
                  aria-invalid={attempted && error ? true : undefined}
                  className={cn('field min-h-[148px] resize-y py-3 leading-relaxed', attempted && error && 'field-invalid')}
                />
                {attempted && error && <p className="field-error">{error}</p>}
              </div>
              <div>
                <FieldLabel htmlFor={`${baseId}-registro`} hint="(opcional)">Registro de validación</FieldLabel>
                <input
                  id={`${baseId}-registro`}
                  value={registro}
                  maxLength={60}
                  onChange={(event) => setRegistro(event.target.value)}
                  placeholder={`VAL-${version.version}`}
                  disabled={saving}
                  className="field h-11 tabular-nums"
                />
                <p className="cal-hint mt-1.5">El documento con el detalle de las pruebas (docs/iso17025/validaciones en ServiceMET).</p>
              </div>
              <div>
                <p className="field-label">Resultado</p>
                <Segmented
                  label="Resultado"
                  value={resultado}
                  onChange={setResultado}
                  disabled={saving}
                  options={[{ value: 'CONFORME', label: 'Conforme' }, { value: 'NO_CONFORME', label: 'No conforme' }]}
                  className="cal-segmented-fill"
                />
              </div>
            </>
          )}

          {step === 'decision' && (
            <>
              <div className="rounded-xl border border-line bg-surface-2/50 px-4 py-3.5">
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-fg">
                  <ToneBadge tone={clase.tone}>Clase {version.clase} · {clase.label}</ToneBadge>
                  {version.validacionResultado === 'CONFORME' && <ToneBadge tone="success">Validación conforme</ToneBadge>}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-fg">{version.resumen}</p>
                {version.impacto && (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-fg-muted">
                    <span className="font-semibold text-fg">Impacto en los registros: </span>{version.impacto}
                  </p>
                )}
                {version.validacion && (
                  <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-fg-muted">
                    <span className="font-semibold text-fg">Validación{version.registroValidacion ? ` (${version.registroValidacion})` : ''}: </span>{version.validacion}
                  </p>
                )}
              </div>
              {puedeAprobar ? (
                <Segmented
                  label="Decisión"
                  value={decision}
                  onChange={setDecision}
                  disabled={saving}
                  options={[{ value: 'APROBAR', label: 'Aprobar para uso' }, { value: 'RECHAZAR', label: 'No aprobar' }]}
                  className="cal-segmented-fill"
                />
              ) : (
                <p className="cal-hint">
                  Para aprobarla falta que Sistemas registre una validación conforme. Mientras tanto puedes registrarla como no aprobada.
                </p>
              )}
              {version.aPosteriori && decision === 'APROBAR' && (
                <p className="cal-hint">Se registró después de liberarse: tu aprobación queda como aprobación a posteriori.</p>
              )}
              {notesField(
                decision === 'RECHAZAR' ? 'Motivo' : 'Observaciones',
                decision === 'RECHAZAR' ? 'Qué falta o por qué no debe usarse.' : 'Condiciones o comentarios de la aprobación.',
                decision === 'RECHAZAR'
              )}
              {attempted && error && <p className="field-error">{error}</p>}
            </>
          )}

          {step === 'puesta' && (
            <>
              <div>
                <FieldLabel htmlFor={`${baseId}-fecha`}>En uso desde</FieldLabel>
                <input
                  id={`${baseId}-fecha`}
                  type="date"
                  data-autofocus
                  value={fecha}
                  min={version.fecha}
                  max={boliviaToday()}
                  onChange={(event) => setFecha(event.target.value)}
                  disabled={saving}
                  aria-invalid={attempted && error ? true : undefined}
                  className={cn('field h-11 font-medium tabular-nums', attempted && error && 'field-invalid')}
                />
                {attempted && error && <p className="field-error">{error}</p>}
              </div>
              <div>
                <FieldLabel htmlFor={`${baseId}-dispositivos`} hint="(opcional)">Teléfonos actualizados</FieldLabel>
                <input
                  id={`${baseId}-dispositivos`}
                  value={dispositivos}
                  maxLength={500}
                  onChange={(event) => setDispositivos(event.target.value)}
                  placeholder="Ej.: los 6 teléfonos de calibración y soporte"
                  disabled={saving}
                  className="field h-11"
                />
              </div>
              {notesField('Observaciones', 'Ej.: distribuida por Google Play (prueba interna) y scripts 012 a 016 ejecutados en DataMET.')}
            </>
          )}
        </div>
      </ModalSection>
    </Modal>
  );
}
