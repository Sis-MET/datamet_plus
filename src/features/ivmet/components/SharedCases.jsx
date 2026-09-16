import { useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useIvmetQuery } from '../useIvmetQuery';
import { equipmentLabel } from '../format';
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
          <dd>
            {equipmentLabel(equipment.equipment || equipment) || v.equipo_id}
          </dd>
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
      <button className="iv-back" onClick={back}>
        <ArrowLeft size={15} /> Volver a casos compartidos
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

// Casos de un solo cliente: la bandeja no mezcla expedientes de otras empresas.
// La ficha conserva el caso abierto, porque guardar recarga su contenido.
export function SharedCases({
  clientId,
  revision,
  onSaved,
  selected,
  setSelected,
}) {
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [status, setStatus] = useState('');
  const [dialog, setDialog] = useState(null);
  const query = useIvmetQuery(
    selected ? null : 'ops/cases',
    { clientId, search, page, ...(status ? { status } : {}) },
    revision,
    15000
  );
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
            title="Casos compartidos"
            description="Solo expedientes enviados expresamente por el jefe de calidad del cliente."
          />
          <div className="iv-toolbar">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Buscar por caso o código de balanza"
            />
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
          </div>
          <QueryState query={query}>
            {query.data?.items.length ? (
              <div className="iv-table-wrap">
                <table className="iv-table">
                  <thead>
                    <tr>
                      <th>Caso</th>
                      <th>Planta</th>
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
                        <td>{c.planta}</td>
                        <td>{equipmentLabel(c) || '—'}</td>
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
            )}
            {query.data && (
              <Pagination
                page={page}
                total={query.data.total}
                onChange={setPage}
              />
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
