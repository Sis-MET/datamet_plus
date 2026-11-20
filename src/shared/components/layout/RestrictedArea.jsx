import { useId } from 'react';
import { ArrowLeft, FlaskConical, Lock } from 'lucide-react';

/**
 * Fondo de muestra del apartado: barras y filas genéricas, sin datos. El
 * apartado real no se monta, así que no pide nada al servidor.
 */
function Ghost() {
  return (
    <div aria-hidden="true" className="pointer-events-none select-none px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-11 w-full max-w-sm rounded-xl border border-line bg-surface" />
        <div className="h-11 w-48 rounded-xl border border-line bg-surface" />
        <div className="h-11 w-28 rounded-xl border border-line bg-surface" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[28, 24, 22].map(width => (
          <div key={width} className="h-8 rounded-full border border-line bg-surface" style={{ width: `${width * 4}px` }} />
        ))}
      </div>
      <div className="mt-6 grid gap-3">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="card flex h-[68px] items-center gap-4 px-5">
            <div className="h-3 w-32 rounded-full bg-fg/[0.12]" />
            <div className="hidden h-3 w-56 rounded-full bg-fg/[0.07] sm:block" />
            <div className="ml-auto h-2 w-24 rounded-full bg-fg/[0.08]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Apartado de otra área: todo el contenido queda difuminado y un aviso dice
 * que no pertenece al área o no está autorizado. Uno en pruebas (`enPruebas`)
 * lo usa solo Sistemas, también para su propia área. La barra lateral sigue
 * disponible para ir a otro apartado.
 */
export function RestrictedArea({ view, enPruebas = false, onExit }) {
  const titleId = useId();
  const onlySystems = view.area.id === null;
  const Icono = enPruebas ? FlaskConical : Lock;

  return (
    <div className="relative min-h-[calc(100dvh-var(--topbar-height))] overflow-hidden">
      <div className="opacity-80 blur-[7px]">
        <Ghost />
      </div>
      <div className="absolute inset-0 flex items-start justify-center bg-canvas/40 px-4 pb-10 pt-[12vh] backdrop-blur-[2px] sm:items-center sm:pt-10">
        <section
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="glass w-full max-w-md rounded-3xl border p-6 text-center sm:p-8"
        >
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-fg/[0.06] text-fg">
            <Icono className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
          </span>
          <h2 id={titleId} className="mt-4 text-lg font-semibold tracking-[-0.01em] text-fg">
            {enPruebas ? 'Apartado en pruebas' : 'Acceso restringido'}
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">
            {enPruebas
              ? <><span className="font-medium text-fg">{view.label}</span> está en pruebas. Mientras tanto solo lo usa el área de Sistemas.</>
              : onlySystems
                ? <>Por ahora, <span className="font-medium text-fg">{view.label}</span> es solo del área de Sistemas. No estás autorizado para acceder a este apartado.</>
                : <><span className="font-medium text-fg">{view.label}</span> es del área de {view.area.nombre}. No perteneces a esa área o no estás autorizado para acceder a este apartado.</>}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-subtle">
            {enPruebas
              ? 'Se abrirá a su área cuando terminen las pruebas.'
              : 'Si necesitas usarlo, pide acceso al área de Sistemas.'}
          </p>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Ir al RIM
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
