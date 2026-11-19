import { useCallback, useMemo, useState } from 'react';
import { UserRoundCheck, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import { Dropdown } from '../../calibration/components/Dropdown';
import { EmptyState, ToneBadge } from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import { fechaHora, iniciales } from '../domain/comercial';
import { Cargando, ErrorCarga } from './comunes';

const cargar = () => Promise.all([comercialApi.bitrixUsuarios(), comercialApi.personal()])
  .then(([usuarios, personal]) => ({ usuarios, personal }));

function Fila({ usuario, opciones, soloConsulta, onGuardado }) {
  const actual = usuario.usuarioId ? String(usuario.usuarioId) : '';
  // Sin persona confirmada, se propone la sugerida (hay que confirmarla igual).
  const [eleccion, setEleccion] = useState(actual || (usuario.sugeridoId ? String(usuario.sugeridoId) : ''));
  const [guardando, setGuardando] = useState(false);
  const cambiado = eleccion !== actual;
  const nombre = usuario.nombreBitrix || `Usuario ${usuario.bitrixId} de Bitrix24`;

  const guardar = async () => {
    setGuardando(true);
    try {
      await comercialApi.bitrixConfirmarUsuario(usuario.bitrixId, eleccion ? Number(eleccion) : null);
      toast.success(eleccion ? `${nombre} quedó enlazado con su persona de DataMET+.` : `Se quitó la persona de ${nombre}.`);
      onGuardado();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  let estado = <ToneBadge tone="warning">Sin persona</ToneBadge>;
  if (usuario.usuarioId) estado = <ToneBadge tone="success">Confirmado</ToneBadge>;
  else if (usuario.sugeridoId) estado = <ToneBadge tone="info">Sugerido</ToneBadge>;

  return (
    <li className="grid gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_7.5rem] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-2 text-[12px] font-semibold text-fg-muted" aria-hidden="true">
          {iniciales(usuario.nombreBitrix) || '?'}
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-fg">
            <span className="truncate">{nombre}</span>
            {estado}
          </p>
          <p className="text-[12px] text-fg-muted">
            {usuario.negociaciones} {usuario.negociaciones === 1 ? 'negociación' : 'negociaciones'}
            {usuario.confirmado ? ` · ${usuario.confirmado.usuario}, ${fechaHora(usuario.confirmado.fecha)}` : ''}
            {!usuario.usuarioId && usuario.sugerencia ? ` · ${usuario.sugerencia}` : ''}
          </p>
        </div>
      </div>
      {soloConsulta ? (
        <p className="text-[13px] text-fg md:col-span-2">{usuario.usuario || '—'}</p>
      ) : (
        <>
          <Dropdown
            ariaLabel={`Persona de DataMET+ de ${nombre}`}
            value={eleccion}
            onChange={setEleccion}
            options={[{ value: '', label: 'Sin persona' }, ...opciones]}
            size="sm"
            menuWidth={320}
          />
          {/* Confirmado y sin cambios no hay nada que guardar; el hueco mantiene la columna. */}
          <Button size="sm" className={cn('h-9 justify-self-start', usuario.usuarioId && !cambiado && 'invisible')}
            disabled={guardando || !cambiado || (!eleccion && !usuario.usuarioId)} onClick={guardar}>
            <UserRoundCheck className="h-4 w-4" aria-hidden="true" /> {usuario.usuarioId ? 'Guardar' : 'Confirmar'}
          </Button>
        </>
      )}
    </li>
  );
}

/**
 * Responsables de las negociaciones de Bitrix24 y su persona en DATA_USERS.
 * La sincronización sugiere una cuando sus facturas la dicen con claridad;
 * aquí se confirma. Con ella, la factura que se propone trae su responsable.
 */
export function ResponsablesBitrix({ soloConsulta, clave, onChanged }) {
  const { data, error, reload } = useResource(cargar);
  const [claveCargada, setClaveCargada] = useState(clave);
  if (claveCargada !== clave) {
    setClaveCargada(clave);
    reload();
  }
  const opciones = useMemo(() => (data?.personal || [])
    .map(persona => ({ value: String(persona.id), label: persona.nombre, group: persona.area || 'Sin área' }))
    .sort((a, b) => (a.group === 'Comercial' ? -1 : b.group === 'Comercial' ? 1 : a.group.localeCompare(b.group))), [data]);
  const guardado = useCallback(() => onChanged?.(), [onChanged]);

  if (error) return <ErrorCarga titulo="No se pudieron cargar los responsables." error={error} onRetry={reload} />;
  if (!data) return <Cargando label="Cargando responsables" filas={3} />;
  if (!data.usuarios.length) {
    return (
      <EmptyState icon={UsersRound} title="Todavía no hay responsables">
        Aparecen aquí los usuarios de Bitrix24 que tienen negociaciones, después de sincronizar.
      </EmptyState>
    );
  }

  return (
    <section aria-label="Responsables de Bitrix24" className="card overflow-hidden shadow-card">
      <p className="border-b border-line bg-surface-2/60 px-4 py-2.5 text-[12.5px] text-fg-muted">
        Cada usuario de Bitrix24 con su persona de DataMET+: así la factura que se propone desde una negociación trae su responsable comercial.
      </p>
      <ul className="divide-y divide-line">
        {data.usuarios.map(usuario => (
          <Fila key={`${usuario.bitrixId}:${usuario.usuarioId ?? ''}`} usuario={usuario} opciones={opciones} soloConsulta={soloConsulta} onGuardado={guardado} />
        ))}
      </ul>
    </section>
  );
}
