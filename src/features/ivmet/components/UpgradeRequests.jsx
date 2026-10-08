import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useIvmetQuery } from '../useIvmetQuery';
import { dateText, requestSummary } from '../format';
import { Badge, Empty, Pagination, QueryState, SearchInput, SectionTitle } from './Ui';
import { RequestContact } from './RequestContact';

const filters = [
  ['OPEN', 'Abiertas'],
  ['CLOSED', 'Cerradas'],
  ['', 'Todas'],
];

// Bandeja de solicitudes de plan superior que las empresas envían desde la
// app. Atender marca el contacto; cambiar el plan, desde la ficha del
// cliente, la cierra sola.
export function UpgradeRequests({ revision, open, onClient }) {
  const [state, setState] = useState('OPEN');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useIvmetQuery(
    'upgrade-requests',
    { state: state || undefined, search, page },
    revision,
    30000
  );
  return (
    <>
      <SectionTitle
        eyebrow="CRECIMIENTO"
        title="Solicitudes de plan"
        description="Empresas que pidieron un plan superior desde la app. Contacta, acuerda las condiciones y cambia el plan en la ficha del cliente."
      />
      <div className="iv-toolbar">
        <div className="iv-segmented" role="group" aria-label="Filtrar solicitudes">
          {filters.map(([value, label]) => (
            <button
              key={value || 'all'}
              aria-pressed={state === value}
              onClick={() => {
                setState(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Buscar por empresa, código, contacto o correo"
        />
      </div>
      <QueryState query={query}>
        {query.data?.items.length ? (
          <div className="iv-table-wrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Pidió</th>
                  <th>Contacto</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button className="iv-link" onClick={() => onClient(r.client.id)}>
                        {r.client.name} <ArrowUpRight size={13} />
                      </button>
                      <small>
                        <span className="code">{r.client.code}</span> · desde el plan{' '}
                        {r.currentPlan?.name || '—'}
                      </small>
                      {r.client.origin === 'AUTOREGISTRO' && <Badge value="AUTOREGISTRO" />}
                    </td>
                    <td>
                      {requestSummary(r)}
                      {r.message && <small className="iv-quote">«{r.message}»</small>}
                    </td>
                    <td>
                      <RequestContact request={r} />
                    </td>
                    <td>
                      {dateText(r.createdAt)}
                      {r.attendedAt && <small>Atendida {dateText(r.attendedAt)}</small>}
                    </td>
                    <td>
                      <Badge value={r.result || r.state} />
                      {r.note && <small>{r.note}</small>}
                    </td>
                    <td>
                      {['PENDING', 'CONTACTED'].includes(r.state) && (
                        <button
                          className="iv-button secondary small"
                          onClick={() => open('upgrade.attend', { record: r })}
                        >
                          Atender
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={query.data.total} onChange={setPage} />
          </div>
        ) : (
          <Empty
            title={state === 'OPEN' ? 'No hay solicitudes abiertas' : 'No hay solicitudes'}
            text="Cuando una empresa pida un plan superior desde la app aparecerá aquí con su contacto."
          />
        )}
      </QueryState>
    </>
  );
}
