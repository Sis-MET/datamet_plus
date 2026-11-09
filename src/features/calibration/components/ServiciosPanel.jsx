import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, FileText, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import { useResource } from '../../system/hooks/useResource';
import { calibrationApi } from '../api/calibration';
import { formatDate } from '../domain/format';
import {
  CALIDADES, agruparPorSeca, conUnidad, contarCalidades, filtrarServicios, instrumentoTexto, tecnicosDe,
} from '../domain/servicios';
import { ESTADOS_REGISTRO } from '../domain/registro';
import { AprobadoresModal } from './AprobadoresModal';
import { Dropdown } from './Dropdown';
import { EmptyState, ToneBadge } from './primitives';
import { AvisoPatrones } from './patrones/AvisoPatrones';

const CONTROL = 'flex h-9 items-center rounded-xl border border-line bg-surface text-fg shadow-xs transition-colors';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const lista = (valores, max = 2) => (valores.length > max ? `${valores.slice(0, max).join(', ')} y ${valores.length - max} más` : valores.join(', '));
const rangoFechas = (desde, hasta) => {
  if (!desde) return null;
  return desde === hasta ? formatDate(desde) : `${formatDate(desde)} – ${formatDate(hasta)}`;
};

function Busqueda({ value, onChange }) {
  return (
    <label className={cn(CONTROL, 'w-full min-w-0 gap-2 px-3 xl:w-auto xl:max-w-[320px] xl:flex-1 focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/15')}>
      <Search className="h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar SECA, cliente, código, serie…"
        aria-label="Buscar servicios"
        className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
      />
    </label>
  );
}

function Fecha({ id, label, value, min, max, onChange }) {
  return (
    <label htmlFor={id} className={cn(CONTROL, 'gap-2 pl-3 pr-1.5 text-[12.5px] text-fg-muted')}>
      {label}
      <input
        id={id}
        type="date"
        value={value}
        min={min || undefined}
        max={max || undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 rounded-lg bg-transparent px-1 text-[13px] font-medium tabular-nums text-fg outline-none"
      />
    </label>
  );
}

/** Errores y avisos de un servicio, como insignias. */
function Avisos({ avisos }) {
  if (!avisos.errores && !avisos.avisos) return <ToneBadge tone="success">Sin observaciones</ToneBadge>;
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {avisos.errores > 0 && <ToneBadge tone="danger">{plural(avisos.errores, 'error', 'errores')}</ToneBadge>}
      {avisos.avisos > 0 && <ToneBadge tone="warning">{plural(avisos.avisos, 'aviso', 'avisos')}</ToneBadge>}
    </span>
  );
}

function EstadoRegistro({ estado }) {
  const meta = ESTADOS_REGISTRO[estado] || ESTADOS_REGISTRO.PENDIENTE;
  return estado === 'PENDIENTE' || !estado
    ? <span className="text-[11.5px] text-fg-subtle">{meta.label}</span>
    : <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>;
}

function Tecnico({ tecnico }) {
  if (tecnico.usuario) {
    return (
      <span className="flex flex-col">
        <span className="font-medium text-fg">{tecnico.iniciales || tecnico.usuario}</span>
        <span className="text-[12px] text-fg-subtle">{tecnico.nombre}</span>
      </span>
    );
  }
  return (
    <span className="flex flex-col items-start gap-0.5">
      <ToneBadge tone="warning">Sin identificar</ToneBadge>
      <span className="text-[12px] text-fg-subtle">{tecnico.original || 'vacío'}</span>
    </span>
  );
}

