import { AlertCircle, ArrowRight, History } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { EmptyState, ToneBadge } from '../../calibration/components/primitives';
import { systemApi } from '../api/system';
import { fechaHora } from '../domain/permisos';
import { useResource } from '../hooks/useResource';

const lista = (sujetos) => (sujetos.length ? sujetos.join(' · ') : 'Nadie (solo Sistemas)');

/**
 * Historial de los cambios de permisos (NB/ISO/IEC 17025, 8.4): quién, cuándo,
 * qué, a quién y quiénes lo tenían antes y después. Solo crece: la base no
 * deja modificar ni borrar sus filas.
 */
export function PermisosHistorial() {
  const { data: historial, error, reload } = useResource(systemApi.historialPermisos);

  if (error && !historial) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
        <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[13px] text-fg">
          <span className="font-semibold">No se pudo cargar el historial.</span> <span className="text-fg-muted">{error.message}</span>
        </p>
        <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
      </div>
    );
  }
  if (!historial) {
    return <div className="card h-48 animate-pulse shadow-card" role="status" aria-label="Cargando el historial" />;
  }
  if (historial.length === 0) {
    return <EmptyState icon={History} title="Sin cambios registrados">Cada permiso que se conceda o revoque quedará aquí.</EmptyState>;
  }
  return (
    <ol className="stagger-in card divide-y divide-line overflow-hidden shadow-card" aria-label="Cambios de permisos">
      {historial.map(cambio => (
        <li key={cambio.id} className="px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ToneBadge tone={cambio.accion === 'CONCEDER' ? 'success' : 'danger'}>{cambio.accion === 'CONCEDER' ? 'Concedido' : 'Revocado'}</ToneBadge>
            <p className="min-w-0 text-[13.5px] font-semibold text-fg">{cambio.permisoNombre}</p>
            <p className="text-[13px] text-fg-muted">a {cambio.sujeto}</p>
            <p className="ml-auto text-xs tabular-nums text-fg-subtle">
              <time dateTime={cambio.fecha}>{fechaHora(cambio.fecha)}</time> · {cambio.nombre || cambio.usuario}
            </p>
          </div>
          {cambio.motivo && <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg">{cambio.motivo}</p>}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed text-fg-muted">
            <span><span className="font-medium text-fg-subtle">Antes:</span> {lista(cambio.antes)}</span>
            <ArrowRight className="h-3 w-3 flex-none text-fg-subtle" aria-hidden="true" />
            <span><span className="font-medium text-fg-subtle">Después:</span> {lista(cambio.despues)}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
