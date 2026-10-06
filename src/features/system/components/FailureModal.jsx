import { useCallback, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { Dropdown } from '../../calibration/components/Dropdown';
import {
  CancelButton,
  FieldLabel,
  Modal,
  ModalColumns,
  ModalSection,
  PrimaryButton,
  Segmented,
  ToneBadge,
} from '../../calibration/components/primitives';
import { systemApi } from '../api/system';
import { ESTADOS_FALLA, ORIGENES_FALLA, boliviaDateTimeInput } from '../domain/system';
import { useResource } from '../hooks/useResource';

const dateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })
  : '—');

const ESTADO_OPTIONS = Object.entries(ESTADOS_FALLA).map(([value, { label }]) => ({ value, label }));

function TextField({ id, label, hint, value, onChange, placeholder, disabled, error, rows = 'min-h-[84px]', max = 1000 }) {
  return (
    <div>
      <FieldLabel htmlFor={id} hint={hint}>{label}</FieldLabel>
      <textarea
        id={id}
        value={value}
        maxLength={max}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        className={cn('field resize-y py-3 leading-relaxed', rows, error && 'field-invalid')}
      />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

function Fact({ label, children, wide = false }) {
  return (
    <div className={wide ? 'col-span-full' : undefined}>
      <dt>{label}</dt>
      <dd className="font-normal">{children}</dd>
    </div>
  );
}

/**
 * Ficha de una falla: qué pasó y su atención. Cerrarla exige la acción
 * inmediata y la correctiva; descartarla, el motivo. Cerrada ya no se edita.
 */
export function FailureModal({ fallaId, cambios, onClose, onSaved }) {
  const baseId = useId();
  const load = useCallback(() => systemApi.falla(fallaId), [fallaId]);
  const { data: falla, error } = useResource(load);
  const [form, setForm] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  // El formulario arranca con lo que ya tiene la falla.
  const values = form || (falla && {
    estado: falla.estado,
    impacto: falla.impacto || '',
    accionInmediata: falla.accionInmediata || '',
    causa: falla.causa || '',
    accionCorrectiva: falla.accionCorrectiva || '',
    cambioId: falla.cambio?.id ?? null,
  });
  const set = (patch) => setForm({ ...values, ...patch });
  const editable = Boolean(falla?.abierta);

  const errors = values ? {
    accionInmediata: values.estado === 'CERRADA' && !values.accionInmediata.trim() ? 'Para cerrarla, registra la acción inmediata.' : null,
    accionCorrectiva: values.estado === 'CERRADA' && !values.accionCorrectiva.trim() ? 'Para cerrarla, registra la acción correctiva.' : null,
    causa: values.estado === 'DESCARTADA' && !values.causa.trim() ? 'Para descartarla, explica el motivo.' : null,
  } : {};

  const save = async (close) => {
    setAttempted(true);
    const firstError = Object.values(errors).find(Boolean);
    if (firstError) {
      toast.error(firstError);
      return;
    }
    setSaving(true);
    try {
      await systemApi.atenderFalla(falla.id, {
        estado: values.estado,
        impacto: values.impacto.trim() || null,
        accionInmediata: values.accionInmediata.trim() || null,
        causa: values.causa.trim() || null,
        accionCorrectiva: values.accionCorrectiva.trim() || null,
        cambioId: values.cambioId,
      });
      toast.success(`F-${falla.id}: ${ESTADOS_FALLA[values.estado].label.toLowerCase()}`);
      setSaving(false);
      onSaved();
      close();
    } catch (saveError) {
      toast.error(saveError.message || 'No se pudo guardar.');
      setSaving(false);
    }
  };

  const cambioOptions = [
    { value: '', label: 'Ninguno' },
    ...(cambios || []).map(cambio => ({ value: cambio.id, label: `${cambio.codigo} · ${cambio.titulo}`, group: cambio.version ? `Versión ${cambio.version}` : 'Sin versión' })),
  ];

  return (
    <Modal
      onClose={onClose}
      title={falla ? `F-${falla.id} · ${falla.mensaje}` : 'Falla'}
      subtitle={falla && (
        <>
          <span className="font-medium text-fg">{ORIGENES_FALLA[falla.origen]}</span>
          <span aria-hidden="true" className="px-1.5 text-fg-subtle">·</span>
          {falla.ocurrencias > 1 ? `${falla.ocurrencias} veces, la última ${dateTime(falla.ultimaVez)}` : dateTime(falla.primeraVez)}
        </>
      )}
      busy={saving}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          {editable ? (
            <>
              <CancelButton onClick={close} disabled={saving} />
              <PrimaryButton onClick={() => save(close)} busy={saving}>Guardar</PrimaryButton>
            </>
          ) : <CancelButton onClick={close}>Cerrar</CancelButton>}
        </div>
      )}
    >
      {!falla && !error && (
        <p className="flex items-center gap-2 p-6 text-[13px] text-fg-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando la falla…
        </p>
      )}
      {!falla && error && <p className="p-6 text-[13px] text-danger" role="alert">No se pudo cargar la falla: {error.message}</p>}
      {falla && (
        <ModalColumns>
          <ModalSection
            title="Qué pasó"
            description="Lo que registró el sistema."
            action={<ToneBadge tone={ESTADOS_FALLA[falla.estado].tone}>{ESTADOS_FALLA[falla.estado].label}</ToneBadge>}
          >
            <p className="max-w-[68ch] whitespace-pre-line break-words text-[13.5px] leading-relaxed text-fg">{falla.mensaje}</p>
            <dl className="cal-facts mt-5">
              <Fact label="Primera vez">{dateTime(falla.primeraVez)}</Fact>
              <Fact label="Última vez">{dateTime(falla.ultimaVez)}</Fact>
              <Fact label="Ocurrencias">{falla.ocurrencias}</Fact>
              <Fact label="Código">{falla.estadoHttp || '—'}</Fact>
              {falla.ruta && <Fact label="Ruta" wide>{falla.ruta}</Fact>}
              {falla.usuario && <Fact label="Usuario">{falla.usuario}</Fact>}
              {falla.registradoPor && <Fact label="Registrada por">{falla.registradoPor}</Fact>}
              {falla.atendidoPor && <Fact label="Atendida por">{`${falla.atendidoPor} · ${dateTime(falla.atendidoEn)}`}</Fact>}
              {falla.cerradoPor && <Fact label={falla.estado === 'DESCARTADA' ? 'Descartada por' : 'Cerrada por'}>{`${falla.cerradoPor} · ${dateTime(falla.cerradoEn)}`}</Fact>}
            </dl>
            {falla.detalle && (
              <details className="mt-6 border-t border-line pt-5">
                <summary className="cursor-pointer text-[13px] font-semibold text-fg">Detalle técnico</summary>
                <pre className="sys-trace mt-3">{falla.detalle}</pre>
              </details>
            )}
          </ModalSection>

          <ModalSection
            aside
            title="Atención"
            description={editable ? 'Acción inmediata, causa y acción correctiva (7.11.3 e).' : 'Registro de la atención de esta falla.'}
          >
            {editable ? (
              <div className="space-y-5">
                <Segmented label="Estado" value={values.estado} onChange={(estado) => set({ estado })} options={ESTADO_OPTIONS} className="cal-segmented-fill" />
                <TextField id={`${baseId}-impacto`} label="Impacto" hint="(opcional)" value={values.impacto} max={500} onChange={(impacto) => set({ impacto })} placeholder="A quién o qué afectó." disabled={saving} />
                <TextField id={`${baseId}-inmediata`} label="Acción inmediata" value={values.accionInmediata} onChange={(accionInmediata) => set({ accionInmediata })} placeholder="Qué se hizo para contenerla." disabled={saving} error={attempted && errors.accionInmediata} />
                <TextField id={`${baseId}-causa`} label={values.estado === 'DESCARTADA' ? 'Motivo para descartarla' : 'Causa'} hint={values.estado === 'DESCARTADA' ? undefined : '(opcional)'} value={values.causa} onChange={(causa) => set({ causa })} placeholder={values.estado === 'DESCARTADA' ? 'Ej.: no fue una falla del sistema.' : 'Por qué ocurrió.'} disabled={saving} error={attempted && errors.causa} />
                <TextField id={`${baseId}-correctiva`} label="Acción correctiva" value={values.accionCorrectiva} onChange={(accionCorrectiva) => set({ accionCorrectiva })} placeholder="Qué se cambió para que no vuelva a ocurrir." disabled={saving} error={attempted && errors.accionCorrectiva} />
                <div>
                  <FieldLabel htmlFor={`${baseId}-cambio`} hint="(opcional)">Cambio que la corrige</FieldLabel>
                  <Dropdown
                    id={`${baseId}-cambio`}
                    value={values.cambioId ?? ''}
                    onChange={(value) => set({ cambioId: value === '' ? null : Number(value) })}
                    options={cambioOptions}
                    disabled={saving}
                  />
                </div>
              </div>
            ) : (
              <dl className="cal-facts">
                <Fact label="Impacto" wide>{falla.impacto || '—'}</Fact>
                <Fact label="Acción inmediata" wide>{falla.accionInmediata || '—'}</Fact>
                <Fact label={falla.estado === 'DESCARTADA' ? 'Motivo' : 'Causa'} wide>{falla.causa || '—'}</Fact>
                <Fact label="Acción correctiva" wide>{falla.accionCorrectiva || '—'}</Fact>
                <Fact label="Cambio que la corrige" wide>{falla.cambio ? `${falla.cambio.codigo} · ${falla.cambio.titulo}` : '—'}</Fact>
              </dl>
            )}
          </ModalSection>
        </ModalColumns>
      )}
    </Modal>
  );
}