function Fila({ servicio, onOpen }) {
  const abrir = () => onOpen(servicio);
  return (
    <tr
      tabIndex={0}
      onClick={abrir}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          abrir();
        }
      }}
      className="cursor-pointer align-top transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
    >
      <td className="px-4 py-3">
        <span className="block whitespace-nowrap font-mono text-[13.5px] font-semibold text-fg">RECA {servicio.reca || '—'}</span>
        <span className="block text-[11.5px] text-fg-subtle">Sticker {servicio.sticker || '—'}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-[13px] text-fg-muted">{formatDate(servicio.fecha)}</td>
      <td className="px-3 py-3 text-[13px]">
        <span className="block font-medium text-fg">{servicio.instrumento.codigoMetrica || 'Sin código'}</span>
        <span className="block text-fg-muted">
          {[instrumentoTexto(servicio.instrumento), servicio.instrumento.max && `Max ${conUnidad(servicio.instrumento.max, servicio.instrumento.unidad)}`]
            .filter(Boolean).join(' · ')}
        </span>
      </td>
      <td className="px-3 py-3 text-[13px]"><Tecnico tecnico={servicio.tecnico} /></td>
      <td className="px-4 py-3 text-right">
        <span className="flex flex-col items-end gap-1">
          <Avisos avisos={servicio.avisos} />
          <EstadoRegistro estado={servicio.estado} />
        </span>
      </td>
    </tr>
  );
}

function Tarjeta({ servicio, onOpen }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(servicio)}
        className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="font-mono text-[13.5px] font-semibold text-fg">RECA {servicio.reca || '—'}</span>
          <span className="flex flex-col items-end gap-1">
            <Avisos avisos={servicio.avisos} />
            <EstadoRegistro estado={servicio.estado} />
          </span>
        </span>
        <span className="text-[12.5px] text-fg-muted">
          {[servicio.instrumento.codigoMetrica, instrumentoTexto(servicio.instrumento)].filter(Boolean).join(' · ')}
        </span>
        <span className="text-[12.5px] text-fg-muted">
          {[formatDate(servicio.fecha), servicio.tecnico.iniciales || 'Técnico sin identificar'].filter(Boolean).join(' · ')}
        </span>
      </button>
    </li>
  );
}

