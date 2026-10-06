import { useEffect, useId, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { calibrationApi } from '../api/calibration';
import { ALERT_FREQUENCIES, EMAIL_ALERTS_UI, alertSummary, formatDate, hasOwnAlert } from '../domain/format';
import { Dropdown } from './Dropdown';
import { FieldLabel, Segmented, Switch } from './primitives';

/** Responsable de una serie: el personal de Calibración aparece primero. */
export function ResponsableSelect({ id, value, fallbackName, onChange, personal, disabled, emptyLabel = 'Sin responsable' }) {
  const options = useMemo(() => {
    const list = [{ value: '', label: emptyLabel }];
    if (value != null && !personal.some(persona => persona.id === value)) {
      list.push({ value, label: fallbackName || 'Responsable anterior' });
    }
    for (const persona of personal) {
      list.push({
        value: persona.id,
        label: persona.nombre,
        hint: persona.esCalibracion ? undefined : persona.area,
        group: persona.esCalibracion ? 'Calibración' : 'Otras áreas',
      });
    }
    return list;
  }, [emptyLabel, fallbackName, personal, value]);

  return (
    <Dropdown
      id={id}
      value={value ?? ''}
      onChange={(next) => onChange(next === '' || next == null ? null : Number(next))}
      options={options}
      ariaLabel="Responsable"
      disabled={disabled}
    />
  );
}

const DAY_PRESETS = [7, 15, 30, 60];

/** Días de anticipación con atajos (7 d, 15 d, 1 mes, 2 meses). */
export function AnticipationField({ id, value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          min={0}
          max={365}
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Math.max(0, Math.min(365, Number(event.target.value) || 0)))}
          className="field h-11 w-20 text-center font-medium tabular-nums"
        />
        <span className="text-[13px] text-fg-muted">días antes</span>
      </div>
      <div className="flex gap-1">
        {DAY_PRESETS.map(dias => (
          <button
            key={dias}
            type="button"
            disabled={disabled}
            onClick={() => onChange(dias)}
            aria-pressed={value === dias}
            className={cn(
              'h-8 rounded-lg px-2.5 text-xs font-medium tabular-nums transition-colors disabled:opacity-50',
              value === dias ? 'bg-fg text-canvas' : 'text-fg-muted hover:bg-fg/[0.06] hover:text-fg'
            )}
          >
            {dias === 30 ? '1 mes' : dias === 60 ? '2 meses' : `${dias} d`}
          </button>
        ))}
      </div>
    </div>
  );
}

// Frecuencia que se recupera al volver a activar los avisos.
const reactivatedFrequency = (...candidates) => candidates.find(item => item && item !== 'NINGUNA') || 'SEMANAL';

/**
 * Avisos de una serie. Con "usar los avisos generales" los tres valores quedan
 * en null y la serie sigue a los ajustes del módulo aunque estos cambien.
 */
export function AlertFields({ value, onChange, ajustes, disabled }) {
  const baseId = useId();
  const inherit = !hasOwnAlert(value);
  const effective = {
    dias: value.alertaDias ?? ajustes.alertaDias,
    frecuencia: value.alertaFrecuencia ?? ajustes.alertaFrecuencia,
    correo: value.alertaCorreo ?? ajustes.alertaCorreo,
  };
  const active = effective.frecuencia !== 'NINGUNA';
  const setInherit = (next) => {
    onChange(next
      ? { alertaDias: null, alertaFrecuencia: null, alertaCorreo: null }
      : { alertaDias: effective.dias, alertaFrecuencia: effective.frecuencia, alertaCorreo: effective.correo });
  };
  const update = (patch) => onChange({
    alertaDias: effective.dias,
    alertaFrecuencia: effective.frecuencia,
    alertaCorreo: effective.correo,
    ...patch,
  });

  return (
    <div className="flex flex-col gap-4">
      <Switch
        label="Usar los avisos generales"
        description={alertSummary({ dias: ajustes.alertaDias, frecuencia: ajustes.alertaFrecuencia, correo: ajustes.alertaCorreo })}
        checked={inherit}
        onChange={setInherit}
        disabled={disabled}
      />
      {!inherit && (
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-xs">
          {!EMAIL_ALERTS_UI && (
            <Switch
              label="Avisar en el cronograma"
              description="Aparece en «Requieren atención» y en el contador de la barra lateral."
              checked={active}
              onChange={(on) => update({
                alertaFrecuencia: on ? reactivatedFrequency(value.alertaFrecuencia, ajustes.alertaFrecuencia) : 'NINGUNA',
              })}
              disabled={disabled}
            />
          )}
          {active && (
            <div>
              <FieldLabel htmlFor={`${baseId}-dias`}>Empezar a avisar</FieldLabel>
              <AnticipationField
                id={`${baseId}-dias`}
                value={effective.dias}
                onChange={(dias) => update({ alertaDias: dias })}
                disabled={disabled}
              />
            </div>
          )}
          {EMAIL_ALERTS_UI && (
            <>
              <div>
                <p className="field-label">Repetir el aviso</p>
                <Segmented
                  label="Repetir el aviso"
                  value={effective.frecuencia}
                  onChange={(frecuencia) => update({ alertaFrecuencia: frecuencia })}
                  options={ALERT_FREQUENCIES}
                  disabled={disabled}
                />
              </div>
              <Switch
                label="Enviar también por correo"
                description="Al responsable y a quienes reciben todas las alertas."
                checked={effective.correo}
                onChange={(correo) => update({ alertaCorreo: correo })}
                disabled={disabled || !active}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Próximas fechas que generará una configuración antes de guardarla. */
export function DatePreview({ request, title = 'Próximas fechas' }) {
  const [state, setState] = useState({ key: null, loading: false, fechas: [], error: false });
  const key = request ? JSON.stringify(request) : null;

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      setState(current => ({ ...current, key, loading: true }));
      try {
        const fechas = await calibrationApi.preview(JSON.parse(key));
        if (active) setState({ key, loading: false, fechas, error: false });
      } catch {
        if (active) setState({ key, loading: false, fechas: [], error: true });
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);

  if (!key) return null;
  const current = state.key === key;
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-xs" aria-live="polite">
      <p className="flex items-center gap-2 text-xs font-medium text-fg-muted">
        {title}
        {(!current || state.loading) && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Calculando" />}
      </p>
      {current && !state.loading && (
        state.error ? (
          <p className="mt-1.5 text-[13px] text-fg-muted">No se pudo calcular la vista previa.</p>
        ) : state.fechas.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-fg-muted">Con esta configuración no hay fechas en los próximos 3 años.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {state.fechas.map(({ fecha, proyectado }) => (
              <li
                key={fecha}
                className={cn(
                  'rounded-lg px-2 py-1 text-xs font-medium tabular-nums',
                  proyectado ? 'border border-dashed border-line-strong text-fg-muted' : 'bg-surface-2 text-fg'
                )}
                title={proyectado ? 'Estimada: depende de la próxima calibración' : undefined}
              >
                {formatDate(fecha)}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
