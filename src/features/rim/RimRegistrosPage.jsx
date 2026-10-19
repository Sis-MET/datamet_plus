import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, ClipboardList, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../../shared/components/ui/Button';
import { cn } from '../../shared/utils/cn';
import { Dropdown } from '../calibration/components/Dropdown';
import { EmptyState, FieldLabel, ToneBadge } from '../calibration/components/primitives';
import { useResource } from '../system/hooks/useResource';
import { rimApi } from './api/rim';
import { RimDetailModal } from './components/RimDetailModal';
import {
  AREAS,
  ESTADOS_RIM,
  ORIGENES,
  PAGE_SIZE,
  SITUACIONES,
  SITUACIONES_SIN_ETAPA,
  clientePlanta,
  contarAvanzados,
  conteoSituacion,
  descripcionInstrumento,
  etiquetasFiltros,
  fechaHora,
  filtrosAParams,
  filtrosVacios,
  hayFiltros,
} from './domain/rim';
import { ETAPAS_RIM } from './domain/seguimiento';
import '../calibration/calibration.css';
import './rim.css';

function Codigo({ rim }) {
  return (
    <span className="flex flex-col">
      <span className="font-mono text-[13.5px] font-semibold tracking-wide text-fg">{rim.codigo}</span>
      <span className="text-[11.5px] text-fg-subtle">
        N.º {rim.n}{rim.formatoAnterior ? ' · formato anterior' : ''}
      </span>
    </span>
  );
}

/** Anulado o, si está vigente, la etapa alcanzada (recibido … entregado). */
function Estado({ rim }) {
  const estado = rim.estado === 'vigente' && ETAPAS_RIM[rim.etapa] ? ETAPAS_RIM[rim.etapa] : ESTADOS_RIM[rim.estado];
  return <ToneBadge tone={estado.tone}>{estado.label}</ToneBadge>;
}

/** Fila del historial: tabla en escritorio, tarjeta en el teléfono. */
function RimRow({ rim, onOpen }) {
  return (
    <tr
      tabIndex={0}
      onClick={() => onOpen(rim)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(rim);
        }
      }}
      className="cursor-pointer align-top transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
    >
      <td className="px-4 py-3"><Codigo rim={rim} /></td>
      <td className="whitespace-nowrap px-3 py-3 text-[13px] text-fg-muted">{fechaHora(rim.emitidoEn)}</td>
      <td className="px-3 py-3 text-[13px]">
        <span className="block font-medium text-fg">{rim.cliente.nombre || '—'}</span>
        <span className="block text-fg-muted">{rim.planta.nombre || rim.planta.codigo || ''}</span>
      </td>
      <td className="px-3 py-3 text-[13px]">
        <span className="block font-medium text-fg">{rim.instrumento.codMetrica || 'Sin código'}</span>
        <span className="block text-fg-muted">{descripcionInstrumento(rim.instrumento)}</span>
      </td>
      <td className="px-3 py-3 text-[13px] text-fg-muted">
        <span className="block text-fg">{rim.areaLabel}</span>
        <span className="block">{rim.origenLabel}</span>
      </td>
      <td className="px-3 py-3 text-[13px] text-fg-muted">{rim.representanteMetrica}</td>
      <td className="px-4 py-3 text-right"><Estado rim={rim} /></td>
    </tr>
  );
}

function RimCard({ rim, onOpen }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(rim)}
        className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
      >
        <span className="flex items-start justify-between gap-3">
          <Codigo rim={rim} />
          <Estado rim={rim} />
        </span>
        <span className="text-[13px] font-medium text-fg">{clientePlanta(rim) || '—'}</span>
        <span className="text-[12.5px] text-fg-muted">
          {[rim.instrumento.codMetrica, descripcionInstrumento(rim.instrumento)].filter(Boolean).join(' · ')}
        </span>
        <span className="text-[12.5px] text-fg-muted">
          {[fechaHora(rim.emitidoEn), rim.areaLabel, rim.representanteMetrica].filter(Boolean).join(' · ')}
        </span>
      </button>
    </li>
  );
}

/** Controles de la barra, como en Calibración y Control de cambios. */
const CONTROL = 'flex h-9 items-center rounded-xl border border-line bg-surface text-fg shadow-xs transition-colors';

/** Búsqueda libre; se aplica al dejar de escribir. Al quitar los filtros se
 * vuelve a montar vacía (key). */
function Busqueda({ value, onChange }) {
  const [texto, setTexto] = useState(value);

  useEffect(() => {
    if (texto === value) return undefined;
    const timer = setTimeout(() => onChange(texto), 350);
    return () => clearTimeout(timer);
  }, [texto, value, onChange]);

  return (
    <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-fg shadow-xs transition-colors focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/15 sm:max-w-[340px]">
      <Search className="h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
      <input
        type="search"
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        placeholder="Buscar código, cliente, serie, SECA…"
        aria-label="Buscar RIM"
        className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
      />
    </label>
  );
}

