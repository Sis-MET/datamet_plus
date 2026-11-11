import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  AlertCircle, Camera, ChevronDown, ChevronLeft, ChevronRight, FileText, Hash, Info, List, Search, SlidersHorizontal, UserRound, X,
} from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import { Dropdown } from '../../calibration/components/Dropdown';
import { EmptyState, FieldLabel, Segmented, ToneBadge } from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { soporteApi } from '../api/soporte';
import { ESTADOS_INFORME, ESTADOS_VALIDACION, formatoFecha } from '../domain/informe';
import { TIPOS_SERVICIO, tipoServicio } from '../domain/plantillas';

const PAGE_SIZE = 25;
const GRUPOS_POR_PAGINA = 20;
const INFORMES_POR_GRUPO = 50;

const AVANZADOS = ['cliente', 'tecnico', 'desde', 'hasta', 'validacion'];
const hayFiltros = (filtros) => Object.values(filtros).some(Boolean);
const activos = (filtros) => Object.fromEntries(Object.entries(filtros).filter(([, value]) => value));

const CONTROL = 'flex h-9 items-center rounded-xl border border-line bg-surface text-fg shadow-xs transition-colors';

const AGRUPACIONES = [
  { value: 'otst', label: 'OTST', icon: <Hash className="h-4 w-4" aria-hidden="true" /> },
  { value: 'tecnico', label: 'Técnico', icon: <UserRound className="h-4 w-4" aria-hidden="true" /> },
  { value: 'ninguno', label: 'Sin agrupar', icon: <List className="h-4 w-4" aria-hidden="true" /> },
];

const NOMBRE_GRUPOS = { otst: ['OTST', 'OTST'], tecnico: ['técnico', 'técnicos'] };
const plural = (n, [uno, varios]) => `${n} ${n === 1 ? uno : varios}`;

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
        placeholder="Buscar OTST, informe, cliente, serie…"
        aria-label="Buscar informes"
        className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
      />
    </label>
  );
}

