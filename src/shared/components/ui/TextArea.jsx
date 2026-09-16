import React, { useId } from 'react';
import { cn } from '../../utils/cn';

export const TextArea = React.forwardRef(({ className, error, label, rows = 3, id, ...props }, ref) => {
  const generatedId = useId();
  const textAreaId = id || generatedId;
  const errorId = `${textAreaId}-error`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textAreaId} className="field-label">
          {label}
          {props.required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={textAreaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn('field resize-y py-2.5 leading-relaxed', error && 'field-invalid', className)}
        {...props}
      />
      {error && <p id={errorId} className="field-error">{error.message}</p>}
    </div>
  );
});

TextArea.displayName = 'TextArea';
