import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import { ToneBadge } from '../../calibration/components/primitives';
import { comercialApi } from '../api/comercial';
import { ESTADOS_FACTURA, TRAMO_TONO } from '../domain/comercial';

/** Búsqueda libre; se aplica al dejar de escribir. */
export function Busqueda({ value, onChange, placeholder, label }) {
  const [texto, setTexto] = useState(value);

  useEffect(() => {
    if (texto === value) return undefined;
    const timer = setTimeout(() => onChange(texto), 350);
    return () => clearTimeout(timer);
  }, [texto, value, onChange]);

  return (
    <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-fg shadow-xs transition-colors focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/15 sm:max-w-[360px]">
      <Search className="h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
      <input
        type="search"
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
      />
    </label>
  );
}

export function EstadoFactura({ estado }) {
  const info = ESTADOS_FACTURA[estado] || ESTADOS_FACTURA.pendiente;
  return <ToneBadge tone={info.tone}>{info.label}</ToneBadge>;
}

export function Mora({ dias, tramo }) {
  if (!dias) return <span className="text-[12.5px] text-fg-subtle">Al día</span>;
  return <ToneBadge tone={TRAMO_TONO[tramo] || 'warning'}>{dias} {dias === 1 ? 'día' : 'días'}</ToneBadge>;
}

/** Cifras del encabezado de una lista (facturado, cobrado, saldo…). */
export function Cifras({ items }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card sm:grid-cols-4">
      {items.map(item => (
        <div key={item.label} className="flex min-w-0 flex-col gap-0.5 bg-surface px-4 py-3">
          <dt className="text-[12px] font-medium text-fg-muted">{item.label}</dt>
          <dd className={cn('truncate text-[19px] font-semibold tabular-nums text-fg', item.tone === 'danger' && 'text-danger', item.tone === 'warning' && 'text-warning')}>
            {item.value}
          </dd>
          {item.hint && <dd className="text-[11.5px] text-fg-subtle">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function ErrorCarga({ titulo, error, onRetry }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
      <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[13px] text-fg">
        <span className="font-semibold">{titulo}</span>{' '}
        <span className="text-fg-muted">{error.message}</span>
      </p>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Reintentar</Button>}
    </div>
  );
}

export function Cargando({ label, filas = 4 }) {
  return (
    <div className="card animate-pulse shadow-card" role="status" aria-label={label}>
      {Array.from({ length: filas }, (_, index) => (
        <div key={index} className="flex h-[58px] items-center gap-4 border-b border-line px-4 last:border-0">
          <div className="h-3 w-24 rounded-full bg-fg/[0.07]" />
          <div className="h-3 w-56 rounded-full bg-fg/[0.07]" />
          <div className="ml-auto h-3 w-20 rounded-full bg-fg/[0.07]" />
        </div>
      ))}
    </div>
  );
}

export function Paginacion({ total, page, pageSize, loading, onPage, unidad }) {
  const paginas = Math.max(1, Math.ceil(total / pageSize));
  if (!total) return null;
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={`Páginas de ${unidad}`}>
      <p className="text-[13px] text-fg-muted">{total} {unidad} · página {page} de {paginas}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Anterior
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= paginas || loading} onClick={() => onPage(page + 1)}>
          Siguiente <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

/** Par etiqueta / valor de una ficha. */
export function Dato({ label, children, className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[12px] font-medium text-fg-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-[13.5px] text-fg">{children ?? '—'}</dd>
    </div>
  );
}

/** Tabla en escritorio y lista en el teléfono, con filas que abren una ficha. */
export function FilaAbrible({ onOpen, children, className }) {
  return (
    <tr
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn('cursor-pointer align-top transition-colors hover:bg-fg/[0.025] focus-visible:-outline-offset-2', className)}
    >
      {children}
    </tr>
  );
}

/**
 * Busca un cliente de DataMET por código, nombre o NIT. Al elegirlo entrega
 * { codigo, razonSocial, nit, plazoDias, correos }.
 */
export function ClienteBuscador({ id, value, onSelect, disabled }) {
  const baseId = useId();
  const inputId = id || baseId;
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const ultimo = useRef('');

  // Con menos de dos letras no se busca ni se muestra la lista.
  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) return undefined;
    const timer = setTimeout(() => {
      ultimo.current = q;
      setBuscando(true);
      comercialApi.clientes(q)
        .then((lista) => { if (ultimo.current === q) setResultados(lista); })
        .catch(() => { if (ultimo.current === q) setResultados([]); })
        .finally(() => { if (ultimo.current === q) setBuscando(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [texto]);

  if (value) {
    return (
      <div className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-fg">{value.razonSocial}</p>
          <p className="text-[12px] text-fg-muted">
            Código {value.codigo}{value.nit ? ` · NIT ${value.nit}` : ''}{value.plazoDias != null ? ` · ${value.plazoDias} días de crédito` : ''}
          </p>
        </div>
        {!disabled && (
          <button type="button" onClick={() => onSelect(null)} className="text-[13px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg">
            Cambiar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/15">
        <Search className="h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
        <input
          id={inputId}
          value={texto}
          disabled={disabled}
          onChange={(event) => { setTexto(event.target.value); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          placeholder="Código, nombre o NIT del cliente"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-fg outline-none placeholder:text-fg-subtle"
        />
        {buscando && <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" aria-hidden="true" />}
      </div>
      {abierto && texto.trim().length >= 2 && (
        <ul className="glass absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border p-1" role="listbox">
          {resultados.length === 0 && !buscando && (
            <li className="px-3 py-2 text-[13px] text-fg-muted">Ningún cliente coincide. Puedes escribir la razón social a mano.</li>
          )}
          {resultados.map(cliente => (
            <li key={cliente.codigo}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onSelect(cliente); setTexto(''); setAbierto(false); }}
                className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-fg/[0.05]"
              >
                <span className="text-[13px] font-semibold text-fg">{cliente.razonSocial}</span>
                <span className="text-[12px] text-fg-muted">
                  {cliente.codigo}{cliente.nit ? ` · NIT ${cliente.nit}` : ''}{cliente.activo ? '' : ' · inactivo'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
