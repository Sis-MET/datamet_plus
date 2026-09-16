import React from 'react';
import { CornerDownRight } from 'lucide-react';
import { cn } from '../../utils/cn';

export function CheckboxWithLocation({
  options,
  label,
  value = {},
  onChange,
  error,
  className,
  locationOptions = []
}) {
  const handleCheckboxChange = (optionValue) => {
    const newValue = { ...value };
    if (newValue[optionValue]) {
      delete newValue[optionValue];
    } else {
      newValue[optionValue] = [];
    }
    onChange(newValue);
  };

  const toggleLocation = (optionValue, location) => {
    const currentLocations = value[optionValue] || [];
    const newLocations = currentLocations.includes(location)
      ? currentLocations.filter(l => l !== location)
      : [...currentLocations, location];
    const newValue = { ...value, [optionValue]: newLocations };
    onChange(newValue);
  };

  return (
    <div className={cn("w-full", className)}>
      {label && <p className="field-label mb-2.5">{label}</p>}
      <div className="grid items-start gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const isChecked = !!value[option.value];
          const selectedLocations = value[option.value] || [];
          return (
            <div
              key={option.value}
              className={cn(
                'rounded-xl border transition-colors duration-150',
                isChecked ? 'border-fg/25 bg-surface' : 'border-line bg-surface hover:border-fg/20'
              )}
            >
              <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleCheckboxChange(option.value)}
                  className="h-4 w-4 shrink-0 cursor-pointer rounded accent-fg"
                />
                <span className={cn('text-sm', isChecked ? 'font-medium text-fg' : 'text-fg-muted')}>{option.label}</span>
              </label>
              {isChecked && locationOptions.length > 0 && (
                <div className="border-t border-line px-3.5 pb-3 pt-2.5 animate-fade-in">
                  <p className="mb-2 flex items-center gap-1.5 text-xs text-fg-muted">
                    <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                    Ubicación del daño/suciedad:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {locationOptions.map((location) => {
                      const selected = selectedLocations.includes(location.value);
                      return (
                        <label
                          key={location.value}
                          className={cn(
                            'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                            selected
                              ? 'border-fg bg-fg text-canvas'
                              : 'border-line-strong text-fg-muted hover:border-fg/30 hover:text-fg'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleLocation(option.value, location.value)}
                            className="sr-only"
                          />
                          {location.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="field-error">{error.message}</p>}
    </div>
  );
}
