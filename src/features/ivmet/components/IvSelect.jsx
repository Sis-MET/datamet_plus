import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';

// Misma superficie y selección azul que los desplegables del Cronograma.
// Popover usa la capa superior nativa: no lo recortan los scrolls ni queda
// detrás de un <dialog>. Se conserva la validación HTML del formulario.
export function IvSelect({
  id,
  value = '',
  onChange,
  options,
  placeholder = 'Seleccionar…',
  required = false,
  disabled = false,
  'aria-label': label,
  'aria-labelledby': labelledBy,
}) {
  const uid = useId();
  const listId = `${uid}-options`;
  const button = useRef(null);
  const list = useRef(null);
  const typed = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const items = [{ value: '', label: placeholder }, ...options];
  const chosen = items.find((item) => item.value === value);
  const supported =
    typeof HTMLElement !== 'undefined' &&
    'showPopover' in HTMLElement.prototype;

  useLayoutEffect(() => {
    const element = list.current;
    if (!supported || !element) return;
    if (!open || disabled) {
      if (element.matches(':popover-open')) element.hidePopover();
      return;
    }
    const position = () => {
      const box = button.current.getBoundingClientRect();
      const width = Math.min(Math.max(box.width, 180), window.innerWidth - 16);
      const below = window.innerHeight - box.bottom - 14;
      const above = box.top - 14;
      const bottom =
        below >= Math.min(240, element.scrollHeight) || below >= above;
      const height = Math.max(40, Math.min(260, bottom ? below : above));
      element.style.width = `${width}px`;
      element.style.maxHeight = `${height}px`;
      element.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - width - 8))}px`;
      element.style.top = `${bottom ? box.bottom + 6 : Math.max(8, box.top - Math.min(element.scrollHeight, height) - 6)}px`;
    };
    element.showPopover();
    position();
    window.addEventListener('resize', position);
    const scroll = (event) => {
      if (!element.contains(event.target)) position();
    };
    window.addEventListener('scroll', scroll, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', scroll, true);
      if (element.matches(':popover-open')) element.hidePopover();
    };
  }, [open, disabled, supported]);

  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (
        !button.current?.contains(event.target) &&
        !list.current?.contains(event.target)
      )
        setOpen(false);
    };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  const reveal = () => {
    setActive(
      Math.max(
        0,
        items.findIndex((item) => item.value === value)
      )
    );
    setOpen(true);
  };
  const choose = (index) => {
    if (disabled) return;
    onChange(items[index].value);
    setInvalid(false);
    setOpen(false);
    button.current?.focus();
  };
  const keyDown = (event) => {
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (
      ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)
    ) {
      event.preventDefault();
      if (!open) {
        reveal();
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') choose(active);
      else
        setActive(
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : (active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
                items.length
        );
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      if (!open) reveal();
      const now = Date.now();
      typed.current = {
        text:
          (now - typed.current.time < 700 ? typed.current.text : '') +
          event.key.toLocaleLowerCase('es'),
        time: now,
      };
      const index = items.findIndex((item) =>
        item.label.toLocaleLowerCase('es').startsWith(typed.current.text)
      );
      if (index >= 0) setActive(index);
    }
  };
  return (
    <div className="iv-select">
      <select
        hidden={supported}
        id={supported ? undefined : id}
        className={supported ? 'iv-select-native' : 'iv-select-fallback'}
        tabIndex={supported ? -1 : undefined}
        aria-hidden={supported || undefined}
        aria-label={label}
        aria-labelledby={labelledBy}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onInvalid={
          supported
            ? (event) => {
                event.preventDefault();
                setInvalid(true);
                button.current?.focus();
              }
            : undefined
        }
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {supported && (
        <>
          <button
            ref={button}
            id={id}
            type="button"
            role="combobox"
            className="iv-select-trigger"
            aria-label={label}
            aria-labelledby={labelledBy}
            aria-expanded={open && !disabled}
            aria-controls={listId}
            aria-haspopup="listbox"
            aria-required={required || undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${uid}-error` : undefined}
            aria-activedescendant={open ? `${uid}-option-${active}` : undefined}
            disabled={disabled}
            onClick={() => (open ? setOpen(false) : reveal())}
            onKeyDown={keyDown}
          >
            <span>{chosen?.label || placeholder}</span>
            <ChevronDown size={15} />
          </button>
          <div
            ref={list}
            id={listId}
            popover="manual"
            role="listbox"
            aria-label={label}
            aria-labelledby={labelledBy}
            className="iv-select-menu"
          >
            {items.map((item, index) => (
              <div
                key={item.value}
                id={`${uid}-option-${index}`}
                role="option"
                aria-selected={item.value === value}
                data-index={index}
                data-active={index === active || undefined}
                className="iv-select-option"
                onPointerMove={() => setActive(index)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>{item.label}</span>
                {item.value === value && <Check size={14} />}
              </div>
            ))}
          </div>
        </>
      )}
      {invalid && (
        <small id={`${uid}-error`} role="alert">
          Selecciona una opción.
        </small>
      )}
    </div>
  );
}
