import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export const Select = React.forwardRef(({ className, error, label, options = [], placeholder, id, ...props }, ref) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="field-label">
          {label}
          {props.required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn('field h-10 cursor-pointer appearance-none pr-10', error && 'field-invalid', className)}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
          aria-hidden="true"
        />
      </div>
      {error && <p id={errorId} className="field-error">{error.message}</p>}
    </div>
  );
});

Select.displayName = 'Select';