/** Falla que la aplicación no pudo registrar sola: servidor caído, red, base de datos. */
export function NewFailureModal({ onClose, onSaved }) {
  const baseId = useId();
  const [mensaje, setMensaje] = useState('');
  const [ocurrida, setOcurrida] = useState(() => boliviaDateTimeInput());
  const [impacto, setImpacto] = useState('');
  const [accionInmediata, setAccionInmediata] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const error = !mensaje.trim() ? 'Describe la falla.' : !ocurrida ? 'Indica cuándo ocurrió.' : null;

  const save = async (close) => {
    setAttempted(true);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const result = await systemApi.createFalla({
        mensaje: mensaje.trim(),
        ocurrida,
        impacto: impacto.trim() || null,
        accionInmediata: accionInmediata.trim() || null,
      });
      toast.success(`Falla F-${result.id} registrada`);
      setSaving(false);
      onSaved();
      close();
    } catch (saveError) {
      toast.error(saveError.message || 'No se pudo registrar la falla.');
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Registrar falla"
      subtitle="Lo que el sistema no puede registrar solo: cortes, red, servidor o base de datos caídos."
      busy={saving}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={saving} />
          <PrimaryButton onClick={() => save(close)} busy={saving}>Registrar falla</PrimaryButton>
        </div>
      )}
    >
      <ModalSection title="Qué pasó" description="Después podrás registrar la causa y la acción correctiva.">
        <div className="space-y-5">
          <div>
            <FieldLabel htmlFor={`${baseId}-mensaje`}>Descripción</FieldLabel>
            <textarea
              id={`${baseId}-mensaje`}
              data-autofocus
              value={mensaje}
              maxLength={500}
              onChange={(event) => setMensaje(event.target.value)}
              placeholder="Ej.: el servidor no respondió entre las 8:10 y las 9:00"
              disabled={saving}
              aria-invalid={attempted && !mensaje.trim() ? true : undefined}
              className={cn('field min-h-[96px] resize-y py-3 leading-relaxed', attempted && !mensaje.trim() && 'field-invalid')}
            />
            {attempted && !mensaje.trim() && <p className="field-error">Describe la falla.</p>}
          </div>
          <div>
            <FieldLabel htmlFor={`${baseId}-ocurrida`}>Cuándo ocurrió</FieldLabel>
            <input
              id={`${baseId}-ocurrida`}
              type="datetime-local"
              value={ocurrida}
              max={boliviaDateTimeInput()}
              onChange={(event) => setOcurrida(event.target.value)}
              disabled={saving}
              className="field h-11 font-medium tabular-nums"
            />
          </div>
          <TextField id={`${baseId}-impacto`} label="Impacto" hint="(opcional)" value={impacto} max={500} onChange={setImpacto} placeholder="A quién o qué afectó." disabled={saving} />
          <TextField id={`${baseId}-inmediata`} label="Acción inmediata" hint="(opcional)" value={accionInmediata} onChange={setAccionInmediata} placeholder="Qué se hizo para contenerla." disabled={saving} />
        </div>
      </ModalSection>
    </Modal>
  );
}
