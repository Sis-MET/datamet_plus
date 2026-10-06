import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Code2,
  Database,
  Info,
  ListTodo,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import { useCompliance } from '../hooks/useCompliance';
import {
  COMPLIANCE_ORDER,
  COMPLIANCE_STATES,
  PRIORIDADES,
  complianceSentence,
  evaluatedAt,
  filterClausulas,
  groupActions,
} from '../domain/compliance';
import { ToneBadge } from './primitives';

const STATE_ICONS = {
  CUMPLE: CheckCircle2,
  PARCIAL: CircleAlert,
  NO_CUMPLE: XCircle,
  LABORATORIO: Building2,
};

const ORIGEN = {
  DATOS: { label: 'Evaluado con los datos actuales', icon: Database },
  DISENO: { label: 'Evaluado por el diseño del software', icon: Code2 },
};

const rowId = (id) => `cal-req-${id.replace(/[^a-z0-9]+/gi, '-')}`;

/** Una barra por estado, proporcional a cuántos requisitos hay en él. */
function DistributionBar({ resumen, className }) {
  return (
    <div className={cn('cal-dist', className)} role="img" aria-label={complianceSentence(resumen)}>
      {COMPLIANCE_ORDER.filter(estado => resumen[estado] > 0).map(estado => (
        <span key={estado} className={`cal-tone-${COMPLIANCE_STATES[estado].tone}`} style={{ flexGrow: resumen[estado] }} />
      ))}
    </div>
  );
}

function Summary({ report, loading, onReload, estados, onToggleEstado, onClearEstados, allOpen, onToggleAll }) {
  const goToPlan = () => {
    const plan = document.getElementById('cal-plan');
    plan?.scrollIntoView({ block: 'start' });
    plan?.querySelector('button')?.focus({ preventScroll: true });
  };
  const { resumen, contexto, norma } = report;
  return (
    <section aria-labelledby="cal-compliance-title" className="card p-5 shadow-card">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface-2 text-fg">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="cal-compliance-title" className="text-[15px] font-semibold text-fg">
            {norma.codigo} · puntos {norma.puntos.join(', ').replace(/, ([^,]*)$/, ' y $1')}
          </h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            Evaluación del módulo Calibración
            {contexto.baseDatos ? ` con los datos de ${contexto.baseDatos}` : ''}
            {' · '}
            <time dateTime={report.evaluadoEn}>{evaluatedAt(report.evaluadoEn)}</time>
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onReload} disabled={loading} className="w-full sm:w-auto">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          {loading ? 'Evaluando' : 'Volver a evaluar'}
        </Button>
      </div>

      <p className="mt-5 max-w-[68ch] text-[15px] leading-relaxed text-fg">{complianceSentence(resumen)}</p>
      <DistributionBar resumen={resumen} className="mt-3" />

      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por estado">
        {COMPLIANCE_ORDER.map(estado => (
          <button
            key={estado}
            type="button"
            aria-pressed={estados.has(estado)}
            onClick={() => onToggleEstado(estado)}
            disabled={!resumen[estado] && !estados.has(estado)}
            className={cn('cal-filter-chip', `cal-tone-${COMPLIANCE_STATES[estado].tone}`)}
          >
            <span className="cal-dot" aria-hidden="true" />
            {COMPLIANCE_STATES[estado].label}
            <strong>{resumen[estado]}</strong>
          </button>
        ))}
        {estados.size > 0 && (
          <button
            type="button"
            onClick={onClearEstados}
            className="ml-1 text-[13px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
          >
            Quitar filtro
          </button>
        )}
        <span className="ml-auto flex items-center gap-4">
          {report.acciones.length > 0 && (
            <button
              type="button"
              onClick={goToPlan}
              className="text-[13px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg xl:hidden"
            >
              Plan de acción ({report.acciones.length})
            </button>
          )}
          <button
            type="button"
            onClick={onToggleAll}
            className="text-[13px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
          >
            {allOpen ? 'Contraer todo' : 'Desplegar todo'}
          </button>
        </span>
      </div>

      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-fg-subtle">
        Los requisitos están resumidos con palabras propias: ante una duda, manda el texto de la norma (IBNORCA) y los
        criterios de la {norma.organismo}. «Del laboratorio» significa que la parte del software está, pero el
        cumplimiento depende de evidencia del laboratorio: informes, acuerdos o procedimientos.
      </p>
    </section>
  );
}