function PanelFiltros({ id, filtros, opciones, onChange, consulta = false }) {
  const baseId = useId();
  const campo = (key, label, control) => (
    <div className="min-w-0">
      <FieldLabel htmlFor={`${baseId}-${key}`}>{label}</FieldLabel>
      {control}
    </div>
  );
  return (
    <section id={id} aria-label="Filtros de los informes" className="card grid gap-x-4 gap-y-3 p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
      {!consulta && campo('validacion', 'Validación del informe', (
        <Dropdown id={`${baseId}-validacion`} ariaLabel="Validación" value={filtros.validacion || ''}
          onChange={validacion => onChange({ validacion })}
          options={[{ value: '', label: 'Todas las validaciones' }, ...Object.entries(ESTADOS_VALIDACION).map(([value, meta]) => ({ value, label: meta.label }))]} />
      ))}
      {campo('cliente', 'Cliente', (
        <Dropdown
          id={`${baseId}-cliente`}
          ariaLabel="Cliente"
          value={filtros.cliente}
          onChange={(cliente) => onChange({ cliente })}
          options={[{ value: '', label: 'Todos los clientes' }, ...(opciones?.clientes || []).map(c => ({ value: c, label: c }))]}
        />
      ))}
      {campo('tecnico', 'Técnico', (
        <Dropdown
          id={`${baseId}-tecnico`}
          ariaLabel="Técnico"
          value={filtros.tecnico}
          onChange={(tecnico) => onChange({ tecnico })}
          options={[{ value: '', label: 'Todos los técnicos' }, ...(opciones?.tecnicos || []).map(t => ({ value: t, label: t }))]}
        />
      ))}
      {campo('desde', 'Servicio desde', (
        <input
          id={`${baseId}-desde`}
          type="date"
          value={filtros.desde}
          max={filtros.hasta || undefined}
          onChange={(event) => onChange({ desde: event.target.value })}
          className="field h-11 font-medium tabular-nums"
        />
      ))}
      {campo('hasta', 'Servicio hasta', (
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

const ETIQUETA_FILTRO = {
  validacion: v => ESTADOS_VALIDACION[v]?.label || v,
  cliente: (v) => v,
  tecnico: (v) => v,
  desde: (v) => `Desde ${formatoFecha(v)}`,
  hasta: (v) => `Hasta ${formatoFecha(v)}`,
};

function Filtros({ filtros, opciones, resumen, total, agrupar, onAgrupar, onChange, onClear, consulta = false }) {
  const [abierto, setAbierto] = useState(false);
  const [reinicio, setReinicio] = useState(0);
  const panelId = useId();
  const avanzados = AVANZADOS.filter(key => filtros[key]).length;
  const buscar = useCallback((q) => onChange({ q }), [onChange]);

  const opcionesTipo = useMemo(() => [
    { value: '', label: 'Todos los servicios', hint: resumen ? String(Object.values(resumen.tipos).reduce((a, b) => a + b, 0)) : undefined },
    ...TIPOS_SERVICIO.map(tipo => ({
      value: tipo.value,
      label: tipo.label,
      hint: resumen ? String(resumen.tipos[tipo.value] ?? 0) : undefined,
    })),
  ], [resumen]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Busqueda key={reinicio} value={filtros.q} onChange={buscar} />
        <div className="w-full sm:w-[290px]">
          <Dropdown
            ariaLabel="Tipo de servicio"
            value={filtros.tipo}
            onChange={(tipo) => onChange({ tipo })}
            options={opcionesTipo}
            className="[&_button]:h-9 [&_select]:h-9"
          />
        </div>
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
        {!abierto && AVANZADOS.filter(key => filtros[key]).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ [key]: '' })}
            aria-label={`Quitar el filtro ${ETIQUETA_FILTRO[key](filtros[key])}`}
            className="cal-filter-chip cal-tone-neutral max-w-[240px]"
          >
            <span className="truncate text-fg">{ETIQUETA_FILTRO[key](filtros[key])}</span>
            <X className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          </button>
        ))}
      </div>

      {abierto && <PanelFiltros id={panelId} filtros={filtros} opciones={opciones} onChange={onChange} consulta={consulta} />}

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {/* Quien solo consulta ve únicamente los emitidos: no filtra por estado. */}
        {!consulta && <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
          {Object.entries(ESTADOS_INFORME).map(([value, estado]) => {
            const conteo = resumen?.estados?.[value] ?? 0;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={filtros.estado === value}
                onClick={() => onChange({ estado: filtros.estado === value ? '' : value })}
                disabled={!conteo && filtros.estado !== value}
                title={estado.descripcion}
                className={cn('cal-filter-chip', `cal-tone-${estado.tone}`)}
              >
                <span className="cal-dot" aria-hidden="true" />
                {estado.label}
                <strong>{conteo}</strong>
              </button>
            );
          })}
        </div>}
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
        <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
          {total && <span className="hidden text-xs text-fg-muted md:block">{total}</span>}
          <span className="flex items-center gap-2">
            <span className="hidden text-xs text-fg-muted sm:inline">Agrupar por</span>
            <Segmented label="Agrupar los informes por" value={agrupar} onChange={onAgrupar} options={AGRUPACIONES} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Filas de informes ─────────────────────────────────────────────────────

function Estado({ informe }) {
  const estado = ESTADOS_INFORME[informe.estado] || ESTADOS_INFORME.PENDIENTE;
  return (
    <span className="flex flex-col items-end gap-1">
      <ToneBadge tone={estado.tone}>{estado.label}</ToneBadge>
      {informe.estado !== 'EMITIDO' && informe.validacionEstado && informe.validacionEstado !== 'BORRADOR' && (
        <ToneBadge tone={ESTADOS_VALIDACION[informe.validacionEstado].tone}>{ESTADOS_VALIDACION[informe.validacionEstado].label}</ToneBadge>
      )}
      {informe.estado === 'EMITIDO' && informe.revision > 0 && (
        <span className="text-[11.5px] text-fg-subtle">Rev. {informe.revision}</span>
      )}
      {informe.estado === 'EN_REVISION' && (
        <span className="text-[11.5px] text-fg-subtle">Rev. {informe.revision + 1} en borrador</span>
      )}
    </span>
  );
}

const instrumentoDe = (informe) => [informe.instrumento.tipo, informe.instrumento.marca, informe.instrumento.modelo]
  .filter(Boolean).join(' · ');

function Numero({ informe }) {
  return (
    <span className="flex flex-col">
      <span className="whitespace-nowrap font-mono text-[13.5px] font-semibold tracking-wide text-fg">{informe.numero}</span>
      <span className="text-[11.5px] text-fg-subtle">{tipoServicio(informe.tipo).corto}</span>
    </span>
  );
}

function Fila({ informe, onOpen, ocultar }) {
  return (
    <tr
      tabIndex={0}
      onClick={() => onOpen(informe)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(informe);
        }
      }}
      className="cursor-pointer align-top transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
    >
      <td className="px-4 py-3"><Numero informe={informe} /></td>
      <td className="whitespace-nowrap px-3 py-3 text-[13px] text-fg-muted">{formatoFecha(informe.fechaServicio)}</td>
      {!ocultar.cliente && (
        <td className="px-3 py-3 text-[13px]">
          <span className="block font-medium text-fg">{informe.cliente || '—'}</span>
          <span className="block text-fg-muted">{informe.planta || ''}</span>
        </td>
      )}
      <td className="px-3 py-3 text-[13px]">
        <span className="block font-medium text-fg">{informe.codMetrica || 'Sin código'}</span>
        <span className="block text-fg-muted">{instrumentoDe(informe)}</span>
        {ocultar.cliente && informe.instrumento.serie && <span className="block text-[12px] text-fg-subtle">Serie {informe.instrumento.serie}</span>}
      </td>
      {!ocultar.tecnico && (
        <td className="px-3 py-3 text-[13px] text-fg-muted">
          <span className="block">{informe.tecnico || '—'}</span>
          {informe.fotos > 0 && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-fg-subtle">
              <Camera className="h-3.5 w-3.5" aria-hidden="true" /> {informe.fotos}
            </span>
          )}
        </td>
      )}
      <td className="px-4 py-3 text-right"><Estado informe={informe} /></td>
    </tr>
  );
}

