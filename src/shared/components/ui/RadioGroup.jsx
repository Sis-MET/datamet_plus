import React from 'react';
import { cn } from '../../utils/cn';
import { useTheme } from '../../context/ThemeContext';

export const RadioGroup = React.forwardRef(({ options, label, error, value, onChange, className, ...props }, ref) => {
  const { isDarkGantt } = useTheme();

  const getButtonClasses = (optionValue) => {
    const isSelected = value === optionValue;
    const baseClasses = "flex items-center justify-center px-4 py-2.5 rounded-full text-sm font-medium transition-all cursor-pointer border-2";
    const colorMap = {
      'excellent': {
        selected: isDarkGantt ? 'bg-white border-white text-gray-900 shadow-lg shadow-white/30' : 'bg-gray-900 border-gray-900 text-white shadow-lg shadow-gray-900/30',
        unselected: isDarkGantt ? 'bg-transparent border-gray-600 text-gray-400 hover:border-white hover:text-white' : 'bg-transparent border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900'
      },
      'good': {
        selected: 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-600/30',
        unselected: isDarkGantt ? 'bg-transparent border-gray-600 text-gray-400 hover:border-green-500 hover:text-green-400' : 'bg-transparent border-gray-300 text-gray-600 hover:border-green-600 hover:text-green-600'
      },
      'fair': {
        selected: 'bg-yellow-500 border-yellow-500 text-white shadow-lg shadow-yellow-500/30',
        unselected: isDarkGantt ? 'bg-transparent border-gray-600 text-gray-400 hover:border-yellow-500 hover:text-yellow-400' : 'bg-transparent border-gray-300 text-gray-600 hover:border-yellow-600 hover:text-yellow-600'
      },
      'poor': {
        selected: 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/30',
        unselected: isDarkGantt ? 'bg-transparent border-gray-600 text-gray-400 hover:border-orange-500 hover:text-orange-400' : 'bg-transparent border-gray-300 text-gray-600 hover:border-orange-600 hover:text-orange-600'
      },
      'critical': {
        selected: 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/30',
        unselected: isDarkGantt ? 'bg-transparent border-gray-600 text-gray-400 hover:border-red-500 hover:text-red-400' : 'bg-transparent border-gray-300 text-gray-600 hover:border-red-600 hover:text-red-600'
      },
      'clean': {
        selected: isDarkGantt ? 'bg-white border-white text-gray-900 shadow-lg shadow-white/30' : 'bg-gray-900 border-gray-900 text-white shadow-lg shadow-gray-900/30',
        unselected: isDarkGantt ? 'bg-transparent border-gray-600 text-gray-400 hover:border-white hover:text-white' : 'bg-transparent border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900'
      },
      'light': {
        selected: 'bg-yellow-500 border-yellow-500 text-white shadow-lg shadow-yellow-500/30',
        unselected: isDarkGantt ? 'bg-transparent border-gray-600 text-gray-400 hover:border-yellow-500 hover:text-yellow-400' : 'bg-transparent border-gray-300 text-gray-600 hover:border-yellow-600 hover:text-yellow-600'
      },
      'moderate': {
        selected: 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/30',
        unselected: isDarkGantt ? 'bg-transparent border-gray-600 text-gray-400 hover:border-orange-500 hover:text-orange-400' : 'bg-transparent border-gray-300 text-gray-600 hover:border-orange-600 hover:text-orange-600'
      },
      'heavy': {
        selected: 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/30',
        unselected: isDarkGantt ? 'bg-transparent border-gray-600 text-gray-400 hover:border-red-500 hover:text-red-400' : 'bg-transparent border-gray-300 text-gray-600 hover:border-red-600 hover:text-red-600'
      },
    };
    const colors = colorMap[optionValue] || {
      selected: 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-600/30',
      unselected: isDarkGantt ? 'bg-transparent border-gray-600 text-gray-400 hover:border-primary-500 hover:text-primary-400' : 'bg-transparent border-gray-300 text-gray-600 hover:border-primary-600 hover:text-primary-600'
    };
    return cn(baseClasses, isSelected ? colors.selected : colors.unselected);
  };

  return (
    <div ref={ref} className={cn("w-full", className)}>
      {label && (
        <label className={`block text-sm font-medium mb-3 ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>
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