function FactList({ title, items, tone, icon: Icon }) {
  const Marker = Icon;
  return (
    <div className="min-w-0">
      <h4 className="mb-1.5 text-xs font-semibold text-fg">{title}</h4>
      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item} className={cn('flex gap-2 text-[13px] leading-snug text-fg-muted', `cal-tone-${tone}`)}>
            {Marker
              ? <Marker className="cal-ink mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
              : <span className="cal-dot mt-[6px]" aria-hidden="true" />}
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RequirementRow({ requisito, open, highlighted, onToggle }) {
  const meta = COMPLIANCE_STATES[requisito.estado];
  const Icon = STATE_ICONS[requisito.estado];
  const origen = ORIGEN[requisito.origen] || ORIGEN.DISENO;
  const OrigenIcon = origen.icon;
  const id = rowId(requisito.id);
  const resumen = requisito.brechas[0] || requisito.evidencias[0] || requisito.notas[0];
  const prioridad = requisito.prioridad && PRIORIDADES[requisito.prioridad];

  return (
    <li className={cn('cal-req relative', highlighted && 'cal-req-highlight')}>
      <button
        id={`${id}-boton`}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-detalle`}
        onClick={onToggle}
        className="flex w-full scroll-mt-[calc(var(--topbar-height)+16px)] items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
      >
        <Icon className={cn('cal-ink mt-px h-[18px] w-[18px] flex-none', `cal-tone-${meta.tone}`)} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs font-semibold tabular-nums text-fg-subtle">{requisito.clausula}</span>
            <span className="sr-only">{meta.label}:</span>
            <span className="text-[13.5px] font-semibold text-fg">{requisito.titulo}</span>
          </span>
          {!open && resumen && <span className="mt-0.5 block truncate text-[12.5px] text-fg-muted">{resumen}</span>}
        </span>
        <span className="flex flex-none items-center gap-2" aria-hidden="true">
          <span className="hidden sm:inline-flex"><ToneBadge tone={meta.tone}>{meta.label}</ToneBadge></span>
          <ChevronDown className={cn('h-4 w-4 text-fg-subtle transition-transform duration-200', open && 'rotate-180')} />
        </span>
      </button>

      <div id={`${id}-detalle`} hidden={!open} className="space-y-4 px-4 pb-5 sm:pl-[46px]">
        <p className="max-w-[72ch] text-[13px] leading-relaxed text-fg-muted">
          <span className="font-semibold text-fg">Qué pide: </span>{requisito.requisito}
        </p>

        {requisito.datos.length > 0 && (
          <dl className="cal-req-data">
            {requisito.datos.map(dato => (
              <div key={dato.etiqueta} className={`cal-tone-${dato.tono || 'neutral'}`}>
                <dt>{dato.etiqueta}</dt>
                <dd>{dato.tono && dato.tono !== 'neutral' && <span className="cal-dot" aria-hidden="true" />}{dato.valor}</dd>
              </div>
            ))}
          </dl>
        )}

        {(requisito.evidencias.length > 0 || requisito.brechas.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {requisito.evidencias.length > 0 && (
              <FactList title="Cómo lo cumple el módulo" items={requisito.evidencias} tone="success" icon={Check} />
            )}
            {requisito.brechas.length > 0 && (
              <FactList title="Qué falta" items={requisito.brechas} tone={requisito.estado === 'NO_CUMPLE' ? 'danger' : 'warning'} />
            )}
          </div>
        )}

        {requisito.notas.length > 0 && (
          <FactList title="A tener en cuenta" items={requisito.notas} tone="muted" icon={Info} />
        )}

        {requisito.accion && (
          <div className="rounded-xl bg-surface-2 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-fg">Acción recomendada</span>
              {prioridad && <ToneBadge tone={prioridad.tone}>{prioridad.label}</ToneBadge>}
            </div>
            <p className="mt-1 max-w-[72ch] text-[13px] leading-relaxed text-fg">{requisito.accion}</p>
          </div>
        )}

        <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <OrigenIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {origen.label}
        </p>
      </div>
    </li>
  );
}

function ClauseSection({ clausula, todos, openIds, highlightId, onToggle }) {
  return (
    <section aria-labelledby={`cal-clausula-${clausula.id}`} className="card overflow-hidden shadow-card">
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line px-4 py-3.5">
        <div className="min-w-0 flex-1 basis-72">
          <h2 id={`cal-clausula-${clausula.id}`} className="flex items-baseline gap-2.5 text-[15px] font-semibold text-fg">
            <span className="tabular-nums text-fg-subtle">{clausula.id}</span>
            {clausula.titulo}
          </h2>
          <p className="mt-0.5 max-w-[72ch] text-[13px] leading-snug text-fg-muted">{clausula.descripcion}</p>
        </div>
        <div className="flex items-center gap-2.5 pt-1">
          <span className="cal-req-dots" aria-hidden="true">
            {todos.requisitos.map(requisito => (
              <span key={requisito.id} className={`cal-tone-${COMPLIANCE_STATES[requisito.estado].tone}`} />
            ))}
          </span>
          <span className="text-xs tabular-nums text-fg-muted">
            {todos.resumen.CUMPLE} de {todos.resumen.total} {todos.resumen.CUMPLE === 1 ? 'cumple' : 'cumplen'}
          </span>
        </div>
      </header>
      <ul className="divide-y divide-line">
        {clausula.requisitos.map(requisito => (
          <RequirementRow
            key={requisito.id}
            requisito={requisito}
            open={openIds.has(requisito.id)}
            highlighted={highlightId === requisito.id}
            onToggle={() => onToggle(requisito.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function ActionPlan({ acciones, onSelect }) {
  const groups = groupActions(acciones);
  return (
    <aside
      id="cal-plan"
      aria-labelledby="cal-plan-title"
      className="card scroll-mt-[calc(var(--topbar-height)+16px)] shadow-card xl:sticky xl:top-[calc(var(--topbar-height)+16px)] xl:max-h-[calc(100dvh-var(--topbar-height)-32px)] xl:overflow-y-auto"
    >
      <div className="rounded-t-2xl border-b border-line bg-surface px-4 py-3.5 xl:sticky xl:top-0 xl:z-10">
        <h2 id="cal-plan-title" className="flex items-center gap-2 text-sm font-semibold text-fg">
          <ListTodo className="h-[18px] w-[18px] text-fg-muted" aria-hidden="true" />
          Plan de acción
          <span className="cal-count">{acciones.length}</span>
        </h2>
        <p className="mt-0.5 text-[12.5px] leading-snug text-fg-muted">Lo que falta para cumplir, de mayor a menor prioridad.</p>
      </div>
      {groups.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-4 text-[13px] text-fg-muted">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> No quedan acciones pendientes.
        </p>
      ) : groups.map(group => (
        <section key={group.prioridad} aria-label={PRIORIDADES[group.prioridad].label} className="pb-1.5">
          <h3 className={cn('flex items-center gap-2 px-4 pb-1 pt-3.5 text-xs font-semibold text-fg', `cal-tone-${PRIORIDADES[group.prioridad].tone}`)}>
            <span className="cal-dot" aria-hidden="true" />
            {PRIORIDADES[group.prioridad].label}
            <span className="font-normal text-fg-muted">{group.items.length}</span>
          </h3>
          <ul>
            {group.items.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="block w-full px-4 py-2 text-left transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="flex-none text-xs font-semibold tabular-nums text-fg-subtle">{item.clausula}</span>
                    <span className="text-[13px] font-medium text-fg">{item.titulo}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-fg-muted">{item.accion}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}

function ComplianceSkeleton() {
  return (
    <div className="grid animate-pulse items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]" role="status" aria-label="Evaluando el cumplimiento">
      <div className="flex flex-col gap-4">
        <div className="card h-[208px] p-5 shadow-card">
          <div className="h-3.5 w-72 max-w-full rounded-full bg-fg/[0.08]" />
          <div className="mt-8 h-3 w-4/5 rounded-full bg-fg/[0.07]" />
          <div className="mt-4 h-2 w-full rounded-full bg-fg/[0.06]" />
        </div>
        {[0, 1].map(index => (
          <div key={index} className="card shadow-card">
            <div className="h-[68px] border-b border-line" />
            {[0, 1, 2].map(row => (
              <div key={row} className="flex h-[66px] items-center gap-3 border-b border-line px-4 last:border-0">
                <div className="h-[18px] w-[18px] rounded-full bg-fg/[0.07]" />
                <div className="h-3 w-56 rounded-full bg-fg/[0.07]" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="card hidden h-[420px] shadow-card xl:block" />
    </div>
  );
}

/**
 * Pestaña Cumplimiento: evalúa el módulo frente a la NB/ISO/IEC 17025:2018
 * (7.5, 7.11 y 8.4) con los datos del momento y propone un plan de acción.
 */
export function CompliancePanel() {
  const { data: report, error, loading, reload } = useCompliance();
  const [estados, setEstados] = useState(() => new Set());
  const [openIds, setOpenIds] = useState(() => new Set());
  const [focus, setFocus] = useState(null);

  const clausulas = useMemo(() => (report ? filterClausulas(report.clausulas, estados) : []), [report, estados]);
  const allIds = useMemo(() => clausulas.flatMap(clausula => clausula.requisitos.map(requisito => requisito.id)), [clausulas]);
  const allOpen = allIds.length > 0 && allIds.every(id => openIds.has(id));

  // Al elegir una acción del plan: abrir el requisito, llevarlo a la vista y
  // marcarlo un momento.
  useEffect(() => {
    if (!focus) return undefined;
    const button = document.getElementById(`${rowId(focus)}-boton`);
    button?.scrollIntoView({ block: 'start' });
    button?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => setFocus(null), 1800);
    return () => window.clearTimeout(timer);
  }, [focus]);

  const toggle = (id) => setOpenIds(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const toggleEstado = (estado) => setEstados(current => {
    const next = new Set(current);
    if (next.has(estado)) next.delete(estado);
    else next.add(estado);
    return next;
  });

  const selectAction = (id) => {
    const requisito = report.clausulas.flatMap(clausula => clausula.requisitos).find(item => item.id === id);
    if (requisito && estados.size > 0 && !estados.has(requisito.estado)) setEstados(new Set());
    setOpenIds(current => new Set(current).add(id));
    setFocus(id);
  };

  if (!report && error) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
        <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[13px] text-fg">
          <span className="font-semibold">No se pudo evaluar el cumplimiento.</span>{' '}
          <span className="text-fg-muted">{error.message}</span>
        </p>
        <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
      </div>
    );
  }
  if (!report) return <ComplianceSkeleton />;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Summary
          report={report}
          loading={loading}
          onReload={reload}
          estados={estados}
          onToggleEstado={toggleEstado}
          onClearEstados={() => setEstados(new Set())}
          allOpen={allOpen}
          onToggleAll={() => setOpenIds(allOpen ? new Set() : new Set(allIds))}
        />
        {error && (
          <p className="flex items-center gap-2 px-1 text-[13px] text-danger" role="alert">
            <AlertCircle className="h-4 w-4 flex-none" aria-hidden="true" />
            No se pudo volver a evaluar: {error.message}
          </p>
        )}
        {clausulas.map(clausula => (
          <ClauseSection
            key={clausula.id}
            clausula={clausula}
            todos={report.clausulas.find(item => item.id === clausula.id)}
            openIds={openIds}
            highlightId={focus}
            onToggle={toggle}
          />
        ))}
      </div>
      <ActionPlan acciones={report.acciones} onSelect={selectAction} />
    </div>
  );
}
