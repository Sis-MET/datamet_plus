import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';
import { capitalize, formatDate } from '../../../calibration/domain/format';
import { ToneBadge } from '../../../calibration/components/primitives';
import {
  CATEGORIAS,
  SITUACIONES,
  cuando,
  detalleGrupo,
  formaDe,
  otstDe,
  plantaVisible,
  rangoCorto,
  sugeridoLabel,
  subtituloEquipo,
  tipoLabel,
  tonoTexto,
  toneDe,
} from '../../domain/proximos';

/** Forma del tipo de servicio coloreada por la situación (mismas clases que calibración). */
export function Glifo({ forma = 'circle', situacion = 'PROGRAMADO', size, className, style }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'cal-glyph',
        `cal-glyph-${forma}`,
        `cal-tone-${toneDe(situacion)}`,
        situacion === 'DESCARTADO' && 'cal-glyph-cancelled',
        className,
      )}
      style={size || style ? { ...(size ? { '--glyph-size': `${size}px` } : {}), ...style } : undefined}
    />
  );
}

export function SituacionBadge({ situacion }) {
  return <ToneBadge tone={toneDe(situacion)}>{SITUACIONES[situacion]?.label || situacion}</ToneBadge>;
}

/** Referencia de formas, colores y bandas de la línea de tiempo. */
export function Leyenda() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-fg-muted">
      {CATEGORIAS.map(categoria => (
        <span key={categoria.forma} className="inline-flex items-center gap-2">
          <Glifo forma={categoria.forma} size={10} /> {categoria.label}
        </span>
      ))}
      <span className="hidden h-4 w-px bg-line-strong sm:block" aria-hidden="true" />
      {['REALIZADO', 'PROGRAMADO', 'PROXIMO', 'COORDINADO', 'VENCIDO', 'DESCARTADO'].map(situacion => (
        <span key={situacion} className="inline-flex items-center gap-2">
          <Glifo situacion={situacion} size={9} />
          {situacion === 'REALIZADO' ? 'Servicio realizado' : SITUACIONES[situacion].label}
        </span>
      ))}
      <span className="hidden h-4 w-px bg-line-strong sm:block" aria-hidden="true" />
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-6 rounded-full bg-fg/10" aria-hidden="true" /> Del último servicio al próximo
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-6 rounded-full bg-warning/30" aria-hidden="true" /> Periodo de aviso
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="w-6 border-t-2 border-dashed border-danger/70" aria-hidden="true" /> Vencido sin atender
      </span>
    </div>
  );
}

function Dato({ label, children }) {
  return (
    <div>
      <p className="text-[11px] text-fg-subtle">{label}</p>
      <div className="mt-0.5 break-words text-[13px] leading-snug text-fg">{children}</div>
    </div>
  );
}

