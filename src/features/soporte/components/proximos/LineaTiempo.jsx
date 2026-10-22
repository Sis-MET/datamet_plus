import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { subDays } from 'date-fns';
import { cn } from '../../../../shared/utils/cn';
import { formatDate, monthLengths, parseISODate, toISODate, yearFraction } from '../../../calibration/domain/format';
import { useHoverCard } from '../../../calibration/hooks/useHoverCard';
import { cuando, formaDe, subtituloEquipo, tipoLabel } from '../../domain/proximos';
import { Glifo, TarjetaFlotante } from './piezas';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ATENCION = new Set(['VENCIDO', 'PROXIMO']);

const pct = (fraction) => `${(fraction * 100).toFixed(3)}%`;

/**
 * Tramos de la fila de un equipo visibles en el año: del último servicio al
 * próximo, el periodo de aviso y, si venció, lo que va sin atender hasta hoy.
 */
function bandas(equipo, anio, hoy, alertaDias) {
  const proximo = equipo.proximo;
  if (!proximo?.fecha || proximo.descartada) return [];
  const desdeAnio = `${anio}-01-01`;
  const hastaAnio = `${anio}-12-31`;
  const inicio = equipo.origen?.fecha;
  const resultado = [];

  if (inicio && inicio <= hastaAnio && proximo.fecha >= desdeAnio) {
    const start = yearFraction(inicio, anio);
    const end = yearFraction(proximo.fecha, anio);
    if (end > start) resultado.push({ key: 'vigencia', className: 'cal-band', start, end });
    if (alertaDias > 0) {
      const ventana = Math.max(start, yearFraction(toISODate(subDays(parseISODate(proximo.fecha), alertaDias)), anio));
      if (end > ventana) resultado.push({ key: 'ventana', className: 'cal-band cal-band-window', start: ventana, end });
    }
  }

  if (proximo.situacion === 'VENCIDO' && hoy >= desdeAnio && proximo.fecha <= hastaAnio) {
    const start = yearFraction(proximo.fecha, anio);
    const end = yearFraction(hoy, anio);
    if (end > start) resultado.push({ key: 'vencido', className: 'cal-band cal-band-expired', start, end });
  }
  return resultado;
}

const etiquetaMarca = (evento) => {
  const fecha = formatDate(evento.fecha);
  if (evento.clase === 'SERVICIO') return `${tipoLabel(evento.tipo)} realizado el ${fecha}, ${evento.codMetrica}`;
  return `Próximo servicio de ${evento.codMetrica}: ${fecha}, ${cuando(evento)}`;
};

const Marca = memo(function Marca({ evento, anio, onSelect, onHover }) {
  const atencion = evento.clase === 'PROXIMO' && ATENCION.has(evento.situacion);
  return (
    <button
      type="button"
      className={cn('cal-mark', atencion && 'cal-mark-attention')}
      style={{ left: pct(yearFraction(evento.fecha, anio)) }}
      aria-label={etiquetaMarca(evento)}
      onClick={(event) => {
        event.stopPropagation();
        onHover(null);
        onSelect(evento);
      }}
      onMouseEnter={(event) => onHover(evento, event.currentTarget)}
      onMouseLeave={() => onHover(null)}
      onFocus={(event) => onHover(evento, event.currentTarget)}
      onBlur={() => onHover(null)}
    >
      <Glifo forma={formaDe(evento)} situacion={evento.situacion} />
    </button>
  );
});

/** Encabezado de un cliente: se abre y se cierra, y resume sus fechas del año. */
function Grupo({ id, cliente, equipos, eventos, anio, abierto, onToggle, children }) {
  const resumen = useMemo(() => eventos.filter(evento => evento.clase === 'PROXIMO'), [eventos]);
  const vencidos = resumen.filter(evento => evento.situacion === 'VENCIDO').length;
  return (
    <section aria-label={cliente}>
      <div className="st-tl-group" onClick={() => onToggle(id)}>
        <button
          type="button"
          className="st-tl-group-label"
          aria-expanded={abierto}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(id);
          }}
          title={cliente}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 flex-none text-fg-muted transition-transform duration-150', !abierto && '-rotate-90')} aria-hidden="true" />
          <span className="st-tl-group-name">{cliente}</span>
          <span className={cn('cal-count flex-none', vencidos > 0 && 'cal-count-alert')} title={`${equipos} ${equipos === 1 ? 'equipo' : 'equipos'}`}>
            {equipos}
          </span>
        </button>
        <div className="st-tl-sum" aria-hidden="true">
          {resumen.map(evento => (
            <Glifo
              key={evento.id}
              forma={formaDe(evento)}
              situacion={evento.situacion}
              className="st-tl-sum-mark"
              style={{ left: pct(yearFraction(evento.fecha, anio)) }}
            />
          ))}
        </div>
      </div>
      {abierto && children}
    </section>
  );
}

/**
 * Vista anual como la de calibración: un grupo por cliente con una fila por
 * equipo, la banda del último servicio al próximo y cada fecha como marca.
 */
