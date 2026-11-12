import { useMemo, useState } from 'react';
import { AlertCircle, GitBranch, Plus, Search } from 'lucide-react';
import { Button } from '../../shared/components/ui/Button';
import { cn } from '../../shared/utils/cn';
import { APP_VERSION } from '../../shared/utils/appVersion';
import { ToneBadge } from '../calibration/components/primitives';
import { systemApi } from './api/system';
import { ChangeDetailModal } from './components/ChangeDetailModal';
import { ChangeFormModal } from './components/ChangeFormModal';
import {
  CHANGE_FILTERS,
  TIPOS_CAMBIO,
  changeGroup,
  changeSituation,
  changeSteps,
  groupByVersion,
  versionStatus,
} from './domain/system';
import { useResource } from './hooks/useResource';
import '../calibration/calibration.css';
import './system.css';

const dateOnly = (value) => (value
  ? new Date(`${value}T12:00:00`).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })
  : null);

const matches = (query, cambio) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [cambio.codigo, cambio.titulo, cambio.modulos, cambio.descripcion, cambio.referencias, cambio.version]
    .some(value => String(value || '').toLowerCase().includes(needle));
};

/** Cuatro tramos: registrado, validado, aprobado, implementado. */
function StepTrack({ cambio }) {
  const steps = changeSteps(cambio);
  return (
    <span className="sys-track" role="img" aria-label={steps.map(step => `${step.label}: ${step.done ? 'sí' : step.failed ? 'no' : 'pendiente'}`).join(', ')}>
      {steps.map(step => (
        <span key={step.id} data-state={step.done ? 'done' : step.failed ? 'failed' : 'pending'} />
      ))}
    </span>
  );
}

/** onCreate solo para Sistemas: el jefe de Calibración entra a aprobar, no registra. */
function VersionSummary({ cambios, onCreate }) {
  const status = versionStatus(cambios, APP_VERSION);
  const aprobada = status.total > 0 && status.pendientes === 0;
  const tone = aprobada ? 'success' : 'warning';
  return (
    <section aria-labelledby="sys-version-title" className="card p-5 shadow-card">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface-2 text-fg">
          <GitBranch className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="sys-version-title" className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-fg">
            Versión {APP_VERSION} en uso
            <ToneBadge tone={tone}>{aprobada ? 'Aprobada' : 'Pendiente de aprobar'}</ToneBadge>
          </h2>
          <p className="mt-0.5 max-w-[72ch] text-[13px] leading-relaxed text-fg-muted">
            {status.total === 0
              ? 'Esta versión aún no tiene cambios registrados. Registra lo que incluye antes de ponerla en producción.'
              : aprobada
                ? `Sus ${status.total} cambios están validados y aprobados.`
                : `${status.pendientes} de sus ${status.total} cambios aún no se validan o aprueban. Hazlo antes de ponerla en producción.`}
          </p>
        </div>
        {onCreate && (
          <Button onClick={onCreate} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" /> Registrar cambio
          </Button>
        )}
      </div>
      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-fg-subtle">
        NB/ISO/IEC 17025 · 7.11.2: todo cambio del sistema, incluida su configuración, se documenta, se valida y se aprueba antes de implementarse.
        Sistemas registra, valida e implementa; el jefe de área de Calibración aprueba o rechaza.
      </p>
    </section>
  );
}

function ChangeRow({ cambio, onOpen }) {
  const situation = changeSituation(cambio);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(cambio)}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
      >
        <span className="min-w-0 flex-1 basis-72">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs font-semibold tabular-nums text-fg-subtle">{cambio.codigo}</span>
            <span className="text-[13.5px] font-semibold text-fg">{cambio.titulo}</span>
          </span>
          <span className="mt-0.5 block truncate text-[12.5px] text-fg-muted">
            {[TIPOS_CAMBIO[cambio.tipo], cambio.modulos, dateOnly(cambio.fechaCambio), cambio.aPosteriori && 'registrado a posteriori']
              .filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="flex flex-none items-center gap-3">
          <StepTrack cambio={cambio} />
          <span className="w-[136px] text-right"><ToneBadge tone={situation.tone}>{situation.label}</ToneBadge></span>
        </span>
      </button>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="card animate-pulse shadow-card" role="status" aria-label="Cargando cambios">
      <div className="h-[52px] border-b border-line" />
      {[0, 1, 2, 3].map(index => (
        <div key={index} className="flex h-[66px] items-center gap-3 border-b border-line px-4 last:border-0">
          <div className="h-3 w-16 rounded-full bg-fg/[0.07]" />
          <div className="h-3 w-64 rounded-full bg-fg/[0.07]" />
        </div>
      ))}
    </div>
  );
}

