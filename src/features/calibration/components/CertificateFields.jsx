import { useState } from 'react';
import { PERIODOS_CERTIFICADO, periodLabel } from '../domain/format';
import { Dropdown, SuggestInput } from './Dropdown';
import { FieldLabel } from './primitives';

const OTRO = 'OTRO';
const PERIOD_OPTIONS = [
  ...PERIODOS_CERTIFICADO.map(dias => ({ value: dias, label: periodLabel(dias), hint: `${dias} días` })),
  { value: OTRO, label: 'Otro plazo…' },
];

/** Vigencia del certificado: plazos habituales o un número de días. */
export function PeriodField({ id, value, onChange, disabled, error }) {
  const [custom, setCustom] = useState(() => value != null && !PERIODOS_CERTIFICADO.includes(Number(value)));
  return (
    <div className="space-y-2">
      <Dropdown
        id={id}
        value={custom ? OTRO : value}
        onChange={(next) => {
          if (next === OTRO) {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(Number(next));
        }}
        options={PERIOD_OPTIONS}
        ariaLabel="Vigencia del certificado"
        disabled={disabled}
      />
      {custom && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={3650}
            inputMode="numeric"
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value === '' ? null : Math.max(0, Math.min(3650, Number(event.target.value))))}
            disabled={disabled}
            aria-label="Vigencia en días"
            aria-invalid={error ? true : undefined}
            className={error ? 'field field-invalid h-11 w-28 text-center font-medium tabular-nums' : 'field h-11 w-28 text-center font-medium tabular-nums'}
          />
          <span className="text-[13px] text-fg-muted">días</span>
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/** Datos de un certificado tal como figuran en el documento emitido. */
export function CertificateFields({ value, onChange, errors = {}, entes = [], hoy, idPrefix, disabled, autoFocus, withNotes }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-5">
      <div>
        <FieldLabel htmlFor={`${idPrefix}-numero`}>Número de certificado</FieldLabel>
        <input
          id={`${idPrefix}-numero`}
          data-autofocus={autoFocus || undefined}
          value={value.numero}
          maxLength={100}
          onChange={(event) => set({ numero: event.target.value })}
          placeholder="Ej.: LP-CC-M-0217-2026"
          disabled={disabled}
          autoComplete="off"
          aria-invalid={errors.numero ? true : undefined}
          className={errors.numero ? 'field field-invalid h-11 font-medium' : 'field h-11 font-medium'}
        />
        {errors.numero && <p className="field-error">{errors.numero}</p>}
      </div>
      <div>
        <FieldLabel htmlFor={`${idPrefix}-ente`}>Ente calibrador</FieldLabel>
        <SuggestInput
          id={`${idPrefix}-ente`}
          value={value.ente}
          onChange={(ente) => set({ ente })}
          suggestions={entes}
          maxLength={50}
          placeholder="Ej.: IBMETRO"
          disabled={disabled}
        />
        {errors.ente && <p className="field-error">{errors.ente}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${idPrefix}-fecha`}>Fecha de emisión</FieldLabel>
          <input
            id={`${idPrefix}-fecha`}
            type="date"
            value={value.fecha}
            max={hoy}
            onChange={(event) => set({ fecha: event.target.value })}
            disabled={disabled}
            aria-invalid={errors.fecha ? true : undefined}
            className={errors.fecha ? 'field field-invalid h-11 font-medium tabular-nums' : 'field h-11 font-medium tabular-nums'}
          />
          {errors.fecha && <p className="field-error">{errors.fecha}</p>}
        </div>
        <div>
          <FieldLabel htmlFor={`${idPrefix}-periodo`}>Vigencia</FieldLabel>
          <PeriodField
            id={`${idPrefix}-periodo`}
            value={value.periodoDias}
            onChange={(periodoDias) => set({ periodoDias })}
            disabled={disabled}
            error={errors.periodoDias}
          />
        </div>
      </div>
      {withNotes && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor={`${idPrefix}-obs`} hint="(opcional)">Observaciones</FieldLabel>
            <span className="mb-1.5 text-xs tabular-nums text-fg-subtle">{value.observaciones.length}/300</span>
          </div>
          <textarea
            id={`${idPrefix}-obs`}
            value={value.observaciones}
            maxLength={300}
            onChange={(event) => set({ observaciones: event.target.value })}
            placeholder="Ej.: incertidumbre declarada, condiciones, número de informe…"
            disabled={disabled}
            className="field min-h-[88px] resize-y py-3 leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}
