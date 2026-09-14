import React, { useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Building2,
  ChevronRight,
  Cloud,
  FileText,
  KeyRound,
  Layers,
  LockKeyhole,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  ClipboardCheck,
  Inbox,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useIvmetQuery } from './useIvmetQuery';
import { actionConfig } from './actions';
import { dateText, money } from './format';
import {
  Badge,
  Empty,
  ErrorBox,
  Loading,
  Pagination,
  QueryState,
  SearchInput,
  SectionTitle,
  Stat,
} from './components/Ui';
import { ActionDialog } from './components/ActionDialog';
import { OnboardingDialog } from './components/OnboardingDialog';
import { ClientWorkspace } from './components/ClientWorkspace';
import { WorkerStatus } from './components/WorkerStatus';
import { OnboardingStatusDialog } from './components/OnboardingStatusDialog';
import { IvmetAccessGate } from './components/IvmetAccessGate';
import { OperationsWorkspace } from './components/OperationsWorkspace';
import { EquipmentUpdates } from './components/EquipmentUpdates';
import { onboardingPending, syncDateTime } from './onboarding';
import './ivmet.css';

function Clients({ revision, onSelect, onOnboard, onStatus, workers }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useIvmetQuery('clients', { search, page }, revision, 10000);
  return (
    <>
      <SectionTitle
        eyebrow="DIRECTORIO OPERATIVO"
        title="Tus clientes, en un solo lugar"
        description="Abre una empresa para gestionar sus plantas, balanzas y accesos."
        action={
          <button className="iv-button primary" onClick={onOnboard}>
            <Plus size={16} /> Incorporar cliente
          </button>
        }
      />
      <WorkerStatus workers={workers} />
      <div className="iv-toolbar">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Buscar por nombre o código de cliente"
        />
        <span className="iv-subtle">
          Clientes incorporados y solicitudes en seguimiento
        </span>
      </div>
      <QueryState query={query}>
        {query.data?.items.length ? (
          <>
            <div className="iv-client-grid">
              {query.data.items.map((c) => (
                <button
                  key={c.id || c.scope_id}
                  className="iv-client-card"
                  onClick={() =>
                    !c.id || onboardingPending(c.onboarding)
                      ? onStatus(c.scope_id)
                      : onSelect(c.id)
                  }
                >
                  <div className="iv-client-card-heading">
                    <div className="iv-client-avatar">
                      <Building2 size={23} />
                    </div>
                    <Badge
                      value={
                        onboardingPending(c.onboarding)
                          ? c.onboarding.syncStatus
                          : c.activo
                            ? 'ACTIVE'
                            : 'INACTIVE'
                      }
                    />
                    <ArrowUpRight size={19} />
                  </div>
                  <span className="iv-eyebrow">CLIENTE {c.codigo}</span>
                  <h3>{c.nombre || c.razon_social || `Cliente ${c.codigo}`}</h3>
                  <p>
                    {onboardingPending(c.onboarding)
                      ? `${c.onboarding.plants.length} plantas · ${c.onboarding.equipmentCount} balanzas autorizadas`
                      : c.razon_social || 'Catálogo sincronizado desde DataMET'}
                  </p>
                  <div className="iv-client-numbers">
                    <span>
                      <strong>{c.plants}</strong>Plantas
                    </span>
                    <span>
                      <strong>{c.equipment}</strong>Balanzas
                    </span>
                    <span>
                      <strong>{c.licenses}</strong>Licencias
                    </span>
                  </div>
                  <footer>
                    <span>
                      {onboardingPending(c.onboarding) ? (
                        'Incorporación en seguimiento'
                      ) : Number(c.review) > 0 ? (
                        <>
                          <i className="iv-warn-dot" />
                          {c.review} balanzas por revisar
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} /> Catálogo validado
                        </>
                      )}
                    </span>
                    <strong>
                      {onboardingPending(c.onboarding)
                        ? 'Ver incorporación'
                        : 'Abrir cliente'}{' '}
                      <ChevronRight size={14} />
                    </strong>
                  </footer>
                </button>
              ))}
            </div>
            <Pagination
              page={page}
              total={query.data.total}
              onChange={setPage}
            />
          </>
        ) : (
          <Empty
            title="No encontramos clientes"
            text="Cambia la búsqueda o incorpora un cliente contratado desde DataMET."
            action={
              <button className="iv-button primary" onClick={onOnboard}>
                Incorporar cliente
              </button>
            }
          />
        )}
      </QueryState>
    </>
  );
}
function Plans({ query, open }) {
  return (
    <>
      <SectionTitle
        eyebrow="CATÁLOGO COMERCIAL"
        title="Planes y tarifas"
        description="Define cuentas incluidas y precios mensuales o anuales. Cada cambio de tarifa conserva su historial."
        action={
          <button
            className="iv-button primary"
            onClick={() => open('plan.save')}
          >
            <Plus size={16} /> Nuevo plan
          </button>
        }
      />
      <QueryState query={query}>
        {query.data?.length ? (
          <div className="iv-plan-grid">
            {query.data.map((p) => (
              <article className="iv-plan-card" key={p.id}>
                <header>
                  <div className="iv-object-icon">
                    <Layers size={22} />
                  </div>
                  <Badge value={p.activo ? 'ACTIVE' : 'INACTIVE'} />
                </header>
                <span className="iv-eyebrow">{p.codigo}</span>
                <h3>{p.nombre}</h3>
                <p>{p.descripcion || 'Plan comercial IvMET'}</p>
                <div className="iv-plan-seats">
                  <strong>{p.cuentas_incluidas}</strong>
                  <span>
                    cuentas incluidas
                    <small>{p.dias_gracia} días de gracia</small>
                  </span>
                </div>
                <div className="iv-prices">
                  {p.prices.length ? (
                    p.prices.map((price) => (
                      <div key={price.id}>
                        <span>
                          {price.periodicidad === 'MONTHLY'
                            ? 'Mensual'
                            : 'Anual'}
                          <small>
                            {dateText(price.vigente_desde)}
                            {price.vigente_hasta
                              ? ' — ' + dateText(price.vigente_hasta)
                              : ''}
                          </small>
                        </span>
                        <strong>{money(price.importe, price.moneda)}</strong>
                      </div>
                    ))
                  ) : (
                    <p>Agrega una tarifa para poder contratar este plan.</p>
                  )}
                </div>
                <footer>
                  <button
                    className="iv-button secondary small"
                    onClick={() => open('plan.save', { record: p })}
                  >
                    Editar plan
                  </button>
                  <button
                    className="iv-button primary small"
                    disabled={!p.activo}
                    onClick={() => open('price.create', { record: p })}
                  >
                    Añadir tarifa
                  </button>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="Diseña tu primer plan"
            text="Empieza por las cuentas incluidas. Después añade una tarifa mensual o anual."
            action={
              <button
                className="iv-button primary"
                onClick={() => open('plan.save')}
              >
                Crear plan comercial
              </button>
            }
          />
        )}
      </QueryState>
    </>
  );
}
function Integration({ revision, onOnboard, onStatus }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const query = useIvmetQuery('integration', { page, search }, revision, 10000);
  return (
    <>
      <SectionTitle
        eyebrow="CONEXIÓN CORPORATIVA"
        title="Sincronización con Métrica"
        description="DataMET es el catálogo maestro; Supabase guarda la operación y el worker conserva el espejo SQL Server."
        action={
          <button className="iv-button secondary" onClick={() => onOnboard()}>
            <Plus size={16} /> Incorporar cliente
          </button>
        }
      />
      <QueryState query={query}>
        <WorkerStatus workers={query.error ? [] : query.data?.workers} />
        <div className="iv-stats compact">
          <Stat
            label="Pendientes de envío"
            value={query.data?.outbox.PENDING || 0}
          />
          <Stat
            label="En procesamiento"
            value={query.data?.outbox.CLAIMED || 0}
          />
          <Stat
            label="Entregados al espejo"
            value={query.data?.outbox.PROCESSED || 0}
          />
          <Stat
            label="Requieren intervención"
            value={query.data?.outbox.DEAD || 0}
          />
        </div>
        <p className="iv-notice">
          Los cambios se envían al espejo en el próximo ciclo del worker. Esta
          pantalla no ejecuta el worker ni modifica los datos maestros de
          DataMET.
        </p>
        <SectionTitle title="Clientes incorporados y solicitudes" />
        <div className="iv-toolbar">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Buscar incorporación por nombre o código"
          />
        </div>
        <div className="iv-table-wrap">
          <table className="iv-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Alcance autorizado</th>
                <th>Estado</th>
                <th>Solicitado</th>
                <th>Gestionar</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.scopes.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong className="code">{s.legacy_codigo_cliente}</strong>
                    <small>{s.client_name || s.solicitado_por}</small>
                  </td>
                  <td>
                    {s.plants.join(', ')}
                    <small>{s.equipmentCount} balanzas</small>
                  </td>
                  <td>
                    <Badge value={s.syncStatus || s.estado} />
                  </td>
                  <td>{syncDateTime(s.solicitado_at)}</td>
                  <td>
                    <button className="iv-link" onClick={() => onStatus(s.id)}>
                      Ver seguimiento
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          total={query.data?.total || 0}
          onChange={setPage}
        />
        <SectionTitle title="Últimos ciclos del worker" />
        <div className="iv-table-wrap">
          <table className="iv-table">
            <thead>
              <tr>
                <th>Dirección / worker</th>
                <th>Inicio</th>
                <th>Estado</th>
                <th>Aceptados / rechazados</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.direccion === 'DATAMET_TO_SUPABASE'
                      ? 'DataMET → Supabase'
                      : 'Supabase → SQL IvMET'}
                    <small>{r.worker_id}</small>
                  </td>
                  <td>{syncDateTime(r.started_at)}</td>
                  <td>
                    <Badge value={r.estado} />
                  </td>
                  <td>
                    {r.accepted_count} / {r.rejected_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
    </>
  );
}
const navigation = [
  ['clients', 'Clientes', Building2, 'commercial'],
  ['plans', 'Planes y tarifas', FileText, 'commercial'],
  ['readiness', 'Preparación', ClipboardCheck, 'commercial'],
  ['billing', 'Cobros pendientes', FileText, 'commercial'],
  ['cases', 'Casos compartidos', Inbox, 'support'],
  ['equipment-updates', 'Actualizaciones del cliente', Scale, 'support'],
  ['integration', 'Sincronización', Cloud, 'integration'],
  ['privacy', 'Privacidad', ShieldCheck, 'integration'],
  ['staff', 'Permisos internos', Users, 'staff'],
  ['audit', 'Auditoría', Activity, 'staff'],
];
export function IvmetManagementPage({ onExit }) {
  return <IvmetAccessGate onExit={onExit}>{(onLock) => <AuthorizedWorkspace onLock={onLock} />}</IvmetAccessGate>;
}

function AuthorizedWorkspace({ onLock }) {
  const [revision,setRevision] = useState(0);
  const session = useIvmetQuery('ops/session',{},revision,30000);
  if (session.loading) return <main className="iv-app"><Loading/></main>;
  if (session.error || !session.data?.capabilities) return <main className="iv-app iv-access-shell"><section className="iv-access-card">
    <h2>Código validado · comprobar permiso interno</h2><ErrorBox error={session.error || new Error('Actualiza el backend y las migraciones del gestor.')}/>
    <button className="iv-button primary" onClick={()=>setRevision((v)=>v+1)}>Comprobar permiso</button><button className="iv-button secondary" onClick={onLock}>Bloquear acceso</button>
  </section></main>;
  return <IvmetWorkspace key={session.data.role} onLock={onLock} capabilities={session.data.capabilities}/>;
}

function IvmetWorkspace({ onLock, capabilities }) {
  const can = (capability)=>capabilities.includes(capability);
  const visibleNavigation = navigation.filter((n)=>can(n[3]));
  const [section, setSection] = useState(visibleNavigation[0]?.[0] || 'cases');
  const [clientId, setClientId] = useState(null);
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState(null);
  const [onboarding, setOnboarding] = useState(false);
  const [tracking, setTracking] = useState(null);
  const overview = useIvmetQuery(can('commercial') ? 'overview' : null, {}, revision);
  const plans = useIvmetQuery(can('commercial') ? 'plans' : null, {}, revision);
  const runtime = useIvmetQuery(can('integration') ? 'onboarding' : null, { pageSize: 1 }, revision, 15000);
  const open = (action, context = {}) =>
    setDialog(actionConfig(action, { plans: plans.data || [], ...context }));
  const refresh = () => setRevision((r) => r + 1);
  const saved = () => {
    refresh();
    toast.success('Operación guardada en IvMET');
  };
  const navigate = (id) => {
    setSection(id);
    setClientId(null);
  };
  return (
    <main className="iv-app">
      <aside className="iv-rail">
        <div className="iv-brand">
          <span>Iv</span>
          <div>
            <strong>IvMET</strong>
            <small>Gestión de clientes</small>
          </div>
        </div>
        <span className="iv-nav-label">ADMINISTRACIÓN</span>
        <nav aria-label="Administración IvMET">
          {visibleNavigation.map(([id, label, icon]) => (
            <button
              key={id}
              aria-current={section === id ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              {React.createElement(icon, { size: 18 })}
              {label}
              {section === id && <span />}
            </button>
          ))}
        </nav>
        <div className="iv-rail-note">
          <ShieldCheck size={22} />
          <strong>Acceso interno Métrica</strong>
          <p>
            Las credenciales y los controles de licencia permanecen en el
            servidor.
          </p>
        </div>
        <div className="iv-rail-bottom">
          <Activity size={14} /> Operación en línea
        </div>
      </aside>
      <section className="iv-main">
        <div className="iv-development-bar">
          <span><span className="iv-development-badge">En desarrollo</span> Acceso de pruebas autorizado</span>
          <button className="iv-link" onClick={onLock}><LockKeyhole size={14} /> Bloquear acceso</button>
        </div>
        <header className="iv-topbar">
          <div>
            <span className="iv-breadcrumb">
              Gestión IvMET <ChevronRight size={13} />{' '}
              {clientId
                ? 'Ficha del cliente'
                : navigation.find((n) => n[0] === section)?.[1]}
            </span>
            <span className="iv-connection">
              <i className={overview.error ? 'offline' : ''} />
              {overview.loading
                ? 'Conectando…'
                : overview.error
                  ? 'Revisar conexión'
                  : 'Supabase conectado'}
            </span>
          </div>
          <button
            className="iv-icon-button"
            aria-label="Actualizar Gestión IvMET"
            onClick={refresh}
          >
            <RefreshCw
              size={17}
              className={overview.loading ? 'animate-spin' : ''}
            />
          </button>
        </header>
        <div className="iv-page iv-content-enter" key={clientId || section}>
          {clientId ? (
            <ClientWorkspace
              key={clientId}
              clientId={clientId}
              revision={revision}
              onBack={() => setClientId(null)}
              open={open}
              plans={plans.data || []}
            />
          ) : (
            <>
              {section === 'clients' && (
                <div className="iv-stats">
                  <Stat
                    label="Clientes habilitados"
                    value={overview.data?.clients}
                    note={
                      (overview.data?.plants ?? '—') + ' plantas sincronizadas'
                    }
                    icon={<Building2 size={20} />}
                  />
                  <Stat
                    label="Balanzas en catálogo"
                    value={overview.data?.equipment}
                    note={
                      (overview.data?.review ?? '—') + ' requieren revisión'
                    }
                    icon={<Scale size={20} />}
                  />
                  <Stat
                    label="Licencias asignadas"
                    value={overview.data?.licenses}
                    note={
                      (overview.data?.subscriptions ?? '—') +
                      ' suscripciones vigentes'
                    }
                    icon={<KeyRound size={20} />}
                  />
                  <Stat
                    label="Próximos vencimientos"
                    value={overview.data?.expiresSoon}
                    note="En los próximos 30 días"
                    icon={<Activity size={20} />}
                  />
                </div>
              )}
              {section === 'clients' ? (
                <Clients
                  revision={revision}
                  onSelect={setClientId}
                  onOnboard={() => setOnboarding(true)}
                  onStatus={setTracking}
                  workers={runtime.error ? [] : runtime.data?.workers}
                />
              ) : section === 'plans' ? (
                <Plans query={plans} open={open} />
              ) : section === 'equipment-updates' ? (
                <EquipmentUpdates revision={revision} onSaved={saved}/>
              ) : section !== 'integration' ? (
                <OperationsWorkspace key={section} section={section} revision={revision} onSaved={saved}/>
              ) : (
                <Integration
                  revision={revision}
                  onOnboard={(scope) => setOnboarding(scope || true)}
                  onStatus={setTracking}
                />
              )}
            </>
          )}
        </div>
        <footer className="iv-page-footer">
          <span>Métrica Ltda. · Centro de gestión IvMET</span>
          <span>La evidencia metrológica se conserva sin alteraciones</span>
        </footer>
      </section>
      {dialog && (
        <ActionDialog
          config={dialog}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {onboarding && (
        <OnboardingDialog
          scope={onboarding === true ? null : onboarding}
          onClose={() => setOnboarding(false)}
          onExisting={(id) => {
            setOnboarding(false);
            setTracking(id);
          }}
          onSaved={(result) => {
            refresh();
            toast.success(
              'Solicitud guardada. Puedes seguir su importación aquí.'
            );
            setTracking(result.id);
          }}
        />
      )}
      {tracking && (
        <OnboardingStatusDialog
          scopeId={tracking}
          onClose={() => setTracking(null)}
          onSaved={refresh}
          onClient={(id) => {
            setTracking(null);
            setClientId(id);
            refresh();
          }}
          onExtend={(scope) => {
            setTracking(null);
            setOnboarding(scope);
          }}
        />
      )}
    </main>
  );
}
