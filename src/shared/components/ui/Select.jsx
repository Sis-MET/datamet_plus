import React from 'react';
import { cn } from '../../utils/cn';

export const Select = React.forwardRef(({ className, error, label, options = [], placeholder, ...props }, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {label} {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border border-gray-600 bg-[#1e1e1e] text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
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
