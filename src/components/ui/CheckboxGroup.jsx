import React from 'react';
import { cn } from '../../utils/cn';

export function CheckboxGroup({ options, label, value = [], onChange, error, className }) {
  const handleChange = (optionValue) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center px-3 py-2 rounded-md border border-gray-700 hover:bg-[#252525] cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={value.includes(option.value)}
              onChange={() => handleChange(option.value)}
              className="mr-3 text-primary-600 focus:ring-primary-500 rounded"
            />
            <span className="text-sm text-gray-200">{option.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error.message}</p>}
    </div>
  );
}
