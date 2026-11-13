import { useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, History, KeyRound, Plus, Search, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { Button } from '../../shared/components/ui/Button';
import { cn } from '../../shared/utils/cn';
import { usePestanaRuta } from '../../shared/navigation/ruta';
import { Dropdown } from '../calibration/components/Dropdown';
import { Segmented, ToneBadge } from '../calibration/components/primitives';
import { systemApi } from './api/system';
import { ConcederPermisoModal } from './components/ConcederPermisoModal';
import { PermisosHistorial } from './components/PermisosHistorial';
import { PersonaPermisosModal } from './components/PersonaPermisosModal';
import { RevocarPermisoModal } from './components/RevocarPermisoModal';
import { fechaHora, filtrarPersonal, iniciales, nivelDe } from './domain/permisos';
import { useResource } from './hooks/useResource';
import '../calibration/calibration.css';
import './system.css';

const PESTANAS = ['personal', 'permisos', 'historial'];

function Resumen({ gestion, onConceder }) {
  return (
    <section aria-labelledby="perm-titulo" className="card p-5 shadow-card">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface-2 text-fg">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 basis-72">
          <h2 id="perm-titulo" className="text-[15px] font-semibold text-fg">Gestión de permisos</h2>
          <p className="mt-0.5 max-w-[78ch] text-[13px] leading-relaxed text-fg-muted">
            Lo que cada persona puede ver o hacer además de lo de su área. Un permiso se concede a una persona o a un grupo
            (un área, un cargo o un cargo de un área) y rige en la siguiente petición, sin cerrar la sesión.
          </p>
        </div>
        <Button onClick={onConceder} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" aria-hidden="true" /> Conceder permiso
        </Button>
      </div>
      <dl className="mt-4 grid gap-3 border-t border-line pt-3 text-[12.5px] sm:grid-cols-3">
        <div>
          <dt className="text-xs text-fg-subtle">Gestionan los permisos</dt>
          <dd className="mt-0.5 text-fg">{gestion.gestores.join(' y ')}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">Sistemas (nivel 3)</dt>
          <dd className="mt-0.5 text-fg">Tiene todos los permisos; no se le quitan.</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">NB/ISO/IEC 17025 · 7.11.3 a y 8.4</dt>
          <dd className="mt-0.5 text-fg">Cada cambio queda en el historial con quién, cuándo, qué y quiénes lo tenían antes y después. Nada se borra.</dd>
        </div>
      </dl>
    </section>
  );
}

function ChipsPermisos({ persona, catalogo }) {
  if (persona.sistemas) return <ToneBadge tone="info">Todos · Sistemas</ToneBadge>;
  if (persona.permisos.length === 0) return <span className="text-[12.5px] text-fg-subtle">Sin permisos especiales</span>;
  return persona.permisos.map(permiso => (
    <ToneBadge key={permiso.clave} tone="success">{catalogo.find(item => item.clave === permiso.clave)?.corto || permiso.clave}</ToneBadge>
  ));
}

function Personal({ gestion, onAbrir }) {
  const [texto, setTexto] = useState('');
  const [area, setArea] = useState('');
  const [permiso, setPermiso] = useState(null);
  const visibles = useMemo(
    () => filtrarPersonal(gestion.personal, { texto, area: area || null, permiso }),
    [area, gestion.personal, permiso, texto],
  );
  const cuantos = clave => gestion.personal.filter(persona => persona.permisos.some(item => item.clave === clave)).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 basis-56 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-fg shadow-xs transition-colors focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/15 sm:max-w-[300px]">
          <Search className="h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
          <input
            type="search"
            value={texto}
            onChange={event => setTexto(event.target.value)}
            placeholder="Buscar nombre, usuario, área o cargo…"
            aria-label="Buscar personal"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
          />
        </label>
        <div className="w-full sm:w-[220px]">
          <Dropdown
            size="sm"
            value={area}
            onChange={setArea}
            ariaLabel="Filtrar por área"
            options={[{ value: '', label: 'Todas las áreas' }, ...gestion.areas.map(item => ({ value: item.clave, label: item.nombre, hint: `${item.personas}` }))]}
          />
        </div>
        <div role="group" aria-label="Filtrar por permiso" className="flex flex-wrap gap-1.5">
          {gestion.catalogo.map(item => (
            <button
              key={item.clave}
              type="button"
              aria-pressed={permiso === item.clave}
              onClick={() => setPermiso(actual => (actual === item.clave ? null : item.clave))}
              className="cal-filter-chip cal-tone-success"
            >
              <span className="cal-dot" aria-hidden="true" />
              {item.corto}
              <strong>{cuantos(item.clave)}</strong>
            </button>
          ))}
        </div>
        <p className="ml-auto hidden text-xs text-fg-muted lg:block">{visibles.length} de {gestion.personal.length} personas</p>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-[13px] text-fg-muted">
          Nadie coincide con la búsqueda o los filtros.
        </p>
      ) : (
        <div className="card overflow-hidden shadow-card">
          <div className="perm-fila perm-cabecera hidden border-b border-line px-4 py-2.5 text-[11.5px] font-medium uppercase tracking-[0.04em] text-fg-subtle md:grid" aria-hidden="true">
            <span>Persona</span><span>Área y cargo</span><span>Permisos</span><span />
          </div>
          <ul className="stagger-in divide-y divide-line" aria-label="Personal">
            {visibles.map(persona => (
              <li key={persona.id}>
                <button
                  type="button"
                  onClick={() => onAbrir(persona.id)}
                  aria-label={`Permisos de ${persona.nombre}`}
                  className="perm-fila grid w-full px-4 py-3 text-left transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-2 text-[11.5px] font-semibold text-fg-muted" aria-hidden="true">
                      {iniciales(persona.nombre)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-fg">{persona.nombre}</span>
                      <span className="block truncate text-xs text-fg-muted">{persona.usuario} · {nivelDe(persona.nivel)}</span>
                    </span>
                  </span>
                  <span className="min-w-0 text-[12.5px] leading-snug">
                    <span className="block truncate text-fg">{persona.area || 'Sin área'}</span>
                    <span className="block truncate text-fg-muted">{persona.cargo || 'Sin cargo'}</span>
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <ChipsPermisos persona={persona} catalogo={gestion.catalogo} />
                  </span>
                  <ChevronRight className="hidden h-4 w-4 text-fg-subtle md:block" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Catalogo({ gestion, onConceder, onRevocar }) {
  return gestion.catalogo.map((permiso) => {
    const concesiones = gestion.concesiones.filter(concesion => concesion.permiso === permiso.clave);
    const tienen = gestion.personal.filter(persona => persona.permisos.some(item => item.clave === permiso.clave)).length;
    return (
      <section key={permiso.clave} aria-labelledby={`perm-${permiso.clave}`} className="card overflow-hidden shadow-card">
        <header className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1 basis-72">
            <h3 id={`perm-${permiso.clave}`} className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-fg">
              {permiso.nombre}
              <ToneBadge>{permiso.modulo}</ToneBadge>
            </h3>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">{permiso.descripcion}</p>
            <p className="mt-1 text-xs text-fg-subtle">
              <code className="rounded bg-fg/[0.05] px-1.5 py-0.5 font-mono text-[11px]">{permiso.clave}</code>
              {' · '}Lo tienen {tienen === 1 ? '1 persona' : `${tienen} personas`}, Sistemas incluido.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => onConceder(permiso.clave)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Conceder
          </Button>
        </header>
        {concesiones.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-fg-muted sm:px-5">Solo lo tiene Sistemas (nivel 3).</p>
        ) : (
          <ul className="divide-y divide-line" aria-label={`Concesiones de ${permiso.nombre}`}>
            {concesiones.map(concesion => (
              <li key={concesion.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-surface-2 text-fg-muted" aria-hidden="true">
                  {concesion.tipo === 'PERSONA' ? <UserRound className="h-4 w-4" /> : <UsersRound className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1 basis-64">
                  <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-fg">
                    {concesion.sujeto}
                    <span className="text-xs font-normal text-fg-muted">
                      {concesion.tipo === 'PERSONA' ? 'Persona' : `Grupo · hoy ${concesion.alcance === 1 ? '1 persona' : `${concesion.alcance} personas`}`}
                    </span>
                  </p>
                  {concesion.motivo && <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">{concesion.motivo}</p>}
                  <p className="mt-0.5 text-xs text-fg-subtle">Concedido por {concesion.concedidoPor} · {fechaHora(concesion.concedidoEn)}</p>
                </div>
                <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => onRevocar(concesion)}>
                  Revocar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  });
}

/**
 * Sistema › Gestión de permisos: qué puede ver o hacer cada persona sin tocar
 * el código. La abren y modifican solo Sistemas y el jefe de Sistemas; el
 * backend lo comprueba en cada petición.
 *
 * Direcciones: /sistema/permisos/<personal|permisos|historial>.
 */
export function PermisosPage() {
  const { pestana, cambiarPestana } = usePestanaRuta('permisos', PESTANAS, { clave: 'datamet_permisos_pestana', predeterminada: 'personal' });
  const { data: gestion, error, reload } = useResource(systemApi.permisos);
  // Ficha abierta: persona, conceder o revocar (pueden apilarse sobre la de la persona).
  const [persona, setPersona] = useState(null);
  const [encima, setEncima] = useState(null);
  const [vuelta, setVuelta] = useState(0);

  const alGuardar = () => {
    reload();
    setVuelta(valor => valor + 1);
  };

  const opciones = gestion ? [
    { value: 'personal', label: 'Por persona', count: gestion.personal.length, icon: <UserRound className="h-4 w-4" aria-hidden="true" /> },
    { value: 'permisos', label: 'Por permiso', count: gestion.concesiones.length, icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" /> },
    { value: 'historial', label: 'Historial', icon: <History className="h-4 w-4" aria-hidden="true" /> },
  ] : [];

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-3 py-3 sm:px-5 sm:py-5 xl:px-6">
      {error && !gestion && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            <span className="font-semibold">No se pudo cargar la gestión de permisos.</span>{' '}
            <span className="text-fg-muted">{error.message}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {!gestion && !error && <div className="card h-40 animate-pulse shadow-card" role="status" aria-label="Cargando permisos" />}

      {gestion && (
        <>
          <Resumen gestion={gestion} onConceder={() => setEncima({ tipo: 'conceder' })} />
          <Segmented value={pestana} onChange={cambiarPestana} options={opciones} label="Vista" className={cn('self-start')} />
          <div className="vt-panel flex flex-col gap-4">
            {pestana === 'personal' && <Personal gestion={gestion} onAbrir={setPersona} />}
            {pestana === 'permisos' && (
              <Catalogo
                gestion={gestion}
                onConceder={clave => setEncima({ tipo: 'conceder', permiso: clave })}
                onRevocar={concesion => setEncima({ tipo: 'revocar', concesion })}
              />
            )}
            {pestana === 'historial' && <PermisosHistorial key={vuelta} />}
          </div>
        </>
      )}

      {gestion && persona !== null && (
        <PersonaPermisosModal
          gestion={gestion}
          personaId={persona}
          onClose={() => setPersona(null)}
          onConceder={(clave, id) => setEncima({ tipo: 'conceder', permiso: clave, persona: id })}
          onRevocar={concesion => setEncima({ tipo: 'revocar', concesion })}
        />
      )}
      {gestion && encima?.tipo === 'conceder' && (
        <ConcederPermisoModal
          gestion={gestion}
          permisoInicial={encima.permiso || null}
          personaInicial={encima.persona ?? null}
          onClose={() => setEncima(null)}
          onSaved={alGuardar}
        />
      )}
      {gestion && encima?.tipo === 'revocar' && (
        <RevocarPermisoModal gestion={gestion} concesion={encima.concesion} onClose={() => setEncima(null)} onSaved={alGuardar} />
      )}
    </main>
  );
}
