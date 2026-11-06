import { useCallback, useId, useState } from 'react';
import { toast } from 'sonner';
import { useResource } from '../../system/hooks/useResource';
import { calibrationApi } from '../api/calibration';
import { formatDate } from '../domain/format';
import { formatNumber, parseNumber } from '../domain/patrones';
import { ORIGENES_ACORDADOS, leerCargas } from '../domain/servicios';
import { Dropdown } from './Dropdown';
import { CancelButton, FieldLabel, Modal, ModalSection, PrimaryButton } from './primitives';

const UNIDADES = ['mg', 'g', 'kg', 't'].map(unidad => ({ value: unidad, label: unidad }));

const aTexto = (cargas) => (cargas || []).map(formatNumber).join('; ');

const ACCIONES = { CARGA_INICIAL: 'Carga inicial', EDICION: 'Edición' };

/**
 * Puntos de ensayo acordados de un instrumento de cliente: cargas de
 * excentricidad, repetibilidad y error. Los mantiene Calibración; cambiar unos
 * existentes pide motivo y queda en el historial.
 */
export function PuntosAcordadosModal({ codMetrica, unidadInstrumento, instrumento, onClose, onSaved }) {
  const load = useCallback(() => calibrationApi.puntosAcordados(codMetrica), [codMetrica]);
  const { data, error } = useResource(load);

  if (!data) {
    return (
      <Modal onClose={onClose} title="Puntos acordados" subtitle={instrumento} size="md">
        <div className="px-6 py-10 text-sm text-fg-muted">{error ? <span className="text-danger">{error.message}</span> : 'Cargando…'}</div>
      </Modal>
    );
  }
  return (
    <Formulario
      data={data}
      codMetrica={codMetrica}
      unidadInstrumento={unidadInstrumento}
      instrumento={instrumento}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

const estadoInicial = (puntos, unidadInstrumento) => ({
  unidad: puntos?.unidad || unidadInstrumento || 'kg',
  excentricidad: puntos?.excentricidad != null ? formatNumber(puntos.excentricidad) : '',
  repetibilidad: aTexto(puntos?.repetibilidad),
  errores: aTexto(puntos?.errores),
  observaciones: puntos?.observaciones || '',
  motivo: '',
});

function Formulario({ data, codMetrica, unidadInstrumento, instrumento, onClose, onSaved }) {
  const baseId = useId();
  const [form, setForm] = useState(() => estadoInicial(data.puntos, unidadInstrumento));
  const [saving, setSaving] = useState(false);

  const existentes = data.puntos;
  const set = (patch) => setForm(current => ({ ...current, ...patch }));
  const excentricidad = parseNumber(form.excentricidad);
  const repetibilidad = leerCargas(form.repetibilidad, parseNumber);
  const errores = leerCargas(form.errores, parseNumber);
  const problemas = [
    Number.isNaN(excentricidad) || (excentricidad != null && excentricidad <= 0) ? 'La carga de excentricidad no es un número mayor que cero.' : null,
    repetibilidad.invalidas.length ? `Repetibilidad: no se entiende «${repetibilidad.invalidas.join('», «')}».` : null,
    repetibilidad.cargas.length > 3 ? 'La repetibilidad admite hasta 3 cargas.' : null,
    errores.invalidas.length ? `Error: no se entiende «${errores.invalidas.join('», «')}».` : null,
    errores.cargas.length > 60 ? 'El error de indicación admite hasta 60 cargas.' : null,
    !excentricidad && !repetibilidad.cargas.length && !errores.cargas.length ? 'Indica al menos una carga acordada.' : null,
    existentes && form.motivo.trim().length < 3 ? 'Escribe el motivo del cambio.' : null,
  ].filter(Boolean);

  const guardar = async (close) => {
    if (problemas.length) {
      toast.error(problemas[0]);
      return;
    }
    setSaving(true);
    try {
      const respuesta = await calibrationApi.savePuntosAcordados(codMetrica, {
        version: existentes?.version ?? null,
        unidad: form.unidad,
        excentricidad: excentricidad ?? null,
        repetibilidad: repetibilidad.cargas,
        errores: [...new Set(errores.cargas)],
        observaciones: form.observaciones.trim() || null,
        motivo: form.motivo.trim() || null,
      });
      toast.success(respuesta.cambios ? 'Puntos acordados guardados' : 'No había cambios que guardar');
      setSaving(false);
      if (respuesta.cambios) onSaved?.();
      close();
    } catch (err) {
      toast.error(err.message || 'No se pudieron guardar los puntos acordados.');
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      busy={saving}
      title="Puntos acordados"
      subtitle={instrumento}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={saving} />
          <PrimaryButton onClick={() => guardar(close)} busy={saving}>Guardar</PrimaryButton>
        </div>
      )}
    >
      <div className="divide-y divide-line">
        <ModalSection
          title="Cargas de ensayo"
          description={existentes
            ? `Origen: ${ORIGENES_ACORDADOS[existentes.origen] || existentes.origen}. Son una referencia: DataMET+ avisa si el técnico usa otras cargas.`
            : 'Este instrumento aún no tiene puntos acordados. Son una referencia: DataMET+ avisa si el técnico usa otras cargas.'}
        >
          <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
            <div>
              <FieldLabel htmlFor={`${baseId}-unidad`}>Unidad</FieldLabel>
              <Dropdown id={`${baseId}-unidad`} ariaLabel="Unidad de las cargas" value={form.unidad} onChange={unidad => set({ unidad })} options={UNIDADES} disabled={saving} />
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-exc`}>Excentricidad</FieldLabel>
              <input id={`${baseId}-exc`} inputMode="decimal" value={form.excentricidad} onChange={event => set({ excentricidad: event.target.value })} disabled={saving} className="field h-11 tabular-nums" placeholder="Ej.: 500" />
            </div>
          </div>
          <div className="mt-4">
            <FieldLabel htmlFor={`${baseId}-rep`} hint="hasta 3, separadas por punto y coma">Repetibilidad</FieldLabel>
            <input id={`${baseId}-rep`} value={form.repetibilidad} onChange={event => set({ repetibilidad: event.target.value })} disabled={saving} className="field h-11 tabular-nums" placeholder="Ej.: 5; 500; 1000" />
          </div>
          <div className="mt-4">
            <FieldLabel htmlFor={`${baseId}-err`} hint="separadas por punto y coma o pegadas de Excel">Error de indicación</FieldLabel>
            <textarea id={`${baseId}-err`} rows={3} value={form.errores} onChange={event => set({ errores: event.target.value })} disabled={saving} className="field py-2.5 tabular-nums" placeholder="Ej.: 5; 20; 50; 100; 500; 1000" />
            <p className="mt-1.5 text-[12px] text-fg-muted">
              {errores.cargas.length} {errores.cargas.length === 1 ? 'carga' : 'cargas'}
              {errores.cargas.length ? `: ${errores.cargas.map(formatNumber).join(' · ')} ${form.unidad}` : ''}
            </p>
          </div>
          <div className="mt-4">
            <FieldLabel htmlFor={`${baseId}-obs`} hint="opcional">Observaciones</FieldLabel>
            <input id={`${baseId}-obs`} value={form.observaciones} maxLength={500} onChange={event => set({ observaciones: event.target.value })} disabled={saving} className="field h-11" placeholder="Ej.: acordado con el cliente en la cotización" />
          </div>
          {existentes && (
            <div className="mt-4">
              <FieldLabel htmlFor={`${baseId}-motivo`}>Motivo del cambio</FieldLabel>
              <input id={`${baseId}-motivo`} value={form.motivo} maxLength={500} onChange={event => set({ motivo: event.target.value })} disabled={saving} className="field h-11" placeholder="Queda en el historial" />
            </div>
          )}
        </ModalSection>

        {data.historial.length > 0 && (
          <ModalSection title="Historial">
            <ul className="flex flex-col gap-2">
              {data.historial.slice(0, 6).map(item => (
                <li key={item.id} className="text-[12.5px]">
                  <span className="font-medium text-fg">{ACCIONES[item.accion] || item.accion}</span>
                  <span className="text-fg-muted"> · {item.usuario} · {formatDate(item.fecha.slice(0, 10))}</span>
                  {item.motivo && <span className="block text-fg-muted">{item.motivo}</span>}
                </li>
              ))}
            </ul>
          </ModalSection>
        )}
      </div>
    </Modal>
  );
}
