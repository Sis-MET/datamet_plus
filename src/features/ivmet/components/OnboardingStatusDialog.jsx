import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useIvmetQuery } from '../useIvmetQuery';
import { useDialogMotion } from '../useDialogMotion';
import { ivmetApi } from '../api/ivmet';
import { createRequestId } from '../requestId';
import { syncDescription, syncDateTime, issueText } from '../onboarding';
import { Badge, ErrorBox, QueryState } from './Ui';
import { WorkerStatus } from './WorkerStatus';

export function OnboardingStatusDialog({
  scopeId,
  onClose,
  onClient,
  onExtend,
  onSaved,
}) {
  const dialog = useRef(null);
  const requestId = useRef(createRequestId());
  const [revision, setRevision] = useState(0);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [uncertain, setUncertain] = useState(false);
  const query = useIvmetQuery('onboarding', { scopeId }, revision, 10000);
  const scope = query.data?.scopes[0];
  const { closing, close } = useDialogMotion(dialog, onClose);
  const retry = async (event) => {
    event.preventDefault();
    if (busy || closing) return;
    setBusy(true);
    setError(null);
    try {
      await ivmetApi.mutate(
        'scope.retry',
        { id: scopeId, reason },
        requestId.current
      );
      requestId.current = createRequestId();
      setReason('');
      setUncertain(false);
      setRevision((value) => value + 1);
      onSaved();
    } catch (failure) {
      setError(failure);
      const pending = failure.status === 0 || failure.status >= 500;
      setUncertain(pending);
      if (!pending) requestId.current = createRequestId();
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="iv-dialog wide-dialog iv-tracking-dialog"
      data-state={closing ? 'closing' : 'open'}
      aria-labelledby="iv-onboarding-status-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <header>
        <div>
          <span className="iv-eyebrow">Seguimiento de incorporación</span>
          <h2 id="iv-onboarding-status-title">
            {scope
              ? `${scope.legacy_codigo_cliente} · ${scope.client_name || 'Cliente'}`
              : 'Estado de la solicitud'}
          </h2>
        </div>
        <button
          className="iv-icon-button"
          aria-label="Cerrar seguimiento"
          disabled={busy}
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      <div className="iv-dialog-body">
        <QueryState query={query}>
          {scope ? (
            <>
              <WorkerStatus
                workers={query.error ? [] : query.data.workers}
                scopeId={scopeId}
              />
              <div className="iv-sync-summary">
                <Badge value={scope.syncStatus} />
                <p>{syncDescription(scope)}</p>
              </div>
              <dl className="iv-sync-details">
                <div>
                  <dt>Plantas autorizadas</dt>
                  <dd>{scope.plants.join(', ')}</dd>
                </div>
                <div>
                  <dt>Balanzas seleccionadas</dt>
                  <dd>{scope.equipmentCount}</dd>
                </div>
                <div>
                  <dt>Solicitud registrada</dt>
                  <dd>{syncDateTime(scope.solicitado_at)}</dd>
                </div>
                <div>
                  <dt>Última importación completa</dt>
                  <dd>{syncDateTime(scope.lastCompletedAt)}</dd>
                </div>
                <div>
                  <dt>Próximo intento / actualización</dt>
                  <dd>
                    {scope.syncStatus === 'RUNNING'
                      ? 'En curso'
                      : syncDateTime(scope.nextAttemptAt)}
                  </dd>
                </div>
                <div>
                  <dt>Último resultado</dt>
                  <dd>
                    {scope.lastRun
                      ? `${scope.lastRun.accepted} importados · ${scope.lastRun.unchanged} sin cambios · ${scope.lastRun.rejected} rechazados`
                      : 'Todavía no procesado'}
                  </dd>
                </div>
              </dl>
              {scope.issueCount > 0 && (
                <section>
                  <h3>Incidencias del último intento ({scope.issueCount})</h3>
                  <ul className="iv-sync-issues">
                    {scope.issues.map((issue, index) => (
                      <li key={`${issue.source_key}-${index}`}>
                        <strong className="code">{issue.source_key}</strong>
                        <span>{issueText(issue.reason_code)}</span>
                      </li>
                    ))}
                  </ul>
                  {scope.issueCount > scope.issues.length && (
                    <p className="iv-subtle">
                      Se muestran las primeras {scope.issues.length}. El
                      registro completo se conserva en el servidor.
                    </p>
                  )}
                </section>
              )}
              {(['FAILED', 'PARTIAL', 'RETRYING'].includes(scope.syncStatus) ||
                uncertain) && (
                <form onSubmit={retry} className="iv-sync-retry">
                  <label className="iv-field">
                    <span>Motivo para adelantar el reintento</span>
                    <input
                      required
                      maxLength={1000}
                      value={reason}
                      disabled={busy || uncertain}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </label>
                  <button
                    className="iv-button secondary"
                    disabled={busy || closing || !reason.trim()}
                  >
                    {busy
                      ? 'Encolando…'
                      : uncertain
                        ? 'Confirmar reintento'
                        : 'Reintentar ahora'}
                  </button>
                  <p className="iv-subtle">
                    Encola otro intento; no ejecuta comandos ni modifica
                    DataMET.
                  </p>
                </form>
              )}
            </>
          ) : (
            <p>
              Esta solicitud ya no está disponible. Actualiza el directorio.
            </p>
          )}
        </QueryState>
        {error && <ErrorBox error={error} />}
      </div>
      <footer>
        <button className="iv-button secondary" disabled={busy} onClick={close}>
          Cerrar
        </button>
        {scope && ['REQUESTED', 'ACTIVE'].includes(scope.estado) && (
          <button
            className="iv-button secondary"
            disabled={busy || uncertain}
            onClick={() => onExtend(scope)}
          >
            Ampliar alcance
          </button>
        )}
        {scope?.supabase_cliente_id && (
          <button
            className="iv-button primary"
            disabled={busy}
            onClick={() => onClient(scope.supabase_cliente_id)}
          >
            Abrir cliente
          </button>
        )}
      </footer>
    </dialog>,
    document.body
  );
}
