import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, Loader2, ShieldCheck, X } from 'lucide-react';
import { ivmetApi } from '../api/ivmet';
import { createRequestId } from '../requestId';
import { useDialogMotion } from '../useDialogMotion';
import { IvSelect } from './IvSelect';

export function ActionDialog({ config, onClose, onSaved }) {
  const dialog = useRef(null);
  const [values, setValues] = useState(config.values);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const requestId = useRef(createRequestId());
  const { closing, close } = useDialogMotion(dialog, onClose);
  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (busy || closing) return;
    setBusy(true);
    setError(null);
    try {
      const payload = { ...values };
      for (const field of config.fields)
        if (field.type === 'integer')
          payload[field.name] = Number(payload[field.name]);
      await (config.ops ? ivmetApi.operate : ivmetApi.mutate)(config.action, payload, requestId.current);
      onSaved();
      close();
    } catch (e) {
      setError(e);
      const isUncertain = e.status === 0 || e.status >= 500;
      setUncertain(isUncertain);
      if (!isUncertain) requestId.current = createRequestId();
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="iv-dialog"
      data-state={closing ? 'closing' : 'open'}
      aria-labelledby="iv-action-title"
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
            <span className="iv-eyebrow">Gestión IvMET</span>
            <h2 id="iv-action-title">{config.title}</h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar formulario"
            className="iv-icon-button"
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        <div className="iv-dialog-body">
          <p className="iv-dialog-description">{config.description}</p>
          {config.codeInfo && (
            <div className="iv-generated-code">
              <span>Código del plan</span>
              <strong>{config.codeInfo}</strong>
            </div>
          )}
          <fieldset
            disabled={busy || uncertain || closing}
            className="iv-form-grid"
          >
            {config.fields.map((field) => (
              <div
                key={field.name}
                className={`iv-field ${field.wide ? 'wide' : ''}`}
              >
                <label
                  id={`iv-label-${field.name}`}
                  htmlFor={
                    field.type === 'multi'
                      ? undefined
                      : `iv-input-${field.name}`
                  }
                >
                  {field.label}
                  {field.required !== false && field.type !== 'checkbox' && (
                    <b> *</b>
                  )}
                </label>
                {field.type === 'select' ? (
                  <IvSelect
                    id={`iv-input-${field.name}`}
                    aria-labelledby={`iv-label-${field.name}`}
                    value={values[field.name] ?? ''}
                    onChange={(value) => set(field.name, value)}
                    required={field.required !== false}
                    disabled={busy || uncertain || closing}
                    options={field.options}
                  />
                ) : field.type === 'multi' ? (
                  <div
                    className="iv-checkbox-list"
                    role="group"
                    aria-labelledby={`iv-label-${field.name}`}
                  >
                    {field.options.map((o) => (
                      <label key={o.value} className="iv-check-row">
                        <input
                          aria-label={o.label}
                          type="checkbox"
                          checked={(values[field.name] || []).includes(o.value)}
                          onChange={(e) =>
                            set(
                              field.name,
                              e.target.checked
                                ? [...(values[field.name] || []), o.value]
                                : (values[field.name] || []).filter(
                                    (v) => v !== o.value
                                  )
                            )
                          }
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                ) : field.type === 'checkbox' ? (
                  <span className="iv-check-row">
                    <input
                      id={`iv-input-${field.name}`}
                      type="checkbox"
                      checked={Boolean(values[field.name])}
                      onChange={(e) => set(field.name, e.target.checked)}
                    />
                    {field.hint}
                  </span>
                ) : field.type === 'textarea' ? (
                  <textarea
                    id={`iv-input-${field.name}`}
                    rows={3}
                    value={values[field.name] ?? ''}
                    onChange={(e) => set(field.name, e.target.value)}
                    maxLength={field.maxLength || 3000}
                    required={field.required !== false}
                  />
                ) : (
                  <div className="iv-input-wrap">
                    <input
                      id={`iv-input-${field.name}`}
                      type={
                        field.type === 'password'
                          ? showPassword
                            ? 'text'
                            : 'password'
                          : field.type === 'integer'
                            ? 'number'
                            : field.type || 'text'
                      }
                      inputMode={field.decimal ? 'decimal' : undefined}
                      step={field.type === 'integer' ? 1 : undefined}
                      min={field.min}
                      max={field.max}
                      minLength={field.type === 'password' ? 12 : undefined}
                      maxLength={field.maxLength || 200}
                      value={values[field.name] ?? ''}
                      onChange={(e) => set(field.name, e.target.value)}
                      required={field.required !== false}
                      autoComplete={
                        field.type === 'password' ? 'new-password' : 'off'
                      }
                      readOnly={field.readOnly}
                    />
                    {field.type === 'password' && (
                      <button
                        type="button"
                        aria-label={
                          showPassword
                            ? 'Ocultar contraseña'
                            : 'Mostrar contraseña'
                        }
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    )}
                  </div>
                )}
                {field.hint && field.type !== 'checkbox' && (
                  <small>{field.hint}</small>
                )}
              </div>
            ))}
          </fieldset>
          {error && (
            <div className="iv-error" role="alert">
              <div>
                <strong>{error.message}</strong>
                {error.data?.issues?.map((i) => (
                  <p key={i.path}>
                    {config.fields.find((f) => f.name === i.path)?.label ||
                      i.path}
                    : {i.message}
                  </p>
                ))}
                {uncertain && (
                  <p>
                    La respuesta no pudo confirmarse. Reintenta con los mismos
                    datos; no se duplicará la operación.
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="iv-form-note">
            <ShieldCheck size={16} /> Esta operación quedará registrada en la
            auditoría del cliente.
          </div>
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
            className={`iv-button ${config.danger ? 'danger' : 'primary'}`}
            disabled={busy || closing}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {uncertain
              ? 'Reintentar solicitud'
              : config.submit || 'Guardar cambios'}
          </button>
        </footer>
      </form>
    </dialog>,
    document.body
  );
}