function Tarjeta({ informe, onOpen, ocultar }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(informe)}
        className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
      >
        <span className="flex items-start justify-between gap-3">
          <Numero informe={informe} />
          <Estado informe={informe} />
        </span>
        {!ocultar.cliente && (
          <span className="text-[13px] font-medium text-fg">{[informe.cliente, informe.planta].filter(Boolean).join(' · ') || '—'}</span>
        )}
        <span className="text-[12.5px] text-fg-muted">{[informe.codMetrica, instrumentoDe(informe)].filter(Boolean).join(' · ')}</span>
        <span className="text-[12.5px] text-fg-muted">
          {[formatoFecha(informe.fechaServicio), !ocultar.tecnico && informe.tecnico].filter(Boolean).join(' · ')}
        </span>
      </button>
    </li>
  );
}

/** Informes como tabla en escritorio y tarjetas en el teléfono. */
function TablaInformes({ items, onOpen, ocultar = {}, loading = false, caption }) {
  return (
    <div className={cn('transition-opacity', loading && 'opacity-60')}>
      <table className="hidden w-full text-left md:table">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line bg-surface-2/60 text-xs text-fg-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Informe</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Fecha</th>
            {!ocultar.cliente && <th scope="col" className="px-3 py-2.5 font-medium">Cliente y planta</th>}
            <th scope="col" className="px-3 py-2.5 font-medium">Instrumento</th>
            {!ocultar.tecnico && <th scope="col" className="px-3 py-2.5 font-medium">Técnico</th>}
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="stagger-in divide-y divide-line">
          {items.map(informe => <Fila key={`${informe.tipo}:${informe.codigo}`} informe={informe} onOpen={onOpen} ocultar={ocultar} />)}
        </tbody>
      </table>
      <ul className="stagger-in divide-y divide-line md:hidden">
        {items.map(informe => <Tarjeta key={`${informe.tipo}:${informe.codigo}`} informe={informe} onOpen={onOpen} ocultar={ocultar} />)}
      </ul>
    </div>
  );
}

