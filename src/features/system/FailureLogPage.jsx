import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Cpu, Plus, Server, ServerCrash, Timer, UserRound } from 'lucide-react';
import { Button } from '../../shared/components/ui/Button';
import { cn } from '../../shared/utils/cn';
import { ToneBadge } from '../calibration/components/primitives';
import { systemApi } from './api/system';
import { FailureModal, NewFailureModal } from './components/FailureModal';
import { ESTADOS_FALLA, FAILURE_FILTERS, ORIGENES_FALLA, failureGroup, relativeTime } from './domain/system';
import { useResource } from './hooks/useResource';
import '../calibration/calibration.css';
import './system.css';

const ORIGEN_ICONS = { SERVIDOR: Server, TAREA: Timer, PROCESO: Cpu, MANUAL: UserRound };

function FailureSummary({ fallas, onCreate }) {
  const abiertas = fallas.filter(falla => falla.estado === 'ABIERTA').length;
  const enCurso = fallas.filter(falla => falla.estado === 'EN_CURSO').length;
  const pendientes = abiertas + enCurso;
  const Icon = pendientes > 0 ? ServerCrash : CheckCircle2;
  return (
    <section aria-labelledby="sys-fallas-title" className="card p-5 shadow-card">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span className={cn('flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface-2', pendientes > 0 ? 'text-danger' : 'text-success')}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="sys-fallas-title" className="text-[15px] font-semibold text-fg">
            {pendientes === 0
              ? 'Sin fallas pendientes'
              : [abiertas > 0 && `${abiertas} ${abiertas === 1 ? 'falla abierta' : 'fallas abiertas'}`, enCurso > 0 && `${enCurso} en curso`].filter(Boolean).join(' · ')}
          </h2>
          <p className="mt-0.5 max-w-[72ch] text-[13px] leading-relaxed text-fg-muted">
            Los errores del servidor y de las tareas programadas se registran solos. Registra aquí lo que la aplicación no puede ver: cortes, red o base de datos caídos.
          </p>
        </div>
        <Button onClick={onCreate} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" aria-hidden="true" /> Registrar falla
        </Button>
      </div>
      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-fg-subtle">
        NB/ISO/IEC 17025 · 7.11.3 e: se registran las fallas del sistema y sus acciones inmediatas y correctivas.
      </p>
    </section>
  );
}

function FailureRow({ falla, onOpen }) {
  const Icon = ORIGEN_ICONS[falla.origen] || Server;
  const estado = ESTADOS_FALLA[falla.estado];
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(falla)}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
      >
        <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-surface-2 text-fg-muted" title={ORIGENES_FALLA[falla.origen]}>
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{ORIGENES_FALLA[falla.origen]}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs font-semibold tabular-nums text-fg-subtle">F-{falla.id}</span>
            <span className="min-w-0 break-words text-[13.5px] font-semibold text-fg">{falla.mensaje}</span>
          </span>
          <span className="mt-0.5 block truncate text-[12.5px] text-fg-muted">
            {[
              falla.ruta || ORIGENES_FALLA[falla.origen],
              falla.ocurrencias > 1 && `${falla.ocurrencias} veces`,
              falla.usuario,
              relativeTime(falla.ultimaVez),
            ].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="flex-none"><ToneBadge tone={estado.tone}>{estado.label}</ToneBadge></span>
      </button>
    </li>
  );
}

/**
 * Registro de fallas del sistema (NB/ISO/IEC 17025, 7.11.3 e): lo que falló,
 * cuántas veces, y su acción inmediata y correctiva.
 */
export function FailureLogPage() {
  const { data: fallas, error, reload } = useResource(systemApi.fallas);
  // La ficha de una falla puede ligarla al cambio que la corrigió.
  const { data: cambios } = useResource(systemApi.cambios);
  const [filtro, setFiltro] = useState('ABIERTAS');
  const [ficha, setFicha] = useState(null);

  const counts = useMemo(() => {
    const result = { ABIERTAS: 0, CERRADA: 0, DESCARTADA: 0 };
    for (const falla of fallas || []) result[failureGroup(falla)] += 1;
    return result;
  }, [fallas]);

  const visibles = useMemo(
    () => (fallas || []).filter(falla => !filtro || failureGroup(falla) === filtro),
    [fallas, filtro]
  );

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-3 py-3 sm:px-5 sm:py-5 xl:px-6">
      {error && !fallas && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            <span className="font-semibold">No se pudo cargar el registro de fallas.</span>{' '}
            <span className="text-fg-muted">{error.message}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {fallas && <FailureSummary fallas={fallas} onCreate={() => setFicha({ type: 'nueva' })} />}

      {fallas && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por estado">
          {FAILURE_FILTERS.map(option => (
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
          {filtro && (
            <button
              type="button"
              onClick={() => setFiltro(null)}
              className="ml-1 text-[13px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
            >
              Ver todas
            </button>
          )}
          <p className="ml-auto hidden text-xs text-fg-muted md:block">{fallas.length} fallas registradas</p>
        </div>
      )}

      {!fallas && !error && (
        <div className="card animate-pulse shadow-card" role="status" aria-label="Cargando fallas">
          {[0, 1, 2].map(index => (
            <div key={index} className="flex h-[66px] items-center gap-3 border-b border-line px-4 last:border-0">
              <div className="h-8 w-8 rounded-lg bg-fg/[0.07]" />
              <div className="h-3 w-64 rounded-full bg-fg/[0.07]" />
            </div>
          ))}
        </div>
      )}

      {fallas && visibles.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-[13px] text-fg-muted">
          {filtro === 'ABIERTAS' ? 'No hay fallas abiertas.' : 'No hay fallas con este estado.'}
        </p>
      )}

      {visibles.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden shadow-card">
          {visibles.map(falla => (
            <FailureRow key={falla.id} falla={falla} onOpen={(item) => setFicha({ type: 'detalle', id: item.id })} />
          ))}
        </ul>
      )}

      {ficha?.type === 'nueva' && <NewFailureModal onClose={() => setFicha(null)} onSaved={reload} />}
      {ficha?.type === 'detalle' && (
        <FailureModal fallaId={ficha.id} cambios={cambios} onClose={() => setFicha(null)} onSaved={reload} />
      )}
    </main>
  );
}
