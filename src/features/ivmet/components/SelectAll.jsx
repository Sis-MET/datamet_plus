import React, { useEffect, useId, useRef } from 'react';
import { selectionState } from '../equipmentSelection';

// Marca o desmarca un grupo de balanzas e indica cuántas quedan elegidas.
export function SelectAll({ codes, selected, locked, onChange, label }) {
  const input = useRef(null);
  const countId = useId();
  const state = selectionState(codes, selected, locked);
  useEffect(() => {
    if (input.current) input.current.indeterminate = state.indeterminate;
  }, [state.indeterminate]);
  return (
    <label className="iv-check-row iv-select-all">
      <input
        ref={input}
        type="checkbox"
        aria-label={label}
        aria-describedby={countId}
        checked={state.checked}
        disabled={state.disabled}
        onChange={(event) => onChange(codes, event.target.checked)}
      />
      <span>
        {label}
        <small id={countId}>
          {state.count} de {state.total} seleccionadas
        </small>
      </span>
    </label>
  );
}
