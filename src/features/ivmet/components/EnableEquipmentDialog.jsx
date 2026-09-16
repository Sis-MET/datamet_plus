import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { ivmetApi } from '../api/ivmet';
import { createRequestId } from '../requestId';
import { useDialogMotion } from '../useDialogMotion';
import {
  canEnable,
  enableCandidates,
  selectEquipment,
} from '../equipmentSelection';
import { ErrorBox, SearchInput } from './Ui';
import { SelectAll } from './SelectAll';

// El servidor acepta hasta 500 balanzas por solicitud.
const BATCH = 500;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

async function loadCandidates(clientId) {
  const items = [];
  for (let page = 1; page <= 100; page++) {
    const data = await ivmetApi.read(`clients/${clientId}/equipment`, {
      status: 'READY',
      page,
      pageSize: 100,
    });
    items.push(...data.items);
    if (!data.items.length || items.length >= data.total) break;
  }
  return items.filter(canEnable);
}

function Option({ equipment: e, detail, checked, onChange }) {
  return (
    <label className="iv-check-row iv-equipment-option">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange([e.id], event.target.checked)}
      />
      <span>
        <strong className="code">{e.cod_metrica}</strong>
        <small>
          {[
            detail,
            e.instrumento || 'Instrumento de pesaje',
            [e.marca, e.modelo].filter(Boolean).join(' '),
          ]
            .filter(Boolean)
            .join(' · ')}
        </small>
      </span>
    </label>
  );
}

