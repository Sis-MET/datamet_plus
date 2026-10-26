import React, { useState } from 'react';
import { FieldLabel } from './FieldLabel';

// Guarda su propio texto: escribir no vuelve a renderizar toda la ficha. La
// ficha lo lee y lo cambia con la referencia (getValue / setValue).
export const TaskDescriptionField = React.memo(React.forwardRef(function TaskDescriptionField(
  _props,
  forwardedRef
) {
  const [value, setValue] = useState('');

  React.useImperativeHandle(forwardedRef, () => ({
    getValue: () => value,
    setValue: (nextValue) => setValue(String(nextValue || '')),
  }), [value]);

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor="task-description" required>Descripción</FieldLabel>
        <span className="mb-1.5 text-xs tabular-nums text-fg-subtle">
          {value.length}/200
        </span>
      </div>
      <textarea
        id="task-description"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Describe el trabajo, la dirección o cualquier indicación útil…"
        maxLength={200}
        spellCheck={false}
        className="field min-h-[112px] resize-y py-3 leading-relaxed"
      />
    </div>
  );
}));

TaskDescriptionField.displayName = 'TaskDescriptionField';
