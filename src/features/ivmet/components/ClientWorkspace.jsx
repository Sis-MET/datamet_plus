import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  FilePenLine,
  FileText,
  Inbox,
  KeyRound,
  Layers,
  Plus,
  Scale,
  Settings2,
  Users,
  X,
} from 'lucide-react';
import { useIvmetQuery } from '../useIvmetQuery';
import { SharedCases } from './SharedCases';
import { EquipmentUpdates } from './EquipmentUpdates';
import {
  Badge,
  Empty,
  Pagination,
  QueryState,
  SearchInput,
  SectionTitle,
} from './Ui';
import { dateText, effectiveState, money } from '../format';
import { IvSelect } from './IvSelect';
import { useDialogMotion } from '../useDialogMotion';
import { EnableEquipmentDialog } from './EnableEquipmentDialog';

function EquipmentView({ clientId, workspace, revision, open, onSaved }) {
  const [search, setSearch] = useState('');
  const [plantId, setPlant] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [enabling, setEnabling] = useState(false);
  const detail = useRef(null);
  const { closing, close } = useDialogMotion(
    detail,
    () => setSelected(null),
    Boolean(selected)
  );
  const query = useIvmetQuery(
    `clients/${clientId}/equipment`,
    {
      search,
      page,
      plantId: plantId || undefined,
      status: status || undefined,
    },
    revision
  );
  const filter = (setter, value) => {
    setter(value);
    setPage(1);
  };
  // Validadas que nadie habilitó ni suspendió, según el filtro de planta.
  const pending = Number(query.data?.pendingEnable) || 0;
  return (
    <>
      <SectionTitle
        title="Balanzas del cliente"
        description="Datos maestros de DataMET. Abre una balanza para ver su ficha o habilita varias a la vez."
        action={
          <button
            className="iv-button primary"
            aria-label={
              pending
                ? `Habilitar balanzas, ${pending} pendientes`
                : 'Habilitar balanzas'
            }
            onClick={() => setEnabling(true)}
          >
            <CheckCheck size={16} /> Habilitar balanzas
            {pending > 0 && <span className="iv-button-count">{pending}</span>}
          </button>
        }
      />
      <div className="iv-toolbar">
        <SearchInput
          value={search}
          onChange={(v) => filter(setSearch, v)}
          placeholder="Código, marca, serie o instrumento"
        />
        <IvSelect
          aria-label="Filtrar por planta"
          value={plantId}
          onChange={(value) => filter(setPlant, value)}
          placeholder="Todas las plantas del cliente"
          options={workspace.plants.map((p) => ({
            value: p.id,
            label: `${p.legacy_codigo_planta} · ${p.nombre}`,
          }))}
        />
        <IvSelect
          aria-label="Estado del catálogo"
          value={status}
          onChange={(value) => filter(setStatus, value)}
          placeholder="Todos los estados"
          options={[
            { value: 'READY', label: 'Validados' },
            { value: 'REQUIRES_REVIEW', label: 'Revisar datos' },
            { value: 'QUARANTINED', label: 'En cuarentena' },
          ]}
        />
      </div>
      <QueryState query={query}>
        {query.data?.items.length ? (
          <div className="iv-table-wrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Balanza / instrumento</th>
                  <th>Planta</th>
                  <th>Marca y modelo</th>
                  <th>Catálogo</th>
                  <th>App IvMET</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data?.items.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <button
                        className="iv-link code"
                        onClick={() => setSelected(e)}
                      >
                        {e.cod_metrica}
                      </button>
                      <small>
                        {e.instrumento ||
                          e.tipo_instrumento ||
                          'Instrumento de pesaje'}
                      </small>
                    </td>
                    <td>
                      <span className="iv-subtle">
                        {
                          workspace.plants.find((p) => p.id === e.planta_id)
                            ?.legacy_codigo_planta
                        }
                      </span>
                    </td>
                    <td>
                      {e.marca || '—'}
                      <small>{e.modelo || 'Sin modelo'}</small>
                    </td>
                    <td>
                      <Badge value={e.estado_catalogo} />
                    </td>
                    <td>
                      <Badge value={e.habilitado ? 'ACTIVE' : 'INACTIVE'}>
                        {e.habilitado
                          ? 'Habilitado'
                          : e.estado_configuracion === 'SUSPENDED'
                            ? 'Suspendido'
                            : 'Sin habilitar'}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="iv-icon-button"
                        aria-label={`Ver ${e.cod_metrica}`}
                        onClick={() => setSelected(e)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              total={query.data?.total || 0}
              onChange={setPage}
            />
          </div>
        ) : (
          <Empty
            title="No hay balanzas en este filtro"
            text="Prueba otra planta o busca por el código Métrica."
          />
        )}
      </QueryState>
      {selected && (
        <dialog
          ref={detail}
          className="iv-detail"
          data-state={closing ? 'closing' : 'open'}
          aria-label={`Ficha ${selected.cod_metrica}`}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
            }
          }}
        >
          <header>
            <div>
              <span className="iv-eyebrow">Ficha del instrumento</span>
              <h2>{selected.cod_metrica}</h2>
            </div>
            <button
              autoFocus
              className="iv-icon-button"
              aria-label="Cerrar ficha"
              onClick={close}
            >
              <X size={20} />
            </button>
          </header>
          <div className="iv-detail-content">
            <Badge value={selected.estado_catalogo} />
            <h3>{selected.instrumento || 'Instrumento de pesaje'}</h3>
            <dl className="iv-definition">
              {[
                ['Código interno', selected.cod_interno],
                ['Marca', selected.marca],
                ['Modelo', selected.modelo],
                ['Serie', selected.serie],
                ['Clase', selected.clase],
                ['Ubicación', selected.ubicacion],
                ['Última sincronización', dateText(selected.synced_at)],
              ].map(([name, value]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{value || '—'}</dd>
                </div>
              ))}
            </dl>
            <h4>Rangos de pesaje</h4>
            {selected.ranges.map((r) => (
              <div className="iv-range" key={r.numero_rango}>
                <strong>
                  Rango {r.numero_rango} · {r.unidad}
                </strong>
                <dl>
                  <div>
                    <dt>Capacidad máxima</dt>
                    <dd>{r.capacidad_max}</dd>
                  </div>
                  <div>
                    <dt>División d</dt>
                    <dd>{r.division_escala}</dd>
                  </div>
                  <div>
                    <dt>Intervalo e</dt>
                    <dd>{r.intervalo_verificacion ?? 'No definido'}</dd>
                  </div>
                </dl>
              </div>
            ))}
            {selected.estado_catalogo !== 'READY' && (
              <p className="iv-notice">
                Corrige los datos técnicos en DataMET y ejecuta la
                sincronización. RimMET no sobrescribe el catálogo maestro.
              </p>
            )}
            <p className="iv-notice">El cliente valida la ficha y gestiona áreas, patrones y planes desde la app. La habilitación comercial no depende de asignar un plan aquí.</p>
          </div>
          <footer>
            <button
              className="iv-button primary"
              onClick={() => {
                open('equipment.configure', selected);
                setSelected(null);
              }}
            >
              <Settings2 size={16} /> Disponibilidad en IvMET
            </button>
          </footer>
        </dialog>
      )}
      {enabling && (
        <EnableEquipmentDialog
          clientId={clientId}
          client={workspace.client}
          plants={workspace.plants}
          onClose={() => setEnabling(false)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
function UsersView({ clientId, workspace, revision, open }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useIvmetQuery(
    `clients/${clientId}/users`,
    { search, page },
    revision
  );
  return (
    <>
      <SectionTitle
        title="Usuarios y licencias"
        description="Cada cuenta es individual. Una licencia ocupa un cupo del contrato, no una instalación."
        action={
          <button
            className="iv-button primary"
            onClick={() => open('user.create')}
          >
            <Plus size={16} /> Crear usuario
          </button>
        }
      />
      <div className="iv-toolbar">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Buscar usuario o nombre"
        />
        <span className="iv-subtle">
          {workspace.subscriptions.reduce((n, s) => n + Number(s.assigned), 0)}{' '}
          licencias asignadas
        </span>
      </div>
      <QueryState query={query}>
        {query.data?.items.length ? (
          <div className="iv-table-wrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol / plantas</th>
                  <th>Cuenta</th>
                  <th>Licencia</th>
                  <th>Gestionar</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.nombre}</strong>
                      <small>
                        @{u.usuario}
                        {u.debe_cambiar_password
                          ? ' · Cambio de contraseña pendiente'
                          : ''}
                      </small>
                    </td>
                    <td>
                      {u.rol === 'cliente_operador'
                        ? 'Operador'
                        : 'Jefe de calidad'}
                      <small>{u.plantIds.length} planta(s) autorizada(s)</small>
                    </td>
                    <td>
                      <Badge value={u.activo ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td>
                      <Badge value={u.license ? 'ACTIVE' : 'PENDING'}>
                        {u.license ? 'Asignada' : 'Sin licencia'}
                      </Badge>
                      {u.license && (
                        <small>
                          {u.appAccess
                            ? 'Acceso vigente'
                            : u.debe_cambiar_password
                              ? 'Requiere cambio de contraseña'
                              : 'Sin acceso: revisar vigencia y cupos'}
                        </small>
                      )}
                    </td>
                    <td>
                      <div className="iv-row-actions">
                        <button onClick={() => open('user.update', u)}>
                          Editar
                        </button>
                        <button
                          disabled={!u.activo}
                          onClick={() =>
                            open(
                              u.license ? 'license.revoke' : 'license.assign',
                              u
                            )
                          }
                        >
                          {u.license ? 'Revocar' : 'Asignar licencia'}
                        </button>
                        <button onClick={() => open('user.reset', u)}>
                          Contraseña
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              total={query.data.total}
              onChange={setPage}
            />
          </div>
        ) : (
          <Empty
            title="Crea la primera cuenta del cliente"
            text="Asigna sus plantas y luego una licencia de la suscripción vigente."
            action={
              <button
                className="iv-button secondary"
                onClick={() => open('user.create')}
              >
                Crear usuario
              </button>
            }
          />
        )}
      </QueryState>
    </>
  );
}
function CommercialView({ workspace, open }) {
  return (
    <>
      <SectionTitle
        title="Contrato y suscripción"
        description="Historial comercial, períodos contratados, cupos y pagos registrados."
        action={
          !workspace.contracts.some((c) =>
            ['ACTIVE', 'DRAFT', 'SUSPENDED'].includes(c.estado)
          ) && (
            <button
              className="iv-button primary"
              onClick={() => open('contract.create')}
            >
              <Plus size={16} /> Registrar contrato
            </button>
          )
        }
      />
      {!workspace.contracts.length ? (
        <Empty
          title="Este cliente aún no tiene contrato"
          text="Selecciona un plan y registra el contrato firmado. El primer pago habilitará los cupos."
          action={
            <button
              className="iv-button primary"
              onClick={() => open('contract.create')}
            >
              Registrar contrato
            </button>
          }
        />
      ) : (
        workspace.contracts.map((c) => (
          <article className="iv-contract" key={c.id}>
            <div className="iv-contract-top">
              <div className="iv-object-icon">
                <FileText size={22} />
              </div>
              <div>
                <span className="iv-eyebrow">Contrato</span>
                <h3>{c.numero_contrato}</h3>
                <p>
                  {dateText(c.vigente_desde)} — {dateText(c.vigente_hasta)}
                </p>
              </div>
              <Badge value={c.estado} />
              {c.estado === 'ACTIVE' && (
                <button
                  className="iv-button secondary small"
                  onClick={() => open('contract.extend', c)}
                >
                  Ampliar vigencia
                </button>
              )}
            </div>
            {workspace.subscriptions
              .filter((s) => s.contrato_id === c.id)
              .map((s) => (
                <div className="iv-subscription" key={s.id}>
                  <div className="iv-subscription-info">
                    <div>
                      <h4>
                        {s.planName} <Badge value={effectiveState(s)} />
                      </h4>
                      <p>
                        {s.periodicidad === 'MONTHLY'
                          ? 'Facturación mensual'
                          : 'Facturación anual'}{' '}
                        · Período hasta {dateText(s.fin_periodo)}
                      </p>
                    </div>
                    <div className="iv-seat-count">
                      <strong>
                        {s.assigned}
                        <span> / {s.seats}</span>
                      </strong>
                      <small>cupos ocupados / contratados</small>
                    </div>
                  </div>
                  <div className="iv-seat-bar">
                    <i
                      style={{
                        width: `${s.seats ? Math.min(100, (s.assigned / s.seats) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="iv-inline-actions">
                    <button
                      className="iv-button secondary small"
                      disabled={['PENDING', 'CANCELLED'].includes(s.estado)}
                      onClick={() => open('subscription.renew', s)}
                    >
                      Renovar período
                    </button>
                    <button
                      className="iv-button secondary small"
                      disabled={['PENDING', 'CANCELLED'].includes(s.estado)}
                      onClick={() => open('seats.purchase', s)}
                    >
                      Agregar cupos
                    </button>
                    <button
                      className="iv-button subtle small"
                      disabled={s.estado === 'CANCELLED'}
                      onClick={() => open('subscription.state', s)}
                    >
                      Cambiar estado
                    </button>
                  </div>
                  {s.estado === 'PENDING' && (
                    <p className="iv-notice">
                      Registra el pago de la factura para activar esta
                      suscripción.
                    </p>
                  )}
                  {s.cups
                    .filter(
                      (cup) =>
                        cup.tipo === 'ADDITIONAL' && cup.estado === 'ACTIVE'
                    )
                    .map((cup) => (
                      <div className="iv-cup-row" key={cup.id}>
                        <span>
                          +{cup.cantidad} cupos · hasta{' '}
                          {dateText(cup.vigente_hasta)}
                        </span>
                        <button
                          className="iv-link"
                          onClick={() => open('seat.revoke', cup)}
                        >
                          Revocar cupos
                        </button>
                      </div>
                    ))}
                </div>
              ))}
          </article>
        ))
      )}
      {workspace.invoices.length > 0 && (
        <>
          <SectionTitle
            title="Facturas y pagos"
            description="Documentos internos de control. No reemplazan la emisión tributaria ni realizan cobros bancarios."
          />
          <div className="iv-table-wrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Período</th>
                  <th>Total / saldo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {workspace.invoices.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.numero_factura}</strong>
                      <small>{f.payments.length} pago(s) registrado(s)</small>
                      {f.payments.length > 0 && (
                        <details className="iv-payment-details">
                          <summary>Ver pagos</summary>
                          {f.payments.map((p) => (
                            <p key={p.id}>
                              {dateText(p.fecha_pago)} ·{' '}
                              {money(p.importe, p.moneda)} · {p.referencia}
                            </p>
                          ))}
                        </details>
                      )}
                    </td>
                    <td>
                      {dateText(f.periodo_desde)}
                      <small>al {dateText(f.periodo_hasta)}</small>
                    </td>
                    <td>
                      {money(f.total, f.moneda)}
                      <small>Saldo: {money(f.saldo, f.moneda)}</small>
                    </td>
                    <td>
                      <Badge value={f.estado} />
                    </td>
                    <td>
                      <div className="iv-row-actions">
                        {['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(
                          f.estado
                        ) && (
                          <button onClick={() => open('payment.record', f)}>
                            Registrar pago
                          </button>
                        )}
                        {f.estado === 'PENDING' && (
                          <button onClick={() => open('invoice.void', f)}>
                            Anular
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
function PatternsView() {
  return <>
    <SectionTitle title="Configuración privada del cliente" description="El cliente organiza su operación desde la app IvMET." />
    <p className="iv-notice">Las áreas, los patrones, sus certificados y los planes metrológicos ya no se registran desde RimMET. El jefe de calidad define y asigna los planes en la app; los usuarios del cliente validan las fichas y registran sus áreas y patrones.</p>
    <p className="iv-notice">Ubicación permite sugerir áreas por planta. Las correcciones son privadas; solo las autorizadas expresamente aparecen en «Actualizaciones de balanzas».</p>
  </>;
}
function ActivityView({ clientId, revision }) {
  const [page, setPage] = useState(1);
  const query = useIvmetQuery(
    `clients/${clientId}/activity`,
    { page },
    revision
  );
  return (
    <>
      <SectionTitle
        title="Actividad administrativa"
        description="Acciones auditadas. No se exponen verificaciones ni alertas privadas del cliente."
      />
      <QueryState query={query}>
        <div className="iv-timeline">
          {query.data?.items.map((item) => (
            <div key={item.id}>
              <span>
                <Check size={12} />
              </span>
              <div>
                <strong>{item.accion}</strong>
                <p>
                  {item.actor_externo} ·{' '}
                  {new Date(item.created_at).toLocaleString('es-BO')}
                </p>
              </div>
            </div>
          ))}
        </div>
        {!query.data?.items.length && (
          <Empty
            title="Sin actividad administrativa"
            text="Los cambios que realices aquí aparecerán en esta línea de tiempo."
          />
        )}
        <div className="iv-inline-actions">
          <button
            className="iv-button secondary small"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <button
            className="iv-button secondary small"
            disabled={(query.data?.items.length || 0) < 20}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      </QueryState>
    </>
  );
}
// Lo que el cliente comparte se atiende dentro de su ficha, no en bandejas generales.
const tabs = [
  ['equipment', 'Balanzas', Scale, 'commercial'],
  ['users', 'Usuarios y licencias', Users, 'commercial'],
  ['commercial', 'Contrato y pagos', KeyRound, 'commercial'],
  ['patterns', 'Configuración del cliente', Layers, 'commercial'],
  ['cases', 'Casos compartidos', Inbox, 'support'],
  ['updates', 'Actualizaciones de balanzas', FilePenLine, 'support'],
  ['activity', 'Actividad', ClipboardList, 'commercial'],
];
export function ClientWorkspace({
  clientId,
  revision,
  onBack,
  open,
  plans,
  can,
  onSaved,
}) {
  const query = useIvmetQuery(`clients/${clientId}`, {}, revision);
  const visibleTabs = tabs.filter((t) => can(t[3]));
  const [tab, setTab] = useState(visibleTabs[0]?.[0]);
  const [caseId, setCaseId] = useState(null);
  const workspace = query.data;
  // Casos y actualizaciones sin revisar; solo llegan con permiso de soporte.
  const pendingByTab = {
    cases: Number(workspace?.attention?.newCases) || 0,
    updates: Number(workspace?.attention?.pendingUpdates) || 0,
  };
  const act = (action, record = {}) =>
    open(action, { record, clientId, workspace, plans });
  return (
    <>
      <button className="iv-back" onClick={onBack}>
        <ArrowLeft size={15} /> Todos los clientes
      </button>
      <QueryState query={query}>
        {workspace && (
          <>
            <div className="iv-client-banner">
              <div className="iv-client-avatar">
                <Building2 size={26} />
              </div>
              <div>
                <span className="iv-eyebrow">
                  Cliente {workspace.client.codigo}
                </span>
                <h1>
                  {workspace.client.nombre || workspace.client.razon_social}
                </h1>
                <p>
                  {workspace.client.razon_social} · {workspace.plants.length}{' '}
                  planta(s)
                </p>
              </div>
              <Badge value={workspace.client.activo ? 'ACTIVE' : 'INACTIVE'} />
            </div>
            <nav className="iv-tabs" aria-label="Gestión del cliente">
              {visibleTabs.map(([id, label, icon]) => (
                <button
                  key={id}
                  aria-current={tab === id ? 'page' : undefined}
                  onClick={() => {
                    setTab(id);
                    setCaseId(null);
                  }}
                >
                  {React.createElement(icon, { size: 16 })}
                  {label}
                  {pendingByTab[id] > 0 && (
                    <span className="iv-tab-count">{pendingByTab[id]}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="iv-workspace-content iv-content-enter" key={tab}>
              {tab === 'equipment' ? (
                <EquipmentView
                  clientId={clientId}
                  workspace={workspace}
                  revision={revision}
                  open={act}
                  onSaved={onSaved}
                />
              ) : tab === 'users' ? (
                <UsersView
                  clientId={clientId}
                  workspace={workspace}
                  revision={revision}
                  open={act}
                />
              ) : tab === 'commercial' ? (
                <CommercialView workspace={workspace} open={act} />
              ) : tab === 'patterns' ? (
                <PatternsView workspace={workspace} open={act} />
              ) : tab === 'cases' ? (
                <SharedCases
                  clientId={clientId}
                  revision={revision}
                  onSaved={onSaved}
                  selected={caseId}
                  setSelected={setCaseId}
                />
              ) : tab === 'updates' ? (
                <EquipmentUpdates
                  clientId={clientId}
                  revision={revision}
                  onSaved={onSaved}
                />
              ) : (
                tab === 'activity' && (
                  <ActivityView clientId={clientId} revision={revision} />
                )
              )}
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
