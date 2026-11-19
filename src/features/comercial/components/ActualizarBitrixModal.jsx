import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { BlockTitle, CancelButton, Modal, PrimaryButton } from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import { Cargando, ErrorCarga } from './comunes';

const QUE = [
  ['facturado', '«¿Está facturado?» pasa a Sí'],
  ['numeroFactura', 'Se escribe el N.º de factura'],
  ['etapa', 'Pasan a su etapa de cobro'],
  ['cierre', 'Pasan a Cerrado Ganado (facturas pagadas)'],
];

/**
 * Resumen de lo que falta en Bitrix24 y confirmación para actualizar todas
 * las negociaciones con factura de una vez. El servidor relee cada una antes
 * de escribir y no empieza si la cantidad ya no es la que se vio.
 */
export function ActualizarBitrixModal({ modo, onClose, onIniciada }) {
  const { data: resumen, error, reload } = useResource(comercialApi.bitrixPendientes);
  const [enviando, setEnviando] = useState(false);

  const actualizar = async (close) => {
    setEnviando(true);
    try {
      await comercialApi.bitrixActualizarPendientes(resumen.negociaciones);
      toast.success('Actualizando Bitrix24: el avance se ve arriba.');
      onIniciada();
      close();
    } catch (err) {
      toast.error(err.message || 'No se pudo iniciar la actualización.');
      setEnviando(false);
      if (err.status === 409) reload();
    }
  };

  const n = resumen?.negociaciones || 0;
  return (
    <Modal
      onClose={onClose}
      size="md"
      busy={enviando}
      title="Actualizar Bitrix24"
      subtitle={modo === 'prueba'
        ? 'Modo de prueba: se simula sobre la copia de DataMET+ y Bitrix24 no cambia.'
        : 'Las negociaciones con factura en DataMET+ a las que les falta algo en Bitrix24.'}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={enviando} />
          <PrimaryButton onClick={() => actualizar(close)} busy={enviando} busyLabel="Iniciando" disabled={!n}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Actualizar {n} {n === 1 ? 'negociación' : 'negociaciones'}
          </PrimaryButton>
        </div>
      )}
    >
      <div className="p-5">
        {error && <ErrorCarga titulo="No se pudo leer lo pendiente." error={error} onRetry={reload} />}
        {!resumen && !error && <Cargando label="Cargando lo pendiente" filas={2} />}
        {resumen && (
          <>
            <BlockTitle>Qué cambia</BlockTitle>
            <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line">
              {QUE.map(([clave, texto]) => (
                <div key={clave} className="flex items-center justify-between gap-3 bg-surface px-3 py-2 text-[13px]">
                  <dt className="text-fg">{texto}</dt>
                  <dd className="font-semibold tabular-nums text-fg">{resumen.cambios[clave].toLocaleString('es-BO')}</dd>
                </div>
              ))}
            </dl>
            {resumen.embudos.length > 0 && (
              <p className="mt-3 text-[12.5px] text-fg-muted">
                Por embudo: {resumen.embudos.map(e => `${e.nombre} ${e.negociaciones}`).join(' · ')}.
              </p>
            )}
            <ul className="mt-4 flex list-disc flex-col gap-1.5 pl-5 text-[13px] text-fg">
              <li>Cada negociación se vuelve a leer en Bitrix24 antes de escribir; si cambió, se salta y queda para revisarla.</li>
              <li>Las etapas solo avanzan, y solo desde facturación, cobro o «Concluido»: las que siguen en proceso (anticipos) quedan para moverlas a mano.</li>
              <li>Mover la etapa puede disparar las automatizaciones de Bitrix24 de esa etapa, como si se moviera a mano.</li>
              <li>Cada cambio queda en el historial con tu usuario.</li>
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