/** Tarjeta de vidrio al pasar sobre una marca (servicio realizado o próximo servicio). */
export function TarjetaFlotante({ hover, onDismiss }) {
  const ref = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!hover || !ref.current) return;
    const anchor = hover.anchor.getBoundingClientRect();
    const box = ref.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(10, anchor.left + (anchor.width / 2) - (box.width / 2)),
      window.innerWidth - box.width - 10,
    );
    const above = anchor.top - box.height - 10;
    setPosition({ left, top: above > 10 ? above : Math.min(anchor.bottom + 10, window.innerHeight - box.height - 10) });
  }, [hover]);

  useEffect(() => {
    if (!hover) return undefined;
    window.addEventListener('scroll', onDismiss, true);
    return () => window.removeEventListener('scroll', onDismiss, true);
  }, [hover, onDismiss]);

  if (!hover) return null;
  const { occurrence: evento } = hover;
  const esServicio = evento.clase === 'SERVICIO';

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="glass pointer-events-none fixed z-[9999] w-[min(290px,calc(100vw-20px))] animate-pop-in rounded-2xl border p-4"
      style={position ? { left: position.left, top: position.top } : { left: -9999, top: -9999 }}
    >
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-fg-muted">
            {esServicio ? tipoLabel(evento.tipo) : 'Próximo servicio'}
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-fg">
            {capitalize(formatDate(evento.fecha, "EEEE d 'de' MMMM"))}
          </p>
        </div>
        <span className="shrink-0"><SituacionBadge situacion={evento.situacion} /></span>
      </div>
      <div className="flex gap-3">
        <span className={`cal-tone-${toneDe(evento.situacion)} w-1 shrink-0 rounded-full`} style={{ backgroundColor: 'var(--tone)' }} aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Dato label="Equipo">
            <span className="font-semibold">{evento.codMetrica}</span>
            {subtituloEquipo(evento) && <span className="text-fg-muted"> · {subtituloEquipo(evento)}</span>}
          </Dato>
          <Dato label="Cliente">{[evento.cliente, evento.planta].filter(Boolean).join(' · ')}</Dato>
          {esServicio ? (
            <>
              <Dato label="Técnico">{evento.tecnico || 'Sin dato'}</Dato>
              {evento.numero && <Dato label="Informe">{evento.numero}</Dato>}
            </>
          ) : (
            <>
              <Dato label="Tipo sugerido">{sugeridoLabel(evento)}</Dato>
              {evento.reprogramada && evento.fechaSugerida && (
                <Dato label="Fecha sugerida por el técnico">{formatDate(evento.fechaSugerida)}</Dato>
              )}
              <p className="flex items-center gap-1.5 text-[13px] font-medium tabular-nums text-fg">
                <Clock className="h-3.5 w-3.5 text-fg-muted" aria-hidden="true" />
                {cuando(evento)}
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CajaFecha({ fecha }) {
  return (
    <span className="flex w-11 flex-none flex-col items-center rounded-xl bg-surface-2 py-1.5 tabular-nums">
      <span className="text-[15px] font-semibold leading-none text-fg">{Number(fecha.slice(8))}</span>
      <span className="mt-1 text-[10px] font-medium uppercase leading-none text-fg-muted">{formatDate(fecha, 'MMM')}</span>
    </span>
  );
}

/**
 * Fila de un próximo servicio o de un servicio realizado: fecha, equipo,
 * cliente y situación, con la OTST del servicio anterior como referencia.
 * Dentro de un grupo (`compacto`) el cliente ya está en el encabezado y la
 * fila nombra el equipo.
 */
export function FilaEvento({ evento, onSelect, sinFecha = false, compacto = false, conFechaCorta = false }) {
  const esServicio = evento.clase === 'SERVICIO';
  const detalle = esServicio
    ? [tipoLabel(evento.tipo), evento.tecnico].filter(Boolean).join(' · ')
    : sugeridoLabel(evento);
  const otst = otstDe(evento);
  const referencia = otst ? `${esServicio ? 'OTST' : 'Servicio anterior: OTST'} ${otst}` : null;
  return (
    <button
      type="button"
      onClick={() => onSelect(evento)}
      className={cn(
        'group flex w-full items-center gap-3 text-left transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2',
        compacto ? 'py-2.5 pl-6 pr-4 sm:pl-[78px]' : 'px-4 py-3',
      )}
    >
      {!sinFecha && !compacto && evento.fecha && <CajaFecha fecha={evento.fecha} />}
      <Glifo forma={formaDe(evento)} situacion={evento.situacion} size={compacto ? 9 : 11} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn('truncate font-semibold text-fg', compacto ? 'text-[13px] tabular-nums' : 'text-[13.5px]')}>
            {compacto ? evento.codMetrica : evento.cliente}
          </span>
          {!compacto && <span className="hidden flex-none text-xs tabular-nums text-fg-muted sm:inline">{evento.codMetrica}</span>}
          {compacto && conFechaCorta && evento.fecha && (
            <span className="flex-none text-xs tabular-nums text-fg-muted">{formatDate(evento.fecha, 'd MMM')}</span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-fg-muted">
          {[subtituloEquipo(evento), detalle, compacto ? null : evento.ciudad].filter(Boolean).join(' · ')}
        </span>
        {referencia && <span className="mt-0.5 block truncate text-[11.5px] tabular-nums text-fg-subtle">{referencia}</span>}
      </span>
      <span className="hidden flex-none flex-col items-end gap-1 sm:flex">
        {!compacto && <SituacionBadge situacion={evento.situacion} />}
        {!esServicio && <span className={cn('text-xs font-medium tabular-nums', tonoTexto(evento.situacion))}>{cuando(evento)}</span>}
      </span>
      {!esServicio && (
        <span className={cn('flex-none text-xs font-medium tabular-nums sm:hidden', tonoTexto(evento.situacion))}>{cuando(evento)}</span>
      )}
      <ChevronRight className="h-4 w-4 flex-none text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

/**
 * Equipos de un mismo cliente y planta en una fila que se despliega. Un
 * grupo de un solo equipo se muestra como su fila.
 */
export function FilaGrupo({ grupo, onSelect, sinFecha = false, abiertoInicial = false }) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  if (grupo.items.length === 1) return <FilaEvento evento={grupo.items[0]} onSelect={onSelect} sinFecha={sinFecha} />;

  const { principal } = grupo;
  const esServicio = grupo.clase === 'SERVICIO';
  const rango = rangoCorto(grupo);
  const equipos = `${grupo.items.length} equipos`;
  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto(valor => !valor)}
        aria-expanded={abierto}
        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
      >
        {!sinFecha && <CajaFecha fecha={grupo.fecha} />}
        <Glifo forma={formaDe(principal)} situacion={grupo.situacion} size={11} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[13.5px] font-semibold text-fg">{grupo.cliente}</span>
            {plantaVisible(grupo) && <span className="hidden min-w-0 truncate text-xs text-fg-muted sm:inline">{plantaVisible(grupo)}</span>}
          </span>
          <span className="mt-0.5 block truncate text-xs text-fg-muted">
            <span className="font-medium text-fg">{equipos}</span>
            {' · '}
            {[rango, detalleGrupo(grupo), grupo.ciudad].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="hidden flex-none flex-col items-end gap-1 sm:flex">
          <SituacionBadge situacion={grupo.situacion} />
          {!esServicio && <span className={cn('text-xs font-medium tabular-nums', tonoTexto(grupo.situacion))}>{cuando(principal)}</span>}
        </span>
        {!esServicio && (
          <span className={cn('flex-none text-xs font-medium tabular-nums sm:hidden', tonoTexto(grupo.situacion))}>{cuando(principal)}</span>
        )}
        <ChevronDown
          className={cn('h-4 w-4 flex-none text-fg-subtle transition-transform duration-150', !abierto && '-rotate-90')}
          aria-hidden="true"
        />
      </button>
      {abierto && (
        <ul className="divide-y divide-line border-t border-dashed border-line bg-surface-2/40" aria-label={`Equipos de ${grupo.cliente}`}>
          {grupo.items.map(item => (
            <li key={item.id}>
              <FilaEvento evento={item} onSelect={onSelect} compacto conFechaCorta={Boolean(rango)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
