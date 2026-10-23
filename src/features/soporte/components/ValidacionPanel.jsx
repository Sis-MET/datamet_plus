import { useState } from 'react';
import { BadgeCheck, Send, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../shared/components/ui/Button';
import { ToneBadge } from '../../calibration/components/primitives';
import { soporteApi } from '../api/soporte';
import { ESTADOS_VALIDACION, fechaHora } from '../domain/informe';
import { MotivoModal } from './MotivoModal';

export function ValidacionPanel({ informe, pendientes, avisos, onAccion, tipo, codigo }) {
  const [busy, setBusy] = useState(false);
  const [observando, setObservando] = useState(false);
  const validacion = informe.validacion || { estado: 'BORRADOR' };
  const estado = ESTADOS_VALIDACION[validacion.estado];
  const bloqueado = ['PENDIENTE', 'APROBADO'].includes(validacion.estado);
  const ejecutar = async (accion, mensaje) => {
    setBusy(true);
    try {
      await onAccion(accion(tipo, codigo, { version: informe.version }));
      toast.success(mensaje);
    } catch (error) {
      if (error.status !== 409) toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Validación del informe" className="rounded-2xl border border-line bg-surface-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 text-[13px]">
          <ToneBadge tone={estado.tone}>{estado.label}</ToneBadge>
          <p className="mt-2 text-fg-muted">
            {validacion.estado === 'APROBADO'
              ? 'El técnico ya puede emitir. Para cambiar datos o fotos, retire la validación y solicite una nueva aprobación.'
              : validacion.estado === 'PENDIENTE'
                ? 'Un aprobador autorizado debe revisar los datos, las pruebas y las fotos antes de aprobar la emisión.'
                : 'Guarde los datos y envíe el informe a revisión. Solo podrá emitir después de la aprobación de personal autorizado.'}
          </p>
          {validacion.enviadaPor && <p className="mt-1 text-xs text-fg-muted">Enviado por {validacion.enviadaPor.nombre || validacion.enviadaPor.usuario} · {fechaHora(validacion.enviadaEn)}</p>}
          {validacion.resueltaPor && <p className="mt-1 text-xs text-fg-muted">Revisado por {validacion.resueltaPor.nombre || validacion.resueltaPor.usuario} · {fechaHora(validacion.resueltaEn)}</p>}
          {validacion.observacion && <p className="mt-2 whitespace-pre-line break-words text-fg"><strong>Observaciones:</strong> {validacion.observacion}</p>}
          {avisos > 0 && <p className="mt-2 text-xs text-fg-muted">Hay {avisos} avisos de datos faltantes o lecturas para revisar en el informe.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {informe.acciones.editar && !bloqueado && (
            <Button onClick={() => ejecutar(soporteApi.enviarValidacion, 'Informe enviado a revisión.')}
              disabled={busy || pendientes > 0} isLoading={busy} title={pendientes ? 'Guarde los cambios antes de enviar' : undefined}>
              <Send className="h-4 w-4" aria-hidden="true" /> Enviar a revisión
            </Button>
          )}
          {informe.acciones.aprobar && validacion.estado === 'PENDIENTE' && (
            <>
              <Button onClick={() => ejecutar((t, c, body) => soporteApi.resolverValidacion(t, c, { ...body, decision: 'APROBAR' }), 'Informe aprobado para emitir.')}
                disabled={busy} isLoading={busy}><BadgeCheck className="h-4 w-4" aria-hidden="true" /> Aprobar informe</Button>
              <Button variant="secondary" onClick={() => setObservando(true)} disabled={busy}>Devolver con observaciones</Button>
            </>
          )}
          {informe.acciones.editar && bloqueado && (
            <Button variant="ghost" disabled={busy} onClick={() => ejecutar(soporteApi.retirarValidacion, 'Validación retirada. Después de editar deberá enviarla nuevamente.')}>
              <Undo2 className="h-4 w-4" aria-hidden="true" /> Retirar para editar
            </Button>
          )}
        </div>
      </div>
      {observando && <MotivoModal titulo="Devolver al técnico" descripcion="Indique qué debe corregirse antes de solicitar otra validación."
        etiqueta="Observaciones del aprobador" accion="Devolver con observaciones" onClose={() => setObservando(false)}
        onConfirm={async observacion => {
          await onAccion(soporteApi.resolverValidacion(tipo, codigo, { version: informe.version, decision: 'OBSERVAR', observacion }));
          toast.success('Informe devuelto para corregir.');
        }} />}
    </section>
  );
}
