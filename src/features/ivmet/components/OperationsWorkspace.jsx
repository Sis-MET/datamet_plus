import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useIvmetQuery } from '../useIvmetQuery';
import { dateText, money } from '../format';
import {
  Badge,
  Empty,
  Pagination,
  QueryState,
  SearchInput,
  SectionTitle,
} from './Ui';
import { IvSelect } from './IvSelect';
import { ActionDialog } from './ActionDialog';
const methods = [
  ['absolute_error', 'Error absoluto'],
  ['range', 'Rango'],
  ['sample_standard_deviation', 'Desviación estándar muestral'],
];

const states = [
  ['NEW', 'Recibido'],
  ['IN_REVIEW', 'En revisión'],
  ['WAITING_CLIENT', 'Esperando al cliente'],
  ['RESOLVED', 'Resuelto'],
];
const roles = [
  ['admin', 'Administrador'],
  ['commercial', 'Gestión comercial'],
  ['support', 'Soporte técnico'],
  ['metrologist', 'Metrología'],
];
const options = (values) => values.map(([value, label]) => ({ value, label }));
const field = (name, label, extra = {}) => ({ name, label, ...extra });
const stamp = (v) => (v ? new Date(v).toLocaleString('es-BO') : '—');
const trialNames = {
  eccentricity: 'Excentricidad',
  repeatability: 'Repetibilidad',
  linearity: 'Linealidad',
};

