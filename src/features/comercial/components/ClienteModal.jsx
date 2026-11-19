import { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { CancelButton, FieldLabel, Modal, ModalColumns, ModalSection, PrimaryButton } from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import { bs, fecha, fechaHora } from '../domain/comercial';
import { Cargando, Dato, ErrorCarga, Mora } from './comunes';

const fichaAFormulario = (ficha) => ({
  plazoDias: ficha?.plazoDias ?? '',
  correos: (ficha?.correos || []).join('; '),
  recepcion: ficha?.recepcion || '',
  observacion: ficha?.observacion || '',
});

/**
 * Ficha de facturación de un cliente: plazo de crédito (para el vencimiento
 * y la mora), correos de recepción de facturas y ventana de recepción, con
 * sus facturas por cobrar. Los datos del cliente siguen en DataMET.
 */
export function ClienteModal({ codigo, soloConsulta, onClose, onChanged, onOpenFactura }) {
  const baseId = useId();
  const load = useCallback(() => comercialApi.cliente(codigo), [codigo]);
  const { data: cliente, error, reload } = useResource(load);
  const [form, setForm] = useState(fichaAFormulario(null));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (cliente) setForm(fichaAFormulario(cliente.ficha));
  }, [cliente]);

  const set = (cambios) => setForm(actual => ({ ...actual, ...cambios }));

  const guardar = async () => {
    setGuardando(true);
    try {
      await comercialApi.guardarCliente(codigo, {
        plazoDias: form.plazoDias === '' ? null : Number(form.plazoDias),
        correos: form.correos.split(/[;,\s]+/).map(c => c.trim().toLowerCase()).filter(Boolean),
        recepcion: form.recepcion.trim() || null,
        observacion: form.observacion.trim() || null,
      });
      toast.success('Ficha de facturación guardada.');
      reload();
      onChanged?.();
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar la ficha.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="lg"
      busy={guardando}
      title={cliente?.razonSocial || 'Cliente'}
      subtitle={cliente ? `Código ${cliente.codigo}${cliente.nit ? ` · NIT ${cliente.nit}` : ''}` : 'Cargando…'}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={guardando}>Cerrar</CancelButton>
          {!soloConsulta && cliente && <PrimaryButton onClick={guardar} busy={guardando}>Guardar ficha</PrimaryButton>}
        </div>
      )}
    >
      {error && <div className="p-5"><ErrorCarga titulo="No se pudo abrir el cliente." error={error} onRetry={reload} /></div>}
      {!cliente && !error && <div className="p-5"><Cargando label="Cargando cliente" filas={2} /></div>}
      {cliente && (
        <ModalColumns>
          <ModalSection title="Facturación" description="Vale para las facturas nuevas y para calcular la mora.">
            {soloConsulta ? (
              <dl className="grid gap-3">
                <Dato label="Plazo de crédito">{cliente.ficha.plazoDias != null ? `${cliente.ficha.plazoDias} días` : 'Sin plazo (vence al emitir)'}</Dato>
                <Dato label="Correos de recepción">{cliente.ficha.correos.join(', ') || null}</Dato>
                <Dato label="Ventana de recepción">{cliente.ficha.recepcion}</Dato>
                <Dato label="Observación">{cliente.ficha.observacion}</Dato>
              </dl>
            ) : (
              <div className="grid gap-4">
                <div>
                  <FieldLabel htmlFor={`${baseId}-plazo`} hint="(días)">Plazo de crédito</FieldLabel>
                  <input id={`${baseId}-plazo`} inputMode="numeric" value={form.plazoDias} placeholder="Sin plazo"
                    onChange={(e) => set({ plazoDias: e.target.value.replace(/\D/g, '').slice(0, 3) })} className="field h-11 w-32 tabular-nums" />
                </div>
                <div>
                  <FieldLabel htmlFor={`${baseId}-correos`} hint="(separados por ;)">Correos de recepción de facturas</FieldLabel>
                  <textarea id={`${baseId}-correos`} value={form.correos} onChange={(e) => set({ correos: e.target.value })}
                    placeholder="facturas@cliente.com; contabilidad@cliente.com" className="field min-h-[64px] resize-y py-2.5" />
                </div>
                <div>
                  <FieldLabel htmlFor={`${baseId}-recepcion`}>Ventana de recepción</FieldLabel>
                  <input id={`${baseId}-recepcion`} value={form.recepcion} maxLength={200} placeholder="Del 1 al 22 de cada mes"
                    onChange={(e) => set({ recepcion: e.target.value })} className="field h-11" />
                </div>
                <div>
                  <FieldLabel htmlFor={`${baseId}-obs`} hint="(opcional)">Observación</FieldLabel>
                  <textarea id={`${baseId}-obs`} value={form.observacion} maxLength={500} onChange={(e) => set({ observacion: e.target.value })}
                    className="field min-h-[64px] resize-y py-2.5" />
                </div>
              </div>
            )}
            {cliente.ficha.actualizado && (
              <p className="mt-4 text-[12px] text-fg-subtle">Actualizada por {cliente.ficha.actualizado.usuario}, {fechaHora(cliente.ficha.actualizado.fecha)}</p>
            )}
          </ModalSection>
          <ModalSection aside title="Por cobrar" description={`${bs(cliente.cobranza.saldo)} en ${cliente.cobranza.facturas.length} facturas`}>
            {cliente.cobranza.facturas.length === 0 && <p className="text-[13px] text-fg-muted">No tiene facturas por cobrar.</p>}
            <ul className="flex flex-col gap-2">
              {cliente.cobranza.facturas.map(f => (
                <li key={f.id}>
                  <button type="button" onClick={() => onOpenFactura?.(f.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-fg">N.º {f.numero} · {bs(f.saldo)}</span>
                      <span className="block text-[12px] text-fg-muted">Emitida {fecha(f.fechaEmision)} · vence {fecha(f.vence)}</span>
                    </span>
                    <Mora dias={f.diasMora} tramo={f.tramo} />
                  </button>
                </li>
              ))}
            </ul>
          </ModalSection>
        </ModalColumns>
      )}
    </Modal>
  );
}
