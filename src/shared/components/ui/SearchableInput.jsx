import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../api/client';

export const SearchableInput = React.forwardRef(({
  className,
  error,
  label,
  value,
  onChange,
  onSelect,
  ...props
}, ref) => {
  const { isDarkGantt } = useTheme();
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
    }
  }, [query, value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchClientes = useCallback(async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.get('/clientes/search', { q: searchTerm });
      if (data.success) {
        setResults(data.data);
        setIsOpen(data.data.length > 0);
        setHighlightedIndex(-1);
      }
    } catch (err) {
      console.error('Error searching clientes:', err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setQuery(newValue);
    if (onChange) onChange(newValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClientes(newValue), 300);
  };

  const handleSelectItem = (item) => {
    const displayValue = item.cliente;
    setQuery(displayValue);
    setIsOpen(false);
    setResults([]);
    if (onChange) onChange(displayValue);
    if (onSelect) onSelect(item);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          handleSelectItem(results[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="w-full relative" ref={wrapperRef}>
      {label && (
        <label className={`block text-sm font-medium mb-1 ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>
          {label} {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          className={cn(
            'flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
            isDarkGantt 
              ? 'border-gray-600 bg-[#1e1e1e] text-gray-200 placeholder:text-gray-500' 
              : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          autoComplete="off"
          {...props}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-500 border-t-primary-400 rounded-full animate-spin" />
          </div>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <ul className={cn("absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-md border shadow-lg",
          isDarkGantt ? "border-gray-600 bg-[#1e1e1e]" : "border-gray-200 bg-white"
        )}>
          {results.map((item, index) => (
            <li
              key={index}
              onClick={() => handleSelectItem(item)}
              className={cn(
                'px-3 py-2 text-sm cursor-pointer transition-colors',
                isDarkGantt ? 'text-gray-200' : 'text-gray-800',
                index === highlightedIndex
                  ? (isDarkGantt ? 'bg-primary-600/30 text-primary-300' : 'bg-primary-50 text-primary-600')
                  : (isDarkGantt ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50')
              )}
            >
              {item.cliente}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-sm text-red-500">{error.message}</p>}
    </div>
  );
});

SearchableInput.displayName = 'SearchableInput';
