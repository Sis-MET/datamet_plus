import { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Download, Filter, GanttChart, ListChecks, MapPin, RefreshCw, Search, Shapes,
} from 'lucide-react';
import { Button } from '../../../../shared/components/ui/Button';
import { cn } from '../../../../shared/utils/cn';
import { safeStorage } from '../../../../shared/utils/storage';
import { FilterMenu } from '../../../calibration/components/Dropdown';
import { Segmented } from '../../../calibration/components/primitives';
import { useProximos } from '../../hooks/useProximos';
import {
  FILTROS_SITUACION, FILTROS_SUGERIDO, SITUACIONES, SUGERIDOS, claveFiltroSugerido, coincideEquipo, enriquecerEvento, toneDe,
} from '../../domain/proximos';
import { EquipoFicha } from './EquipoFicha';
import { LineaTiempo } from './LineaTiempo';
import { Agenda, AtencionPanel } from './Listas';
import { VistaMes } from './VistaMes';
import { Glifo, Leyenda } from './piezas';
import { ExportarPlanModal } from './ExportarPlanModal';

const VISTA_KEY = 'datamet_soporte_proximos_vista';
const VISTAS = ['anio', 'mes', 'agenda'];
const AUTO_ABRIR = 3;

const CONTROL = 'flex h-9 items-center rounded-xl border border-line bg-surface text-fg shadow-xs transition-colors';

const leerVista = () => {
  const valor = safeStorage.getItem(VISTA_KEY);
  return VISTAS.includes(valor) ? valor : 'anio';
};

const contar = (lista, clave) => {
  const mapa = new Map();
  for (const item of lista) {
    const valor = clave(item);
    if (valor) mapa.set(valor, (mapa.get(valor) || 0) + 1);
  }
  return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, 'es')).map(([value, count]) => ({ value, label: value, count }));
};

