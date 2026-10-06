import { useId, useState } from 'react';
import { Info } from 'lucide-react';
import { toast } from 'sonner';
import { calibrationApi } from '../api/calibration';
import { certificateErrors, certificatePayload, emptyCertificate } from '../domain/certificate';
import { VIGENCIA, expiryOf, formatDate, vigenciaOf } from '../domain/format';
import { CertificateFields } from './CertificateFields';
import { SuggestInput } from './Dropdown';
import {
  CancelButton,
  FieldLabel,
  Modal,
  ModalColumns,
  ModalSection,
  PrimaryButton,
  Switch,
  ToneBadge,
} from './primitives';

const datosErrors = (form) => {
  const errors = {};
  if (!form.codigo.trim()) errors.codigo = 'Escribe el código del equipo.';
  if (!form.instrumento.trim()) errors.instrumento = 'Indica el instrumento.';
  if (!form.planta.trim()) errors.planta = 'Indica la planta.';
  return errors;
};

function DatosFields({ form, set, errors, catalogos, idPrefix, disabled }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${idPrefix}-codigo`}>Código</FieldLabel>
          <input
            id={`${idPrefix}-codigo`}
            data-autofocus
            value={form.codigo}
            maxLength={30}
            onChange={(event) => set({ codigo: event.target.value.toUpperCase() })}
            placeholder="Ej.: F1-205"
            disabled={disabled}
            autoComplete="off"
            aria-invalid={errors.codigo ? true : undefined}
            className={errors.codigo ? 'field field-invalid h-11 font-semibold tabular-nums' : 'field h-11 font-semibold tabular-nums'}
          />
          {errors.codigo && <p className="field-error">{errors.codigo}</p>}
        </div>
        <div>
          <FieldLabel htmlFor={`${idPrefix}-planta`}>Planta</FieldLabel>
          <SuggestInput
            id={`${idPrefix}-planta`}
            value={form.planta}
            onChange={(planta) => set({ planta })}
            suggestions={catalogos.plantas}
            maxLength={50}
            placeholder="Ej.: La Paz"
            disabled={disabled}
          />
          {errors.planta && <p className="field-error">{errors.planta}</p>}
        </div>
      </div>
      <div>
        <FieldLabel htmlFor={`${idPrefix}-instrumento`}>Instrumento</FieldLabel>
        <SuggestInput
          id={`${idPrefix}-instrumento`}
          value={form.instrumento}
          onChange={(instrumento) => set({ instrumento })}
          suggestions={catalogos.instrumentos}
          maxLength={30}
          placeholder="Ej.: Pesas Patron"
          disabled={disabled}
        />
        {errors.instrumento && <p className="field-error">{errors.instrumento}</p>}
      </div>
      <div>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor={`${idPrefix}-obs`} hint="(opcional)">Observaciones</FieldLabel>
          <span className="mb-1.5 text-xs tabular-nums text-fg-subtle">{form.observaciones.length}/200</span>
        </div>
        <textarea
          id={`${idPrefix}-obs`}
          value={form.observaciones}
          maxLength={200}
          onChange={(event) => set({ observaciones: event.target.value })}
          placeholder="Clase, valor nominal, ubicación o cualquier dato útil…"
          disabled={disabled}
          className="field min-h-[96px] resize-y py-3 leading-relaxed"
        />
      </div>
    </div>
  );
}

const datosPayload = (form) => ({
  codigo: form.codigo.trim(),
  instrumento: form.instrumento.trim(),
  planta: form.planta.trim(),
  observaciones: form.observaciones.trim() || null,
});

/** Alta de un equipo nuevo en DATA_EQUIPOS_CAL, con su certificado si ya lo tiene. */
export function NewEquipmentModal({ catalogos, hoy, alertaDias, onClose, onSaved }) {
  const baseId = useId();
  const [form, setForm] = useState({ codigo: '', instrumento: '', planta: '', observaciones: '' });
  const [conCertificado, setConCertificado] = useState(true);
  const [certificado, setCertificado] = useState(() => emptyCertificate({ ente: catalogos.entes[0] }));
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm(current => ({ ...current, ...patch }));

  const errors = datosErrors(form);
  const certErrors = conCertificado ? certificateErrors(certificado, { hoy }) : {};
  const vence = conCertificado ? expiryOf(certificado.fecha, certificado.periodoDias) : null;
  const vigencia = VIGENCIA[vigenciaOf(vence, hoy, alertaDias)];

  const save = async (close) => {
    setAttempted(true);
    if (Object.keys(errors).length > 0 || Object.keys(certErrors).length > 0) {
      toast.error('Revisa los datos marcados.');
      return;
    }
    setSaving(true);
    try {
      await calibrationApi.createEquipo({
        ...datosPayload(form),
        certificado: conCertificado ? certificatePayload(certificado) : null,
      });
      toast.success(`${form.codigo.trim()} agregado al plan de calibración`);
      setSaving(false);
      onSaved();
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo registrar el equipo.');
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Nuevo equipo"
      subtitle="Se registra en los equipos de calibración y entra al plan anual."
      busy={saving}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={saving} />
          <PrimaryButton onClick={() => save(close)} busy={saving}>Registrar equipo</PrimaryButton>
        </div>
      )}
    >
      <ModalColumns>
        <ModalSection title="Datos del equipo" description="Cómo se identifica el equipo en el laboratorio.">
          <DatosFields
            form={form}
            set={set}
            errors={attempted ? errors : {}}
            catalogos={catalogos}
            idPrefix={baseId}
            disabled={saving}
          />
        </ModalSection>
        <ModalSection
          aside
          title="Certificado de calibración"
          description="El vigente define la próxima calibración."
          action={vence ? <ToneBadge tone={vigencia.tone}>{vigencia.label}</ToneBadge> : null}
        >
          <div className="space-y-5">
            <Switch
              label="Ya tiene certificado"
              description={conCertificado ? 'Registra el que está vigente hoy.' : 'Quedará «Sin certificado» hasta registrar el primero.'}
              checked={conCertificado}
              onChange={setConCertificado}
              disabled={saving}
            />
            {conCertificado && (
              <>
                <CertificateFields
                  value={certificado}
                  onChange={setCertificado}
                  errors={attempted ? certErrors : {}}
                  entes={catalogos.entes}
                  hoy={hoy}
                  idPrefix={`${baseId}-cert`}
                  disabled={saving}
                />
                {vence && (
                  <p className="flex gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-muted">
                    <Info className="mt-0.5 h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
                    <span>Vence el <strong className="font-semibold text-fg">{formatDate(vence)}</strong>: esa será su próxima calibración en el plan.</span>
                  </p>
                )}
              </>
            )}
          </div>
        </ModalSection>
      </ModalColumns>
    </Modal>
  );
}

/** Edición de los datos de un equipo (no del certificado). */
export function EditEquipmentModal({ equipo, catalogos, onClose, onSaved }) {
  const baseId = useId();
  const [form, setForm] = useState(() => ({
    codigo: equipo.codigo,
    instrumento: equipo.instrumento,
    planta: equipo.planta === 'Sin planta' ? '' : equipo.planta,
    observaciones: equipo.observaciones || '',
  }));
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm(current => ({ ...current, ...patch }));
  const errors = datosErrors(form);

  const save = async (close) => {
    setAttempted(true);
    if (Object.keys(errors).length > 0) {
      toast.error('Revisa los datos marcados.');
      return;
    }
    setSaving(true);
    try {
      await calibrationApi.updateEquipoDatos(equipo.id, datosPayload(form));
      toast.success('Datos del equipo actualizados');
      setSaving(false);
      onSaved();
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudieron guardar los datos.');
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      title={`Editar ${equipo.codigo}`}
      subtitle="El certificado se renueva o corrige desde la ficha del equipo."
      busy={saving}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={saving} />
          <PrimaryButton onClick={() => save(close)} busy={saving}>Guardar cambios</PrimaryButton>
        </div>
      )}
    >
      <ModalSection title="Datos del equipo" description="Se actualizan en los equipos de calibración; el cambio queda en el historial.">
        <DatosFields
          form={form}
          set={set}
          errors={attempted ? errors : {}}
          catalogos={catalogos}
          idPrefix={baseId}
          disabled={saving}
        />
      </ModalSection>
    </Modal>
  );
}
