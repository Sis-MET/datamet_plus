import { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  GanttChart,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../shared/components/ui/Button';
import { cn } from '../../shared/utils/cn';
import { navegar, rutaDe, usePestanaRuta } from '../../shared/navigation/ruta';
import { safeStorage } from '../../shared/utils/storage';
import { calibrationApi } from './api/calibration';
import { useCalibrationPlan } from './hooks/useCalibrationPlan';
import { usePersonal } from './hooks/usePersonal';
import {
  SITUACION_TONE,
  TIPOS,
  TIPO_ORDER,
  expiryOf,
  formatDate,
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
import { EquipmentTable, InactiveEquipmentList } from './components/EquipmentTable';
import { EditEquipmentModal, NewEquipmentModal } from './components/EquipmentFormModal';
import { CertificateModal } from './components/CertificateModal';
import { PatronModal } from './components/PatronModal';
import { ServiciosPanel } from './components/ServiciosPanel';
import { RegistroPagina } from './components/registro/RegistroPagina';
import { tipoPatronSugerido } from './domain/patrones';
import { ReasonModal } from './components/ReasonModal';
import { ActivitiesList } from './components/ActivitiesList';
import { AlertSettings } from './components/AlertSettings';
import { CompliancePanel } from './components/CompliancePanel';
import { ServiceMetPanel } from './components/ServiceMetPanel';
import { MetodoPagina } from './components/metodo/MetodoPagina';
import { EmitidosPanel } from './components/emitidos/EmitidosPanel';
import { PatronesPanel } from './components/patrones/PatronesPanel';
import { ValidacionPagina } from './components/validacion/ValidacionPagina';
import { TiemposPanel } from '../tiempos/components/TiemposPanel';
import './calibration.css';

const TAB_KEY = 'datamet_cal_tab';
const VIEW_KEY = 'datamet_cal_view';
const TABS = ['cronograma', 'equipos', 'actividades', 'certificados', 'emitidos', 'patrones', 'alertas', 'tiempos', 'cumplimiento', 'metodo', 'validacion', 'servicemet'];
// Secciones que no muestran el plan anual.
const SIN_PLAN = new Set(['servicemet', 'certificados', 'emitidos', 'patrones', 'metodo', 'validacion', 'tiempos']);
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
  // La pestaña va en la dirección (/calibracion/equipos, /calibracion/alertas…)
  // y se elige desde la barra lateral.
  const { pestana: storedTab, detalle, irADetalle } = usePestanaRuta('calibration', TABS, {
    clave: TAB_KEY,
    predeterminada: 'cronograma',
  });
  const [view, setViewState] = useState(() => readStored(VIEW_KEY, VIEWS, 'anio'));
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState(() => new Date().getMonth());
  const [tipos, setTipos] = useState(() => new Set(TIPO_ORDER));
  const [planta, setPlanta] = useState('');
  const [query, setQuery] = useState('');
  const [situaciones, setSituaciones] = useState(() => new Set());
  const [ficha, setFicha] = useState(null);
  // Cambia al volver del registro de un servicio: la lista relee los estados.
  const [vueltaRegistro, setVueltaRegistro] = useState(0);
  // Cambia tras configurar varios equipos para vaciar la selección de la tabla.
  const [bulkRound, setBulkRound] = useState(0);
  // Ficha apilada sobre la principal (certificado, datos, baja, anulación).
  const [sub, setSub] = useState(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [showBajas, setShowBajas] = useState(false);

  const { data, error, loading, reload } = useCalibrationPlan(anio);
  const personal = usePersonal();

  const setView = (next) => {
    safeStorage.setItem(VIEW_KEY, next);
    setViewState(next);
  };

  const hoy = data?.hoy;
  const canEdit = Boolean(data?.permisos?.canEdit);
  // Cumplimiento es solo para quienes editan; sin permiso se vuelve al cronograma.
  const tab = storedTab === 'cumplimiento' && data && !canEdit ? 'cronograma' : storedTab;
  const registroAbierto = tab === 'certificados' && detalle[0] ? detalle[0] : null;
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
  const closeSub = useCallback(() => setSub(null), []);
  const equipmentChanged = useCallback(() => {
    setHistoryVersion(version => version + 1);
    reload();
  }, [reload]);
  const openSub = useCallback((type, equipo, extra = {}) => setSub({ type, equipoId: equipo.id, ...extra }), []);

  const fichaEquipo = ficha?.type === 'equipo' ? data?.equipos.find(equipo => equipo.id === ficha.id) : null;
  const subEquipo = sub
    ? (data?.equipos.find(equipo => equipo.id === sub.equipoId) || data?.bajas?.find(equipo => equipo.id === sub.equipoId))
    : null;
  const bajasVisibles = (data?.bajas || []).filter(equipo => (
    (!planta || equipo.planta === planta)
    && matchesQuery(query, equipo.codigo, equipo.instrumento, equipo.certificado, equipo.enteCalibrador)
  ));
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
      {/* Las secciones se eligen en la barra lateral; aquí queda la acción principal de cada una. */}
      {canEdit && (tab === 'cronograma' || tab === 'actividades') && (
        <Button className="self-end" onClick={() => openActividad(null)}>
          <Plus className="h-4 w-4" /> Nueva actividad
        </Button>
      )}
      {canEdit && tab === 'equipos' && (
        <Button className="self-end" onClick={() => setFicha({ type: 'nuevoEquipo' })}>
          <Plus className="h-4 w-4" /> Nuevo equipo
        </Button>
      )}

      <div className="vt-panel flex flex-col gap-4">
      {/* Versiones de ServiceMET y servicios de calibración: no dependen del plan anual. */}
      {tab === 'servicemet' && <ServiceMetPanel />}
      {/* Configuración del método por versiones (fase 6). */}
      {tab === 'metodo' && <MetodoPagina />}
      {/* Validación del motor con los ejemplos publicados (7.11.2). */}
      {tab === 'validacion' && <ValidacionPagina />}
      {/* Libro de certificados emitidos; «Abrir registro» lleva al registro del servicio. */}
      {/* Equipos › Patrones: qué le falta a cada patrón; «Piezas y valores» abre su ficha de Equipos. */}
      {tab === 'patrones' && (
        <PatronesPanel
          version={historyVersion}
          onPiezas={equipoId => setSub({ type: 'patron', equipoId })}
          onEquipos={() => navegar(rutaDe('calibration', 'equipos'), { transicion: 'panel' })}
        />
      )}
      {/* Tiempos de servicio del personal (KPI): con su permiso de Gestión de permisos. */}
      {tab === 'tiempos' && (
        <TiemposPanel
          area="calibracion"
          cargar={calibrationApi.tiempos}
          onAbrir={servicio => navegar(rutaDe('calibration', 'certificados', servicio.codigo), { transicion: 'panel', alCambiar: () => window.scrollTo({ top: 0 }) })}
        />
      )}
      {tab === 'emitidos' && (
        <EmitidosPanel onAbrir={(codigo, pestana) => navegar(`${rutaDe('calibration', 'certificados', codigo)}${pestana ? `#${pestana}` : ''}`, { transicion: 'panel', alCambiar: () => window.scrollTo({ top: 0 }) })} />
      )}
      {tab === 'certificados' && (
        <>
          {/* El registro de un servicio es una página (/calibracion/certificados/<servicio>), como los informes de Soporte. */}
          {registroAbierto && (
            <RegistroPagina
              key={registroAbierto}
              codigo={registroAbierto}
              canEdit={canEdit}
              onVolver={() => {
                irADetalle([], { alCambiar: () => window.scrollTo({ top: 0 }) });
                setVueltaRegistro(v => v + 1);
              }}
            />
          )}
          {/* La lista se oculta sin desmontarse: al volver conserva filtros y grupos abiertos. */}
          <div hidden={Boolean(registroAbierto)}>
            <ServiciosPanel
              actualizar={vueltaRegistro}
              onAbrir={codigo => irADetalle([codigo], { alCambiar: () => window.scrollTo({ top: 0 }) })}
              onVerPatrones={() => navegar(rutaDe('calibration', 'patrones'), { transicion: 'panel', alCambiar: () => window.scrollTo({ top: 0 }) })}
            />
          </div>
        </>
      )}

      {error && !SIN_PLAN.has(tab) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            <span className="font-semibold">No se pudo cargar el plan.</span>{' '}
            <span className="text-fg-muted">{error.message}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {!data && !error && !SIN_PLAN.has(tab) && <PlanSkeleton />}

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
            {data.bajas.length > 0 && (
              <button
                type="button"
                aria-pressed={showBajas}
                onClick={() => setShowBajas(value => !value)}
                className="cal-filter-chip cal-tone-neutral"
              >
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                Dados de baja
                <strong>{data.bajas.length}</strong>
              </button>
            )}
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
            onRegistrarCertificado={(equipo) => openSub('certificado', equipo, { mode: 'nuevo' })}
          />
          {showBajas && data.bajas.length > 0 && (
            <section aria-labelledby="cal-bajas" className="mt-2">
              <h3 id="cal-bajas" className="mb-2 flex items-baseline gap-2 px-1">
                <span className="text-[13px] font-semibold text-fg">Dados de baja</span>
                <span className="text-xs text-fg-muted">Fuera del plan y de las alertas; su historial se conserva.</span>
              </h3>
              <InactiveEquipmentList
                equipos={bajasVisibles}
                canEdit={canEdit}
                onReactivar={(equipo) => openSub('reactivar', equipo)}
              />
            </section>
          )}
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

      {data && tab === 'cumplimiento' && canEdit && <CompliancePanel />}

      {ficha?.type === 'event' && (
        <EventModal
          key={ficha.occurrence.id}
          occurrence={ficha.occurrence}
          equipo={eventEquipo}
          hoy={hoy}
          canEdit={canEdit}
          usuario={data?.permisos?.usuario}
          onClose={closeFicha}
          onSaved={reload}
          onOpenEquipo={eventEquipo ? () => openEquipo(eventEquipo) : undefined}
          onOpenActividad={eventActividad ? () => openActividad(eventActividad) : undefined}
          onRegistrarCertificado={eventEquipo
            ? () => openSub('certificado', eventEquipo, { mode: 'nuevo', closeParent: true })
            : undefined}
        />
      )}
      {fichaEquipo && (
        <EquipmentModal
          key={fichaEquipo.id}
          equipo={fichaEquipo}
          ajustes={ajustes}
          personal={personal}
          canEdit={canEdit}
          historyVersion={historyVersion}
          onClose={closeFicha}
          onSaved={reload}
          onRegistrarCertificado={() => openSub('certificado', fichaEquipo, { mode: 'nuevo' })}
          onCorregirCertificado={() => openSub('certificado', fichaEquipo, { mode: 'corregir' })}
          onRevisarCertificado={() => openSub('revisar', fichaEquipo)}
          onAnularCertificado={(anterior) => openSub('anular', fichaEquipo, { anterior })}
          onEditarDatos={() => openSub('datos', fichaEquipo)}
          onDarDeBaja={() => openSub('baja', fichaEquipo)}
          onAbrirPatron={() => openSub('patron', fichaEquipo)}
        />
      )}
      {ficha?.type === 'nuevoEquipo' && (
        <NewEquipmentModal
          catalogos={data.catalogos}
          hoy={hoy}
          alertaDias={ajustes.alertaDias}
          onClose={closeFicha}
          onSaved={equipmentChanged}
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

      {sub?.type === 'certificado' && subEquipo && (
        <CertificateModal
          key={`${sub.mode}-${subEquipo.id}`}
          mode={sub.mode}
          equipo={subEquipo}
          entes={data.catalogos.entes}
          hoy={hoy}
          alertaDias={subEquipo.calibracion?.alertaDias ?? ajustes.alertaDias}
          // Un certificado nuevo de un juego de pesas o termohigrómetro sigue
          // con la transcripción de sus valores.
          onClose={() => setSub(current => (current?.siguiente
            ? { type: 'patron', equipoId: current.equipoId, desdeCertificado: true }
            : null))}
          onSaved={() => {
            // Desde la ficha de una fecha, esa fecha deja de existir al recalcularse el plan.
            if (sub.closeParent) setFicha(null);
            if (sub.mode === 'nuevo' && tipoPatronSugerido(subEquipo.instrumento)) {
              setSub(current => ({ ...current, siguiente: 'patron' }));
            }
            equipmentChanged();
          }}
        />
      )}
      {sub?.type === 'patron' && subEquipo && (
        <PatronModal
          key={`patron-${subEquipo.id}`}
          equipo={subEquipo}
          desdeCertificado={Boolean(sub.desdeCertificado)}
          canEdit={canEdit}
          onClose={closeSub}
          onSaved={equipmentChanged}
        />
      )}
      {sub?.type === 'datos' && subEquipo && (
        <EditEquipmentModal
          equipo={subEquipo}
          catalogos={data.catalogos}
          onClose={closeSub}
          onSaved={equipmentChanged}
        />
      )}
      {sub?.type === 'baja' && subEquipo && (
        <ReasonModal
          title={`Dar de baja ${subEquipo.codigo}`}
          subtitle={`${subEquipo.instrumento} · ${subEquipo.planta}`}
          heading="Qué pasa al darlo de baja"
          description="Sale del plan anual, del cronograma y de las alertas. Su historial se conserva y puedes reactivarlo cuando quieras."
          confirmLabel="Dar de baja"
          danger
          reasonPlaceholder="Ej.: pesa dañada, equipo vendido o reemplazado por otro…"
          onClose={closeSub}
          onConfirm={async (motivo) => {
            await calibrationApi.setEquipoEstado(subEquipo.id, { activo: false, motivo });
            toast.success(`${subEquipo.codigo} dado de baja`);
            setFicha(null);
            equipmentChanged();
          }}
        />
      )}
      {sub?.type === 'reactivar' && subEquipo && (
        <ReasonModal
          title={`Reactivar ${subEquipo.codigo}`}
          subtitle={`${subEquipo.instrumento} · ${subEquipo.planta}`}
          heading="Vuelve al plan"
          description="Vuelve al cronograma y a las alertas con su configuración y su último certificado."
          confirmLabel="Reactivar"
          requireReason={false}
          reasonLabel="Nota"
          reasonPlaceholder="Ej.: reparado y verificado"
          onClose={closeSub}
          onConfirm={async (motivo) => {
            await calibrationApi.setEquipoEstado(subEquipo.id, { activo: true, motivo });
            toast.success(`${subEquipo.codigo} vuelve al plan`);
            equipmentChanged();
          }}
        />
      )}
      {sub?.type === 'revisar' && subEquipo && (
        <ReasonModal
          title={`Revisar ${subEquipo.certificado || 'el certificado'}`}
          subtitle={`${subEquipo.codigo} · ${subEquipo.instrumento}`}
          heading="Compáralo con el certificado original"
          description="Confirma que estos datos coinciden con el documento emitido por el ente. Si algo no coincide, cancela y usa «Corregir»."
          confirmLabel="Confirmar revisión"
          requireReason={false}
          reasonLabel="Observación"
          reasonPlaceholder="Ej.: comparado con el PDF del certificado"
          onClose={closeSub}
          onConfirm={async (observaciones) => {
            await calibrationApi.revisarCertificado(subEquipo.id, { observaciones });
            toast.success(`Certificado de ${subEquipo.codigo} revisado`);
            equipmentChanged();
          }}
        >
          <dl className="cal-facts rounded-xl border border-line bg-surface-2/50 px-4 py-3.5">
            <div className="col-span-full"><dt>Número</dt><dd>{subEquipo.certificado || '—'}</dd></div>
            <div><dt>Emitido</dt><dd>{formatDate(subEquipo.certFecha)}</dd></div>
            <div><dt>Vence</dt><dd>{formatDate(expiryOf(subEquipo.certFecha, subEquipo.periodoDias))}</dd></div>
            <div><dt>Vigencia</dt><dd>{subEquipo.periodoDias ? `${subEquipo.periodoDias} días` : '—'}</dd></div>
            <div><dt>Ente calibrador</dt><dd>{subEquipo.enteCalibrador || '—'}</dd></div>
          </dl>
        </ReasonModal>
      )}
      {sub?.type === 'anular' && subEquipo && sub.anterior && (
        <ReasonModal
          title={`Anular ${subEquipo.certificado || 'el certificado vigente'}`}
          subtitle={`${subEquipo.codigo} · ${subEquipo.instrumento}`}
          heading="Vuelve a regir el certificado anterior"
          description={`${sub.anterior.numero || 'El anterior'} (emitido el ${formatDate(sub.anterior.fecha)}, vence el ${formatDate(sub.anterior.vence || expiryOf(sub.anterior.fecha, sub.anterior.periodoDias))}) pasa a ser el vigente. Úsalo solo si el certificado se registró por error.`}
          confirmLabel="Anular certificado"
          danger
          reasonPlaceholder="Ej.: se registró el certificado de otro equipo"
          onClose={closeSub}
          onConfirm={async (motivo) => {
            await calibrationApi.anularCertificado(subEquipo.id, { motivo });
            toast.success('Certificado anulado; vuelve a regir el anterior');
            equipmentChanged();
          }}
        />
      )}
      </div>
    </main>
  );
}
