import React from 'react';
import { ChevronDown } from 'lucide-react';
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
      // Si ya existe, lo removemos
      delete newValue[optionValue];
    } else {
      // Si no existe, lo agregamos con array vacío de ubicaciones
      newValue[optionValue] = [];
    }
    
    onChange(newValue);
  };

  const handleLocationChange = (optionValue, selectedLocations) => {
    const newValue = { ...value };
    newValue[optionValue] = selectedLocations;
    onChange(newValue);
  };

  const toggleLocation = (optionValue, location) => {
    const currentLocations = value[optionValue] || [];
    const newLocations = currentLocations.includes(location)
      ? currentLocations.filter(l => l !== location)
      : [...currentLocations, location];
    
    handleLocationChange(optionValue, newLocations);
  };

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="space-y-2">
        {options.map((option) => {
          const isChecked = !!value[option.value];
          const selectedLocations = value[option.value] || [];
          
          return (
            <div key={option.value} className="space-y-2">
              {/* Checkbox principal */}
              <label className="flex items-center px-3 py-2 rounded-md border border-gray-700 hover:bg-[#252525] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleCheckboxChange(option.value)}
                  className="mr-3 text-primary-600 focus:ring-primary-500 rounded"
                />
                <span className="text-sm text-gray-200 flex-1">{option.label}</span>
              </label>
              
              {/* Dropdown de ubicaciones (solo se muestra si el checkbox está marcado) */}
              {isChecked && locationOptions.length > 0 && (
                <div className="ml-8 pl-4 border-l-2 border-gray-700">
                  <div className="mb-2 flex items-center text-xs text-gray-400">
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Ubicación del daño/suciedad:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {locationOptions.map((location) => (
                      <label
                        key={location.value}
                        className={cn(
                          "flex items-center px-2 py-1.5 rounded text-xs cursor-pointer transition-all border",
                          selectedLocations.includes(location.value)
                            ? "bg-primary-600/20 border-primary-600/50 text-primary-300"
                            : "bg-[#1e1e1e] border-gray-700 text-gray-400 hover:border-gray-600"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedLocations.includes(location.value)}
                          onChange={() => toggleLocation(option.value, location.value)}
                          className="mr-2 text-primary-600 focus:ring-primary-500 rounded h-3 w-3"
                        />
                        {location.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error.message}</p>}
    </div>
  );
}