export function CaseEvidence({ snapshot }) {
  if (!snapshot) return null;
  const v = snapshot.verificacion || {},
    equipment = v.equipo_snapshot || {};
  return (
    <section className="iv-evidence">
      <div className="iv-privacy-note">
        <ShieldCheck size={19} />
        <p>
          Expediente autorizado por el cliente. No incluye acceso al historial
          de otras verificaciones.
        </p>
      </div>
      <dl className="iv-detail-grid">
        <div>
          <dt>Equipo</dt>
          <dd>{equipment.cod_metrica || equipment.codigo || v.equipo_id}</dd>
        </div>
        <div>
          <dt>Alcance</dt>
          <dd>{v.alcance === 'partial' ? 'Parcial' : 'Completo'}</dd>
        </div>
        <div>
          <dt>Medición</dt>
          <dd>{stamp(v.realizado_at)}</dd>
        </div>
        <div>
          <dt>Recepción</dt>
          <dd>{stamp(v.recibido_at)}</dd>
        </div>
        <div>
          <dt>Trazabilidad</dt>
          <dd>{v.trazabilidad === 'traceable' ? 'Trazable' : 'No trazable'}</dd>
        </div>
        <div>
          <dt>Resultado</dt>
          <dd>
            {v.veredicto_global === 'pass'
              ? 'Conforme'
              : v.veredicto_global === 'fail'
                ? 'No conforme'
                : 'Sin dictamen'}
          </dd>
        </div>
        <div>
          <dt>Captura / finalización</dt>
          <dd>
            {snapshot.usuarios?.captura || '—'} /{' '}
            {snapshot.usuarios?.finalizacion || '—'}
          </dd>
        </div>
        <div>
          <dt>Condiciones ambientales</dt>
          <dd>
            {v.temperatura_c ?? '—'} °C · {v.humedad_relativa_pct ?? '—'} % HR
          </dd>
        </div>
      </dl>
      {v.observaciones && (
        <p className="iv-preserve-lines">{v.observaciones}</p>
      )}
      <details className="iv-evidence-detail">
        <summary>Equipo y plan capturados en la verificación</summary>
        <pre>
          {JSON.stringify(
            { equipo: equipment, plan: v.plan_snapshot },
            null,
            2
          )}
        </pre>
      </details>
      {(snapshot.pruebas || []).map((trial) => (
        <article className="iv-trial-card" key={trial.id}>
          <h3>
            {trialNames[trial.tipo] || trial.tipo}{' '}
            <Badge
              value={
                trial.estado_ejecucion === 'omitted'
                  ? 'OMITTED'
                  : trial.veredicto === 'pass'
                    ? 'PASS'
                    : 'FAIL'
              }
            />
          </h3>
          {trial.estado_ejecucion === 'omitted' ? (
            <p>Omitida: {trial.motivo_omision}</p>
          ) : (
            <>
              <p className="iv-subtle">
                Método:{' '}
                {methods.find(([id]) => id === trial.metodo_evaluacion)?.[1] ||
                  trial.metodo_evaluacion}{' '}
                · Unidad: {trial.unidad} · Tolerancia:{' '}
                {trial.tolerancia ?? 'Por punto'}
              </p>
              <div className="iv-table-wrap">
                <table className="iv-table">
                  <thead>
                    <tr>
                      <th>Punto</th>
                      <th>Carga</th>
                      <th>Indicación</th>
                      <th>Cero</th>
                      <th>Error</th>
                      <th>Tolerancia</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(trial.lecturas || []).map((reading) => (
                      <tr key={reading.id}>
                        <td>{reading.etiqueta || reading.punto_codigo}</td>
                        <td>{reading.carga_nominal}</td>
                        <td>{reading.indicacion}</td>
                        <td>{reading.retorno_cero ?? '—'}</td>
                        <td>{reading.error}</td>
                        <td>{reading.tolerancia}</td>
                        <td>
                          <Badge
                            value={
                              reading.veredicto === 'pass' ? 'PASS' : 'FAIL'
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="iv-subtle">
                Error máximo: {trial.error_max_abs ?? '—'} · Media:{' '}
                {trial.media ?? '—'} · Desviación:{' '}
                {trial.desviacion_estandar ?? '—'} · Rango: {trial.rango ?? '—'}
              </p>
            </>
          )}
        </article>
      ))}
      <h3>Patrones y certificados utilizados</h3>
      {snapshot.patrones?.length ? (
        snapshot.patrones.map((p) => (
          <details
            className="iv-evidence-detail"
            key={`${p.patron_id}-${p.rol}`}
          >
            <summary>
              {p.snapshot?.descripcion || p.snapshot?.codigo || 'Patrón'} ·{' '}
              {p.rol}
            </summary>
            <pre>{JSON.stringify(p.snapshot, null, 2)}</pre>
          </details>
        ))
      ) : (
        <p className="iv-subtle">Sin patrones en el expediente compartido.</p>
      )}
    </section>
  );
}

function CaseDetail({ id, revision, back, open }) {
  const query = useIvmetQuery('ops/case', { id }, revision, 15000);
  const assignees = useIvmetQuery('ops/assignees', {}, revision);
  const c = query.data;
  return (
    <>
      <button className="iv-link" onClick={back}>
        <ArrowLeft size={16} /> Volver a casos compartidos
      </button>
      <QueryState query={query}>
        {c && (
          <>
            <SectionTitle
              eyebrow="ATENCIÓN AL CLIENTE"
              title={c.codigo}
              description={`Compartido el ${stamp(c.autorizado_at)} · ${c.consentimiento_version}`}
              action={
                <button
                  className="iv-button primary"
                  disabled={Boolean(assignees.error) || assignees.loading}
                  onClick={() =>
                    open({
                      ops: true,
                      action: 'case.update',
                      title: 'Registrar seguimiento',
                      description:
                        'El comentario forma parte del seguimiento visible para el cliente. No autoriza una intervención automática.',
                      values: {
                        id: c.id,
                        version: c.row_version,
                        status: c.estado,
                        assignee: c.responsable || '',
                        comment: '',
                      },
                      fields: [
                        field('status', 'Estado', {
                          type: 'select',
                          options: options(states),
                        }),
                        field('assignee', 'Responsable', {
                          type: 'select',
                          required: false,
                          options: (assignees.data || []).map((a) => ({
                            value: a.actor,
                            label: a.name,
                          })),
                        }),
                        field('comment', 'Comentario para el cliente', {
                          type: 'textarea',
                          wide: true,
                          maxLength: 2000,
                        }),
                      ],
                    })
                  }
                >
                  Registrar seguimiento
                </button>
              }
            />
            <div className="iv-toolbar">
              <Badge value={c.estado} />
              <span className="iv-subtle">
                Responsable: {c.responsable || 'Sin asignar'}
              </span>
            </div>
            <blockquote className="iv-client-message">{c.mensaje}</blockquote>
            <CaseEvidence snapshot={c.snapshot} />
            <h3>Seguimiento</h3>
            <ol className="iv-case-timeline">
              {c.eventos.map((e) => (
                <li key={e.id}>
                  <strong>{e.actor_externo || 'Cliente'}</strong>
                  <time>{stamp(e.created_at)}</time>
                  <p>{e.comentario}</p>
                </li>
              ))}
            </ol>
          </>
        )}
      </QueryState>
    </>
  );
}

export function OperationsWorkspace({ section, revision, onSaved }) {
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null),
    [dialog, setDialog] = useState(null);
  const query = useIvmetQuery(
    selected ? null : `ops/${section}`,
    { search, page, ...(status ? { status } : {}) },
    revision,
    section === 'cases' ? 15000 : 0
  );
  const openStaff = (s = {}) =>
    setDialog({
      ops: true,
      action: 'staff.save',
      title: s.actor ? 'Editar permiso interno' : 'Asignar permiso interno',
      description:
        'El usuario debe existir en RimMET con acceso_cron 3. Este permiso no concede acceso a resultados privados.',
      values: {
        actor: s.actor || 'RIMMET:',
        name: s.nombre || '',
        role: s.rol || 'support',
        active: s.activo ?? true,
        ...(s.actor ? { version: String(s.row_version) } : {}),
      },
      fields: [
        field('actor', 'Identificador RIMMET:usuario', {
          readOnly: Boolean(s.actor),
        }),
        field('name', 'Nombre'),
        field('role', 'Permiso', { type: 'select', options: options(roles) }),
        field('active', 'Acceso activo', { type: 'checkbox' }),
      ],
    });
  const titles = {
    cases: [
      'Casos compartidos',
      'Solo expedientes enviados expresamente por el jefe de calidad del cliente.',
    ],
    readiness: [
      'Preparación de clientes',
      'Comprueba la configuración antes de entregar accesos. No se consultan resultados metrológicos.',
    ],
    billing: [
      'Cobros pendientes',
      'Saldos por documento y moneda; gestiona los pagos desde la ficha del cliente.',
    ],
    staff: [
      'Permisos internos',
      'Acceso individual por responsabilidad, además del código de desarrollo.',
    ],
    privacy: [
      'Privacidad e integración',
      'La sincronización automática excluye evidencia privada.',
    ],
    audit: [
      'Auditoría administrativa',
      'Accesos y cambios internos, sin snapshots ni contenido de resultados privados.',
    ],
  };
  return (
    <>
      {selected ? (
        <CaseDetail
          id={selected}
          revision={revision}
          back={() => setSelected(null)}
          open={setDialog}
        />
      ) : (
        <>
          <SectionTitle
            eyebrow="GESTIÓN IVMET"
            title={titles[section][0]}
            description={titles[section][1]}
            action={
              section === 'staff' && (
                <button
                  className="iv-button primary"
                  onClick={() => openStaff()}
                >
                  <Plus size={16} /> Asignar permiso
                </button>
              )
            }
          />
          {['cases', 'readiness', 'billing'].includes(section) && (
            <div className="iv-toolbar">
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder={
                  section === 'cases'
                    ? 'Buscar caso, cliente o balanza'
                    : 'Buscar cliente'
                }
              />
              {section === 'cases' && (
                <IvSelect
                  aria-label="Estado del caso"
                  value={status}
                  options={options(states)}
                  placeholder="Todos los estados"
                  onChange={(v) => {
                    setStatus(v);
                    setPage(1);
                  }}
                />
              )}
            </div>
          )}
          <QueryState query={query}>
            {section === 'cases' &&
              (query.data?.items.length ? (
                <div className="iv-table-wrap">
                  <table className="iv-table">
                    <thead>
                      <tr>
                        <th>Caso</th>
                        <th>Cliente / planta</th>
                        <th>Balanza</th>
                        <th>Estado</th>
                        <th>Compartido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.items.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <button
                              className="iv-link"
                              onClick={() => setSelected(c.id)}
                            >
                              {c.codigo}
                            </button>
                          </td>
                          <td>
                            {c.cliente}
                            <small>{c.planta}</small>
                          </td>
                          <td>{c.cod_metrica}</td>
                          <td>
                            <Badge value={c.estado} />
                          </td>
                          <td>{stamp(c.autorizado_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Sin casos compartidos"
                  text="Las pruebas y alertas privadas del cliente no aparecen aquí."
                />
              ))}
            {section === 'readiness' && (
              <div className="iv-readiness-grid">
                {query.data?.items.map((c) => (
                  <article className="iv-plan-card" key={c.id}>
                    <span className="iv-eyebrow">CLIENTE {c.code}</span>
                    <h3>{c.name}</h3>
                    <ul className="iv-readiness-list">
                      {[
                        ['contract', 'Contrato vigente'],
                        ['subscription', 'Suscripción vigente'],
                        ['users', 'Usuario con licencia y contraseña cambiada'],
                        ['equipment', 'Balanzas habilitadas'],
                      ].map(([k, label]) => (
                        <li key={k} className={c[k] ? 'ready' : ''}>
                          {c[k] ? (
                            <CheckCircle2 size={17} />
                          ) : (
                            <Circle size={17} />
                          )}{' '}
                          {label}
                        </li>
                      ))}
                    </ul>
                    <p className="iv-subtle">
                      Catálogo actualizado: {stamp(c.syncedAt)}
                    </p>
                  </article>
                ))}
              </div>
            )}
            {section === 'billing' &&
              (query.data?.items.length ? (
                <div className="iv-table-wrap">
                  <table className="iv-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Documento</th>
                        <th>Vencimiento</th>
                        <th>Saldo</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.items.map((f) => (
                        <tr key={f.id}>
                          <td>{f.cliente}</td>
                          <td>{f.numero}</td>
                          <td>{dateText(f.vence_el)}</td>
                          <td>{money(f.saldo, f.moneda)}</td>
                          <td>
                            <Badge value={f.estado} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Sin cobros pendientes"
                  text="No hay documentos pendientes para este filtro."
                />
              ))}
            {section === 'staff' && (
              <div className="iv-table-wrap">
                <table className="iv-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Nombre</th>
                      <th>Permiso</th>
                      <th>Acceso</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {query.data?.map((s) => (
                      <tr key={s.actor}>
                        <td>{s.actor}</td>
                        <td>{s.nombre}</td>
                        <td>{roles.find(([r]) => r === s.rol)?.[1]}</td>
                        <td>
                          <Badge value={s.activo ? 'ACTIVE' : 'INACTIVE'} />
                        </td>
                        <td>
                          <button
                            className="iv-link"
                            onClick={() => openStaff(s)}
                          >
                            Editar permiso
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {section === 'privacy' && query.data && (
              <article className="iv-plan-card">
                <ShieldCheck size={27} />
                <h3>Evidencia privada fuera del espejo corporativo</h3>
                <p>
                  Contrato del worker: versión {query.data.contractVersion}.
                  Solo los expedientes autorizados pueden transferir resultados.
                </p>
                <p className="iv-subtle">
                  Esta vista confirma el contrato de Supabase. La configuración
                  SQL Server se valida con worker:health en el servidor.
                </p>
                <dl className="iv-detail-grid">
                  {Object.entries(query.data.queue).map(([state, n]) => (
                    <div key={state}>
                      <dt>{state}</dt>
                      <dd>{n} eventos administrativos o compartidos</dd>
                    </div>
                  ))}
                </dl>
              </article>
            )}
            {section === 'audit' && (
              <div className="iv-table-wrap">
                <table className="iv-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Usuario</th>
                      <th>Acción</th>
                      <th>Entidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data?.items.map((a) => (
                      <tr key={a.id}>
                        <td>{stamp(a.created_at)}</td>
                        <td>{a.actor_externo}</td>
                        <td>{a.accion}</td>
                        <td>{a.entidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {query.data?.total !== undefined && (
              <Pagination
                page={page}
                total={query.data.total}
                onChange={setPage}
              />
            )}
            {section === 'audit' && (
              <div className="iv-pagination">
                <button
                  className="iv-button secondary small"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </button>
                <span>Página {page}</span>
                <button
                  className="iv-button secondary small"
                  disabled={query.data?.items.length !== 20}
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </button>
              </div>
            )}
          </QueryState>
        </>
      )}
      {dialog && (
        <ActionDialog
          config={dialog}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
