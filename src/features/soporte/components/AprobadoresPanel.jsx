import { useState } from 'react';
import { AlertCircle, Loader2, RotateCw, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../shared/components/ui/Button';
import { useResource } from '../../system/hooks/useResource';
import { soporteApi } from '../api/soporte';
import { fechaHora } from '../domain/informe';

export function AprobadoresPanel() {
  const { data, error, loading, reload } = useResource(soporteApi.aprobadores);
  const [seleccion, setSeleccion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState(null);
  const [guardado, setGuardado] = useState(null);
  const actual = guardado || data;
  const ids = seleccion || actual?.aprobadores || [];
  const cambios = actual && JSON.stringify([...ids].sort((a, b) => a - b)) !== JSON.stringify([...actual.aprobadores].sort((a, b) => a - b));
  const recargar = () => { setSeleccion(null); setGuardado(null); setFallo(null); reload(); };
  const guardar = async () => {
    setGuardando(true); setFallo(null);
    try {
      const nuevo = await soporteApi.guardarAprobadores({ version: actual.version, aprobadores: ids });
      setGuardado(nuevo); setSeleccion(null);
      toast.success('Aprobadores actualizados.');
    } catch (failure) { setFallo(failure.message); }
    finally { setGuardando(false); }
  };
  return (
    <section aria-labelledby="aprobadores-titulo" className="max-w-3xl rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="h-5 w-5 text-fg-muted" aria-hidden="true" />
        <h2 id="aprobadores-titulo" className="text-lg font-semibold text-fg">Aprobadores de informes</h2>
      </div>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-muted">
        Seleccione quién puede revisar, aprobar o devolver informes de Soporte Técnico. Puede autorizar a varias personas.
        El jefe de área conserva estos permisos por su cargo y es quien administra esta configuración.
      </p>
      {loading && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-fg-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando personal…</p>}
      {(error || fallo) && <div role="alert" className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-danger/30 p-3 text-sm text-danger">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{fallo || error.message}</span>
        <Button variant="secondary" onClick={recargar} disabled={guardando || loading}><RotateCw className="h-4 w-4" aria-hidden="true" /> Recargar configuración</Button>
      </div>}
      {actual && !loading && !error && <>
        <fieldset disabled={guardando} className="mt-5">
          <legend className="mb-2 text-sm font-semibold text-fg">Personal activo de Soporte Técnico</legend>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {actual.personal.map(persona => <label key={persona.id} className="flex min-h-16 cursor-pointer items-center gap-3 px-3 py-3 hover:bg-surface-2 sm:px-4">
              <input type="checkbox" checked={persona.esJefe || ids.includes(persona.id)} disabled={persona.esJefe}
                className="h-5 w-5 shrink-0 accent-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg"
                onChange={event => setSeleccion(event.target.checked ? [...ids, persona.id] : ids.filter(id => id !== persona.id))} />
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium text-fg">{persona.nombre}</span>
                <span className="block break-words text-xs text-fg-muted">{persona.cargo || 'Sin cargo registrado'}{persona.esJefe ? ' · Autorizado por cargo' : ''}</span></span>
            </label>)}
          </div>
        </fieldset>
        <p className="mt-3 text-xs leading-relaxed text-fg-muted">{ids.length} {ids.length === 1 ? 'aprobador adicional seleccionado' : 'aprobadores adicionales seleccionados'}. Los permisos se aplican al guardar y se verifican en cada aprobación.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button onClick={guardar} disabled={!cambios || guardando} isLoading={guardando}><Save className="h-4 w-4" aria-hidden="true" /> Guardar aprobadores</Button>
          {cambios && <Button variant="ghost" onClick={() => { setSeleccion(null); setFallo(null); }} disabled={guardando}>Descartar cambios</Button>}
          {!cambios && actual.actualizadoEn && <p className="text-xs text-fg-muted">Actualizado por {actual.actualizadoPor} · {fechaHora(actual.actualizadoEn)}</p>}
        </div>
      </>}
    </section>
  );
}
