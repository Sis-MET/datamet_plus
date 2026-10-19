import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, ClipboardList, Search, X } from 'lucide-react';
import { Button } from '../../shared/components/ui/Button';
import { Input } from '../../shared/components/ui/Input';
import { Select } from '../../shared/components/ui/Select';
import { cn } from '../../shared/utils/cn';
import { EmptyState, ToneBadge } from '../calibration/components/primitives';
import { useResource } from '../system/hooks/useResource';
import { rimApi } from './api/rim';
import { RimDetailModal } from './components/RimDetailModal';
import {
  AREAS,
  ESTADOS_RIM,
  PAGE_SIZE,
  clientePlanta,
  descripcionInstrumento,
  fechaHora,
  filtrosAParams,
  filtrosVacios,
  hayFiltros,
} from './domain/rim';
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

function Estado({ rim }) {
  const estado = ESTADOS_RIM[rim.estado];
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

function Filtros({ filtros, opciones, onChange, onClear }) {
  const [texto, setTexto] = useState(filtros.q);

  // La búsqueda libre se aplica al dejar de escribir.
  useEffect(() => {
    if (texto === filtros.q) return undefined;
    const timer = setTimeout(() => onChange({ q: texto }), 350);
    return () => clearTimeout(timer);
  }, [texto, filtros.q, onChange]);

  const plantas = useMemo(
    () => (opciones?.plantas || []).filter(planta => !filtros.cliente || planta.cliente === filtros.cliente),
    [opciones, filtros.cliente],
  );

  return (
    <section aria-label="Filtros del historial" className="card p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <label htmlFor="rim-buscar" className="field-label">Buscar</label>
          <Search className="pointer-events-none absolute bottom-3 left-3.5 h-4 w-4 text-fg-subtle" aria-hidden="true" />
          <input
            id="rim-buscar"
            type="search"
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Código, código métrica, serie, contacto, SECA u OTST"
            className="field h-10 pl-10"
          />
        </div>
        <Select
          label="Cliente"
          value={filtros.cliente}
          onChange={(event) => onChange({ cliente: event.target.value, planta: '' })}
          placeholder="Todos"
          options={(opciones?.clientes || []).map(cliente => ({ value: cliente.codigo, label: cliente.nombre }))}
        />
        <Select
          label="Planta"
          value={filtros.planta}
          onChange={(event) => onChange({ planta: event.target.value })}
          placeholder="Todas"
          options={plantas.map(planta => ({ value: planta.codigo, label: `${planta.codigo} · ${planta.nombre}` }))}
        />
        <Select
          label="Área"
          value={filtros.area}
          onChange={(event) => onChange({ area: event.target.value })}
          placeholder="Todas"
          options={AREAS}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <Input label="Emitido desde" type="date" value={filtros.desde} max={filtros.hasta || undefined}
          onChange={(event) => onChange({ desde: event.target.value })} />
        <Input label="Emitido hasta" type="date" value={filtros.hasta} min={filtros.desde || undefined}
          onChange={(event) => onChange({ hasta: event.target.value })} />
        <Select
          label="Estado"
          value={filtros.estado}
          onChange={(event) => onChange({ estado: event.target.value })}
          placeholder="Vigentes y anulados"
          options={[{ value: 'vigente', label: 'Vigentes' }, { value: 'anulado', label: 'Anulados' }]}
        />
        <div className="flex items-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setTexto('');
              onClear();
            }}
            disabled={!hayFiltros(filtros)}
            className="w-full lg:w-auto"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Limpiar filtros
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * Historial de RIM de ServiceMET y de DataMET+, con filtros y la ficha de
 * cada uno en solo lectura. Un RIM no se edita: se anula con su motivo.
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
      <section aria-labelledby="rim-registros-titulo" className="card p-5 shadow-card">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand/20 text-fg">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="rim-registros-titulo" className="text-[15px] font-semibold text-fg">Historial de RIM</h2>
            <p className="mt-0.5 max-w-[78ch] text-[13px] leading-relaxed text-fg-muted">
              Recepciones de instrumentos registradas desde ServiceMET (calibración, soporte y registro directo) y desde el formulario web.
              Un RIM no se edita ni se borra: si tiene un error, se anula con su motivo y queda en el historial.
            </p>
          </div>
          {data && (
            <dl className="flex w-full gap-6 border-t border-line pt-3 sm:w-auto sm:border-0 sm:pt-0 sm:text-right">
              <div>
                <dt className="text-xs text-fg-muted">Vigentes</dt>
                <dd className="text-lg font-semibold tabular-nums text-fg">{data.resumen.vigentes}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">Anulados</dt>
                <dd className="text-lg font-semibold tabular-nums text-fg">{data.resumen.anulados}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <Filtros
        filtros={filtros}
        opciones={opciones}
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
