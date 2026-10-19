import { cn } from '../../../shared/utils/cn';

/** Par etiqueta-valor de la ficha; no se muestra si no hay valor. */
export function Dato({ label, children, mono = false }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div className="grid grid-cols-[minmax(110px,0.4fr)_minmax(0,1fr)] gap-3 py-1.5 text-[13px]">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={cn('min-w-0 break-words text-fg', mono && 'font-mono text-[12.5px]')}>{children}</dd>
    </div>
  );
}

/** Firma registrada (PNG), con el nombre de quien firmó. */
export function Firma({ titulo, nombre, src }) {
  return (
    <figure>
      <figcaption className="mb-1.5 text-[12.5px] text-fg-muted">
        {titulo}
        {nombre && <span className="block font-medium text-fg">{nombre}</span>}
      </figcaption>
      <div className="rim-firma">
        {src
          ? <img src={src} alt={`${titulo}${nombre ? ` de ${nombre}` : ''}`} />
          : <span className="px-4 text-center text-xs text-fg-subtle">Sin firma (RIM de prueba anterior a la segunda firma)</span>}
      </div>
    </figure>
  );
}
