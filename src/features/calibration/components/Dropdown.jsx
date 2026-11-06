import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { FloatingDropdown } from '../../../shared/components/ui/FloatingDropdown';

// Mismo vocabulario que las fichas del Cronograma: en escritorio un menú de
// vidrio; en pantallas angostas el selector nativo del sistema.
const TRIGGER = 'field hidden cursor-pointer items-center justify-between gap-2 text-left font-medium sm:flex';
const NATIVE = 'field cursor-pointer font-medium sm:hidden';
// `sm` es para celdas de tablas, a la altura de sus campos de texto.
const SIZES = {
  md: 'h-11',
  sm: 'h-9 gap-1 rounded-lg px-2.5 text-[13px] font-normal',
};
const MENU = 'glass rounded-xl border p-1';
const GROUP_LABEL = 'px-2.5 pb-1 pt-2 text-[11px] font-medium text-fg-subtle first:pt-1';

const groupOptions = (options) => {
  const groups = [];
  for (const option of options) {
    const label = option.group || '';
    let group = groups.find(item => item.label === label);
    if (!group) {
      group = { label, items: [] };
      groups.push(group);
    }
    group.items.push(option);
  }
  return groups;
};

/**
 * Lista desplegable de una sola opción.
 * options: [{ value, label, hint?, group? }]; `group` agrupa bajo un subtítulo.
 * size: 'md' (formularios) o 'sm' (celdas de tablas).
 */
export function Dropdown({
  id,
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  ariaLabel,
  disabled,
  maxHeight = 264,
  size = 'md',
  className,
}) {
  const generatedId = useId();
  const triggerId = id || generatedId;
  const listId = `${triggerId}-lista`;
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const groups = useMemo(() => groupOptions(options), [options]);
  // Orden visual (por grupos) para moverse con el teclado.
  const ordered = useMemo(() => groups.flatMap(group => group.items), [groups]);
  const selectedIndex = ordered.findIndex(option => String(option.value) === String(value ?? ''));
  const selected = ordered[selectedIndex];
  const hasGroups = groups.some(group => group.label);

  const openMenu = () => {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const choose = (option) => {
    onChange(option.value);
    setOpen(false);
  };

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive(current => (current + step + ordered.length) % ordered.length);
    } else if ((event.key === 'Enter' || event.key === ' ') && open && ordered[active]) {
      event.preventDefault();
      choose(ordered[active]);
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setActive(ordered.length - 1);
    } else if (event.key === 'Tab' && open) {
      setOpen(false);
    }
  };

  return (
    <div className={cn('relative min-w-0', className)}>
      <select
        value={value ?? ''}
        onChange={(event) => {
          const option = ordered.find(item => String(item.value) === event.target.value);
          if (option) onChange(option.value);
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(NATIVE, SIZES[size])}
      >
        {!selected && <option value="" disabled>{placeholder}</option>}
        {hasGroups
          ? groups.map(group => (
            <optgroup key={group.label || 'sin-grupo'} label={group.label || ' '}>
              {group.items.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </optgroup>
          ))
          : ordered.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>

      <button
        ref={buttonRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className={cn(TRIGGER, SIZES[size], disabled && 'cursor-not-allowed')}
      >
        <span className={cn('truncate', !selected && 'font-normal text-fg-subtle')}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={cn('shrink-0 text-fg-subtle transition-transform duration-150', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4', open && 'rotate-180')} aria-hidden="true" />
      </button>

      <FloatingDropdown
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        maxHeight={maxHeight}
        ariaLabel={ariaLabel}
        className={MENU}
      >
        <div ref={listRef} id={listId} role="listbox" className="overflow-y-auto" style={{ maxHeight: maxHeight - 8 }}>
          {groups.map(group => (
            <div key={group.label || 'sin-grupo'} role={group.label ? 'group' : undefined} aria-label={group.label || undefined}>
              {group.label && <p className={GROUP_LABEL} aria-hidden="true">{group.label}</p>}
              {group.items.map((option) => {
                const index = ordered.indexOf(option);
                return (
                  <button
                    key={option.value}
                    id={`${listId}-${index}`}
                    data-index={index}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === selectedIndex}
                    data-selected={index === selectedIndex}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(option)}
                    className={cn('menu-item justify-between', index === active && 'bg-fg/[0.06]')}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.hint && <span className="shrink-0 text-xs font-normal text-fg-subtle">{option.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </FloatingDropdown>
    </div>
  );
}

/**
 * Texto libre con sugerencias en un menú de vidrio (como el buscador de
 * clientes del Cronograma).
 */
export function SuggestInput({ id, value, onChange, suggestions, placeholder, disabled, maxLength }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const needle = String(value || '').trim().toLowerCase();
  const matches = suggestions.filter(item => item.toLowerCase().includes(needle) && item.toLowerCase() !== needle);

  return (
    <div className="relative min-w-0">
      <input
        ref={inputRef}
        id={id}
        value={value}
        maxLength={maxLength}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Tab') setOpen(false);
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && matches.length > 0}
        className="field h-11 font-medium"
      />
      <FloatingDropdown
        open={open && matches.length > 0 && !disabled}
        anchorRef={inputRef}
        onClose={() => setOpen(false)}
        maxHeight={220}
        ariaLabel="Sugerencias"
        className={MENU}
      >
        <div role="listbox" className="max-h-52 overflow-y-auto">
          {matches.map(item => (
            <button
              key={item}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                onChange(item);
                setOpen(false);
              }}
              className="menu-item"
            >
              {item}
            </button>
          ))}
        </div>
      </FloatingDropdown>
    </div>
  );
}

/**
 * Filtro de la barra de herramientas con el mismo panel de vidrio que el
 * filtro de áreas del Cronograma. options: [{ value, label, count? }]
 */
export function FilterMenu({ icon: Icon, value, onChange, options, allLabel, ariaLabel }) {
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  const total = options.reduce((sum, option) => sum + (option.count || 0), 0);

  const item = (optionValue, label, count) => (
    <button
      key={optionValue || 'todas'}
      type="button"
      role="option"
      aria-selected={value === optionValue}
      onClick={() => {
        onChange(optionValue);
        setOpen(false);
      }}
      className="menu-item justify-between"
    >
      <span className="truncate pr-2">{label}</span>
      {count != null && (
        <span className="shrink-0 rounded-full bg-fg/[0.07] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-fg-muted">
          {count}
        </span>
      )}
    </button>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="calendar-toolbar-control flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] text-fg shadow-xs transition-colors duration-150 hover:bg-surface-2"
      >
        {Icon && <Icon className={cn('h-4 w-4', value ? 'text-fg' : 'text-fg-muted')} aria-hidden="true" />}
        <span className="max-w-[160px] truncate font-medium">{selected?.label || allLabel}</span>
        <ChevronDown className={cn('h-4 w-4 text-fg-subtle transition-transform duration-150', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <FloatingDropdown
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        width={256}
        maxHeight={320}
        align="end"
        ariaLabel={ariaLabel}
        className="glass rounded-2xl border"
      >
        <div role="listbox" aria-label={ariaLabel} className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto p-1.5">
          {item('', allLabel, total || null)}
          <div className="mx-1 my-1 h-px bg-line" />
          {options.map(option => item(option.value, option.label, option.count))}
        </div>
      </FloatingDropdown>
    </>
  );
}