export function LineaTiempo({ anio, hoy, ajustes, equipos, eventos, abiertos, onToggle, onSelect, onAbrirEquipo }) {
  const scrollRef = useRef(null);
  const frameRef = useRef(null);
  const [hover, mostrarHover, ocultarHover] = useHoverCard();
  const [bordes, setBordes] = useState({ left: false, right: false });

  const columnas = useMemo(() => monthLengths(anio).map(dias => `${dias}fr`).join(' '), [anio]);
  const esAnioActual = Number(hoy.slice(0, 4)) === anio;
  const mesActual = esAnioActual ? Number(hoy.slice(5, 7)) - 1 : -1;

  const eventosPorEquipo = useMemo(() => {
    const mapa = new Map();
    for (const evento of eventos) {
      if (!mapa.has(evento.equipoId)) mapa.set(evento.equipoId, []);
      mapa.get(evento.equipoId).push(evento);
    }
    return mapa;
  }, [eventos]);

  const porMes = useMemo(() => {
    const cuenta = Array(12).fill(0);
    for (const evento of eventos) {
      if (evento.clase === 'PROXIMO') cuenta[Number(evento.fecha.slice(5, 7)) - 1] += 1;
    }
    return cuenta;
  }, [eventos]);

  const grupos = useMemo(() => {
    const porCliente = new Map();
    for (const equipo of equipos) {
      if (!porCliente.has(equipo.cliente)) porCliente.set(equipo.cliente, []);
      porCliente.get(equipo.cliente).push(equipo);
    }
    return [...porCliente.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [equipos]);

  const actualizarBordes = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const element = scrollRef.current;
      if (!element) return;
      const max = element.scrollWidth - element.clientWidth;
      const next = { left: element.scrollLeft > 4, right: element.scrollLeft < max - 4 };
      setBordes(current => (current.left === next.left && current.right === next.right ? current : next));
    });
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    actualizarBordes();
    element.addEventListener('scroll', actualizarBordes, { passive: true });
    const observer = new ResizeObserver(actualizarBordes);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', actualizarBordes);
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [actualizarBordes]);

  // En pantallas angostas el año no cabe: se lleva la vista hasta hoy.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !esAnioActual || element.scrollWidth <= element.clientWidth) return;
    const label = element.querySelector('.cal-tl-label, .st-tl-group-label')?.getBoundingClientRect().width || 0;
    const track = element.scrollWidth - label;
    const target = (yearFraction(hoy, anio) * track) - ((element.clientWidth - label) * 0.3);
    element.scrollLeft = Math.max(0, target);
  }, [anio, hoy, esAnioActual]);

  const hoyFraccion = esAnioActual ? yearFraction(hoy, anio) : null;

  return (
    <div className="cal-timeline">
      <div className={cn('cal-scroll-edge cal-scroll-edge-left', bordes.left && 'is-visible')} aria-hidden="true" />
      <div className={cn('cal-scroll-edge cal-scroll-edge-right', bordes.right && 'is-visible')} aria-hidden="true" />
      <div ref={scrollRef} className="cal-timeline-scroll">
        <div className="cal-timeline-inner">
          <div className="cal-tl-head">
            <div className="cal-tl-corner">Cliente y equipo</div>
            <div className="cal-tl-months relative" style={{ gridTemplateColumns: columnas }}>
              {MESES.map((mes, index) => (
                <div key={mes} className={cn('cal-tl-month', index === mesActual && 'cal-tl-month-current')}>
                  <span>{mes}</span>
                  <small>{porMes[index] > 0 ? `${porMes[index]} ${porMes[index] === 1 ? 'próximo' : 'próximos'}` : '—'}</small>
                </div>
              ))}
              {hoyFraccion !== null && <span className="cal-tl-today-flag" style={{ left: pct(hoyFraccion) }}>Hoy</span>}
            </div>
          </div>

          {grupos.length === 0 ? (
            <div className="cal-tl-empty">
              <strong>No hay nada que mostrar con estos filtros</strong>
              <span>Cambie el año, el cliente, la situación o la búsqueda.</span>
            </div>
          ) : (
            <div className="cal-tl-body">
              <div className="cal-tl-lines" style={{ gridTemplateColumns: columnas }} aria-hidden="true">
                {MESES.map((mes, index) => (
                  <div key={mes} className={index === mesActual ? 'cal-tl-month-current' : undefined} />
                ))}
                {hoyFraccion !== null && <span className="cal-tl-today" style={{ left: pct(hoyFraccion) }} />}
              </div>

              {grupos.map(([cliente, lista]) => {
                const id = `cliente:${cliente}`;
                const eventosCliente = lista.flatMap(equipo => eventosPorEquipo.get(equipo.id) || []);
                return (
                  <Grupo
                    key={id}
                    id={id}
                    cliente={cliente}
                    equipos={lista.length}
                    eventos={eventosCliente}
                    anio={anio}
                    abierto={abiertos.has(id)}
                    onToggle={onToggle}
                  >
                    {lista.map(equipo => (
                      <div key={equipo.id} className="cal-tl-row">
                        <button
                          type="button"
                          className="cal-tl-label"
                          onClick={() => onAbrirEquipo(equipo)}
                          title={`${equipo.codMetrica} · ${subtituloEquipo(equipo)}`}
                        >
                          <strong>{equipo.codMetrica}</strong>
                          <span>{[equipo.instrumento, equipo.planta].filter(Boolean).join(' · ') || 'Sin datos del equipo'}</span>
                        </button>
                        <div className="cal-tl-track cursor-pointer" onClick={() => onAbrirEquipo(equipo)}>
                          {bandas(equipo, anio, hoy, ajustes.alertaDias).map(banda => (
                            <span
                              key={banda.key}
                              className={banda.className}
                              style={{ left: pct(banda.start), width: pct(banda.end - banda.start) }}
                            />
                          ))}
                          {(eventosPorEquipo.get(equipo.id) || []).map(evento => (
                            <Marca key={evento.id} evento={evento} anio={anio} onSelect={onSelect} onHover={mostrarHover} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </Grupo>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <TarjetaFlotante hover={hover} onDismiss={ocultarHover} />
    </div>
  );
}
