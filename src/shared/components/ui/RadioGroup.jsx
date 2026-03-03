import React from 'react';
import { cn } from '../../utils/cn';

export const RadioGroup = React.forwardRef(({ options, label, error, value, onChange, className, ...props }, ref) => {
  const getButtonClasses = (optionValue) => {
    const isSelected = value === optionValue;
    const baseClasses = "flex items-center justify-center px-4 py-2.5 rounded-full text-sm font-medium transition-all cursor-pointer border-2";
    const colorMap = {
      'excellent': {
        selected: 'bg-white border-white text-gray-900 shadow-lg shadow-white/30',
        unselected: 'bg-transparent border-gray-600 text-gray-400 hover:border-white hover:text-white'
      },
      'good': {
        selected: 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-600/30',
        unselected: 'bg-transparent border-gray-600 text-gray-400 hover:border-green-500 hover:text-green-400'
      },
      'fair': {
        selected: 'bg-yellow-500 border-yellow-500 text-white shadow-lg shadow-yellow-500/30',
        unselected: 'bg-transparent border-gray-600 text-gray-400 hover:border-yellow-500 hover:text-yellow-400'
      },
      'poor': {
        selected: 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/30',
        unselected: 'bg-transparent border-gray-600 text-gray-400 hover:border-orange-500 hover:text-orange-400'
      },
      'critical': {
        selected: 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/30',
        unselected: 'bg-transparent border-gray-600 text-gray-400 hover:border-red-500 hover:text-red-400'
      },
      'clean': {
        selected: 'bg-white border-white text-gray-900 shadow-lg shadow-white/30',
        unselected: 'bg-transparent border-gray-600 text-gray-400 hover:border-white hover:text-white'
      },
      'light': {
        selected: 'bg-yellow-500 border-yellow-500 text-white shadow-lg shadow-yellow-500/30',
        unselected: 'bg-transparent border-gray-600 text-gray-400 hover:border-yellow-500 hover:text-yellow-400'
      },
      'moderate': {
        selected: 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/30',
        unselected: 'bg-transparent border-gray-600 text-gray-400 hover:border-orange-500 hover:text-orange-400'
      },
      'heavy': {
        selected: 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/30',
        unselected: 'bg-transparent border-gray-600 text-gray-400 hover:border-red-500 hover:text-red-400'
      },
    };
    const colors = colorMap[optionValue] || {
      selected: 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-600/30',
      unselected: 'bg-transparent border-gray-600 text-gray-400 hover:border-primary-500 hover:text-primary-400'
    };
    return cn(baseClasses, isSelected ? colors.selected : colors.unselected);
  };

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-3">
          {label} {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={getButtonClasses(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error.message}</p>}
    </div>
  );
});

RadioGroup.displayName = 'RadioGroup';
