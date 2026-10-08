import React from 'react';
import { ArrowUpRight, Check, Lock } from 'lucide-react';
import { dateText, planFeatures, planResources, requestSummary } from '../format';
import { Badge, SectionTitle } from './Ui';
import { RequestContact } from './RequestContact';

// Plan vigente del cliente, cuánto usa de cada límite y lo que pidió desde
// la app. Cambiar de plan conserva el acceso; el cobro sigue en contrato y
// facturas.
export function PlanUsage({ workspace, open }) {
  const plan = workspace.plan;
  const usage = workspace.usage || {};
  const requests = workspace.upgradeRequests || [];
  const subscription = workspace.subscriptions.find((s) => s.id === plan?.subscriptionId);
  if (!plan) return null;
  const used = (key) =>
    key === 'monthlyVerifications'
      ? Number(usage.monthlyVerifications || 0) + Number(usage.openDrafts || 0)
      : Number(usage[key] || 0);
  const limitOf = (key) => (key === 'users' ? plan.seatsAvailable : plan.limits?.[key]);
  return (
    <>
      <SectionTitle
        title="Plan y uso"
        description="Límites del plan contra lo que el cliente usa hoy. Las verificaciones del mes incluyen las capturas en curso."
        action={
          subscription && (
            <button
              className="iv-button primary"
              onClick={() => open('subscription.change-plan', subscription)}
            >
              <ArrowUpRight size={16} /> Cambiar plan
            </button>
          )
        }
      />
      <article className="iv-plan-usage">
        <header>
          <div>
            <span className="iv-eyebrow">Plan vigente</span>
            <h3>{plan.name}</h3>
            <p>
              {plan.catalog?.summary || 'Plan comercial IvMET'} · Período hasta{' '}
              {dateText(plan.periodEndsAt || (subscription?.fin_periodo ?? null))}
            </p>
          </div>
          <Badge value={plan.subscriptionStatus} />
        </header>
        <div className="iv-usage-grid">
          {planResources.map(([key, label]) => {
            const limit = limitOf(key);
            const value = used(key);
            const full = limit != null && value >= Number(limit);
            return (
              <div key={key} className={full ? 'full' : undefined}>
                <span>{label}</span>
                <strong>
                  {value}
                  <small>{limit == null ? ' · sin límite' : ` / ${limit}`}</small>
                </strong>
                {limit != null && (
                  <div className="iv-seat-bar">
                    <i style={{ width: `${Math.min(100, (value / Math.max(1, Number(limit))) * 100)}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <footer>
          {planFeatures.map(([key, label]) => (
            <span key={key} className={plan.features?.[key] ? 'on' : 'off'}>
              {plan.features?.[key] ? <Check size={14} /> : <Lock size={14} />} {label}
            </span>
          ))}
        </footer>
      </article>
      {requests.length > 0 && (
        <>
          <SectionTitle
            title="Solicitudes de plan"
            description="Lo que el cliente pidió desde la app. Cambiar el plan cierra las abiertas."
          />
          <div className="iv-table-wrap">
            <table className="iv-table">
              <thead>
                <tr>
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
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {requestSummary(r)}
                      {r.message && <small className="iv-quote">«{r.message}»</small>}
                    </td>
                    <td>
                      <RequestContact request={r} />
                    </td>
                    <td>{dateText(r.createdAt)}</td>
                    <td>
                      <Badge value={r.result || r.state} />
                      {r.note && <small>{r.note}</small>}
                    </td>
                    <td>
                      {['PENDING', 'CONTACTED'].includes(r.state) && (
                        <button
                          className="iv-button secondary small"
                          onClick={() =>
                            open('upgrade.attend', {
                              ...r,
                              client: { name: workspace.client.nombre || workspace.client.codigo },
                            })
                          }
                        >
                          Atender
                        </button>
                      )}
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
