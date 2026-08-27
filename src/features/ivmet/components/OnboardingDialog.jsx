import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, Search, X } from 'lucide-react';
import { ivmetApi } from '../api/ivmet';
import { createRequestId } from '../requestId';
import { ErrorBox } from './Ui';
import {
  groupEquipment,
  selectEquipment,
  selectionState,
} from '../equipmentSelection';
import { useDialogMotion } from '../useDialogMotion';

function SelectAll({ codes, selected, locked, onChange, label }) {
  const input = useRef(null);
  const countId = useId();
  const state = selectionState(codes, selected, locked);
  useEffect(() => {
    if (input.current) input.current.indeterminate = state.indeterminate;
  }, [state.indeterminate]);
  return (
    <label className="iv-check-row iv-select-all">
      <input
        ref={input}
        type="checkbox"
        aria-label={label}
        aria-describedby={countId}
        checked={state.checked}
        disabled={state.disabled}
        onChange={(event) => onChange(codes, event.target.checked)}
      />
      <span>
        {label}
        <small id={countId}>
          {state.count} de {state.total} seleccionadas
        </small>
      </span>
    </label>
  );
}

export function OnboardingDialog({
  onClose,
  onSaved,
  onExisting,
  scope = null,
}) {
  const dialog = useRef(null);
  const request = useRef(createRequestId());
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [plants, setPlants] = useState(scope?.plants || []);
  const [equipment, setEquipment] = useState(scope?.equipmentCodes || []);
  const [paid, setPaid] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(Boolean(scope));
  const [error, setError] = useState(null);
  const [uncertain, setUncertain] = useState(false);
  const [existing, setExisting] = useState(null);
  const { closing, close } = useDialogMotion(dialog, onClose);
  const groups = groupEquipment(catalog, plants);
  const visibleCodes = groups.flatMap((group) =>
    group.equipment.map((item) => item.code)
  );
  const locked = scope?.equipmentCodes || [];
  const selectMany = (codes, checked) =>
    setEquipment((current) => selectEquipment(current, codes, checked, locked));
  useEffect(() => {
    if (!scope) return;
    let cancelled = false;
    ivmetApi
      .read(`legacy/clients/${scope.legacy_cliente_id}/catalog`)
      .then(
        (value) => {
          if (!cancelled) setCatalog(value);
        },
        (failure) => {
          if (!cancelled) setError(failure);
        }
      )
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);
  const find = async () => {
    setBusy(true);
    setError(null);
    try {
      setClients(await ivmetApi.read('legacy/clients', { search }));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const choose = async (id) => {
    setBusy(true);
    setError(null);
    setExisting(null);
    try {
      const requests = await ivmetApi.read('onboarding', {
        legacyClientId: id,
      });
      if (requests.scopes.length) {
        setExisting(requests.scopes[0]);
        return;
      }
      setCatalog(await ivmetApi.read(`legacy/clients/${id}/catalog`));
      setPlants([]);
      setEquipment([]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const togglePlant = (code) => {
    setPlants((v) =>
      v.includes(code) ? v.filter((p) => p !== code) : [...v, code]
    );
    setEquipment((v) => v.filter((e) => e.slice(0, 7) !== code));
  };
  const submit = async (e) => {
    e.preventDefault();
    if (busy || closing) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ivmetApi.mutate(
        scope ? 'scope.extend' : 'scope.request',
        {
          ...(scope
            ? { id: scope.id, version: String(scope.row_version) }
            : {}),
          legacyClientId: catalog.client.id,
          clientCode: catalog.client.code,
          plantCodes: plants,
          equipmentCodes: equipment,
          paidConfirmed: paid,
          reason,
        },
        request.current
      );
      onSaved(result);
      close();
    } catch (e) {
      setError(e);
      if (e.data?.code === 'SCOPE_ALREADY_EXISTS') {
        try {
          const requests = await ivmetApi.read('onboarding', {
            legacyClientId: catalog.client.id,
          });
          setExisting(requests.scopes[0] || null);
        } catch {
          /* El mensaje original se conserva si la consulta falla. */
        }
      }
      const pending = e.status === 0 || e.status >= 500;
      setUncertain(pending);
      if (!pending) request.current = createRequestId();
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="iv-dialog wide-dialog"
      data-state={closing ? 'closing' : 'open'}
      aria-labelledby="iv-onboard-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (!busy) close();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <form onSubmit={submit}>
        <header>
          <div>
            <span className="iv-eyebrow">Incorporación selectiva</span>
            <h2 id="iv-onboard-title">
              {scope
                ? 'Ampliar plantas y balanzas'
                : 'Incorporar un cliente desde DataMET'}
            </h2>
          </div>
          <button
            type="button"
            className="iv-icon-button"
            aria-label="Cerrar incorporación"
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        <div className="iv-dialog-body">
          <p className="iv-dialog-description">
            Solo se sincronizarán las plantas y balanzas que selecciones. No se
            importa todo DataMET.
            {scope &&
              ' Las incorporaciones anteriores se conservan. Para bloquear una balanza utiliza su configuración IvMET.'}
          </p>
          {existing && (
            <div className="iv-notice" role="status">
              <strong>
                El cliente {existing.legacy_codigo_cliente} ya tiene una
                incorporación.
              </strong>
              <p>
                No necesitas solicitarlo otra vez. Consulta el avance o amplía
                su selección existente.
              </p>
              <button
                type="button"
                className="iv-button secondary"
                onClick={() => onExisting(existing.id)}
              >
                Ver incorporación existente
              </button>
            </div>
          )}
          <fieldset disabled={busy || uncertain || closing}>
            {!catalog && scope ? (
              <p>Consultando el catálogo de este cliente en DataMET…</p>
            ) : !catalog ? (
              <>
                <div className="iv-toolbar">
                  <input
                    aria-label="Buscar cliente en DataMET"
                    placeholder="Nombre o código del cliente"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button
                    type="button"
                    className="iv-button primary"
                    disabled={search.trim().length < 2}
                    onClick={find}
                  >
                    <Search size={16} /> Buscar
                  </button>
                </div>
                <div className="iv-legacy-results">
                  {clients.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => choose(c.id)}
                    >
                      <span className="code">{c.code}</span>
                      <strong>{c.name || c.legalName}</strong>
                      <span>Seleccionar</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="iv-selected-customer">
                  <Check size={18} />
                  <strong>
                    {catalog.client.code} · {catalog.client.name}
                  </strong>
                  <button
                    type="button"
                    className="iv-link"
                    disabled={Boolean(scope)}
                    onClick={() => setCatalog(null)}
                  >
                    Cambiar
                  </button>
                </div>
                <div className="iv-onboarding-grid">
                  <section>
                    <h3>1. Plantas contratadas</h3>
                    <div className="iv-checkbox-list">
                      {catalog.plants.map((p) => (
                        <label key={p.code} className="iv-check-row">
                          <input
                            type="checkbox"
                            disabled={scope?.plants.includes(p.code)}
                            checked={plants.includes(p.code)}
                            onChange={() => togglePlant(p.code)}
                          />
                          <span>
                            {p.code}
                            <small>{p.name}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h3>2. Balanzas incluidas</h3>
                    <SelectAll
                      codes={visibleCodes}
                      selected={equipment}
                      locked={locked}
                      onChange={selectMany}
                      label="Seleccionar todas las balanzas"
                    />
                    <div className="iv-equipment-groups">
                      {!groups.length && (
                        <p className="iv-selection-empty">
                          Selecciona una planta para ver sus balanzas.
                        </p>
                      )}
                      {groups.map((group) => (
                        <section
                          key={group.code}
                          className="iv-equipment-group"
                          aria-label={`Balanzas de ${group.name || group.code}`}
                        >
                          <header>
                            <div>
                              <strong>{group.name || 'Planta'}</strong>
                              <small className="code">{group.code}</small>
                            </div>
                            <span>{group.equipment.length} balanzas</span>
                          </header>
                          <SelectAll
                            codes={group.equipment.map((item) => item.code)}
                            selected={equipment}
                            locked={locked}
                            onChange={selectMany}
                            label={`Seleccionar toda la planta ${group.code}`}
                          />
                          {!group.equipment.length && (
                            <p className="iv-selection-empty">
                              Sin balanzas disponibles en esta planta.
                            </p>
                          )}
                          {group.equipment.map((e) => (
                            <label
                              key={e.id || e.code}
                              className="iv-check-row iv-equipment-option"
                            >
                              <input
                                type="checkbox"
                                disabled={locked.includes(e.code)}
                                checked={equipment.includes(e.code)}
                                onChange={(event) =>
                                  selectMany([e.code], event.target.checked)
                                }
                              />
                              <span>
                                <strong className="code">{e.code}</strong>
                                <small>
                                  {e.name} · {e.brand} · {e.status}
                                </small>
                              </span>
                              {locked.includes(e.code) && (
                                <span className="iv-locked-label">
                                  Incluida
                                </span>
                              )}
                            </label>
                          ))}
                        </section>
                      ))}
                    </div>
                  </section>
                </div>
                <label className="iv-field">
                  <span>Referencia del contrato/pago y motivo</span>
                  <textarea
                    required
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <label className="iv-check-row iv-notice">
                  <input
                    type="checkbox"
                    required
                    checked={paid}
                    onChange={(e) => setPaid(e.target.checked)}
                  />{' '}
                  Confirmo que el cliente contrató el servicio y se verificó su
                  pago.
                </label>
                <p className="iv-subtle">
                  El worker corporativo procesará esta solicitud en su siguiente
                  ciclo. La solicitud no crea usuarios ni licencias por sí sola.
                </p>
              </>
            )}
          </fieldset>
          {busy && (
            <div className="iv-loading">
              <Loader2 size={18} className="animate-spin" /> Procesando…
            </div>
          )}
          {error && <ErrorBox error={error} />}
        </div>
        <footer>
          <button
            type="button"
            className="iv-button secondary"
            disabled={busy}
            onClick={close}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="iv-button primary"
            disabled={
              busy ||
              closing ||
              !catalog ||
              !plants.length ||
              !equipment.length ||
              !paid ||
              Boolean(existing)
            }
          >
            {uncertain ? 'Reintentar solicitud' : 'Solicitar sincronización'}
          </button>
        </footer>
      </form>
    </dialog>,
    document.body
  );
}
