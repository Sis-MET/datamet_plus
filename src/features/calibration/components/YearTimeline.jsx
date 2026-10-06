import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { subDays } from 'date-fns';
import { cn } from '../../../shared/utils/cn';
import {
  TIPOS,
  formatDate,
  frequencyLabel,
  monthLengths,
  occurrenceTitle,
  occurrenceWhen,
  parseISODate,
  toISODate,
  yearFraction,
} from '../domain/format';
import { Glyph } from './primitives';
import { OccurrenceHoverCard } from './HoverCard';
import { useHoverCard } from '../hooks/useHoverCard';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ATTENTION = new Set(['VENCIDO', 'PROXIMO']);

const pct = (fraction) => `${(fraction * 100).toFixed(3)}%`;

/** Tramos de la vigencia del certificado visibles en el año. */
function certificateBands(equipo, anio, hoy, alertaDias) {
  if (!equipo.certFecha || !equipo.vence) return [];
  const yearStart = `${anio}-01-01`;
  const yearEnd = `${anio}-12-31`;
  if (equipo.certFecha > yearEnd) return [];
  const bands = [];

  if (equipo.vence >= yearStart) {
    const windowStart = toISODate(subDays(parseISODate(equipo.vence), alertaDias));
    const start = yearFraction(equipo.certFecha, anio);
    const end = yearFraction(equipo.vence, anio);
    if (end > start) bands.push({ key: 'vigencia', className: 'cal-band', start, end });
    const wStart = Math.max(start, yearFraction(windowStart, anio));
    if (alertaDias > 0 && end > wStart) bands.push({ key: 'ventana', className: 'cal-band cal-band-window', start: wStart, end });
  }

  // Sin recalibrar, el tramo entre el vencimiento y hoy queda sin cobertura.
  if (equipo.vigencia === 'VENCIDO' && hoy >= yearStart) {
    const start = yearFraction(equipo.vence, anio);
    const end = yearFraction(hoy, anio);
    if (end > start) bands.push({ key: 'vencido', className: 'cal-band cal-band-expired', start, end });
  }
  return bands;
}

const Marker = memo(function Marker({ occurrence, anio, onSelect, onHover }) {
  const fraction = yearFraction(occurrence.fecha, anio);
  const attention = ATTENTION.has(occurrence.situacion) && !occurrence.proyectado;
  const label = `${TIPOS[occurrence.tipo].label}: ${occurrenceTitle(occurrence)}, ${formatDate(occurrence.fecha)}, ${occurrenceWhen(occurrence)}`;
  return (
    <button
      type="button"
      className={cn('cal-mark', attention && 'cal-mark-attention')}
      style={{ left: pct(fraction) }}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onHover(null);
        onSelect(occurrence);
      }}
      onMouseEnter={(event) => onHover(occurrence, event.currentTarget)}
      onMouseLeave={() => onHover(null)}
      onFocus={(event) => onHover(occurrence, event.currentTarget)}
      onBlur={() => onHover(null)}
    >
      <Glyph tipo={occurrence.tipo} situacion={occurrence.situacion} proyectado={occurrence.proyectado} />
    </button>
  );
});

function Row({ label, sublabel, onOpen, children, onTrackClick, title }) {
  return (
    <div className="cal-tl-row">
      {onOpen ? (
        <button type="button" className="cal-tl-label" onClick={onOpen} title={title}>
          <strong>{label}</strong>
          {sublabel && <span>{sublabel}</span>}
        </button>
      ) : (
        <div className="cal-tl-label" title={title}>
          <strong>{label}</strong>
          {sublabel && <span>{sublabel}</span>}
        </div>
      )}
      <div className={cn('cal-tl-track', onTrackClick && 'cursor-pointer')} onClick={onTrackClick}>
        {children}
      </div>
    </div>
  );
}

function Group({ id, label, count, collapsed, onToggle, children }) {
  return (
    <section aria-label={label}>
      <div className="cal-tl-group">
        <div className="cal-tl-group-label">
          <button type="button" onClick={() => onToggle(id)} aria-expanded={!collapsed}>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-150', collapsed && '-rotate-90')} aria-hidden="true" />
            {label}
            <span className="cal-count">{count}</span>
          </button>
        </div>
      </div>
      {!collapsed && children}
    </section>
  );
}

/**
 * Vista anual: una fila por equipo (agrupados por planta) y por actividad,
 * con la vigencia del certificado como banda y cada fecha como marcador.
 */