/**
 * Control de cambios del sistema (NB/ISO/IEC 17025, 7.11.2): qué cambió en
 * cada versión y en qué paso está (validación, aprobación, implementación).
 */
export function ChangeControlPage({ puedeRegistrar = false }) {
  const { data: cambios, error, reload } = useResource(systemApi.cambios);
  const [filtro, setFiltro] = useState(null);
  const [query, setQuery] = useState('');
  const [ficha, setFicha] = useState(null);

  const counts = useMemo(() => {
    const result = { PENDIENTE: 0, COMPLETO: 0, RECHAZADO: 0 };
    for (const cambio of cambios || []) result[changeGroup(cambio)] += 1;
    return result;
  }, [cambios]);

  const groups = useMemo(() => groupByVersion((cambios || []).filter(cambio => (
    (!filtro || changeGroup(cambio) === filtro) && matches(query, cambio)
  ))), [cambios, filtro, query]);

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-3 py-3 sm:px-5 sm:py-5 xl:px-6">
      {error && !cambios && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            <span className="font-semibold">No se pudo cargar el control de cambios.</span>{' '}
            <span className="text-fg-muted">{error.message}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {cambios && <VersionSummary cambios={cambios} onCreate={puedeRegistrar ? () => setFicha({ type: 'nuevo' }) : null} />}

      {cambios && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-fg shadow-xs transition-colors focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/15 sm:max-w-[280px]">
            <Search className="h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar código, título, módulo…"
              aria-label="Buscar cambios"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
            />
          </label>
          <div role="group" aria-label="Filtrar por situación" className="flex flex-wrap gap-1.5">
            {CHANGE_FILTERS.map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filtro === option.value}
                onClick={() => setFiltro(current => (current === option.value ? null : option.value))}
                disabled={!counts[option.value] && filtro !== option.value}
                className={cn('cal-filter-chip', `cal-tone-${option.tone}`)}
              >
                <span className="cal-dot" aria-hidden="true" />
                {option.label}
                <strong>{counts[option.value]}</strong>
              </button>
            ))}
          </div>
          <p className="ml-auto hidden text-xs text-fg-muted md:block">{cambios.length} cambios registrados</p>
        </div>
      )}

      {!cambios && !error && <ListSkeleton />}

      {cambios && groups.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-[13px] text-fg-muted">
          Ningún cambio coincide con la búsqueda o el filtro.
        </p>
      )}

      {groups.map(group => {
        const enUso = group.version === APP_VERSION;
        return (
          <section key={group.version || 'sin-version'} aria-labelledby={`sys-version-${group.version || 'ninguna'}`} className="card overflow-hidden shadow-card">
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3">
              <h2 id={`sys-version-${group.version || 'ninguna'}`} className="text-[14px] font-semibold text-fg">
                {group.version ? `Versión ${group.version}` : 'Sin versión'}
              </h2>
              {enUso && <ToneBadge tone="info">En uso</ToneBadge>}
              <p className="text-xs text-fg-muted">
                {group.items.length} {group.items.length === 1 ? 'cambio' : 'cambios'}
              </p>
            </header>
            <ul className="stagger-in divide-y divide-line">
              {group.items.map(cambio => (
                <ChangeRow key={cambio.id} cambio={cambio} onOpen={(item) => setFicha({ type: 'detalle', id: item.id })} />
              ))}
            </ul>
          </section>
        );
      })}

      {ficha?.type === 'nuevo' && <ChangeFormModal onClose={() => setFicha(null)} onSaved={reload} />}
      {ficha?.type === 'detalle' && (
        <ChangeDetailModal cambioId={ficha.id} onClose={() => setFicha(null)} onChanged={reload} />
      )}
    </main>
  );
}
