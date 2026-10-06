import { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  GanttChart,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Weight,
} from 'lucide-react';
import { Button } from '../../shared/components/ui/Button';
import { cn } from '../../shared/utils/cn';
import { safeStorage } from '../../shared/utils/storage';
import { useCalibrationPlan } from './hooks/useCalibrationPlan';
import { usePersonal } from './hooks/usePersonal';
import {
  SITUACION_TONE,
  TIPOS,
  TIPO_ORDER,
  matchesQuery,
} from './domain/format';
import { Glyph, Segmented } from './components/primitives';
import { FilterMenu } from './components/Dropdown';
import { YearTimeline, TimelineLegend } from './components/YearTimeline';
import { MonthCalendar } from './components/MonthCalendar';
import { AgendaList } from './components/AgendaList';
import { AttentionPanel } from './components/AttentionPanel';
import { EventModal } from './components/EventModal';
import { BulkEquipmentModal, EquipmentModal } from './components/EquipmentModal';
import { ActivityModal } from './components/ActivityModal';
import { EquipmentTable } from './components/EquipmentTable';
import { ActivitiesList } from './components/ActivitiesList';
import { AlertSettings } from './components/AlertSettings';
import './calibration.css';

const TAB_KEY = 'rimmet_cal_tab';
const VIEW_KEY = 'rimmet_cal_view';
const TABS = ['cronograma', 'equipos', 'actividades', 'alertas'];
const VIEWS = ['anio', 'mes', 'agenda'];

const STATUS_FILTERS = [
  { value: 'VENCIDO', label: 'Vencidas' },
  { value: 'PROXIMO', label: 'En aviso' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'PROGRAMADO', label: 'Programadas' },
  { value: 'REALIZADO', label: 'Realizadas' },
];

const readStored = (key, allowed, fallback) => {
  const value = safeStorage.getItem(key);
  return allowed.includes(value) ? value : fallback;
};

// Una fecha estimada cuenta como programada en los filtros.
const situationKey = (occurrence) => (occurrence.proyectado ? 'PROGRAMADO' : occurrence.situacion);

const control = 'flex h-9 items-center rounded-xl border border-line bg-surface text-fg shadow-xs transition-colors';

function PlanSkeleton() {
  return (
    <div className="cal-timeline animate-pulse" role="status" aria-label="Cargando el plan">
      <div className="h-[53px] border-b border-line bg-surface-2/60" />
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="flex h-[46px] items-center gap-4 border-b border-line px-4">
          <div className="h-3 w-24 rounded-full bg-fg/[0.07]" />
          <div className="ml-auto h-1.5 rounded-full bg-fg/[0.06]" style={{ width: `${30 + ((index * 17) % 45)}%` }} />
        </div>
      ))}
    </div>
  );
}

