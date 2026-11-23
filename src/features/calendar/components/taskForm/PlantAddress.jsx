import { Loader2, MapPin } from 'lucide-react';

/** Dirección de la planta elegida, de solo lectura: se edita en el registro de plantas. */
export function PlantAddress({ address, isLoading }) {
  const isPending = isLoading && !address;

  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5" aria-live="polite">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-fg/[0.06] text-fg-muted">
        {isPending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          : <MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-fg-subtle">Dirección de la planta</p>
        {isPending && <p className="mt-0.5 text-[13px] text-fg-muted">Cargando dirección…</p>}
        {!isPending && address && <p className="mt-0.5 break-words text-[13px] font-medium leading-snug text-fg">{address}</p>}
        {!isPending && !address && <p className="mt-0.5 text-[13px] text-fg-muted">Esta planta no tiene dirección registrada.</p>}
      </div>
    </div>
  );
}
