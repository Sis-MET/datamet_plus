import React from 'react';
import { Check, X, Minus } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

export function InventoryItem({
  label,
  value,
  onChange,
  showQuantity = false,
  quantity,
  onQuantityChange
}) {
  const getButtonClasses = (buttonValue) => {
    const isSelected = value === buttonValue;
    const baseClasses = "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border-2";
    if (buttonValue === 'present') {
      return cn(baseClasses, isSelected
        ? "bg-green-600 border-green-600 text-white shadow-lg shadow-green-600/30"
        : "bg-transparent border-gray-600 text-gray-400 hover:border-green-500 hover:text-green-400");
    }
    if (buttonValue === 'missing') {
      return cn(baseClasses, isSelected
        ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/30"
        : "bg-transparent border-gray-600 text-gray-400 hover:border-red-500 hover:text-red-400");
    }
    if (buttonValue === 'na') {
      return cn(baseClasses, isSelected
        ? "bg-gray-600 border-gray-600 text-white shadow-lg shadow-gray-600/20"
        : "bg-transparent border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300");
    }
  };

  return (
    <div className="flex flex-col sm:grid sm:grid-cols-12 gap-3 py-3 border-b border-gray-700/50 last:border-0">
      <div className="sm:col-span-4 text-sm text-gray-300 font-medium">{label}</div>
      <div className="sm:col-span-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange('present')} className={getButtonClasses('present')}>
          <Check className="h-3 w-3" /> Presente
        </button>
        <button type="button" onClick={() => onChange('missing')} className={getButtonClasses('missing')}>
          <X className="h-3 w-3" /> Faltante
        </button>
        <button type="button" onClick={() => onChange('na')} className={getButtonClasses('na')}>
          <Minus className="h-3 w-3" /> N/A
        </button>
      </div>
      {showQuantity && (
        <div className="sm:col-span-2">
          <input
            type="number"
            min="0"
            value={quantity || ''}
            onChange={(e) => onQuantityChange?.(e.target.value)}
            placeholder="Cant."
            className="w-full h-9 px-3 text-sm rounded-md border border-gray-600 bg-[#1e1e1e] text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
