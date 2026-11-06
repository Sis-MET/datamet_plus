import { useState } from 'react';
import { toast } from 'sonner';
import { useResource } from '../../system/hooks/useResource';
import { calibrationApi } from '../api/calibration';
import { CancelButton, Modal, ModalSection, PrimaryButton } from './primitives';

const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' }) : null);
const ordenados = (ids) => [...ids].sort((a, b) => a - b);

/**
 * Aprobadores de los registros de calibración (migración 019): el jefe de
 * Calibración revisa por su cargo y elige quién más del área puede aprobar u
 * observar. Cada cambio queda con su versión e historial.
 */
export function AprobadoresModal({ onClose }) {
  const { data, error } = useResource(calibrationApi.aprobadores);
  const [seleccion, setSeleccion] = useState(null);
  const [saving, setSaving] = useState(false);
  const ids = seleccion || data?.aprobadores || [];
  const cambios = Boolean(data) && JSON.stringify(ordenados(ids)) !== JSON.stringify(ordenados(data.aprobadores));

  const alternar = (id, activo) => setSeleccion(activo ? [...ids, id] : ids.filter(item => item !== id));

  const guardar = async (close) => {
    setSaving(true);
    try {
      await calibrationApi.guardarAprobadores({ version: data.version, aprobadores: ids });
      toast.success('Aprobadores actualizados');
      setSaving(false);
      close();
    } catch (failure) {
      toast.error(failure.message || 'No se pudieron guardar los aprobadores.');
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      busy={saving}
      title="Aprobadores de registros"
      subtitle="Quién puede aprobar u observar los registros de calibración, además del jefe de Calibración."
      footer={(close) => (
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-fg-muted">
            {data?.actualizadoEn ? `Último cambio: ${data.actualizadoPor} · ${fechaHora(data.actualizadoEn)}` : 'Los permisos se verifican en cada revisión.'}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <CancelButton onClick={close} disabled={saving} />
            <PrimaryButton onClick={() => guardar(close)} busy={saving} disabled={!cambios}>Guardar</PrimaryButton>
          </div>
        </div>
      )}
    >
      <ModalSection
        title="Personal activo de Calibración"
        description="Nadie revisa lo que envió él mismo. Reabrir un registro aprobado queda para el jefe."
      >
        {!data && <p className="text-[13px] text-fg-muted">{error ? <span className="text-danger">{error.message}</span> : 'Leyendo el personal…'}</p>}
        {data && (
          <fieldset disabled={saving} className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            <legend className="sr-only">Aprobadores</legend>
            {data.personal.map(persona => (
              <label key={persona.id} className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={persona.esJefe || ids.includes(persona.id)}
                  disabled={persona.esJefe}
                  onChange={event => alternar(persona.id, event.target.checked)}
                  className="h-4 w-4 flex-none accent-fg"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-fg">{persona.nombre}</span>
                  <span className="block truncate text-[12px] text-fg-muted">
                    {persona.cargo || 'Sin cargo registrado'}{persona.esJefe ? ' · revisa por su cargo' : ''}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </ModalSection>
    </Modal>
  );
}
