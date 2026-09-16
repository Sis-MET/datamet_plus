import React, { useId } from 'react';
import { cn } from '../../utils/cn';

export const Input = React.forwardRef(({ className, error, label, id, ...props }, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="field-label">
          {label}
          {props.required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn('field h-10', error && 'field-invalid', className)}
        {...props}
      />
      {error && <p id={errorId} className="field-error">{error.message}</p>}
    </div>
  );
});

Input.displayName = 'Input';