export function YearTimeline({
  anio,
  hoy,
  ajustes,
  equipos,
  actividades,
  eventos,
  onSelectEvent,
  onOpenEquipo,
  onOpenActividad,
}) {
  const scrollRef = useRef(null);
  const frameRef = useRef(null);
  const [hover, handleHover, hideHover] = useHoverCard();
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [edges, setEdges] = useState({ left: false, right: false });

  const columns = useMemo(() => monthLengths(anio).map(days => `${days}fr`).join(' '), [anio]);
  const isCurrentYear = Number(hoy.slice(0, 4)) === anio;
  const currentMonth = isCurrentYear ? Number(hoy.slice(5, 7)) - 1 : -1;

  const eventsByRow = useMemo(() => {
    const map = new Map();
    for (const occurrence of eventos) {
      const key = occurrence.tipo === 'ACTIVIDAD' ? `a:${occurrence.programaId}` : `e:${occurrence.equipoId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(occurrence);
    }
    return map;
  }, [eventos]);

  const monthCounts = useMemo(() => {
    const counts = Array(12).fill(0);
    for (const occurrence of eventos) counts[Number(occurrence.fecha.slice(5, 7)) - 1] += 1;
    return counts;
  }, [eventos]);

  const groups = useMemo(() => {
    const byPlanta = new Map();
    for (const equipo of equipos) {
      if (!byPlanta.has(equipo.planta)) byPlanta.set(equipo.planta, []);
      byPlanta.get(equipo.planta).push(equipo);
    }
    return [...byPlanta.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [equipos]);

  const toggleGroup = useCallback((id) => {
    setCollapsed(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const updateEdges = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const element = scrollRef.current;
      if (!element) return;
      const max = element.scrollWidth - element.clientWidth;
      const next = { left: element.scrollLeft > 4, right: element.scrollLeft < max - 4 };
      setEdges(current => (current.left === next.left && current.right === next.right ? current : next));
    });
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    updateEdges();
    element.addEventListener('scroll', updateEdges, { passive: true });
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', updateEdges);
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [updateEdges]);

  // En pantallas angostas el año no cabe: se lleva la vista hasta hoy.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !isCurrentYear || element.scrollWidth <= element.clientWidth) return;
    const label = element.querySelector('.cal-tl-label')?.getBoundingClientRect().width || 0;
    const track = element.scrollWidth - label;
    const target = (yearFraction(hoy, anio) * track) - ((element.clientWidth - label) * 0.3);
    element.scrollLeft = Math.max(0, target);
  }, [anio, hoy, isCurrentYear]);

  const todayFraction = isCurrentYear ? yearFraction(hoy, anio) : null;
  const hasRows = equipos.length > 0 || actividades.length > 0;

  return (
    <div className="cal-timeline">
      <div className={cn('cal-scroll-edge cal-scroll-edge-left', edges.left && 'is-visible')} aria-hidden="true" />
      <div className={cn('cal-scroll-edge cal-scroll-edge-right', edges.right && 'is-visible')} aria-hidden="true" />
      <div ref={scrollRef} className="cal-timeline-scroll">
        <div className="cal-timeline-inner">
          <div className="cal-tl-head">
            <div className="cal-tl-corner">Equipo o actividad</div>
            <div className="cal-tl-months relative" style={{ gridTemplateColumns: columns }}>
              {MONTHS.map((month, index) => (
                <div key={month} className={cn('cal-tl-month', index === currentMonth && 'cal-tl-month-current')}>
                  <span>{month}</span>
                  <small>{monthCounts[index] > 0 ? `${monthCounts[index]} ${monthCounts[index] === 1 ? 'fecha' : 'fechas'}` : '—'}</small>
                </div>
              ))}
              {todayFraction !== null && (
                <span className="cal-tl-today-flag" style={{ left: pct(todayFraction) }}>Hoy</span>
              )}
            </div>
          </div>

          {!hasRows ? (
            <div className="cal-tl-empty">
              <strong>No hay nada que mostrar con estos filtros</strong>
              <span>Cambia el tipo, la planta o la búsqueda para ver el plan.</span>
            </div>
          ) : (
            <div className="cal-tl-body">
              <div className="cal-tl-lines" style={{ gridTemplateColumns: columns }} aria-hidden="true">
                {MONTHS.map((month, index) => (
                  <div key={month} className={index === currentMonth ? 'cal-tl-month-current' : undefined} />
                ))}
                {todayFraction !== null && <span className="cal-tl-today" style={{ left: pct(todayFraction) }} />}
              </div>

              {groups.map(([planta, items]) => (
                <Group
                  key={planta}
                  id={`planta:${planta}`}
                  label={`Equipos · ${planta}`}
                  count={items.length}
                  collapsed={collapsed.has(`planta:${planta}`)}
                  onToggle={toggleGroup}
                >
                  {items.map((equipo) => {
                    const alertaDias = equipo.calibracion?.alertaDias ?? ajustes.alertaDias;
                    const verificacion = equipo.verificacion?.activo
                      ? ` · Verif. ${frequencyLabel(equipo.verificacion.frecuenciaMeses).toLowerCase()}`
                      : '';
                    return (
                      <Row
                        key={equipo.id}
                        label={equipo.codigo}
                        sublabel={`${equipo.instrumento}${verificacion}`}
                        title={`${equipo.codigo} · ${equipo.instrumento}`}
                        onOpen={() => onOpenEquipo(equipo)}
                        onTrackClick={() => onOpenEquipo(equipo)}
                      >
                        {certificateBands(equipo, anio, hoy, alertaDias).map(band => (
                          <span
                            key={band.key}
                            className={band.className}
                            style={{ left: pct(band.start), width: pct(band.end - band.start) }}
                          />
                        ))}
                        {(eventsByRow.get(`e:${equipo.id}`) || []).map(occurrence => (
                          <Marker
                            key={occurrence.id}
                            occurrence={occurrence}
                            anio={anio}
                            onSelect={onSelectEvent}
                            onHover={handleHover}
                          />
                        ))}
                      </Row>
                    );
                  })}
                </Group>
              ))}

              {actividades.length > 0 && (
                <Group
                  id="actividades"
                  label="Actividades del área"
                  count={actividades.length}
                  collapsed={collapsed.has('actividades')}
                  onToggle={toggleGroup}
                >
                  {actividades.map(actividad => (
                    <Row
                      key={actividad.id}
                      label={actividad.titulo}
                      sublabel={[frequencyLabel(actividad.frecuenciaMeses), actividad.responsableNombre].filter(Boolean).join(' · ')}
                      title={actividad.titulo}
                      onOpen={() => onOpenActividad(actividad)}
                      onTrackClick={() => onOpenActividad(actividad)}
                    >
                      {(eventsByRow.get(`a:${actividad.id}`) || []).map(occurrence => (
                        <Marker
                          key={occurrence.id}
                          occurrence={occurrence}
                          anio={anio}
                          onSelect={onSelectEvent}
                          onHover={handleHover}
                        />
                      ))}
                    </Row>
                  ))}
                </Group>
              )}
            </div>
          )}
        </div>
      </div>
      <OccurrenceHoverCard hover={hover} onDismiss={hideHover} />
    </div>
  );
}

/** Referencia de formas, colores y bandas de la vista anual. */
export function TimelineLegend() {
  const states = [
    ['PROGRAMADO', 'Programada'],
    ['PROXIMO', 'En aviso'],
    ['VENCIDO', 'Vencida o atrasada'],
    ['EN_PROCESO', 'En proceso'],
    ['REALIZADO', 'Realizada'],
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-fg-muted">
      {Object.entries(TIPOS).map(([tipo, meta]) => (
        <span key={tipo} className="inline-flex items-center gap-2">
          <Glyph tipo={tipo} size={10} /> {meta.label}
        </span>
      ))}
      <span className="hidden h-4 w-px bg-line-strong sm:block" aria-hidden="true" />
      {states.map(([situacion, label]) => (
        <span key={situacion} className="inline-flex items-center gap-2">
          <Glyph tipo="CALIBRACION" situacion={situacion} size={9} /> {label}
        </span>
      ))}
      <span className="inline-flex items-center gap-2">
        <Glyph tipo="CALIBRACION" proyectado size={9} /> Estimada
      </span>
      <span className="hidden h-4 w-px bg-line-strong sm:block" aria-hidden="true" />
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-6 rounded-full bg-fg/10" aria-hidden="true" /> Certificado vigente
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-6 rounded-full bg-warning/30" aria-hidden="true" /> Periodo de aviso
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="w-6 border-t-2 border-dashed border-danger/70" aria-hidden="true" /> Sin certificado vigente
      </span>
    </div>
  );
}