export function CalibrationPage() {
  const [tab, setTabState] = useState(() => readStored(TAB_KEY, TABS, 'cronograma'));
  const [view, setViewState] = useState(() => readStored(VIEW_KEY, VIEWS, 'anio'));
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState(() => new Date().getMonth());
  const [tipos, setTipos] = useState(() => new Set(TIPO_ORDER));
  const [planta, setPlanta] = useState('');
  const [query, setQuery] = useState('');
  const [situaciones, setSituaciones] = useState(() => new Set());
  const [ficha, setFicha] = useState(null);
  // Cambia tras configurar varios equipos para vaciar la selección de la tabla.
  const [bulkRound, setBulkRound] = useState(0);

  const { data, error, loading, reload } = useCalibrationPlan(anio);
  const personal = usePersonal();

  const setTab = (next) => {
    safeStorage.setItem(TAB_KEY, next);
    setTabState(next);
  };
  const setView = (next) => {
    safeStorage.setItem(VIEW_KEY, next);
    setViewState(next);
  };

  const hoy = data?.hoy;
  const canEdit = Boolean(data?.permisos?.canEdit);
  const ajustes = data?.ajustes;

  const categorias = useMemo(
    () => [...new Set((data?.actividades || []).map(actividad => actividad.categoria).filter(Boolean))],
    [data]
  );

  const plantas = useMemo(
    () => [...new Set((data?.equipos || []).map(equipo => equipo.planta))].sort((a, b) => a.localeCompare(b, 'es')),
    [data]
  );

  const equiposVisibles = useMemo(() => (data?.equipos || []).filter(equipo => (
    (!planta || equipo.planta === planta)
    && matchesQuery(
      query,
      equipo.codigo,
      equipo.instrumento,
      equipo.certificado,
      equipo.enteCalibrador,
      equipo.calibracion?.responsableNombre,
      equipo.verificacion?.responsableNombre
    )
  )), [data, planta, query]);

  const actividadesVisibles = useMemo(() => (data?.actividades || []).filter(actividad => (
    matchesQuery(query, actividad.titulo, actividad.categoria, actividad.descripcion, actividad.responsableNombre)
  )), [data, query]);

  // Fechas que pasan los filtros de tipo, planta y búsqueda (sin la situación).
  const eventosBase = useMemo(() => {
    const equipoIds = new Set(equiposVisibles.map(equipo => equipo.id));
    const actividadIds = new Set(actividadesVisibles.map(actividad => actividad.id));
    return (data?.eventos || []).filter(occurrence => (
      tipos.has(occurrence.tipo)
      && (occurrence.tipo === 'ACTIVIDAD' ? actividadIds.has(occurrence.programaId) : equipoIds.has(occurrence.equipoId))
    ));
  }, [data, equiposVisibles, actividadesVisibles, tipos]);

  const statusCounts = useMemo(() => {
    const counts = {};
    for (const occurrence of eventosBase) counts[situationKey(occurrence)] = (counts[situationKey(occurrence)] || 0) + 1;
    return counts;
  }, [eventosBase]);

  const eventos = useMemo(() => (
    situaciones.size === 0 ? eventosBase : eventosBase.filter(occurrence => situaciones.has(situationKey(occurrence)))
  ), [eventosBase, situaciones]);

  const timelineRows = useMemo(() => {
    const showEquipos = tipos.has('CALIBRACION') || tipos.has('VERIFICACION');
    let equipos = showEquipos ? equiposVisibles : [];
    let actividades = tipos.has('ACTIVIDAD') ? actividadesVisibles : [];
    if (situaciones.size > 0) {
      const withEvents = new Set(eventos.map(occurrence => (
        occurrence.tipo === 'ACTIVIDAD' ? `a:${occurrence.programaId}` : `e:${occurrence.equipoId}`
      )));
      equipos = equipos.filter(equipo => withEvents.has(`e:${equipo.id}`));
      actividades = actividades.filter(actividad => withEvents.has(`a:${actividad.id}`));
    }
    return { equipos, actividades };
  }, [tipos, equiposVisibles, actividadesVisibles, situaciones, eventos]);

  const toggleTipo = (tipo) => setTipos(current => {
    const next = new Set(current);
    if (next.has(tipo) && next.size > 1) next.delete(tipo);
    else next.add(tipo);
    return next;
  });

  const toggleSituacion = (situacion) => setSituaciones(current => {
    const next = new Set(current);
    if (next.has(situacion)) next.delete(situacion);
    else next.add(situacion);
    return next;
  });

  const goToToday = () => {
    const now = new Date();
    setAnio(now.getFullYear());
    setMes(now.getMonth());
  };

  const navigateMonth = useCallback((year, month) => {
    setAnio(year);
    setMes(month);
  }, []);

  const openEvent = useCallback((occurrence) => setFicha({ type: 'event', occurrence }), []);
  const openEquipo = useCallback((equipo) => setFicha({ type: 'equipo', id: equipo.id }), []);
  const openActividad = useCallback((actividad) => setFicha({ type: 'actividad', id: actividad?.id ?? null }), []);
  const closeFicha = useCallback(() => setFicha(null), []);

  const alertCount = data?.alertas?.length || 0;
  const vencidas = (data?.alertas || []).filter(alerta => alerta.situacion === 'VENCIDO').length;

  const fichaEquipo = ficha?.type === 'equipo' ? data?.equipos.find(equipo => equipo.id === ficha.id) : null;
  const fichaActividad = ficha?.type === 'actividad' && ficha.id != null
    ? data?.actividades.find(actividad => actividad.id === ficha.id)
    : null;
  const eventEquipo = ficha?.type === 'event' && ficha.occurrence.equipoId != null
    ? data?.equipos.find(equipo => equipo.id === ficha.occurrence.equipoId)
    : null;
  const eventActividad = ficha?.type === 'event' && ficha.occurrence.tipo === 'ACTIVIDAD'
    ? data?.actividades.find(actividad => actividad.id === ficha.occurrence.programaId)
    : null;

  const filtersActive = planta || query || situaciones.size > 0 || tipos.size < TIPO_ORDER.length;

  const searchBox = (
    <label className={cn(control, 'min-w-0 flex-1 gap-2 px-3 sm:max-w-[260px] focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/15')}>
      <Search className="h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={tab === 'actividades' ? 'Buscar actividad…' : 'Buscar código, instrumento…'}
        aria-label="Buscar"
        className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
      />
    </label>
  );

  const plantaSelect = plantas.length > 1 && (
    <FilterMenu
      icon={Filter}
      value={planta}
      onChange={setPlanta}
      allLabel="Todas las plantas"
      ariaLabel="Filtrar por planta"
      options={plantas.map(item => ({
        value: item,
        label: item,
        count: data.equipos.filter(equipo => equipo.planta === item).length,
      }))}
    />
  );

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-3 py-3 sm:px-5 sm:py-5 xl:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Secciones de Calibración" className="cal-segmented cal-tabs">
          {[
            { id: 'cronograma', label: 'Cronograma', icon: CalendarRange },
            { id: 'equipos', label: 'Equipos', icon: Weight, count: data?.equipos.length },
            { id: 'actividades', label: 'Actividades', icon: ClipboardList, count: data?.actividades.length },
            { id: 'alertas', label: 'Alertas', icon: BellRing, count: alertCount || null, alert: vencidas > 0 },
          ].map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                aria-current={tab === section.id ? 'page' : undefined}
                onClick={() => setTab(section.id)}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {section.label}
                {section.count != null && (
                  <span className={cn('cal-count', section.alert && 'cal-count-alert')}>{section.count}</span>
                )}
              </button>
            );
          })}
        </nav>
        {canEdit && (tab === 'cronograma' || tab === 'actividades') && (
          <Button className="ml-auto" onClick={() => openActividad(null)}>
            <Plus className="h-4 w-4" /> Nueva actividad
          </Button>
        )}
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            <span className="font-semibold">No se pudo cargar el plan.</span>{' '}
            <span className="text-fg-muted">{error.message}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {!data && !error && <PlanSkeleton />}

      {data && tab === 'cronograma' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className={cn(control, 'overflow-hidden')}>
              <button type="button" onClick={() => setAnio(year => year - 1)} className="flex h-full items-center px-2.5 text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label="Año anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[52px] border-x border-line px-2 text-center text-[13px] font-semibold tabular-nums" aria-live="polite">{anio}</span>
              <button type="button" onClick={() => setAnio(year => year + 1)} className="flex h-full items-center px-2.5 text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label="Año siguiente">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button type="button" onClick={goToToday} className={cn(control, 'gap-2 px-3 text-[13px] font-semibold hover:bg-surface-2')}>
              <CalendarDays className="h-4 w-4 text-fg-muted" aria-hidden="true" /> Hoy
            </button>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className={cn(control, 'w-9 justify-center hover:bg-surface-2 disabled:opacity-60')}
              aria-label="Recargar el plan"
              title="Recargar el plan"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin text-fg-muted')} />
            </button>

            <Segmented
              label="Vista"
              value={view}
              onChange={setView}
              options={[
                { value: 'anio', label: 'Año', icon: <GanttChart className="h-4 w-4" aria-hidden="true" /> },
                { value: 'mes', label: 'Mes', icon: <CalendarDays className="h-4 w-4" aria-hidden="true" /> },
                { value: 'agenda', label: 'Agenda', icon: <ListChecks className="h-4 w-4" aria-hidden="true" /> },
              ]}
            />

            <div role="group" aria-label="Tipos" className="flex flex-wrap gap-1.5">
              {TIPO_ORDER.map(tipo => (
                <button
                  key={tipo}
                  type="button"
                  aria-pressed={tipos.has(tipo)}
                  onClick={() => toggleTipo(tipo)}
                  className="cal-filter-chip cal-tone-neutral"
                  title={tipos.has(tipo) && tipos.size === 1 ? 'Debe quedar al menos un tipo' : undefined}
                >
                  <Glyph tipo={tipo} situacion={tipos.has(tipo) ? 'PROGRAMADO' : 'CANCELADO'} size={9} />
                  {TIPOS[tipo].plural}
                </button>
              ))}
            </div>

            <div className="flex w-full flex-wrap gap-2 lg:ml-auto lg:w-auto">
              {plantaSelect}
              {searchBox}
            </div>
          </div>

          <AttentionPanel alertas={data.alertas} onSelectEvent={openEvent} />

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por situación">
            {STATUS_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={situaciones.has(value)}
                onClick={() => toggleSituacion(value)}
                disabled={!statusCounts[value] && !situaciones.has(value)}
                className={cn('cal-filter-chip', `cal-tone-${SITUACION_TONE[value]}`)}
              >
                <Glyph tipo="CALIBRACION" situacion={value} size={8} />
                {label}
                <strong>{statusCounts[value] || 0}</strong>
              </button>
            ))}
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setSituaciones(new Set());
                  setTipos(new Set(TIPO_ORDER));
                  setPlanta('');
                  setQuery('');
                }}
                className="ml-1 text-[13px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
              >
                Quitar filtros
              </button>
            )}
            <span className="ml-auto hidden text-xs text-fg-muted md:block">
              {eventos.length} {eventos.length === 1 ? 'fecha' : 'fechas'} en {anio}
            </span>
          </div>

          {view === 'anio' && (
            <div>
              <YearTimeline
                anio={anio}
                hoy={hoy}
                ajustes={ajustes}
                equipos={timelineRows.equipos}
                actividades={timelineRows.actividades}
                eventos={eventos}
                onSelectEvent={openEvent}
                onOpenEquipo={openEquipo}
                onOpenActividad={openActividad}
              />
              <TimelineLegend />
            </div>
          )}
          {view === 'mes' && (
            <MonthCalendar
              anio={anio}
              mes={mes}
              hoy={hoy}
              eventos={eventos}
              onNavigate={navigateMonth}
              onSelectEvent={openEvent}
            />
          )}
          {view === 'agenda' && <AgendaList eventos={eventos} onSelectEvent={openEvent} />}
        </>
      )}

      {data && tab === 'equipos' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {searchBox}
            {plantaSelect}
            <p className="ml-auto text-xs text-fg-muted">
              {equiposVisibles.length} de {data.equipos.length} equipos activos
            </p>
          </div>
          <EquipmentTable
            key={bulkRound}
            equipos={equiposVisibles}
            ajustes={ajustes}
            canEdit={canEdit}
            onOpenEquipo={openEquipo}
            onConfigureMany={(selected) => setFicha({ type: 'equipos', ids: selected.map(equipo => equipo.id) })}
          />
        </>
      )}

      {data && tab === 'actividades' && (
        <>
          {data.actividades.length > 0 && <div className="flex flex-wrap items-center gap-2">{searchBox}</div>}
          <ActivitiesList
            actividades={actividadesVisibles}
            ajustes={ajustes}
            canEdit={canEdit}
            onOpen={openActividad}
            onCreate={() => openActividad(null)}
          />
        </>
      )}

      {data && tab === 'alertas' && (
        <AlertSettings
          canEdit={canEdit}
          ajustes={ajustes}
          alertas={data.alertas}
          equipos={data.equipos}
          actividades={data.actividades}
          personal={personal}
          onSelectEvent={openEvent}
          onPlanChanged={reload}
        />
      )}

      {ficha?.type === 'event' && (
        <EventModal
          key={ficha.occurrence.id}
          occurrence={ficha.occurrence}
          equipo={eventEquipo}
          hoy={hoy}
          canEdit={canEdit}
          onClose={closeFicha}
          onSaved={reload}
          onOpenEquipo={eventEquipo ? () => openEquipo(eventEquipo) : undefined}
          onOpenActividad={eventActividad ? () => openActividad(eventActividad) : undefined}
        />
      )}
      {fichaEquipo && (
        <EquipmentModal
          key={fichaEquipo.id}
          equipo={fichaEquipo}
          ajustes={ajustes}
          personal={personal}
          canEdit={canEdit}
          onClose={closeFicha}
          onSaved={reload}
        />
      )}
      {ficha?.type === 'equipos' && (
        <BulkEquipmentModal
          equipos={data.equipos.filter(equipo => ficha.ids.includes(equipo.id))}
          ajustes={ajustes}
          personal={personal}
          onClose={closeFicha}
          onSaved={() => {
            setBulkRound(round => round + 1);
            reload();
          }}
        />
      )}
      {ficha?.type === 'actividad' && (ficha.id == null || fichaActividad) && (
        <ActivityModal
          key={ficha.id ?? 'nueva'}
          actividad={fichaActividad}
          categorias={categorias}
          ajustes={ajustes}
          personal={personal}
          canEdit={canEdit}
          hoy={hoy}
          onClose={closeFicha}
          onSaved={reload}
        />
      )}
    </main>
  );
}