export function EnableEquipmentDialog({
  clientId,
  client,
  plants,
  onClose,
  onSaved,
}) {
  const dialog = useRef(null);
  const requests = useRef({ key: '', ids: [] });
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [uncertain, setUncertain] = useState(false);
  const { closing, close } = useDialogMotion(dialog, onClose);
  useEffect(() => {
    let cancelled = false;
    loadCandidates(clientId).then(
      (value) => {
        if (!cancelled) setItems(value);
      },
      (failure) => {
        if (!cancelled) setError(failure);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [clientId]);
  const { groups, suspended } = enableCandidates(items || [], plants, search);
  const pending = groups.flatMap((group) => group.equipment.map((e) => e.id));
  const reactivated = (items || []).filter(
    (e) => e.estado_configuracion === 'SUSPENDED' && selected.includes(e.id)
  ).length;
  const selectMany = (ids, checked) =>
    setSelected((current) => selectEquipment(current, ids, checked));
  const plantCode = (e) =>
    plants.find((p) => p.id === e.planta_id)?.legacy_codigo_planta;
  const submit = async (event) => {
    event.preventDefault();
    if (busy || closing || !selected.length) return;
    const ids = [...selected].sort();
    const batches = [];
    for (let i = 0; i < ids.length; i += BATCH)
      batches.push(ids.slice(i, i + BATCH));
    // Reintentar la misma selección reutiliza las solicitudes: no se duplica nada.
    if (requests.current.key !== ids.join())
      requests.current = {
        key: ids.join(),
        ids: batches.map(() => createRequestId()),
      };
    setBusy(true);
    setError(null);
    try {
      let changed = 0;
      for (const [index, batch] of batches.entries()) {
        const result = await ivmetApi.mutate(
          'equipment.bulk-configure',
          { clientId, enabled: true, ids: batch },
          requests.current.ids[index]
        );
        changed += Number(result?.changed) || 0;
      }
      onSaved(
        changed
          ? plural(changed, 'balanza habilitada', 'balanzas habilitadas')
          : 'Las balanzas ya estaban habilitadas.'
      );
      close();
    } catch (failure) {
      setError(failure);
      const pendingAnswer = failure.status === 0 || failure.status >= 500;
      setUncertain(pendingAnswer);
      if (!pendingAnswer) {
        // Una balanza cambió mientras el diálogo estaba abierto: se recarga la lista.
        requests.current = { key: '', ids: [] };
        loadCandidates(clientId).then((value) => {
          setItems(value);
          setSelected((current) =>
            current.filter((id) => value.some((e) => e.id === id))
          );
        }, setError);
      }
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="iv-dialog"
      data-state={closing ? 'closing' : 'open'}
      aria-labelledby="iv-enable-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (!busy) close();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <form onSubmit={submit}>
        <header>
          <div>
            <span className="iv-eyebrow">Cliente {client.codigo}</span>
            <h2 id="iv-enable-title">Habilitar balanzas</h2>
          </div>
          <button
            type="button"
            className="iv-icon-button"
            aria-label="Cerrar habilitación de balanzas"
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        <div className="iv-dialog-body">
          <p className="iv-dialog-description">
            Elige las balanzas validadas que{' '}
            {client.nombre || client.razon_social || 'el cliente'} podrá
            configurar en su app. Las que requieren revisión en DataMET
            aparecerán aquí cuando se corrijan.
          </p>
          {!items ? (
            !error && (
              <div className="iv-loading" role="status">
                <Loader2 size={18} className="animate-spin" /> Consultando las
                balanzas del cliente…
              </div>
            )
          ) : !items.length ? (
            <p className="iv-selection-empty">
              Todas las balanzas validadas de este cliente ya están habilitadas.
            </p>
          ) : (
            <fieldset disabled={busy || uncertain || closing}>
              <div className="iv-toolbar">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Código, marca o modelo"
                />
              </div>
              {pending.length > 0 && (
                <SelectAll
                  codes={pending}
                  selected={selected}
                  onChange={selectMany}
                  label="Seleccionar todas las pendientes"
                />
              )}
              <div className="iv-equipment-groups">
                {!pending.length && !suspended.length && (
                  <p className="iv-selection-empty">
                    Ninguna balanza coincide con la búsqueda.
                  </p>
                )}
                {groups.map((group) => (
                  <section
                    key={group.id}
                    className="iv-equipment-group"
                    aria-label={`Balanzas de ${group.name}`}
                  >
                    <header>
                      <div>
                        <strong>{group.name}</strong>
                        <small className="code">{group.code}</small>
                      </div>
                      <span>
                        {plural(group.equipment.length, 'balanza', 'balanzas')}
                      </span>
                    </header>
                    {groups.length > 1 && (
                      <SelectAll
                        codes={group.equipment.map((e) => e.id)}
                        selected={selected}
                        onChange={selectMany}
                        label={`Seleccionar la planta ${group.code || group.name}`}
                      />
                    )}
                    {group.equipment.map((e) => (
                      <Option
                        key={e.id}
                        equipment={e}
                        checked={selected.includes(e.id)}
                        onChange={selectMany}
                      />
                    ))}
                  </section>
                ))}
                {suspended.length > 0 && (
                  <details className="iv-equipment-group iv-suspended-equipment">
                    <summary>
                      {plural(suspended.length, 'balanza suspendida', 'balanzas suspendidas')}
                      <small>
                        {suspended.length === 1
                          ? 'Se suspendió a propósito. Márcala solo si el cliente debe volver a usarla.'
                          : 'Se suspendieron a propósito. Márcalas solo si el cliente debe volver a usarlas.'}
                      </small>
                    </summary>
                    {suspended.map((e) => (
                      <Option
                        key={e.id}
                        equipment={e}
                        detail={plantCode(e)}
                        checked={selected.includes(e.id)}
                        onChange={selectMany}
                      />
                    ))}
                  </details>
                )}
              </div>
            </fieldset>
          )}
          {reactivated > 0 && (
            <p className="iv-notice">
              {reactivated === 1
                ? 'La selección incluye una balanza suspendida: el cliente volverá a verla en su app.'
                : `La selección incluye ${reactivated} balanzas suspendidas: el cliente volverá a verlas en su app.`}
            </p>
          )}
          {error && <ErrorBox error={error} />}
          {uncertain && (
            <p className="iv-subtle">
              La respuesta no pudo confirmarse. Reintenta con la misma selección;
              no se habilitará nada dos veces.
            </p>
          )}
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
            disabled={busy || closing || !selected.length}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {uncertain
              ? 'Reintentar'
              : selected.length
                ? `Habilitar ${plural(selected.length, 'balanza', 'balanzas')}`
                : 'Habilitar'}
          </button>
        </footer>
      </form>
    </dialog>,
    document.body
  );
}