function Paginas({ page, total, pageSize, loading, onPage, etiqueta, className }) {
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  if (totalPaginas <= 1 && !etiqueta) return null;
  return (
    <nav className={cn('flex flex-wrap items-center justify-between gap-3', className)} aria-label="Páginas">
      <p className="text-[13px] text-fg-muted">{[etiqueta, totalPaginas > 1 && `página ${page} de ${totalPaginas}`].filter(Boolean).join(' · ')}</p>
      {totalPaginas > 1 && (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Anterior
          </Button>
          <Button size="sm" variant="secondary" disabled={page >= totalPaginas || loading} onClick={() => onPage(page + 1)}>
            Siguiente <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </nav>
  );
}

// ─── Grupos ────────────────────────────────────────────────────────────────

/** Avance del grupo: emitidos, borradores y pendientes en una barra. */
function BarraEstados({ estados, total }) {
  const partes = [
    ['EMITIDO', 'bg-success'],
    ['EN_REVISION', 'bg-info'],
    ['BORRADOR', 'bg-warning'],
    ['PENDIENTE', 'bg-fg/15'],
  ];
  const detalle = partes
    .filter(([clave]) => estados[clave] > 0)
    .map(([clave]) => (clave === 'EN_REVISION'
      ? `${estados[clave]} en revisión`
      : `${estados[clave]} ${ESTADOS_INFORME[clave].label.toLowerCase()}${estados[clave] === 1 ? '' : 's'}`))
    .join(', ');
  return (
    <span className="flex flex-col items-end gap-1" title={detalle}>
      <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-fg/[0.06]" aria-hidden="true">
        {partes.map(([clave, color]) => (
          estados[clave] > 0 && <span key={clave} className={color} style={{ width: `${(estados[clave] / total) * 100}%` }} />
        ))}
      </span>
      <span className="text-[11.5px] tabular-nums text-fg-muted">
        <span className="sr-only">{detalle}. </span>
        <span aria-hidden="true">{(estados.EMITIDO || 0) + (estados.EN_REVISION || 0)} de {total} emitidos</span>
      </span>
    </span>
  );
}

const fechas = (grupo) => {
  if (!grupo.desde) return null;
  return grupo.desde === grupo.hasta ? formatoFecha(grupo.desde) : `${formatoFecha(grupo.desde)} – ${formatoFecha(grupo.hasta)}`;
};

const lista = (valores, max = 2) => (valores.length > max ? `${valores.slice(0, max).join(', ')} y ${valores.length - max} más` : valores.join(', '));

const iniciales = (nombre) => String(nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

function EncabezadoGrupo({ grupo, por }) {
  const servicios = grupo.tipos.map(tipo => tipoServicio(tipo).corto).join(', ');
  if (por === 'tecnico') {
    return (
      <>
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-2 text-[12px] font-semibold text-fg-muted">
          {iniciales(grupo.clave)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-fg">{grupo.clave || 'Sin técnico'}</span>
          <span className="block truncate text-[12.5px] text-fg-muted">
            {[plural(grupo.otsts, ['OTST', 'OTST']), plural(grupo.clientes.length, ['cliente', 'clientes']),
              grupo.hasta && `último servicio ${formatoFecha(grupo.hasta)}`, servicios].filter(Boolean).join(' · ')}
          </span>
        </span>
      </>
    );
  }
  return (
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="font-mono text-[14px] font-semibold tracking-wide text-fg">{grupo.clave || 'Sin OTST'}</span>
        <span className="min-w-0 truncate text-[13.5px] font-medium text-fg">{lista(grupo.clientes, 1)}</span>
      </span>
      <span className="block truncate text-[12.5px] text-fg-muted">
        {[lista(grupo.plantas), fechas(grupo), lista(grupo.tecnicos), servicios].filter(Boolean).join(' · ')}
      </span>
    </span>
  );
}

/** Informes de un grupo abierto; se cargan al abrirlo. */
function ContenidoGrupo({ grupo, por, filtros, onOpen }) {
  const [page, setPage] = useState(1);
  const load = useCallback(() => soporteApi.informes({
    ...activos(filtros),
    por,
    grupo: grupo.clave,
    page,
    pageSize: INFORMES_POR_GRUPO,
  }), [filtros, grupo.clave, page, por]);
  const { data, error, loading, reload } = useResource(load);

  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-3" role="alert">
        <AlertCircle className="h-4 w-4 flex-none text-danger" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[13px] text-fg">{error.message}</p>
        <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="animate-pulse" role="status" aria-label="Cargando los informes del grupo">
        {Array.from({ length: Math.min(grupo.total, 3) }, (_, index) => (
          <div key={index} className="flex h-[58px] items-center gap-4 border-b border-line px-4 last:border-0">
            <div className="h-3 w-28 rounded-full bg-fg/[0.07]" />
            <div className="h-3 w-56 rounded-full bg-fg/[0.07]" />
          </div>
        ))}
      </div>
    );
  }
  if (data.items.length === 0) {
    return <p className="px-4 py-3 text-[13px] text-fg-muted">Ningún informe de este grupo coincide con los filtros.</p>;
  }
  return (
    <>
      <TablaInformes
        items={data.items}
        onOpen={onOpen}
        loading={loading}
        ocultar={{ cliente: por === 'otst', tecnico: por === 'tecnico' }}
        caption={`Informes de ${grupo.clave}`}
      />
      <Paginas
        page={page}
        total={data.total}
        pageSize={INFORMES_POR_GRUPO}
        loading={loading}
        onPage={setPage}
        className="border-t border-line px-4 py-2.5"
      />
    </>
  );
}

function Grupo({ grupo, por, filtros, abierto, onToggle, onOpen, consulta = false }) {
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
          <ChevronDown
            className={cn('h-4 w-4 flex-none text-fg-subtle transition-transform duration-150', !abierto && '-rotate-90')}
            aria-hidden="true"
          />
          <EncabezadoGrupo grupo={grupo} por={por} />
          <span className="hidden flex-none text-[12.5px] font-medium tabular-nums text-fg-muted sm:block">
            {plural(grupo.total, ['informe', 'informes'])}
          </span>
          {!consulta && <BarraEstados estados={grupo.estados} total={grupo.total} />}
        </button>
      </h3>
      {abierto && (
        <div id={contenidoId} className="border-t border-line">
          <ContenidoGrupo grupo={grupo} por={por} filtros={filtros} onOpen={onOpen} />
        </div>
      )}
    </section>
  );
}

// ─── Lista ─────────────────────────────────────────────────────────────────

function Esqueleto() {
  return (
    <div className="card animate-pulse shadow-card" role="status" aria-label="Cargando informes">
      {[0, 1, 2, 3].map(index => (
        <div key={index} className="flex h-[62px] items-center gap-4 border-b border-line px-4 last:border-0">
          <div className="h-3 w-28 rounded-full bg-fg/[0.07]" />
          <div className="h-3 w-56 rounded-full bg-fg/[0.07]" />
        </div>
      ))}
    </div>
  );
}

/**
 * Lista de los servicios de Soporte técnico que subió ServiceMET, con el
 * estado de su informe, agrupada por OTST, por técnico o sin agrupar. Al
 * abrir uno se edita y se imprime. Con `consulta` (Comercial) el servidor
 * manda solo los informes emitidos, que se abren para verlos e imprimirlos.
 */
export function InformesLista({ filtros, page, agrupar, abiertos, onFiltros, onPage, onAgrupar, onAbiertos, onOpen, consulta = false }) {
  const agrupado = agrupar !== 'ninguno';
  const load = useCallback(() => (agrupado
    ? soporteApi.grupos({ ...activos(filtros), por: agrupar, page, pageSize: GRUPOS_POR_PAGINA })
    : soporteApi.informes({ ...activos(filtros), page, pageSize: PAGE_SIZE })), [agrupado, agrupar, filtros, page]);
  const { data: cargado, error, loading, reload } = useResource(load);
  const { data: opciones } = useResource(soporteApi.filtros);

  // Al cambiar de agrupación la respuesta anterior no sirve.
  const data = cargado && (agrupado ? cargado.por === agrupar : !cargado.por) ? cargado : null;
  const claveGrupo = (grupo) => `${agrupar}:${grupo.clave}`;

  // Con pocos grupos (por ejemplo, al buscar una OTST) se abren solos.
  useEffect(() => {
    if (!data?.grupos || data.total > 2 || data.grupos.length === 0) return;
    onAbiertos((actuales) => {
      const nuevas = data.grupos.map(grupo => `${data.por}:${grupo.clave}`).filter(clave => !actuales.has(clave));
      return nuevas.length ? new Set([...actuales, ...nuevas]) : actuales;
    });
  }, [data, onAbiertos]);

  const alternar = (grupo) => onAbiertos((actuales) => {
    const siguiente = new Set(actuales);
    const clave = claveGrupo(grupo);
    if (siguiente.has(clave)) siguiente.delete(clave);
    else siguiente.add(clave);
    return siguiente;
  });

  const grupos = data?.grupos || [];
  const items = data?.items || [];
  const vacio = data && (agrupado ? grupos.length === 0 : items.length === 0);
  const algunoAbierto = grupos.some(grupo => abiertos.has(claveGrupo(grupo)));
  const total = !data ? null : agrupado
    ? `${plural(data.total, NOMBRE_GRUPOS[agrupar])} · ${plural(data.totalInformes, ['informe', 'informes'])}`
    : plural(data.total, ['informe', 'informes']);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="sr-only">{consulta ? 'Informes emitidos de soporte técnico' : 'Informes de soporte técnico'}</h2>

      {consulta && (
        <p className="flex items-start gap-2 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-fg-muted">
          <Info className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          <span>
            Informes emitidos por Soporte Técnico, en la revisión que tiene el cliente. Puede verlos, imprimirlos y
            descargarlos; si alguno necesita una corrección, pídala al área.
          </span>
        </p>
      )}

      <Filtros
        consulta={consulta}
        filtros={filtros}
        opciones={opciones}
        resumen={data?.resumen}
        total={total}
        agrupar={agrupar}
        onAgrupar={onAgrupar}
        onChange={onFiltros}
        onClear={() => onFiltros(null)}
      />

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            <span className="font-semibold">No se pudieron cargar los informes.</span>{' '}
            <span className="text-fg-muted">{error.message}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {!data && !error && <Esqueleto />}

      {vacio && (
        <EmptyState
          icon={FileText}
          title={hayFiltros(filtros) ? 'Ningún informe coincide con los filtros'
            : consulta ? 'Todavía no hay informes emitidos' : 'Todavía no hay servicios de soporte'}
        >
          {hayFiltros(filtros)
            ? 'Cambie o limpie los filtros para ver otros informes.'
            : consulta ? 'Los informes aparecen aquí cuando Soporte Técnico los emite.'
              : 'Los servicios aparecen aquí cuando el técnico los sube desde ServiceMET.'}
        </EmptyState>
      )}

      {agrupado && grupos.length > 0 && (
        <>
          <div className="-mb-1 flex justify-end">
            <button
              type="button"
              onClick={() => onAbiertos((actuales) => {
                const siguiente = new Set(actuales);
                grupos.forEach(grupo => (algunoAbierto ? siguiente.delete(claveGrupo(grupo)) : siguiente.add(claveGrupo(grupo))));
                return siguiente;
              })}
              className="text-[12.5px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
            >
              {algunoAbierto ? 'Cerrar todos' : 'Abrir todos'}
            </button>
          </div>
          <div className={cn('stagger-in flex flex-col gap-2.5 transition-opacity', loading && 'opacity-60')}>
            {grupos.map(grupo => (
              <Grupo
                key={claveGrupo(grupo)}
                grupo={grupo}
                por={agrupar}
                filtros={filtros}
                abierto={abiertos.has(claveGrupo(grupo))}
                onToggle={() => alternar(grupo)}
                onOpen={onOpen}
                consulta={consulta}
              />
            ))}
          </div>
        </>
      )}

      {!agrupado && items.length > 0 && (
        <div className="card overflow-hidden shadow-card">
          <TablaInformes items={items} onOpen={onOpen} loading={loading} caption="Informes de soporte, del servicio más reciente al más antiguo" />
        </div>
      )}

      {data && data.total > 0 && (
        <Paginas
          page={page}
          total={data.total}
          pageSize={data.pageSize || (agrupado ? GRUPOS_POR_PAGINA : PAGE_SIZE)}
          loading={loading}
          onPage={onPage}
          etiqueta={total}
        />
      )}
    </div>
  );
}