/** Chips de situación (etapa o anulado), con cuántos RIM hay en cada una. */
function Situaciones({ value, resumen, onChange }) {
  const opciones = resumen?.etapas ? SITUACIONES : SITUACIONES_SIN_ETAPA;
  return (
    <div role="group" aria-label="Filtrar por situación" className="flex flex-wrap gap-1.5">
      {opciones.map(opcion => {
        const conteo = conteoSituacion(resumen, opcion.value);
        return (
          <button
            key={opcion.value}
            type="button"
            aria-pressed={value === opcion.value}
            onClick={() => onChange(value === opcion.value ? '' : opcion.value)}
            disabled={!conteo && value !== opcion.value}
            className={cn('cal-filter-chip', `cal-tone-${opcion.tone}`)}
          >
            <span className="cal-dot" aria-hidden="true" />
            {opcion.label}
            <strong>{conteo ?? 0}</strong>
          </button>
        );
      })}
    </div>
  );
}

/** Panel «Filtros»: cliente, planta, área, origen y fechas de emisión. */
function PanelFiltros({ id, filtros, opciones, onChange }) {
  const baseId = useId();
  const plantas = useMemo(
    () => (opciones?.plantas || []).filter(planta => !filtros.cliente || planta.cliente === filtros.cliente),
    [opciones, filtros.cliente],
  );
  const campo = (key, label, control) => (
    <div className="min-w-0">
      <FieldLabel htmlFor={`${baseId}-${key}`}>{label}</FieldLabel>
      {control}
    </div>
  );

  return (
    <section id={id} aria-label="Filtros del historial" className="card grid gap-x-4 gap-y-3 p-4 shadow-card sm:grid-cols-2 lg:grid-cols-3">
      {campo('cliente', 'Cliente', (
        <Dropdown
          id={`${baseId}-cliente`}
          ariaLabel="Cliente"
          value={filtros.cliente}
          onChange={(cliente) => onChange({ cliente, planta: '' })}
          options={[
            { value: '', label: 'Todos los clientes' },
            ...(opciones?.clientes || []).map(cliente => ({ value: cliente.codigo, label: cliente.nombre })),
          ]}
        />
      ))}
      {campo('planta', 'Planta', (
        <Dropdown
          id={`${baseId}-planta`}
          ariaLabel="Planta"
          value={filtros.planta}
          onChange={(planta) => onChange({ planta })}
          options={[
            { value: '', label: 'Todas las plantas' },
            ...plantas.map(planta => ({ value: planta.codigo, label: planta.nombre, hint: planta.codigo })),
          ]}
        />
      ))}
      {campo('area', 'Área', (
        <Dropdown
          id={`${baseId}-area`}
          ariaLabel="Área"
          value={filtros.area}
          onChange={(area) => onChange({ area })}
          options={[{ value: '', label: 'Todas las áreas' }, ...AREAS]}
        />
      ))}
      {campo('origen', 'Origen', (
        <Dropdown
          id={`${baseId}-origen`}
          ariaLabel="Origen"
          value={filtros.origen}
          onChange={(origen) => onChange({ origen })}
          options={[{ value: '', label: 'ServiceMET y web' }, ...ORIGENES]}
        />
      ))}
      {campo('desde', 'Emitido desde', (
        <input
          id={`${baseId}-desde`}
          type="date"
          value={filtros.desde}
          max={filtros.hasta || undefined}
          onChange={(event) => onChange({ desde: event.target.value })}
          className="field h-11 font-medium tabular-nums"
        />
      ))}
      {campo('hasta', 'Emitido hasta', (
        <input
          id={`${baseId}-hasta`}
          type="date"
          value={filtros.hasta}
          min={filtros.desde || undefined}
          onChange={(event) => onChange({ hasta: event.target.value })}
          className="field h-11 font-medium tabular-nums"
        />
      ))}
    </section>
  );
}

/**
 * Barra del historial: búsqueda, botón «Filtros» (el panel se abre a
 * pedido), los filtros del panel aplicados como etiquetas que se quitan con
 * un clic, y los chips de situación con sus conteos.
 */
