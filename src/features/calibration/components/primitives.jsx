import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { usePageScrollLock } from '../../../shared/hooks/usePageScrollLock';
import { SITUACION_TONE, TIPOS, situationLabel } from '../domain/format';

/** Forma del tipo (círculo, rombo, cuadrado) coloreada por la situación. */
export function Glyph({ tipo, situacion = 'PROGRAMADO', proyectado = false, size, className }) {
  const tone = SITUACION_TONE[situacion] || 'neutral';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'cal-glyph',
        `cal-glyph-${TIPOS[tipo]?.shape || 'circle'}`,
        `cal-tone-${tone}`,
        proyectado && 'cal-glyph-projected',
        situacion === 'CANCELADO' && 'cal-glyph-cancelled',
        className
      )}
      style={size ? { '--glyph-size': `${size}px` } : undefined}
    />
  );
}

export function StatusBadge({ situacion, tipo, proyectado, children }) {
  const tone = proyectado ? 'neutral' : (SITUACION_TONE[situacion] || 'neutral');
  return (
    <span className={cn('cal-badge', `cal-tone-${tone}`)}>
      {children || (proyectado ? 'Estimada' : situationLabel(situacion, tipo))}
    </span>
  );
}

export function ToneBadge({ tone = 'neutral', children }) {
  return <span className={cn('cal-badge', `cal-tone-${tone}`)}>{children}</span>;
}

/** Interruptor con etiqueta y descripción; el input es un checkbox con role="switch". */
export function Switch({ checked, onChange, label, description, disabled, id }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={inputId} className={cn('min-w-0', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
        <span className="block text-[13px] font-medium text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-snug text-fg-muted">{description}</span>}
      </label>
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        className="cal-switch mt-0.5"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

/** Grupo de opciones excluyentes con aspecto segmentado. */
export function Segmented({ value, onChange, options, label, className, disabled }) {
  return (
    <div role="group" aria-label={label} className={cn('cal-segmented', className)}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
          {option.count != null && <span className={cn('cal-count', option.alert && 'cal-count-alert')}>{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const MODAL_SIZES = {
  lg: 'max-w-4xl',
  md: 'max-w-2xl',
};

/**
 * Ficha modal con el mismo armazón que la ficha de tarea del Cronograma:
 * centrada en escritorio y como hoja inferior en móvil, cabecera y pie fijos.
 * Atrapa el foco, se cierra con Escape o tocando fuera y devuelve el foco.
 * `children` y `footer` pueden ser funciones que reciben `close`.
 */
export function Modal({ title, subtitle, onClose, children, footer, size = 'lg', busy = false }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const [closing, setClosing] = useState(false);

  usePageScrollLock(true);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  // Cerrar solo cambia el estado: la salida anima y después avisa al padre.
  const close = useCallback(() => setClosing(true), []);
  const requestClose = useCallback(() => {
    if (!busyRef.current) setClosing(true);
  }, []);

  useEffect(() => {
    if (!closing) return undefined;
    const timer = setTimeout(() => onCloseRef.current(), 100);
    return () => clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    const previous = document.activeElement;
    const panel = panelRef.current;
    // La ficha ya está en el DOM: el foco entra sin esperar al siguiente cuadro.
    const target = panel?.querySelector('[data-autofocus]') || panel?.querySelector('.cal-modal-body ' + FOCUSABLE) || panel;
    target?.focus({ preventScroll: true });
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        requestClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter(item => item.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [requestClose]);

  const state = closing ? 'closing' : 'open';
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-state={state}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      className="task-dialog-backdrop scrim fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        data-state={state}
        className={cn(
          'task-dialog-panel flex max-h-[calc(100dvh-0.5rem)] w-full flex-col overflow-hidden rounded-t-[22px] border border-line bg-surface shadow-dialog outline-none sm:max-h-[90dvh] sm:rounded-[22px]',
          MODAL_SIZES[size] || MODAL_SIZES.lg
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold tracking-[-0.01em] text-fg">{title}</h2>
            {subtitle && <div className="mt-0.5 truncate text-sm text-fg-muted">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Cerrar ficha"
            disabled={busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="cal-modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {typeof children === 'function' ? children(close) : children}
        </div>
        {footer && (
          <footer className="flex shrink-0 items-center gap-2 border-t border-line bg-surface px-5 py-3 sm:px-6">
            {typeof footer === 'function' ? footer(close) : footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Dos columnas como la ficha del Cronograma: datos a la izquierda, contexto a la derecha. */
export function ModalColumns({ children }) {
  return <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">{children}</div>;
}

export function ModalSection({ title, description, aside = false, action, children }) {
  const headingId = useId();
  const Tag = aside ? 'aside' : 'section';
  return (
    <Tag
      aria-labelledby={headingId}
      className={aside
        ? 'border-t border-line bg-surface-2/50 px-5 py-6 sm:px-6 lg:border-l lg:border-t-0'
        : 'px-5 py-6 sm:px-6 lg:pr-7'}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 id={headingId} className="text-sm font-semibold text-fg">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Tag>
  );
}

/** Subtítulo dentro de una sección de la ficha. */
export function BlockTitle({ children, leading }) {
  return (
    <h4 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-fg">
      {leading}
      {children}
    </h4>
  );
}

// Botones del pie, idénticos a los de la ficha del Cronograma.
export function CancelButton({ onClick, disabled, children = 'Cancelar' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-10 rounded-xl px-4 text-sm font-semibold text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ onClick, busy, disabled, children, busyLabel = 'Guardando', type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
      className="flex h-10 min-w-[128px] items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg shadow-xs ring-1 ring-inset ring-black/5 transition-[background-color,transform] duration-150 hover:bg-brand-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {busy ? busyLabel : children}
    </button>
  );
}

export function DangerButton({ onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function FieldLabel({ htmlFor, children, hint }) {
  return (
    <label htmlFor={htmlFor} className="field-label">
      {children}
      {hint && <span className="ml-1 font-normal text-fg-subtle">{hint}</span>}
    </label>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      {Icon && (
        <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-2 text-fg-muted">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <p className="text-sm font-semibold text-fg">{title}</p>
      {children && <p className="max-w-md text-[13px] leading-relaxed text-fg-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
