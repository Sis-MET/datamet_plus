import React from 'react';
import { cn } from '../../utils/cn';
import { useTheme } from '../../context/ThemeContext';

export function CheckboxGroup({ options, label, value = [], onChange, error, className }) {
  const { isDarkGantt } = useTheme();

  const handleChange = (optionValue) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className={`block text-sm font-medium mb-2 ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>
          {label}
        </label>
      )}
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex items-center px-3 py-2 rounded-md border cursor-pointer transition-colors",
              isDarkGantt 
                ? "border-gray-700 hover:bg-[#252525]" 
                : "border-gray-300 bg-white hover:bg-gray-50"
            )}
          >
            <input
              type="checkbox"
              checked={value.includes(option.value)}
              onChange={() => handleChange(option.value)}
              className="mr-3 text-primary-600 focus:ring-primary-500 rounded"
            />
            <span className={`text-sm ${isDarkGantt ? 'text-gray-200' : 'text-gray-900'}`}>{option.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error.message}</p>}
    </div>
  );
}
