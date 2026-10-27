import { useId, useState } from 'react';
import { Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { boliviaToday } from '../../system/domain/system';
import { calibrationApi } from '../api/calibration';
import { CLASES_VERSION, splitLines } from '../domain/servicemet';
import {
  CancelButton,
  FieldLabel,
  Modal,
  ModalColumns,
  ModalSection,
  PrimaryButton,
  Segmented,
} from './primitives';

const VERSION_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,6}$/;

const fromVersion = (version) => ({
  version: version?.version || '',
  fecha: version?.fecha || boliviaToday(),
  commit: version?.commit || '',
  clase: version?.clase || 'A',
  resumen: version?.resumen || '',
  nuevo: (version?.nuevo || []).join('\n'),
  corregido: (version?.corregido || []).join('\n'),
  impacto: version?.impacto || '',
});

/**
 * Registro o edición de una versión de ServiceMET: su número, qué cambia y a
 * qué registros afecta. Se copia del historial de versiones de la app
 * (lib/screens/calidad/data/historial_versiones.dart).
 */
export function ServiceMetFormModal({ version = null, onClose, onSaved }) {
  const baseId = useId();
  const editing = Boolean(version);
  const [form, setForm] = useState(() => fromVersion(version));
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm(current => ({ ...current, ...patch }));

  const nuevo = splitLines(form.nuevo);
  const corregido = splitLines(form.corregido);
  const errors = {
    version: VERSION_PATTERN.test(form.version.trim()) ? null : 'Escribe la versión con su build, como figura en pubspec.yaml: 6.4.1+19.',
    fecha: !form.fecha ? 'Indica la fecha de la versión.' : form.fecha > boliviaToday() ? 'La fecha no puede ser posterior a hoy.' : null,
    commit: !form.commit.trim() || /^[0-9a-f]{7,40}$/i.test(form.commit.trim()) ? null : 'El commit son de 7 a 40 caracteres hexadecimales.',
    resumen: form.resumen.trim() ? null : 'Resume qué cambia en esta versión.',
    nuevo: nuevo.length + corregido.length > 0 ? null : 'Indica al menos un cambio nuevo o una corrección.',
  };
  const firstError = Object.values(errors).find(Boolean);
  const anulaValidacion = editing && Boolean(version.validacion);

  const save = async (close) => {
    setAttempted(true);
    if (firstError) {
      toast.error(firstError);
      return;
    }
    setSaving(true);
    try {
      const body = {
        version: form.version.trim(),
        fecha: form.fecha,
        commit: form.commit.trim() || null,
        clase: form.clase,
        resumen: form.resumen.trim(),
        nuevo,
        corregido,
        impacto: form.impacto.trim() || null,
      };
      if (editing) {
        await calibrationApi.updateServicemet(version.id, body);
        toast.success(`Versión ${body.version} actualizada`);
      } else {
        await calibrationApi.createServicemet(body);
        toast.success(`Versión ${body.version} registrada`);
      }
      setSaving(false);
      onSaved();
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar la versión.');
      setSaving(false);
    }
  };

  const invalid = (key) => attempted && errors[key];
  const textArea = (key, { rows = 'min-h-[96px]', placeholder, max }) => (
    <textarea
      id={`${baseId}-${key}`}
      value={form[key]}
      maxLength={max}
      onChange={(event) => set({ [key]: event.target.value })}
      placeholder={placeholder}
      disabled={saving}
      aria-invalid={invalid(key) ? true : undefined}
      className={cn('field resize-y py-3 leading-relaxed', rows, invalid(key) && 'field-invalid')}
    />
  );

  return (
    <Modal
      onClose={onClose}
      title={editing ? `Editar ServiceMET ${version.version}` : 'Registrar versión de ServiceMET'}
      subtitle={editing ? version.resumen : 'Cópiala del historial de versiones de la app; Sistemas la valida y el jefe de Calibración la aprueba.'}
      busy={saving}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={saving} />
          <PrimaryButton onClick={() => save(close)} busy={saving}>{editing ? 'Guardar cambios' : 'Registrar versión'}</PrimaryButton>
        </div>
      )}
    >
      <ModalColumns>
        <ModalSection title="Qué cambia" description="Para el laboratorio: qué cambia para el técnico y para los registros.">
          <div className="space-y-5">
            <div>
              <FieldLabel htmlFor={`${baseId}-resumen`}>Resumen</FieldLabel>
              {textArea('resumen', { max: 1000, placeholder: 'Ej.: Soporte técnico: una prueba omitida ya no se guarda ni se sube.' })}
              {invalid('resumen') && <p className="field-error">{errors.resumen}</p>}
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-nuevo`} hint="(una por línea)">Nuevo</FieldLabel>
              {textArea('nuevo', { rows: 'min-h-[120px]', placeholder: 'Cada función nueva en su propia línea.' })}
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-corregido`} hint="(una por línea)">Corregido</FieldLabel>
              {textArea('corregido', { rows: 'min-h-[96px]', placeholder: 'Cada corrección en su propia línea.' })}
              {invalid('nuevo') && <p className="field-error">{errors.nuevo}</p>}
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-impacto`} hint="(opcional)">Impacto en los registros</FieldLabel>
              {textArea('impacto', { max: 2000, placeholder: 'Qué cambia en los datos capturados o subidos, scripts SQL o despliegues que requiere antes de distribuirse.' })}
            </div>
          </div>
        </ModalSection>

        <ModalSection aside title="Identificación" description="Como figura en pubspec.yaml y en git.">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor={`${baseId}-version`}>Versión</FieldLabel>
                <input
                  id={`${baseId}-version`}
                  data-autofocus
                  value={form.version}
                  maxLength={30}
                  onChange={(event) => set({ version: event.target.value })}
                  placeholder="6.4.2+20"
                  disabled={saving}
                  aria-invalid={invalid('version') ? true : undefined}
                  className={cn('field h-11 font-medium tabular-nums', invalid('version') && 'field-invalid')}
                />
              </div>
              <div>
                <FieldLabel htmlFor={`${baseId}-fecha`}>Fecha</FieldLabel>
                <input
                  id={`${baseId}-fecha`}
                  type="date"
                  value={form.fecha}
                  max={boliviaToday()}
                  onChange={(event) => set({ fecha: event.target.value })}
                  disabled={saving}
                  aria-invalid={invalid('fecha') ? true : undefined}
                  className={cn('field h-11 tabular-nums', invalid('fecha') && 'field-invalid')}
                />
              </div>
            </div>
            {(invalid('version') || invalid('fecha')) && <p className="field-error -mt-3">{errors.version || errors.fecha}</p>}
            <div>
              <FieldLabel htmlFor={`${baseId}-commit`} hint="(opcional)">Commit</FieldLabel>
              <input
                id={`${baseId}-commit`}
                value={form.commit}
                maxLength={40}
                onChange={(event) => set({ commit: event.target.value })}
                placeholder="Ej.: 646ec67 (chore: versión …)"
                disabled={saving}
                aria-invalid={invalid('commit') ? true : undefined}
                className={cn('field h-11 font-mono text-[13px]', invalid('commit') && 'field-invalid')}
              />
              {invalid('commit') && <p className="field-error">{errors.commit}</p>}
            </div>
            <div>
              <p className="field-label">Clase del cambio</p>
              <Segmented
                label="Clase del cambio"
                value={form.clase}
                onChange={(clase) => set({ clase })}
                disabled={saving}
                options={Object.entries(CLASES_VERSION).map(([value, clase]) => ({ value, label: `${value} · ${clase.label}` }))}
                className="cal-segmented-fill"
              />
              <p className="cal-hint mt-1.5">{CLASES_VERSION[form.clase].description} Se clasifica por su cambio de mayor impacto.</p>
            </div>
            {anulaValidacion && (
              <p className="flex gap-2.5 rounded-xl border border-warning/35 bg-warning/[0.06] px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-muted">
                <Info className="mt-0.5 h-4 w-4 flex-none text-warning" aria-hidden="true" />
                <span>Esta versión ya tiene una validación. Si cambias lo que describe, la validación queda sin efecto y habrá que repetirla.</span>
              </p>
            )}
          </div>
        </ModalSection>
      </ModalColumns>
    </Modal>
  );
}
