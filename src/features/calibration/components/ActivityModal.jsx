import { useId, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { calibrationApi } from '../api/calibration';
import { FRECUENCIAS_ACTIVIDAD, frequencyLabel } from '../domain/format';
import { Dropdown, SuggestInput } from './Dropdown';
import { AlertFields, DatePreview, ResponsableSelect } from './fields';
import {
  CancelButton,
  DangerButton,
  FieldLabel,
  Modal,
  ModalColumns,
  ModalSection,
  PrimaryButton,
} from './primitives';

const CATEGORIAS_SUGERIDAS = [
  'Documentos legales',
  'Sistema de calidad',
  'Auditoría',
  'Capacitación',
  'Mantenimiento',
  'Condiciones ambientales',
];

const FREQUENCY_OPTIONS = FRECUENCIAS_ACTIVIDAD.map(meses => ({ value: meses, label: frequencyLabel(meses) }));

/** Ficha de alta y edición de actividades del área (revisiones, auditorías, trámites…). */
export function ActivityModal({ actividad, categorias = [], ajustes, personal, canEdit, hoy, onClose, onSaved }) {
  const baseId = useId();
  const editing = Boolean(actividad);
  const [form, setForm] = useState(() => ({
    titulo: actividad?.titulo || '',
    categoria: actividad?.categoria || '',
    descripcion: actividad?.descripcion || '',
    frecuenciaMeses: actividad?.frecuenciaMeses ?? 12,
    fechaInicio: actividad?.fechaInicio || hoy,
    responsableId: actividad?.responsableId ?? null,
    alertaDias: actividad?.alertaDias ?? null,
    alertaFrecuencia: actividad?.alertaFrecuencia ?? null,
    alertaCorreo: actividad?.alertaCorreo ?? null,
  }));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [touched, setTouched] = useState(false);
  const disabled = !canEdit || saving;
  const set = (patch) => setForm(current => ({ ...current, ...patch }));
  const tituloError = touched && !form.titulo.trim();

  const sugerencias = useMemo(
    () => [...new Set([...CATEGORIAS_SUGERIDAS, ...categorias.filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'es')),
    [categorias]
  );

  const save = async (close) => {
    setTouched(true);
    if (!form.titulo.trim() || !form.fechaInicio) {
      toast.error(!form.titulo.trim() ? 'Escribe el nombre de la actividad.' : 'Indica la fecha.');
      return;
    }
    setSaving(true);
    try {
      const body = { ...form, categoria: form.categoria.trim() || null, descripcion: form.descripcion.trim() || null };
      if (editing) await calibrationApi.updateActividad(actividad.id, body);
      else await calibrationApi.createActividad(body);
      toast.success(editing ? 'Actividad actualizada' : 'Actividad agregada al plan');
      setSaving(false);
      onSaved();
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar.');
      setSaving(false);
    }
  };

  const remove = async (close) => {
    setSaving(true);
    try {
      await calibrationApi.deleteActividad(actividad.id);
      toast.success('Actividad quitada del plan');
      setSaving(false);
      onSaved();
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo eliminar.');
      setSaving(false);
    }
  };

  const footer = (close) => {
    if (!canEdit) {
      return (
        <div className="ml-auto">
          <CancelButton onClick={close}>Cerrar</CancelButton>
        </div>
      );
    }
    if (confirmDelete) {
      return (
        <>
          <p className="mr-auto text-sm font-medium text-fg">¿Quitar esta actividad del plan?</p>
          <CancelButton onClick={() => setConfirmDelete(false)} disabled={saving}>No</CancelButton>
          <button
            type="button"
            onClick={() => remove(close)}
            disabled={saving}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            Sí, quitar
          </button>
        </>
      );
    }
    return (
      <>
        {editing && (
          <DangerButton onClick={() => setConfirmDelete(true)} disabled={saving} label="Eliminar actividad">
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Eliminar</span>
          </DangerButton>
        )}
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={saving} />
          <PrimaryButton onClick={() => save(close)} busy={saving}>
            {editing ? 'Guardar cambios' : 'Agregar al plan'}
          </PrimaryButton>
        </div>
      </>
    );
  };

  return (
    <Modal
      onClose={onClose}
      title={editing ? actividad.titulo : 'Nueva actividad'}
      subtitle={editing ? (
        <>
          <span className="font-medium text-fg">{actividad.categoria || 'Actividad del área'}</span>
          <span aria-hidden="true" className="px-1.5 text-fg-subtle">·</span>
          <span>{frequencyLabel(actividad.frecuenciaMeses)}</span>
        </>
      ) : 'Tareas del área que se planifican en el año, como revisiones o trámites.'}
      busy={saving}
      footer={footer}
    >
      <ModalColumns>
        <ModalSection title="Datos de la actividad" description="Qué se hace y dónde encontrar lo necesario.">
          <div className="space-y-5">
            <div>
              <FieldLabel htmlFor={`${baseId}-titulo`}>Actividad</FieldLabel>
              <input
                id={`${baseId}-titulo`}
                data-autofocus
                value={form.titulo}
                maxLength={150}
                onChange={(event) => set({ titulo: event.target.value })}
                placeholder="Ej.: Revisar documentos legales – Fundaempresa"
                disabled={disabled}
                aria-invalid={tituloError || undefined}
                className={tituloError ? 'field field-invalid h-11 font-medium' : 'field h-11 font-medium'}
              />
              {tituloError && <p className="field-error">Escribe el nombre de la actividad.</p>}
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-categoria`} hint="(opcional)">Categoría</FieldLabel>
              <SuggestInput
                id={`${baseId}-categoria`}
                value={form.categoria}
                onChange={(categoria) => set({ categoria })}
                suggestions={sugerencias}
                maxLength={60}
                placeholder="Elige o escribe una categoría"
                disabled={disabled}
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor={`${baseId}-descripcion`} hint="(opcional)">Descripción</FieldLabel>
                <span className="mb-1.5 text-xs tabular-nums text-fg-subtle">{form.descripcion.length}/500</span>
              </div>
              <textarea
                id={`${baseId}-descripcion`}
                value={form.descripcion}
                maxLength={500}
                onChange={(event) => set({ descripcion: event.target.value })}
                placeholder="Qué se revisa, dónde está el documento, criterios…"
                disabled={disabled}
                className="field min-h-[112px] resize-y py-3 leading-relaxed"
              />
            </div>
          </div>
        </ModalSection>

        <ModalSection aside title="Fechas y avisos" description="Cuándo se repite, quién responde y cuándo avisar.">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div>
                <FieldLabel htmlFor={`${baseId}-frecuencia`}>Se repite</FieldLabel>
                <Dropdown
                  id={`${baseId}-frecuencia`}
                  value={form.frecuenciaMeses}
                  onChange={(value) => set({ frecuenciaMeses: Number(value) })}
                  options={FREQUENCY_OPTIONS}
                  ariaLabel="Frecuencia de la actividad"
                  disabled={disabled}
                />
              </div>
              <div>
                <FieldLabel htmlFor={`${baseId}-inicio`}>{form.frecuenciaMeses ? 'Primera fecha' : 'Fecha'}</FieldLabel>
                <input
                  id={`${baseId}-inicio`}
                  type="date"
                  value={form.fechaInicio}
                  onChange={(event) => set({ fechaInicio: event.target.value })}
                  disabled={disabled}
                  className="field h-11 font-medium tabular-nums"
                />
              </div>
            </div>
            {form.fechaInicio && form.frecuenciaMeses > 0 && (
              <DatePreview request={{ tipo: 'ACTIVIDAD', frecuenciaMeses: form.frecuenciaMeses, fechaInicio: form.fechaInicio }} />
            )}
            <div>
              <FieldLabel htmlFor={`${baseId}-resp`}>Responsable</FieldLabel>
              <ResponsableSelect
                id={`${baseId}-resp`}
                value={form.responsableId}
                fallbackName={actividad?.responsableNombre}
                onChange={(responsableId) => set({ responsableId })}
                personal={personal}
                disabled={disabled}
              />
            </div>
            <div className="h-px bg-line" />
            <AlertFields value={form} onChange={set} ajustes={ajustes} disabled={disabled} />
          </div>
        </ModalSection>
      </ModalColumns>
    </Modal>
  );
}
