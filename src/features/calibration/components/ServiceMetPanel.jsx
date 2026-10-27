import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Plus, Search, Smartphone } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import { relativeTime } from '../../system/domain/system';
import { useResource } from '../../system/hooks/useResource';
import { calibrationApi } from '../api/calibration';
import {
  CLASES_VERSION,
  TELEFONO_SITUACION,
  VERSION_FILTERS,
  currentVersion,
  versionGroup,
  versionSituation,
  versionSteps,
} from '../domain/servicemet';
import { formatDate } from '../domain/format';
import { ToneBadge } from './primitives';
import { ServiceMetFormModal } from './ServiceMetFormModal';
import { ServiceMetVersionModal } from './ServiceMetVersionModal';
import '../../system/system.css';

const matches = (query, version) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [version.version, version.commit, version.resumen, version.impacto, ...version.nuevo, ...version.corregido]
    .some(value => String(value || '').toLowerCase().includes(needle));
};

/** Cuatro tramos: registrada, validada, aprobada, en uso. */
function StepTrack({ version }) {
  const steps = versionSteps(version);
  return (
    <span className="sys-track" role="img" aria-label={steps.map(step => `${step.label}: ${step.done ? 'sí' : step.failed ? 'no' : 'pendiente'}`).join(', ')}>
      {steps.map(step => (
        <span key={step.id} data-state={step.done ? 'done' : step.failed ? 'failed' : 'pending'} />
      ))}
    </span>
  );
}

/** Qué espera la versión más reciente y de quién, dicho para quien mira. */
function pendingMessage(version, permisos) {
  if (version.estado === 'VALIDADA') {
    return permisos.aprobar
      ? { text: `La versión ${version.version} está validada y espera tu aprobación.`, action: 'Revisar y aprobar' }
      : { text: `La versión ${version.version} está validada y espera la aprobación del jefe de Calibración.`, action: 'Ver la versión' };
  }
  if (version.validacionResultado === 'NO_CONFORME') {
    return { text: `La validación de la versión ${version.version} no fue conforme: no se puede aprobar ni distribuir.`, action: 'Ver la versión' };
  }
  return permisos.registrar
    ? { text: `La versión ${version.version} espera su validación antes de pasar al jefe de Calibración.`, action: 'Registrar validación' }
    : { text: `La versión ${version.version} aún no se valida; después la aprueba el jefe de Calibración.`, action: 'Ver la versión' };
}

function Summary({ versiones, permisos, onOpen, onCreate }) {
  const vigente = currentVersion(versiones);
  const ultima = versiones[0] || null;
  const pendiente = ultima && ['REGISTRADA', 'VALIDADA'].includes(ultima.estado) ? pendingMessage(ultima, permisos) : null;
  return (
    <section aria-labelledby="smet-vigente" className="card p-5 shadow-card">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface-2 text-fg">
          <Smartphone className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="smet-vigente" className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-fg">
            {vigente ? `ServiceMET ${vigente.version} en uso` : 'Ninguna versión aprobada en uso'}
            <ToneBadge tone={vigente ? 'success' : 'warning'}>{vigente ? 'Aprobada' : 'Pendiente'}</ToneBadge>
          </h2>
          <p className="mt-0.5 max-w-[72ch] text-[13px] leading-relaxed text-fg-muted">
            {vigente
              ? `Aprobada por ${vigente.decididoNombre || vigente.decididoPor} y en uso desde el ${formatDate(vigente.enUsoDesde)}.`
              : 'Ninguna versión tiene aún la aprobación del jefe de Calibración y su puesta en uso registrada.'}
          </p>
        </div>
        {permisos.registrar && (
          <Button onClick={onCreate} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" /> Registrar versión
          </Button>
        )}
      </div>
      {pendiente && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warning/35 bg-warning/[0.06] px-3.5 py-3">
          <AlertCircle className="h-4 w-4 flex-none text-warning" aria-hidden="true" />
          <p className="min-w-0 flex-1 basis-60 text-[13px] leading-relaxed text-fg">{pendiente.text}</p>
          <Button size="sm" variant="secondary" onClick={() => onOpen(ultima)}>
            {pendiente.action} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}
      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-fg-subtle">
        NB/ISO/IEC 17025 · 7.11.2: cada versión de ServiceMET se valida y la aprueba el jefe de Calibración antes de usarse en los servicios.
        Registra y valida Sistemas; aprueba o rechaza solo el jefe de área de Calibración.
      </p>
    </section>
  );
}

