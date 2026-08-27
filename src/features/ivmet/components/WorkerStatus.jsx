import React from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { workerAvailability } from '../onboarding';

export function WorkerStatus({ workers, scopeId = null }) {
  if (workers === undefined)
    return (
      <div className="iv-worker-status" role="status">
        <Cloud size={19} />
        <span>Comprobando el servicio de sincronización…</span>
      </div>
    );
  const state = workerAvailability(workers, scopeId);
  const online = state === 'ONLINE';
  return (
    <div
      className={`iv-worker-status ${online ? '' : 'attention'}`}
      role="status"
    >
      {online ? <Cloud size={19} /> : <CloudOff size={19} />}
      <div>
        <strong>
          {online
            ? 'Sincronización automática disponible'
            : state === 'RESTRICTED'
              ? 'Servicio limitado a otro cliente'
              : state === 'DEGRADED'
                ? 'Servicio conectado con incidencias'
                : 'Sin servicio de sincronización disponible'}
        </strong>
        <p>
          {online
            ? 'Las solicitudes se procesan en el servidor, aunque cierres RimMET.'
            : state === 'RESTRICTED'
              ? 'El worker conserva un filtro de piloto. El responsable del servidor debe configurar el alcance de producción.'
              : state === 'DEGRADED'
                ? 'Los intentos fallidos se reprograman automáticamente. Revisa el detalle de la solicitud.'
                : 'Las solicitudes quedan guardadas en cola. El responsable del servidor debe iniciar o revisar ivmet-worker.'}
        </p>
      </div>
    </div>
  );
}
