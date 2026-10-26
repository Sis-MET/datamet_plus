import { useState } from 'react';
import { CheckCircle2, Circle, Plus, ShieldCheck } from 'lucide-react';
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
import { ActionDialog } from './ActionDialog';

const roles = [
  ['admin', 'Administrador'],
  ['commercial', 'Gestión comercial'],
  ['support', 'Soporte técnico'],
  ['metrologist', 'Metrología'],
];
const options = (values) => values.map(([value, label]) => ({ value, label }));
const field = (name, label, extra = {}) => ({ name, label, ...extra });
const stamp = (v) => (v ? new Date(v).toLocaleString('es-BO') : '—');

export function OperationsWorkspace({ section, revision, onSaved }) {
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const query = useIvmetQuery(`ops/${section}`, { search, page }, revision);
  const openStaff = (s = {}) =>
    setDialog({
      ops: true,
      action: 'staff.save',
      title: s.actor ? 'Editar permiso interno' : 'Asignar permiso interno',
      description:
        'El usuario debe existir en DataMET+ con acceso_cron 3. Este permiso no concede acceso a resultados privados.',
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
      <SectionTitle
        eyebrow="GESTIÓN IVMET"
        title={titles[section][0]}
        description={titles[section][1]}
        action={
          section === 'staff' && (
            <button className="iv-button primary" onClick={() => openStaff()}>
              <Plus size={16} /> Asignar permiso
            </button>
          )
        }
      />
      {['readiness', 'billing'].includes(section) && (
        <div className="iv-toolbar">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Buscar cliente"
          />
        </div>
      )}
      <QueryState query={query}>
        {section === 'readiness' && (
          <div className="iv-readiness-grid">
            {query.data?.items.map((c) => (
              <article className="iv-plan-card" key={c.id}>
                <span className="iv-eyebrow">Cliente <span className="code">{c.code}</span></span>
                <h3>{c.name}</h3>
                <ul className="iv-readiness-list">
                  {[
                    ['contract', 'Contrato vigente'],
                    ['subscription', 'Suscripción vigente'],
                    ['users', 'Usuario con licencia y contraseña cambiada'],
                    ['equipment', 'Balanzas habilitadas'],
                  ].map(([k, label]) => (
                    <li key={k} className={c[k] ? 'ready' : ''}>
                      {c[k] ? <CheckCircle2 size={17} /> : <Circle size={17} />}{' '}
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
                      <button className="iv-link" onClick={() => openStaff(s)}>
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
              Contrato del worker: versión {query.data.contractVersion}. Solo
              los expedientes autorizados pueden transferir resultados.
            </p>
            <p className="iv-subtle">
              Esta vista confirma el contrato de Supabase. La configuración SQL
              Server se valida con worker:health en el servidor.
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
          <Pagination page={page} total={query.data.total} onChange={setPage} />
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
