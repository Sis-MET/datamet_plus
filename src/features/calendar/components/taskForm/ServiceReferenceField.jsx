import { Check, Hash } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';
import {
  REFERENCE_LABELS,
  REFERENCE_MAX_LENGTH,
  recognizeServiceReference,
} from '../../domain/taskFormDomain';
import { FieldLabel } from './FieldLabel';

/**
 * Cotización, SECA u OTST del servicio al que va la salida. Es un campo más
 * de la ficha, como Cliente o Planta: mientras falta lleva la marca
 * «Recomendado»; al reconocer el formato muestra de qué se trata dentro del
 * campo. No es obligatorio.
 */
export function ServiceReferenceField({ value, onChange }) {
  const { tipo } = recognizeServiceReference(value);
  const filled = value.trim() !== '';

  return (
    <div className="pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel htmlFor="task-service-reference">Cotización, SECA u OTST</FieldLabel>
        {!filled && (
          <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs text-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
            Recomendado
          </span>
        )}
      </div>
      <div className="relative">
        <Hash className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
        <input
          id="task-service-reference"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={REFERENCE_MAX_LENGTH}
          spellCheck={false}
          autoComplete="off"
          placeholder="Ej.: OTST 26-0285-51-S01"
          aria-describedby="task-service-reference-help"
          className={cn(
            'field h-11 pl-10 font-medium uppercase tracking-wide placeholder:font-normal placeholder:normal-case placeholder:tracking-normal',
            tipo && 'pr-24'
          )}
        />
        {tipo && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md bg-success/10 px-1.5 py-0.5 text-[11px] font-semibold text-success">
            <Check className="h-3 w-3" aria-hidden="true" />
            {REFERENCE_LABELS[tipo]}
          </span>
        )}
      </div>
      <p id="task-service-reference-help" className="mt-1.5 text-xs leading-snug text-fg-muted">
        {filled && !tipo
          ? 'No tiene el formato de una cotización, SECA u OTST; se guardará tal cual.'
          : 'La del servicio al que va la salida: queda vinculada y se encuentra con Ctrl + K.'}
      </p>
    </div>
  );
}
