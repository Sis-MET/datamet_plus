import React from 'react';
import { Check, X, Minus } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

const OPTIONS = [
  { value: 'present', label: 'Presente', icon: Check, selected: 'bg-success/[0.12] text-success ring-1 ring-inset ring-success/30' },
  { value: 'missing', label: 'Faltante', icon: X, selected: 'bg-danger/10 text-danger ring-1 ring-inset ring-danger/30' },
  { value: 'na', label: 'N/A', icon: Minus, selected: 'bg-surface text-fg shadow-xs ring-1 ring-inset ring-line-strong' },
];

export function InventoryItem({
  label,
  value,
  onChange,
  showQuantity = false,
  quantity,
  onQuantityChange,
  compact = false,
}) {
  const control = (
    <div
      role="radiogroup"
      aria-label={label || 'Estado del componente'}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-line bg-surface-2/70 p-0.5"
    >
      {OPTIONS.map(({ value: optionValue, label: optionLabel, icon, selected }) => {
        const Icon = icon;
        const isSelected = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(optionValue)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-medium transition-[background-color,color,box-shadow] duration-150',
              isSelected ? selected : 'text-fg-muted hover:text-fg'
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
            {optionLabel}
          </button>
        );
      })}
    </div>
  );

  if (compact) return control;

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="text-sm font-medium text-fg sm:w-48 sm:shrink-0">{label}</div>
      <div className="flex flex-1 flex-wrap items-center gap-3">
        {control}
        {showQuantity && (
          <input
            type="number"
            min="0"
            value={quantity || ''}
            onChange={(e) => onQuantityChange?.(e.target.value)}
            placeholder="Cant."
            aria-label={`Cantidad de ${label}`}
            className="field h-9 w-24 tabular-nums"
          />
        )}
      </div>
    </div>
  );
}
