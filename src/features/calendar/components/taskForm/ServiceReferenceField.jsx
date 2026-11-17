import { AlertTriangle, CheckCircle2, Hash } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';
import {
  REFERENCE_LABELS,
  REFERENCE_MAX_LENGTH,
  recognizeServiceReference,
} from '../../domain/taskFormDomain';

/**
 * Aviso destacado y campo para la cotización, SECA u OTST del servicio al que
 * va la salida. Mientras falta, el aviso queda en amarillo Métrica; al
 * reconocer el formato pasa a verde y dice qué referencia es.
 */
export function ServiceReferenceField({ value, onChange }) {
  const { tipo, codigo } = recognizeServiceReference(value);
  const filled = value.trim() !== '';
  const state = !filled ? 'empty' : tipo ? 'recognized' : 'free';

  return (
    <div
      className={cn(
        'relative mt-5 overflow-hidden rounded-2xl border px-4 pb-4 pt-3.5 transition-colors duration-200',
        state === 'empty' && 'border-brand bg-brand/[0.13] shadow-[0_8px_24px_-14px_rgb(var(--c-brand)/0.9)]',
        state === 'recognized' && 'border-success/40 bg-success/[0.07]',
        state === 'free' && 'border-info/35 bg-info/[0.06]'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-0 w-1',
          state === 'empty' && 'bg-brand',
          state === 'recognized' && 'bg-success',
          state === 'free' && 'bg-info'
        )}
      />
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'relative mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-xl',
            state === 'empty' && 'bg-brand text-brand-fg',
            state === 'recognized' && 'bg-success/15 text-success',
            state === 'free' && 'bg-info/10 text-info'
          )}
          aria-hidden="true"
        >
          {state === 'empty' && <span className="absolute inset-0 animate-ping rounded-xl bg-brand/60 motion-reduce:hidden" />}
          {state === 'empty' && <AlertTriangle className="relative h-4 w-4" />}
          {state === 'recognized' && <CheckCircle2 className="h-4 w-4" />}
          {state === 'free' && <Hash className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor="task-service-reference" className="block text-[14px] font-semibold leading-snug text-fg">
            {state === 'recognized'
              ? <>Servicio asociado: <span className="font-mono">{REFERENCE_LABELS[tipo]} {codigo}</span></>
              : 'Registra al menos la cotización, SECA u OTST del servicio'}
          </label>
          <p className="mt-0.5 text-[12.5px] leading-snug text-fg-muted">
            {state === 'free'
              ? 'No se reconoce el formato: se guardará tal cual. Revisa que sea la cotización, SECA u OTST.'
              : 'Vincula esta salida con su servicio y permite encontrarla con Ctrl + K.'}
          </p>
        </div>
      </div>

      <div className="relative mt-3">
        <input
          id="task-service-reference"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={REFERENCE_MAX_LENGTH}
          spellCheck={false}
          autoComplete="off"
          placeholder="Ej.: OTST 26-0285-51-S01 · SECA 0051-C01-26 · 123.COT456"
          aria-describedby="task-service-reference-status"
          className="field pr-28 font-mono text-[13.5px] uppercase tracking-wide placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
        />
        <span
          id="task-service-reference-status"
          className={cn(
            'pointer-events-none absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            state === 'empty' && 'bg-brand/40 text-fg',
            state === 'recognized' && 'bg-success/15 text-success',
            state === 'free' && 'bg-info/10 text-info'
          )}
        >
          {state === 'empty' ? 'Falta' : state === 'recognized' ? `${REFERENCE_LABELS[tipo]} ✓` : 'Texto libre'}
        </span>
      </div>
    </div>
  );
}