function Grupo({ grupo, abierto, onToggle, onOpen }) {
  const contenidoId = useId();
  return (
    <section className="card overflow-hidden shadow-card">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={abierto}
          aria-controls={contenidoId}
          className={cn(
            'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2',
            abierto && 'bg-surface-2/50',
          )}
        >
          <ChevronDown className={cn('h-4 w-4 flex-none text-fg-subtle transition-transform duration-150', !abierto && '-rotate-90')} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="font-mono text-[14px] font-semibold tracking-wide text-fg">{grupo.clave}</span>
              <span className="min-w-0 truncate text-[13.5px] font-medium text-fg">{lista(grupo.clientes, 1)}</span>
            </span>
            <span className="block truncate text-[12.5px] text-fg-muted">
              {[lista(grupo.plantas), rangoFechas(grupo.desde, grupo.hasta), lista(grupo.tecnicos, 3)].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className="hidden flex-none text-[12.5px] font-medium tabular-nums text-fg-muted sm:block">
            {plural(grupo.total, 'servicio', 'servicios')}
          </span>
          <span className="flex flex-none flex-col items-end gap-1">
            {grupo.conErrores > 0 && <ToneBadge tone="danger">{grupo.conErrores} con errores</ToneBadge>}
            {grupo.conAvisos > 0 && <ToneBadge tone="warning">{grupo.conAvisos} con avisos</ToneBadge>}
            {!grupo.conErrores && !grupo.conAvisos && <ToneBadge tone="success">Sin observaciones</ToneBadge>}
          </span>
        </button>
      </h3>
      {abierto && (
        <div id={contenidoId} className="border-t border-line">
          <table className="hidden w-full text-left md:table">
            <caption className="sr-only">Servicios del SECA {grupo.clave}</caption>
            <thead className="border-b border-line bg-surface-2/60 text-xs text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Registro</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Fecha</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Instrumento</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Técnico</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Datos y registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {grupo.servicios.map(servicio => <Fila key={servicio.codigo} servicio={servicio} onOpen={onOpen} />)}
            </tbody>
          </table>
          <ul className="divide-y divide-line md:hidden">
            {grupo.servicios.map(servicio => <Tarjeta key={servicio.codigo} servicio={servicio} onOpen={onOpen} />)}
          </ul>
        </div>
      )}
    </section>
  );
}

function Esqueleto() {
  return (
    <div className="card animate-pulse shadow-card" role="status" aria-label="Cargando servicios">
      {[0, 1, 2, 3].map(index => (
        <div key={index} className="flex h-[62px] items-center gap-4 border-b border-line px-4 last:border-0">
          <div className="h-3 w-28 rounded-full bg-fg/[0.07]" />
          <div className="h-3 w-56 rounded-full bg-fg/[0.07]" />
        </div>
      ))}
    </div>
  );
}

const inicioDelAnio = () => `${new Date().getFullYear()}-01-01`;

/**
 * Servicios de calibración que subió ServiceMET, agrupados por SECA, con los
 * avisos de calidad de sus datos. El registro de calibración (corregir,
 * calcular, revisar) se elabora en la siguiente etapa.
 */
/**
 * `onAbrir(codigo)` abre la página del registro del servicio. `actualizar`
 * cambia al volver de un registro, para releer los estados. `onVerPatrones`
 * lleva a Equipos › Patrones desde el aviso de cálculos provisionales.
 */
export function ServiciosPanel({ onAbrir, actualizar = 0, onVerPatrones }) {
  const baseId = useId();
  const [desde, setDesde] = useState(inicioDelAnio);
  const [hasta, setHasta] = useState('');
  const [q, setQ] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [calidad, setCalidad] = useState('');
  const [abiertos, setAbiertos] = useState(() => new Set());
  // Con pocos grupos (por ejemplo, al buscar un SECA) se muestran abiertos
  // salvo que se cierren a mano.
  const [cerrados, setCerrados] = useState(() => new Set());
  const [aprobadores, setAprobadores] = useState(false);

  const load = useCallback(() => calibrationApi.servicios({ desde: desde || undefined, hasta: hasta || undefined }), [desde, hasta]);
  const { data, error, loading, reload } = useResource(load);
  // Al volver de un registro se releen los estados.
  useEffect(() => {
    if (actualizar) reload();
  }, [actualizar, reload]);
  const servicios = useMemo(() => data?.servicios || [], [data]);

  const tecnicos = useMemo(() => tecnicosDe(servicios), [servicios]);
  const porTexto = useMemo(() => filtrarServicios(servicios, { q, tecnico }), [servicios, q, tecnico]);
  const conteos = useMemo(() => contarCalidades(porTexto), [porTexto]);
  const visibles = useMemo(() => filtrarServicios(porTexto, { calidad }), [porTexto, calidad]);
  const grupos = useMemo(() => agruparPorSeca(visibles), [visibles]);
  const pocos = grupos.length > 0 && grupos.length <= 2;
  const estaAbierto = (clave) => abiertos.has(clave) || (pocos && !cerrados.has(clave));
  const algunoAbierto = grupos.some(grupo => estaAbierto(grupo.clave));
  const hayFiltros = Boolean(q || tecnico || calidad || hasta || desde !== inicioDelAnio());

  const alternar = (clave) => {
    const abrir = !estaAbierto(clave);
    const cambiar = (incluir) => (actuales) => {
      const siguiente = new Set(actuales);
      if (incluir) siguiente.add(clave);
      else siguiente.delete(clave);
      return siguiente;
    };
    setAbiertos(cambiar(abrir));
    setCerrados(cambiar(!abrir));
  };

  const todos = (abrir) => {
    const claves = grupos.map(grupo => grupo.clave);
    setAbiertos(abrir ? new Set(claves) : new Set());
    setCerrados(abrir ? new Set() : new Set(claves));
  };

  const limpiar = () => {
    setQ('');
    setTecnico('');
    setCalidad('');
    setDesde(inicioDelAnio());
    setHasta('');
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="sr-only">Servicios de calibración de ServiceMET</h2>
      <AvisoPatrones onVer={onVerPatrones} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Busqueda value={q} onChange={setQ} />
          <Fecha id={`${baseId}-desde`} label="Desde" value={desde} max={hasta} onChange={setDesde} />
          <Fecha id={`${baseId}-hasta`} label="Hasta" value={hasta} min={desde} onChange={setHasta} />
          <div className="w-full sm:w-[230px]">
            <Dropdown
              ariaLabel="Técnico"
              value={tecnico}
              onChange={setTecnico}
              options={[{ value: '', label: 'Todos los técnicos' }, ...tecnicos]}
              className="[&_button]:h-9 [&_select]:h-9"
            />
          </div>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className={cn(CONTROL, 'w-9 justify-center hover:bg-surface-2 disabled:opacity-60')}
            aria-label="Volver a leer los servicios"
            title="Volver a leer los servicios"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin text-fg-muted')} />
          </button>
          {data?.permisos?.configurarAprobadores && (
            <button
              type="button"
              onClick={() => setAprobadores(true)}
              className={cn(CONTROL, 'ml-auto gap-1.5 px-3 font-semibold hover:bg-surface-2')}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Aprobadores
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
          <div role="group" aria-label="Filtrar por calidad de los datos" className="flex flex-wrap gap-1.5">
            {Object.entries(CALIDADES).map(([clave, meta]) => (
              <button
                key={clave}
                type="button"
                aria-pressed={calidad === clave}
                onClick={() => setCalidad(calidad === clave ? '' : clave)}
                disabled={!conteos[clave] && calidad !== clave}
                title={meta.descripcion}
                className={cn('cal-filter-chip', `cal-tone-${meta.tone}`)}
              >
                <span className="cal-dot" aria-hidden="true" />
                {meta.label}
                <strong>{conteos[clave]}</strong>
              </button>
            ))}
          </div>
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiar}
              className="ml-1 text-[13px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
            >
              Quitar filtros
            </button>
          )}
          {data && (
            <span className="text-xs text-fg-muted sm:ml-auto">
              {plural(grupos.length, 'SECA', 'SECA')} · {plural(visibles.length, 'servicio', 'servicios')}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            <span className="font-semibold">No se pudieron leer los servicios.</span>{' '}
            <span className="text-fg-muted">{error.message}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {!data && !error && <Esqueleto />}

      {data && grupos.length === 0 && (
        <EmptyState icon={FileText} title={servicios.length ? 'Ningún servicio coincide con los filtros' : 'No hay servicios en estas fechas'}>
          {servicios.length
            ? 'Cambie o quite los filtros para ver otros servicios.'
            : 'Los servicios aparecen aquí cuando el técnico los sube desde ServiceMET. Pruebe con otro rango de fechas.'}
        </EmptyState>
      )}

      {grupos.length > 0 && (
        <>
          <div className="-mb-1 flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[12.5px] text-fg-muted">
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
              Los datos de ServiceMET no se modifican: las correcciones quedan en el registro, con su historial.
            </p>
            <button
              type="button"
              onClick={() => todos(!algunoAbierto)}
              className="text-[12.5px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
            >
              {algunoAbierto ? 'Cerrar todos' : 'Abrir todos'}
            </button>
          </div>
          <div className={cn('flex flex-col gap-2.5 transition-opacity', loading && 'opacity-60')}>
            {grupos.map(grupo => (
              <Grupo
                key={grupo.clave}
                grupo={grupo}
                abierto={estaAbierto(grupo.clave)}
                onToggle={() => alternar(grupo.clave)}
                onOpen={servicio => onAbrir(servicio.codigo)}
              />
            ))}
          </div>
        </>
      )}

      {aprobadores && <AprobadoresModal onClose={() => setAprobadores(false)} />}
    </div>
  );
}
