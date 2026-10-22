import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import { cn } from '../../../../shared/utils/cn';
import { capitalize, formatDate, toISODate } from '../../../calibration/domain/format';
import { useHoverCard } from '../../../calibration/hooks/useHoverCard';
import { agruparPorCliente, formaDe, toneDe } from '../../domain/proximos';
import { FilaGrupo, Glifo, TarjetaFlotante } from './piezas';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_CHIPS = 3;

const iconButton = 'flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-fg-muted shadow-xs transition-colors hover:bg-surface-2 hover:text-fg';

/** Vista mensual, como la de calibración: cuadrícula de lunes a domingo y el detalle del día elegido. */
export function VistaMes({ anio, mes, hoy, eventos, onNavigate, onSelect }) {
  const fechaMes = useMemo(() => new Date(anio, mes, 1), [anio, mes]);
  const prefijo = `${anio}-${String(mes + 1).padStart(2, '0')}`;
  const hoyEnMes = hoy.startsWith(prefijo);
  const [dia, setDia] = useState(() => (hoyEnMes ? hoy : toISODate(fechaMes)));
  const [claveMes, setClaveMes] = useState(prefijo);
  const [hover, mostrarHover, ocultarHover] = useHoverCard();

  // Al cambiar de mes el día elegido vuelve a hoy o al primer día del mes.
  if (claveMes !== prefijo) {
    setClaveMes(prefijo);
    setDia(hoyEnMes ? hoy : toISODate(fechaMes));
  }

  const dias = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(fechaMes), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(fechaMes), { weekStartsOn: 1 }),
  }).map(toISODate), [fechaMes]);

  const porDia = useMemo(() => {
    const mapa = new Map();
    for (const evento of eventos) {
      if (!mapa.has(evento.fecha)) mapa.set(evento.fecha, []);
      mapa.get(evento.fecha).push(evento);
    }
    // Primero los próximos servicios, después lo realizado; los equipos de
    // un mismo cliente, juntos.
    const grupos = new Map();
    for (const [fecha, lista] of mapa) {
      lista.sort((a, b) => Number(a.clase === 'SERVICIO') - Number(b.clase === 'SERVICIO'));
      grupos.set(fecha, { items: lista, grupos: agruparPorCliente(lista) });
    }
    return grupos;
  }, [eventos]);

  const ir = (offset) => {
    const destino = new Date(anio, mes + offset, 1);
    onNavigate(destino.getFullYear(), destino.getMonth());
  };

  const delDia = porDia.get(dia)?.grupos || [];
  const totalMes = eventos.filter(evento => evento.fecha.startsWith(prefijo) && evento.clase === 'PROXIMO').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button type="button" className={iconButton} onClick={() => ir(-1)} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" className={iconButton} onClick={() => ir(1)} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </button>
        <h3 className="ml-1 text-base font-semibold text-fg">{capitalize(formatDate(toISODate(fechaMes), 'MMMM yyyy'))}</h3>
        <span className="text-[13px] text-fg-muted">
          {totalMes === 0 ? 'Sin próximos servicios' : `${totalMes} ${totalMes === 1 ? 'próximo servicio' : 'próximos servicios'}`}
        </span>
      </div>

      <div className="cal-month">
        <div className="cal-month-grid">
          {DIAS.map(nombre => <div key={nombre} className="cal-month-weekday" aria-hidden="true">{nombre}</div>)}
          {dias.map((fecha) => {
            const { items = [], grupos = [] } = porDia.get(fecha) || {};
            const fuera = !fecha.startsWith(prefijo);
            return (
              <div
                key={fecha}
                className={cn('cal-month-day cursor-pointer', fuera && 'cal-month-day-outside', fecha === dia && 'cal-month-day-selected')}
                onClick={() => setDia(fecha)}
              >
                <button
                  type="button"
                  className={cn('cal-month-number', fecha === hoy && 'cal-month-number-today')}
                  aria-pressed={fecha === dia}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDia(fecha);
                  }}
                  aria-label={`${formatDate(fecha, "EEEE d 'de' MMMM")}${items.length ? `, ${items.length} ${items.length === 1 ? 'fecha' : 'fechas'}` : ''}`}
                >
                  {Number(fecha.slice(8))}
                </button>
                {grupos.slice(0, MAX_CHIPS).map((grupo) => {
                  const solo = grupo.items.length === 1 ? grupo.items[0] : null;
                  return (
                    <button
                      key={grupo.id}
                      type="button"
                      className={cn('cal-chip', `cal-tone-${toneDe(grupo.situacion)}`, grupo.situacion === 'DESCARTADO' && 'cal-chip-cancelled')}
                      title={solo ? undefined : `${grupo.items.length} equipos: ${grupo.items.map(item => item.codMetrica).join(', ')}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        ocultarHover();
                        // Un grupo se ve en el detalle del día, ya abierto.
                        if (solo) onSelect(solo);
                        else setDia(fecha);
                      }}
                      onMouseEnter={solo ? (event) => mostrarHover(solo, event.currentTarget) : undefined}
                      onMouseLeave={solo ? ocultarHover : undefined}
                      onFocus={solo ? (event) => mostrarHover(solo, event.currentTarget) : undefined}
                      onBlur={solo ? ocultarHover : undefined}
                    >
                      <Glifo forma={formaDe(grupo.principal)} situacion={grupo.situacion} />
                      <span>{solo ? grupo.cliente : `${grupo.cliente} · ${grupo.items.length}`}</span>
                    </button>
                  );
                })}
                {grupos.length > MAX_CHIPS && <span className="cal-month-more">+{grupos.length - MAX_CHIPS} más</span>}
                {items.length > 0 && (
                  <span className="cal-month-dots" aria-hidden="true">
                    {items.slice(0, 6).map(evento => <Glifo key={evento.id} forma={formaDe(evento)} situacion={evento.situacion} />)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <section aria-labelledby="st-dia-detalle">
        <h3 id="st-dia-detalle" className="mb-2 px-1 text-[13px] font-semibold text-fg">
          {capitalize(formatDate(dia, "EEEE d 'de' MMMM"))}
        </h3>
        {delDia.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-5 text-center text-[13px] text-fg-muted">
            Nada para este día.
          </p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden shadow-xs">
            {delDia.map(grupo => (
              <li key={`${dia}|${grupo.id}`}>
                <FilaGrupo grupo={grupo} onSelect={onSelect} sinFecha abiertoInicial />
              </li>
            ))}
          </ul>
        )}
      </section>
      <TarjetaFlotante hover={hover} onDismiss={ocultarHover} />
    </div>
  );
}
