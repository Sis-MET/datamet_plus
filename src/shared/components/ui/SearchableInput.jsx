import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { api } from '../../api/client';

export const SearchableInput = React.forwardRef(({
  className,
  error,
  label,
  value,
  onChange,
  onSelect,
  id,
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listId = `${inputId}-list`;
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
    <div className="relative w-full" ref={wrapperRef}>
      {label && (
        <label htmlFor={inputId} className="field-label">
          {label}
          {props.required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          role="combobox"
          aria-expanded={isOpen && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          className={cn('field h-10', isLoading && 'pr-10', error && 'field-invalid', className)}
          autoComplete="off"
          {...props}
        />
        {isLoading && (
          <Loader2 className="pointer-events-none absolute right-3.5 top-1/2 -mt-2 h-4 w-4 animate-spin text-fg-subtle" aria-hidden="true" />
        )}
      </div>
      {isOpen && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="glass absolute z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border p-1 animate-pop-in"
        >
          {results.map((item, index) => (
            <li
              key={index}
              role="option"
              aria-selected={index === highlightedIndex}
              onClick={() => handleSelectItem(item)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className="menu-item cursor-pointer"
            >
              {item.cliente}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="field-error">{error.message}</p>}
    </div>
  );
});

SearchableInput.displayName = 'SearchableInput';
