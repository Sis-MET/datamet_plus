import { useId, useState } from 'react';
import { Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { APP_VERSION } from '../../../shared/utils/appVersion';
import { Dropdown } from '../../calibration/components/Dropdown';
import {
  CancelButton,
  FieldLabel,
  Modal,
  ModalColumns,
  ModalSection,
  PrimaryButton,
} from '../../calibration/components/primitives';
import { systemApi } from '../api/system';
import { TIPOS_CAMBIO, boliviaToday } from '../domain/system';

const TIPO_OPTIONS = Object.entries(TIPOS_CAMBIO).map(([value, label]) => ({ value, label }));

const fromCambio = (cambio) => ({
  titulo: cambio?.titulo || '',
  tipo: cambio?.tipo || 'MEJORA',
  version: cambio?.version || APP_VERSION,
  modulos: cambio?.modulos || '',
  fechaCambio: cambio?.fechaCambio || boliviaToday(),
  descripcion: cambio?.descripcion || '',
  impacto: cambio?.impacto || '',
  referencias: cambio?.referencias || '',
});

/** Registro o edición de un cambio del sistema (qué cambia, por qué y a qué afecta). */
export function ChangeFormModal({ cambio = null, onClose, onSaved }) {
  const baseId = useId();
  const editing = Boolean(cambio);
  const [form, setForm] = useState(() => fromCambio(cambio));
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm(current => ({ ...current, ...patch }));
  const anulaValidacion = editing && cambio.validacion && !cambio.aPosteriori;

  const errors = {
    titulo: form.titulo.trim() ? null : 'Escribe el título del cambio.',
    descripcion: form.descripcion.trim() ? null : 'Describe qué cambia y por qué.',
  };

  const save = async (close) => {
    setAttempted(true);
    if (errors.titulo || errors.descripcion) {
      toast.error(errors.titulo || errors.descripcion);
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        fechaCambio: form.fechaCambio || null,
      };
      if (editing) {
        await systemApi.updateCambio(cambio.id, body);
        toast.success(`${cambio.codigo} actualizado`);
      } else {
        const result = await systemApi.createCambio(body);
        toast.success(`Cambio ${result.codigo} registrado`);
      }
      setSaving(false);
      onSaved();
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar el cambio.');
      setSaving(false);
    }
  };

  const textArea = (key, { rows = 'min-h-[96px]', placeholder, max }) => (
    <textarea
      id={`${baseId}-${key}`}
      value={form[key]}
      maxLength={max}
      onChange={(event) => set({ [key]: event.target.value })}
      placeholder={placeholder}
      disabled={saving}
      aria-invalid={attempted && errors[key] ? true : undefined}
      className={cn('field resize-y py-3 leading-relaxed', rows, attempted && errors[key] && 'field-invalid')}
    />
  );

  return (
    <Modal
      onClose={onClose}
      title={editing ? `Editar ${cambio.codigo}` : 'Registrar cambio'}
      subtitle={editing ? cambio.titulo : 'NB/ISO/IEC 17025 · 7.11.2: se documenta, se valida y se aprueba antes de implementarse.'}
      busy={saving}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={saving} />
          <PrimaryButton onClick={() => save(close)} busy={saving}>{editing ? 'Guardar cambios' : 'Registrar cambio'}</PrimaryButton>
        </div>
      )}
    >
      <ModalColumns>
        <ModalSection title="Qué cambia" description="Lo que se modifica en el sistema y por qué.">
          <div className="space-y-5">
            <div>
              <FieldLabel htmlFor={`${baseId}-titulo`}>Título</FieldLabel>
              <input
                id={`${baseId}-titulo`}
                data-autofocus
                value={form.titulo}
                maxLength={150}
                onChange={(event) => set({ titulo: event.target.value })}
                placeholder="Ej.: Historial de cambios en las verificaciones"
                disabled={saving}
                aria-invalid={attempted && errors.titulo ? true : undefined}
                className={cn('field h-11', attempted && errors.titulo && 'field-invalid')}
              />
              {attempted && errors.titulo && <p className="field-error">{errors.titulo}</p>}
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-descripcion`}>Descripción</FieldLabel>
              {textArea('descripcion', { rows: 'min-h-[168px]', max: 4000, placeholder: 'Qué se agrega o modifica, por qué se necesita y cómo lo usa el personal.' })}
              {attempted && errors.descripcion && <p className="field-error">{errors.descripcion}</p>}
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-impacto`} hint="(opcional)">Impacto</FieldLabel>
              {textArea('impacto', { max: 1000, placeholder: 'Registros, tablas o usuarios afectados y riesgos.' })}
            </div>
          </div>
        </ModalSection>

        <ModalSection aside title="Clasificación" description="Para encontrarlo y saber en qué versión entra.">
          <div className="space-y-5">
            <div>
              <FieldLabel htmlFor={`${baseId}-tipo`}>Tipo</FieldLabel>
              <Dropdown id={`${baseId}-tipo`} value={form.tipo} onChange={(tipo) => set({ tipo })} options={TIPO_OPTIONS} disabled={saving} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor={`${baseId}-version`} hint="(opcional)">Versión</FieldLabel>
                <input
                  id={`${baseId}-version`}
                  value={form.version}
                  maxLength={20}
                  onChange={(event) => set({ version: event.target.value })}
                  placeholder={APP_VERSION}
                  disabled={saving}
                  className="field h-11 tabular-nums"
                />
              </div>
              <div>
                <FieldLabel htmlFor={`${baseId}-fecha`} hint="(opcional)">Fecha</FieldLabel>
                <input
                  id={`${baseId}-fecha`}
                  type="date"
                  value={form.fechaCambio}
                  max={boliviaToday()}
                  onChange={(event) => set({ fechaCambio: event.target.value })}
                  disabled={saving}
                  className="field h-11 tabular-nums"
                />
              </div>
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-modulos`} hint="(opcional)">Módulos</FieldLabel>
              <input
                id={`${baseId}-modulos`}
                value={form.modulos}
                maxLength={200}
                onChange={(event) => set({ modulos: event.target.value })}
                placeholder="Ej.: Calibración, Cronograma"
                disabled={saving}
                className="field h-11"
              />
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-referencias`} hint="(opcional)">Referencias</FieldLabel>
              {textArea('referencias', { rows: 'min-h-[84px]', max: 1000, placeholder: 'Commits, migraciones, documentos o solicitudes.' })}
            </div>
            {anulaValidacion && (
              <p className="flex gap-2.5 rounded-xl border border-warning/35 bg-warning/[0.06] px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-muted">
                <Info className="mt-0.5 h-4 w-4 flex-none text-warning" aria-hidden="true" />
                <span>Este cambio ya está validado. Si cambias lo que describe, la validación queda sin efecto y habrá que repetirla.</span>
              </p>
            )}
          </div>
        </ModalSection>
      </ModalColumns>
    </Modal>
  );
}
