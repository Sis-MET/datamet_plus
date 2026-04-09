import React from 'react';
import { cn } from '../../utils/cn';
import { useTheme } from '../../context/ThemeContext';

export const TextArea = React.forwardRef(({ className, error, label, rows = 3, ...props }, ref) => {
  const { isDarkGantt } = useTheme();
  return (
    <div className="w-full">
      {label && (
        <label className={`block text-sm font-medium mb-1 ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>
          {label} {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          'w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 resize-none',
          isDarkGantt 
            ? 'border-gray-600 bg-[#1e1e1e] text-gray-200 placeholder:text-gray-500' 
            : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error.message}</p>}
    </div>
  );
});

TextArea.displayName = 'TextArea';