function Phones({ telefonos, onOpenVersion }) {
  const fueraDeControl = telefonos.items.filter(telefono => telefono.situacion !== 'APROBADA').length;
  return (
    <section aria-labelledby="smet-telefonos" className="card overflow-hidden shadow-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <h2 id="smet-telefonos" className="text-[14px] font-semibold text-fg">Teléfonos con ServiceMET</h2>
        {telefonos.items.length > 0 && (
          <ToneBadge tone={fueraDeControl ? 'danger' : 'success'}>
            {fueraDeControl ? `${fueraDeControl} con versión sin aprobar` : 'Todos con versión aprobada'}
          </ToneBadge>
        )}
        <p className="w-full text-xs text-fg-muted">
          Última versión que informó cada teléfono en los últimos {telefonos.dias} días, según los RIM y talonarios que envía.
        </p>
      </header>
      {telefonos.items.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-fg-muted">Ningún teléfono envió RIM ni pidió talonarios en ese tiempo.</p>
      ) : (
        <ul className="divide-y divide-line">
          {telefonos.items.map(telefono => {
            const situacion = TELEFONO_SITUACION[telefono.situacion];
            return (
              <li key={telefono.instalacion} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                <span className="min-w-0 flex-1 basis-56">
                  <span className="block truncate text-[13.5px] font-semibold text-fg">{telefono.tecnico || 'Sin nombre'}</span>
                  <span className="block truncate text-[12.5px] text-fg-muted">
                    {[telefono.dispositivo, `último reporte ${relativeTime(telefono.ultimoReporte)}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex flex-none items-center gap-3">
                  {telefono.versionId ? (
                    <button
                      type="button"
                      onClick={() => onOpenVersion(telefono.versionId)}
                      className="font-mono text-[13px] font-medium text-fg underline decoration-fg/25 underline-offset-4 hover:decoration-fg"
                    >
                      {telefono.version}
                    </button>
                  ) : (
                    <span className="font-mono text-[13px] font-medium text-fg">{telefono.version}</span>
                  )}
                  <span className="w-[108px] text-right"><ToneBadge tone={situacion.tone}>{situacion.label}</ToneBadge></span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function VersionRow({ version, onOpen }) {
  const situation = versionSituation(version);
  const clase = CLASES_VERSION[version.clase];
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(version)}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
      >
        <span className="min-w-0 flex-1 basis-72">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-[13.5px] font-semibold text-fg">{version.version}</span>
            <span className="text-[12.5px] text-fg-muted">
              {[`Clase ${version.clase} · ${clase.label}`, formatDate(version.fecha), version.aPosteriori && !version.decididoPor && 'registrada a posteriori']
                .filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-fg">{version.resumen}</span>
        </span>
        <span className="flex flex-none items-center gap-3">
          <StepTrack version={version} />
          <span className="w-[150px] text-right"><ToneBadge tone={situation.tone}>{situation.label}</ToneBadge></span>
        </span>
      </button>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="card animate-pulse shadow-card" role="status" aria-label="Cargando las versiones">
      <div className="h-[52px] border-b border-line" />
      {[0, 1, 2, 3].map(index => (
        <div key={index} className="flex h-[74px] items-center gap-3 border-b border-line px-4 last:border-0">
          <div className="h-3 w-16 rounded-full bg-fg/[0.07]" />
          <div className="h-3 w-64 rounded-full bg-fg/[0.07]" />
        </div>
      ))}
    </div>
  );
}

/**
 * Versiones de ServiceMET (NB/ISO/IEC 17025, 7.11.2): qué cambió en cada
 * versión de la app de los técnicos, su validación, la aprobación del jefe de
 * Calibración y qué versión usa cada teléfono.
 */
export function ServiceMetPanel() {
  const { data, error, reload } = useResource(calibrationApi.servicemet);
  const [filtro, setFiltro] = useState(null);
  const [query, setQuery] = useState('');
  const [ficha, setFicha] = useState(null);

  const versiones = useMemo(() => data?.versiones || [], [data]);
  const counts = useMemo(() => {
    const result = { PENDIENTE: 0, APROBADA: 0, RECHAZADA: 0 };
    for (const version of versiones) result[versionGroup(version)] += 1;
    return result;
  }, [versiones]);
  const visibles = versiones.filter(version => (!filtro || versionGroup(version) === filtro) && matches(query, version));
  const openVersion = (version) => setFicha({ type: 'detalle', id: version.id });

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      {error && !data && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            <span className="font-semibold">No se pudieron cargar las versiones de ServiceMET.</span>{' '}
            <span className="text-fg-muted">{error.message}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {!data && !error && <ListSkeleton />}

      {data && (
        <>
          <Summary versiones={versiones} permisos={data.permisos} onOpen={openVersion} onCreate={() => setFicha({ type: 'nuevo' })} />

          {data.telefonos.disponible && (
            <Phones telefonos={data.telefonos} onOpenVersion={(id) => setFicha({ type: 'detalle', id })} />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-fg shadow-xs transition-colors focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/15 sm:max-w-[280px]">
              <Search className="h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar versión, cambio, commit…"
                aria-label="Buscar versiones"
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
              />
            </label>
            <div role="group" aria-label="Filtrar por situación" className="flex flex-wrap gap-1.5">
              {VERSION_FILTERS.map(option => (
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
            <p className="ml-auto hidden text-xs text-fg-muted md:block">
              {versiones.length} {versiones.length === 1 ? 'versión registrada' : 'versiones registradas'}
            </p>
          </div>

          {visibles.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-[13px] text-fg-muted">
              {versiones.length === 0
                ? 'Aún no hay versiones registradas. Sistemas registra cada versión al liberarla.'
                : 'Ninguna versión coincide con la búsqueda o el filtro.'}
            </p>
          ) : (
            <section aria-label="Versiones de ServiceMET" className="card overflow-hidden shadow-card">
              <ul className="stagger-in divide-y divide-line">
                {visibles.map(version => <VersionRow key={version.id} version={version} onOpen={openVersion} />)}
              </ul>
            </section>
          )}

          {!data.telefonos.disponible && (
            <p className="px-1 text-xs leading-relaxed text-fg-subtle">
              {data.telefonos.error
                ? 'No se pudo consultar qué versión usa cada teléfono.'
                : 'Esta base no tiene los RIM ni los talonarios de ServiceMET: no se puede mostrar qué versión usa cada teléfono.'}
            </p>
          )}
        </>
      )}

      {ficha?.type === 'nuevo' && <ServiceMetFormModal onClose={() => setFicha(null)} onSaved={reload} />}
      {ficha?.type === 'detalle' && (
        <ServiceMetVersionModal versionId={ficha.id} onClose={() => setFicha(null)} onChanged={reload} />
      )}
    </div>
  );
}