function Esqueleto() {
  return (
    <div className="cal-timeline animate-pulse" role="status" aria-label="Cargando los próximos servicios">
      <div className="h-[69px] border-b border-line bg-surface-2/60" />
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex h-[40px] items-center gap-4 border-b border-line px-4">
          <div className="h-3 w-32 rounded-full bg-fg/[0.07]" />
          <div className="ml-auto h-1.5 rounded-full bg-fg/[0.06]" style={{ width: `${25 + ((index * 19) % 50)}%` }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Pestaña «Próximos servicios»: lo que requiere atención, la línea de tiempo
 * anual por cliente y equipo, el mes y la agenda, con la ficha de cada equipo.
 */
export function ProximosPanel({ onAbrirInforme }) {
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState(() => new Date().getMonth());
  const [vista, setVistaState] = useState(leerVista);
  const [query, setQuery] = useState('');
  const [cliente, setCliente] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [sugerido, setSugerido] = useState('');
  const [situaciones, setSituaciones] = useState(() => new Set());
  // Lo que la persona abrió o cerró a mano; el resto sigue la regla automática.
  const [elegidos, setElegidos] = useState(() => new Map());
  const [ficha, setFicha] = useState(null);
  const [exportando, setExportando] = useState(false);

  const { data, error, loading, reload } = useProximos(anio);

  const setVista = (valor) => {
    safeStorage.setItem(VISTA_KEY, valor);
    setVistaState(valor);
  };

  const equiposPorId = useMemo(() => new Map((data?.equipos || []).map(equipo => [equipo.id, equipo])), [data]);

  const clientes = useMemo(() => contar(data?.equipos || [], equipo => equipo.cliente), [data]);
  const ciudades = useMemo(() => contar(data?.equipos || [], equipo => equipo.ciudad), [data]);

  const pasaFiltros = useCallback((item) => (
    (!cliente || item.cliente === cliente)
    && (!ciudad || item.ciudad === ciudad)
    && coincideEquipo(query, item)
  ), [cliente, ciudad, query]);

  const equiposVisibles = useMemo(() => (data?.equipos || []).filter(equipo => (
    pasaFiltros(equipo) && (!sugerido || (equipo.proximo && claveFiltroSugerido(equipo.proximo) === sugerido))
  )), [data, pasaFiltros, sugerido]);

  // Marcas que pasan cliente, ciudad, tipo sugerido y búsqueda (sin la situación).
  const eventosBase = useMemo(() => {
    const visibles = new Set(equiposVisibles.map(equipo => equipo.id));
    return (data?.eventos || [])
      .filter(evento => visibles.has(evento.equipoId))
      .map(evento => enriquecerEvento(evento, equiposPorId.get(evento.equipoId)));
  }, [data, equiposVisibles, equiposPorId]);

  const cuentaSituacion = useMemo(() => {
    const cuenta = {};
    for (const evento of eventosBase) cuenta[evento.situacion] = (cuenta[evento.situacion] || 0) + 1;
    return cuenta;
  }, [eventosBase]);

  const eventos = useMemo(() => (
    situaciones.size === 0 ? eventosBase : eventosBase.filter(evento => situaciones.has(evento.situacion))
  ), [eventosBase, situaciones]);

  const filas = useMemo(() => {
    if (situaciones.size === 0) return equiposVisibles;
    const conMarcas = new Set(eventos.map(evento => evento.equipoId));
    return equiposVisibles.filter(equipo => conMarcas.has(equipo.id));
  }, [equiposVisibles, eventos, situaciones]);

  const alertas = useMemo(() => (data?.alertas || []).filter(alerta => (
    pasaFiltros(alerta) && (!sugerido || claveFiltroSugerido(alerta) === sugerido)
  )), [data, pasaFiltros, sugerido]);

  const gruposVisibles = useMemo(() => [...new Set(filas.map(equipo => `cliente:${equipo.cliente}`))], [filas]);

  // Con pocos clientes a la vista (por ejemplo, al filtrar uno) se abren solos.
  const abiertos = useMemo(() => {
    const auto = gruposVisibles.length > 0 && gruposVisibles.length <= AUTO_ABRIR;
    return new Set(gruposVisibles.filter(id => (elegidos.has(id) ? elegidos.get(id) : auto)));
  }, [gruposVisibles, elegidos]);

  const alternarGrupo = useCallback((id) => setElegidos((actuales) => {
    const siguiente = new Map(actuales);
    siguiente.set(id, !abiertos.has(id));
    return siguiente;
  }), [abiertos]);

  const algunoAbierto = gruposVisibles.some(id => abiertos.has(id));

  const alternarSituacion = (situacion) => setSituaciones((actuales) => {
    const siguiente = new Set(actuales);
    if (siguiente.has(situacion)) siguiente.delete(situacion);
    else siguiente.add(situacion);
    return siguiente;
  });

  const irAHoy = () => {
    const ahora = new Date();
    setAnio(ahora.getFullYear());
    setMes(ahora.getMonth());
  };

  const navegarMes = useCallback((year, month) => {
    setAnio(year);
    setMes(month);
  }, []);

  const abrirEvento = useCallback((evento) => setFicha(evento.equipoId || evento.codMetrica), []);
  const abrirEquipo = useCallback((equipo) => setFicha(equipo.id), []);

  const hayFiltros = Boolean(query || cliente || ciudad || sugerido || situaciones.size > 0);
  const proximosAnio = eventos.filter(evento => evento.clase === 'PROXIMO').length;

  const opcionesSugerido = useMemo(() => {
    const cuenta = new Map();
    for (const equipo of data?.equipos || []) {
      if (!equipo.proximo) continue;
      const clave = claveFiltroSugerido(equipo.proximo);
      cuenta.set(clave, (cuenta.get(clave) || 0) + 1);
    }
    return FILTROS_SUGERIDO
      .filter(clave => cuenta.has(clave))
      .map(clave => ({ value: clave, label: clave === 'NINGUNO' ? 'Sin tipo sugerido' : SUGERIDOS[clave].label, count: cuenta.get(clave) }));
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className={cn(CONTROL, 'overflow-hidden')}>
          <button type="button" onClick={() => setAnio(year => year - 1)} className="flex h-full items-center px-2.5 text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label="Año anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[52px] border-x border-line px-2 text-center text-[13px] font-semibold tabular-nums" aria-live="polite">{anio}</span>
          <button type="button" onClick={() => setAnio(year => year + 1)} className="flex h-full items-center px-2.5 text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label="Año siguiente">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button type="button" onClick={irAHoy} className={cn(CONTROL, 'gap-2 px-3 text-[13px] font-semibold hover:bg-surface-2')}>
          <CalendarDays className="h-4 w-4 text-fg-muted" aria-hidden="true" /> Hoy
        </button>
        <Button variant="secondary" size="sm" onClick={() => setExportando(true)} disabled={!data || loading || Boolean(error)}>
          <Download className="h-4 w-4" aria-hidden="true" /> Exportar PDF
        </Button>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className={cn(CONTROL, 'w-9 justify-center hover:bg-surface-2 disabled:opacity-60')}
          aria-label="Recargar los próximos servicios"
          title="Recargar"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin text-fg-muted')} />
        </button>

        <Segmented
          label="Vista"
          value={vista}
          onChange={setVista}
          options={[
            { value: 'anio', label: 'Año', icon: <GanttChart className="h-4 w-4" aria-hidden="true" /> },
            { value: 'mes', label: 'Mes', icon: <CalendarDays className="h-4 w-4" aria-hidden="true" /> },
            { value: 'agenda', label: 'Agenda', icon: <ListChecks className="h-4 w-4" aria-hidden="true" /> },
          ]}
        />

        <div className="flex w-full flex-wrap gap-2 lg:ml-auto lg:w-auto">
          {clientes.length > 1 && (
            <FilterMenu icon={Filter} value={cliente} onChange={setCliente} allLabel="Todos los clientes" ariaLabel="Filtrar por cliente" options={clientes} />
          )}
          {ciudades.length > 1 && (
            <FilterMenu icon={MapPin} value={ciudad} onChange={setCiudad} allLabel="Todas las ciudades" ariaLabel="Filtrar por ciudad" options={ciudades} />
          )}
          {opcionesSugerido.length > 1 && (
            <FilterMenu icon={Shapes} value={sugerido} onChange={setSugerido} allLabel="Todo tipo sugerido" ariaLabel="Filtrar por tipo de servicio sugerido" options={opcionesSugerido} />
          )}
          <label className={cn(CONTROL, 'min-w-0 flex-1 gap-2 px-3 sm:max-w-[260px] focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/15')}>
            <Search className="h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar equipo, serie, cliente…"
              aria-label="Buscar equipo"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            <span className="font-semibold">No se pudieron cargar los próximos servicios.</span>{' '}
            <span className="text-fg-muted">{error.message}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {!data && !error && <Esqueleto />}

      {data && (
        <>
          <AtencionPanel alertas={alertas} onSelect={abrirEvento} />

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por situación">
            {FILTROS_SITUACION.map(situacion => (
              <button
                key={situacion}
                type="button"
                aria-pressed={situaciones.has(situacion)}
                onClick={() => alternarSituacion(situacion)}
                disabled={!cuentaSituacion[situacion] && !situaciones.has(situacion)}
                className={cn('cal-filter-chip', `cal-tone-${toneDe(situacion)}`)}
              >
                <Glifo situacion={situacion} size={8} />
                {situacion === 'REALIZADO' ? 'Servicios realizados' : SITUACIONES[situacion].plural}
                <strong>{cuentaSituacion[situacion] || 0}</strong>
              </button>
            ))}
            {hayFiltros && (
              <button
                type="button"
                onClick={() => {
                  setSituaciones(new Set());
                  setCliente('');
                  setCiudad('');
                  setSugerido('');
                  setQuery('');
                }}
                className="ml-1 text-[13px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
              >
                Quitar filtros
              </button>
            )}
            <span className="ml-auto hidden text-xs text-fg-muted md:block">
              {filas.length} {filas.length === 1 ? 'equipo' : 'equipos'} · {proximosAnio} {proximosAnio === 1 ? 'próximo servicio' : 'próximos servicios'} en {anio}
            </span>
          </div>

          <div className={cn('transition-opacity', loading && 'opacity-60')}>
            {vista === 'anio' && (
              <>
                {gruposVisibles.length > 0 && (
                  <div className="mb-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setElegidos((actuales) => {
                        const siguiente = new Map(actuales);
                        gruposVisibles.forEach(id => siguiente.set(id, !algunoAbierto));
                        return siguiente;
                      })}
                      className="text-[12.5px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
                    >
                      {algunoAbierto ? 'Cerrar todos los clientes' : 'Abrir todos los clientes'}
                    </button>
                  </div>
                )}
                <LineaTiempo
                  anio={anio}
                  hoy={data.hoy}
                  ajustes={data.ajustes}
                  equipos={filas}
                  eventos={eventos}
                  abiertos={abiertos}
                  onToggle={alternarGrupo}
                  onSelect={abrirEvento}
                  onAbrirEquipo={abrirEquipo}
                />
                <Leyenda />
              </>
            )}
            {vista === 'mes' && (
              <VistaMes anio={anio} mes={mes} hoy={data.hoy} eventos={eventos} onNavigate={navegarMes} onSelect={abrirEvento} />
            )}
            {vista === 'agenda' && <Agenda eventos={eventos} onSelect={abrirEvento} />}
          </div>
        </>
      )}

      {ficha && (
        <EquipoFicha
          key={ficha}
          codMetrica={ficha}
          onClose={() => setFicha(null)}
          onAbrirInforme={onAbrirInforme}
        />
      )}
      {exportando && <ExportarPlanModal anio={anio} mes={mes} eventos={eventos}
        filtros={[cliente && `Cliente: ${cliente}`, ciudad && `Ciudad: ${ciudad}`, query && `Búsqueda: ${query}`,
          sugerido && `Tipo: ${sugerido === 'NINGUNO' ? 'Sin tipo sugerido' : SUGERIDOS[sugerido]?.label}`,
          situaciones.size > 0 && `Situación: ${[...situaciones].map(s => SITUACIONES[s]?.label).join(', ')}`].filter(Boolean).join(' · ')}
        onClose={() => setExportando(false)} />}
    </div>
  );
}
