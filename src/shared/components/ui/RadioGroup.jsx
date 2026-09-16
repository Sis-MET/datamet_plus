import React, { useId } from 'react';
import { cn } from '../../utils/cn';

// Cada opción conserva su significado cromático: el color solo aparece en la
// opción elegida; las demás quedan neutras.
const SELECTED_TONE = {
  neutral: 'border-fg bg-fg text-canvas',
  success: 'border-success bg-success text-canvas',
  warning: 'border-warning bg-warning text-canvas',
  orange: 'border-orange-600 bg-orange-600 text-white dark:border-orange-400 dark:bg-orange-400 dark:text-canvas',
  danger: 'border-danger bg-danger text-canvas',
};

const OPTION_TONE = {
  excellent: 'neutral',
  clean: 'neutral',
  good: 'success',
  fair: 'warning',
  light: 'warning',
  poor: 'orange',
  moderate: 'orange',
  critical: 'danger',
  heavy: 'danger',
};

export const RadioGroup = React.forwardRef(({ options, label, error, value, onChange, className, ...props }, ref) => {
  const labelId = useId();

  return (
    <div ref={ref} className={cn('w-full', className)}>
      {label && (
        <p id={labelId} className="field-label mb-2.5">
          {label}
          {props.required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
        </p>
      )}
      <div role="radiogroup" aria-labelledby={label ? labelId : undefined} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = value === option.value;
          const tone = OPTION_TONE[option.value] || 'neutral';
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.value)}
              className={cn(
                'inline-flex h-9 items-center justify-center rounded-full border px-4 text-[13px] font-medium transition-[background-color,border-color,color] duration-150',
                isSelected
                  ? SELECTED_TONE[tone]
                  : 'border-line-strong bg-surface text-fg-muted hover:border-fg/30 hover:text-fg'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error && <p className="field-error mt-2">{error.message}</p>}
    </div>
  );
});

RadioGroup.displayName = 'RadioGroup';