function Filtros({ filtros, opciones, resumen, total, onChange, onClear }) {
  const [abierto, setAbierto] = useState(false);
  const [reinicio, setReinicio] = useState(0);
  const panelId = useId();
  const avanzados = contarAvanzados(filtros);
  const etiquetas = etiquetasFiltros(filtros, opciones);
  const buscar = useCallback((q) => onChange({ q }), [onChange]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Busqueda key={reinicio} value={filtros.q} onChange={buscar} />
        <button
          type="button"
          onClick={() => setAbierto(value => !value)}
          aria-expanded={abierto}
          aria-controls={panelId}
          className={cn(CONTROL, 'gap-2 px-3 text-[13px] font-semibold hover:bg-surface-2', abierto && 'bg-surface-2')}
        >
          <SlidersHorizontal className="h-4 w-4 text-fg-muted" aria-hidden="true" />
          Filtros
          {avanzados > 0 && <span className="cal-count">{avanzados}</span>}
        </button>
        {!abierto && etiquetas.map(etiqueta => (
          <button
            key={etiqueta.key}
            type="button"
            onClick={() => onChange({ [etiqueta.key]: '', ...(etiqueta.key === 'cliente' ? { planta: '' } : {}) })}
            aria-label={`Quitar el filtro ${etiqueta.label}`}
            className="cal-filter-chip cal-tone-neutral max-w-[240px]"
          >
            <span className="truncate text-fg">{etiqueta.label}</span>
            <X className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          </button>
        ))}
      </div>

      {abierto && <PanelFiltros id={panelId} filtros={filtros} opciones={opciones} onChange={onChange} />}

      <div className="flex flex-wrap items-center gap-1.5">
        <Situaciones value={filtros.situacion} resumen={resumen} onChange={(situacion) => onChange({ situacion })} />
        {hayFiltros(filtros) && (
          <button
            type="button"
            onClick={() => {
              setReinicio(value => value + 1);
              onClear();
            }}
            className="ml-1 text-[13px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
          >
            Quitar filtros
          </button>
        )}
        {total != null && (
          <span className="ml-auto hidden text-xs text-fg-muted md:block">
            {total} RIM
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Historial de RIM de ServiceMET y de DataMET+, con filtros y la ficha de
 * cada uno en solo lectura. Un RIM no se edita: se anula con su motivo. Como
 * en Calibración, la lista va directo bajo la barra: los conteos están en
 * los chips de situación.
 */
export function RimRegistrosPage() {
  const [filtros, setFiltros] = useState(filtrosVacios);
  const [page, setPage] = useState(1);
  const [abierto, setAbierto] = useState(null);

  const load = useCallback(() => rimApi.registros(filtrosAParams(filtros, page)), [filtros, page]);
  const { data, error, loading, reload } = useResource(load);
  const { data: opciones } = useResource(rimApi.filtros);

  const cambiarFiltros = useCallback((cambios) => {
    setFiltros(current => ({ ...current, ...cambios }));
    setPage(1);
  }, []);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / (data.pageSize || PAGE_SIZE))) : 1;
  const items = data?.items || [];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="sr-only">Historial de RIM</h2>

      <Filtros
        filtros={filtros}
        opciones={opciones}
        resumen={data?.resumen}
        total={data?.total}
        onChange={cambiarFiltros}
        onClear={() => cambiarFiltros(filtrosVacios())}
      />

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            <span className="font-semibold">No se pudo cargar el historial de RIM.</span>{' '}
            <span className="text-fg-muted">{error.message}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {!data && !error && (
        <div className="card animate-pulse shadow-card" role="status" aria-label="Cargando RIM">
          {[0, 1, 2, 3].map(index => (
            <div key={index} className="flex h-[62px] items-center gap-4 border-b border-line px-4 last:border-0">
              <div className="h-3 w-28 rounded-full bg-fg/[0.07]" />
              <div className="h-3 w-56 rounded-full bg-fg/[0.07]" />
            </div>
          ))}
        </div>
      )}

      {data && items.length === 0 && (
        <EmptyState icon={ClipboardList} title={hayFiltros(filtros) ? 'Ningún RIM coincide con los filtros' : 'Todavía no hay RIM registrados'}>
          {hayFiltros(filtros)
            ? 'Cambie o limpie los filtros para ver otros RIM.'
            : 'Los RIM aparecen aquí cuando el técnico los sube desde ServiceMET o se registran en «Nuevo RIM».'}
        </EmptyState>
      )}

      {items.length > 0 && (
        <div className={cn('card overflow-hidden shadow-card transition-opacity', loading && 'opacity-60')}>
          <table className="hidden w-full text-left md:table">
            <caption className="sr-only">RIM registrados, del más reciente al más antiguo</caption>
            <thead className="border-b border-line bg-surface-2/60 text-xs text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Código</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Emisión</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Cliente y planta</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Instrumento</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Área y origen</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Recibió</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map(rim => <RimRow key={rim.n} rim={rim} onOpen={(item) => setAbierto(item.n)} />)}
            </tbody>
          </table>
          <ul className="divide-y divide-line md:hidden">
            {items.map(rim => <RimCard key={rim.n} rim={rim} onOpen={(item) => setAbierto(item.n)} />)}
          </ul>
        </div>
      )}

      {data && data.total > 0 && (
        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Páginas del historial">
          <p className="text-[13px] text-fg-muted">
            {data.total} RIM · página {page} de {totalPaginas}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Anterior
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= totalPaginas || loading} onClick={() => setPage(value => value + 1)}>
              Siguiente <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}

      {abierto && (
        <RimDetailModal n={abierto} onClose={() => setAbierto(null)} onChanged={reload} />
      )}
    </div>
  );
}
