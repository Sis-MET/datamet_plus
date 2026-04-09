import React from 'react';
import { cn } from '../../utils/cn';
import { useTheme } from '../../context/ThemeContext';

export const Select = React.forwardRef(({ className, error, label, options = [], placeholder, ...props }, ref) => {
  const { isDarkGantt } = useTheme();
  return (
    <div className="w-full">
      {label && (
        <label className={`block text-sm font-medium mb-1 ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>
          {label} {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
          isDarkGantt 
            ? 'border-gray-600 bg-[#1e1e1e] text-gray-200' 
            : 'border-gray-300 bg-white text-gray-900',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-500">{error.message}</p>}
    </div>
  );
});

Select.displayName = 'Select';
