import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Crosshair, CornerDownLeft, Loader2, Search, Truck, UserRound, X } from 'lucide-react';
import { api } from '../../../shared/api/client';
import { usePageScrollLock } from '../../../shared/hooks/usePageScrollLock';
import { cn } from '../../../shared/utils/cn';
import { IS_APPLE_PLATFORM } from '../../../shared/components/layout/shortcuts';
import { mapScheduleRow } from '../domain/scheduleRows';
import {
  buscarRecursos, buscarTareas, combinarTareas, esBusquedaValida, resaltar,
} from '../domain/scheduleSearch';
import { serviceReferenceLabel } from '../domain/taskFormDomain';
import { isVehicleResource } from '../domain/vehicleAvailability';

const ESPERA_SERVIDOR_MS = 220;
const SALIDAS = new Set(['Salida Personal', 'SalidaMET']);

const SUGERENCIAS = ['OTST', 'SECA', 'Servicio', 'Visita'];

function Resaltado({ texto, q }) {
  return resaltar(texto, q).map((parte, i) => (parte.marca
    ? <mark key={i} className="rounded-[3px] bg-brand/60 px-px text-fg">{parte.texto}</mark>
    : <span key={i}>{parte.texto}</span>));
}

const fechaTarea = fecha => {
  const texto = format(fecha, "EEE d 'de' MMM yyyy", { locale: es });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/**
 * Buscador del cronograma (Ctrl + K). Busca al instante en lo cargado y, en
 * todas las fechas, en el servidor. Enter abre la ficha de la tarea (o la
 * salida); Mayús + Enter solo la ubica en el cronograma.
 */
export function CalendarSearch({ isOpen, onClose, tasks = [], tecnicos = [], onSelectTask, onSelectResource }) {
  usePageScrollLock(isOpen);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState({ q: '', tareas: [], error: null });
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const sequenceRef = useRef(0);

  const nombreDe = useMemo(() => {
    const nombres = new Map(tecnicos.map(t => [t.id, String(t.nombre || t.id).replace(/_/g, ' ')]));
    return id => nombres.get(id) || String(id || '').replace(/_/g, ' ');
  }, [tecnicos]);

  useEffect(() => {
    if (!isOpen) return undefined;
    setActive(0);
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  // El servidor busca en todas las fechas; solo vale la respuesta de la última búsqueda.
  useEffect(() => {
    if (!isOpen || !esBusquedaValida(query)) {
      setLoadingRemote(false);
      return undefined;
    }
    const sequence = ++sequenceRef.current;
    setLoadingRemote(true);
    const timer = setTimeout(async () => {
      try {
        const response = await api.get('/calendar/cronograma/buscar', { q: query.trim() });
        if (sequence !== sequenceRef.current) return;
        const filas = Array.isArray(response?.data) ? response.data : [];
        setRemote({ q: query, tareas: filas.map(fila => mapScheduleRow(fila, tecnicos)).filter(Boolean), error: null });
      } catch (error) {
        if (sequence !== sequenceRef.current) return;
        setRemote({ q: query, tareas: [], error: error?.message || 'No se pudo buscar en otras fechas.' });
      } finally {
        if (sequence === sequenceRef.current) setLoadingRemote(false);
      }
    }, ESPERA_SERVIDOR_MS);
    return () => clearTimeout(timer);
  }, [isOpen, query, tecnicos]);

  const recursos = useMemo(() => buscarRecursos(tecnicos, query, 5), [tecnicos, query]);
  const tareas = useMemo(() => {
    const locales = buscarTareas(tasks, query, { nombreDe });
    const remotas = remote.q === query ? remote.tareas : [];
    return combinarTareas(locales, remotas);
  }, [tasks, query, nombreDe, remote]);

  const items = useMemo(() => [
    ...recursos.map(recurso => ({ tipo: 'recurso', key: `r-${recurso.id}`, recurso })),
    ...tareas.map(tarea => ({ tipo: 'tarea', key: `t-${tarea.rowId}`, tarea })),
  ], [recursos, tareas]);

  const activeIndex = Math.min(active, Math.max(0, items.length - 1));

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  const elegir = (item, { ubicar = false } = {}) => {
    if (!item) return;
    if (item.tipo === 'recurso') onSelectResource?.(item.recurso);
    else onSelectTask?.(item.tarea, { abrir: !ubicar });
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(i => (items.length ? (Math.min(i, items.length - 1) + 1) % items.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(i => (items.length ? (Math.min(i, items.length - 1) - 1 + items.length) % items.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      elegir(items[activeIndex], { ubicar: event.shiftKey });
    }
  };

  const valida = esBusquedaValida(query);
  const sinResultados = valida && !loadingRemote && items.length === 0;
  const primeraTarea = recursos.length;

  // En el body: el área del cronograma usa container-type, que encerraría la capa fija.
  return createPortal(
    <div
      className="task-dialog-backdrop scrim fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[8vh] sm:pt-[12vh]"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en el cronograma"
        className="task-dialog-panel flex max-h-[78vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[22px] border border-line bg-surface shadow-dialog"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search className="h-5 w-5 flex-none text-fg-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder="Buscar cliente, planta, OTST, SECA, cotización, persona…"
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-subtle"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls="calendar-search-results"
            aria-activedescendant={items[activeIndex] ? `calendar-search-${items[activeIndex].key}` : undefined}
            aria-autocomplete="list"
            spellCheck={false}
            autoComplete="off"
          />
          {loadingRemote && <Loader2 className="h-4 w-4 flex-none animate-spin text-fg-subtle" aria-label="Buscando en todas las fechas" />}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 flex-none items-center gap-1 rounded-lg px-2 text-xs font-medium text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
            aria-label="Cerrar buscador"
          >
            <kbd className="kbd">Esc</kbd>
            <X className="h-4 w-4 sm:hidden" aria-hidden="true" />
          </button>
        </div>

        <div ref={listRef} id="calendar-search-results" role="listbox" aria-label="Resultados" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {!valida && (
            <div className="px-3 py-6 text-center">
              <p className="text-sm font-semibold text-fg">Busca en todas las fechas del cronograma</p>
              <p className="mt-1 text-[13px] text-fg-muted">Por cliente, planta, cotización, SECA u OTST, descripción o persona. Todas las palabras deben coincidir.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGERENCIAS.map(sugerencia => (
                  <button
                    key={sugerencia}
                    type="button"
                    onClick={() => { setQuery(sugerencia); inputRef.current?.focus(); }}
                    className="rounded-full border border-line-strong bg-surface px-3 py-1 text-[12.5px] font-medium text-fg-muted transition-colors hover:border-accent/40 hover:text-fg"
                  >
                    {sugerencia}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sinResultados && (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-semibold text-fg">Sin resultados para «{query.trim()}»</p>
              <p className="mt-1 text-[13px] text-fg-muted">Prueba con otra palabra o con menos palabras.</p>
            </div>
          )}

          {recursos.length > 0 && (
            <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-subtle">Personas y vehículos</p>
          )}
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            const header = index === primeraTarea && tareas.length > 0 ? (
              <p key={`h-${item.key}`} className="flex items-center justify-between px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-subtle">
                <span>Tareas · {tareas.length}{tareas.length >= 40 ? '+' : ''}</span>
                <span className="normal-case tracking-normal">las más cercanas a hoy primero</span>
              </p>
            ) : null;

            if (item.tipo === 'recurso') {
              const { recurso } = item;
              const Icono = isVehicleResource(recurso) ? Truck : UserRound;
              return (
                <button
                  key={item.key}
                  id={`calendar-search-${item.key}`}
                  data-index={index}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseMove={() => setActive(index)}
                  onClick={() => elegir(item)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors', isActive ? 'bg-accent/[0.08]' : 'hover:bg-fg/[0.04]')}
                >
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-fg/[0.06] text-fg-muted"><Icono className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-fg"><Resaltado texto={String(recurso.nombre || '').replace(/_/g, ' ')} q={query} /></span>
                    <span className="block truncate text-[12px] text-fg-muted">{[recurso.cargo, isVehicleResource(recurso) ? 'Vehículos' : recurso.area].filter(Boolean).join(' · ')}</span>
                  </span>
                  {isActive && <span className="flex flex-none items-center gap-1 text-[11.5px] font-medium text-fg-muted">Ir a su fila <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" /></span>}
                </button>
              );
            }

            const { tarea } = item;
            const titulo = tarea.cliente || tarea.descripcion || tarea.tipoTarea || 'Tarea';
            const esSalida = SALIDAS.has(tarea.creadoEn);
            return [header, (
              <div
                key={item.key}
                id={`calendar-search-${item.key}`}
                data-index={index}
                role="option"
                aria-selected={isActive}
                onMouseMove={() => setActive(index)}
                className={cn('group flex items-center gap-1 rounded-xl transition-colors', isActive ? 'bg-accent/[0.08]' : 'hover:bg-fg/[0.04]')}
              >
                <button type="button" onClick={() => elegir(item)} className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2 text-left">
                  <span className="h-9 w-1.5 flex-none rounded-full" style={{ backgroundColor: tarea.colorAM || '#37A65F' }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-fg"><Resaltado texto={titulo} q={query} /></span>
                      {esSalida && <span className="flex-none rounded-full bg-info/10 px-1.5 py-px text-[10.5px] font-semibold text-info">Salida</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-fg-muted">
                      {[
                        tarea.tipoTarea && tarea.tipoTarea !== titulo ? tarea.tipoTarea : null,
                        nombreDe(tarea.Tecnico),
                        fechaTarea(tarea.fecha),
                        tarea.horaInicio && tarea.horaFin ? `${tarea.horaInicio}–${tarea.horaFin}` : null,
                        tarea.planta && tarea.planta !== titulo ? tarea.planta : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {tarea.cotizacion && (
                    <span className="hidden max-w-[190px] flex-none items-center gap-1 truncate rounded-lg border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg sm:inline-flex" title={`${serviceReferenceLabel(tarea.cotizacion)}: ${tarea.cotizacion}`}>
                      <span className="font-sans font-semibold text-fg-muted">{serviceReferenceLabel(tarea.cotizacion)}</span>
                      <span className="truncate"><Resaltado texto={tarea.cotizacion} q={query} /></span>
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => elegir(item, { ubicar: true })}
                  className={cn('mr-1.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg text-fg-muted transition-opacity hover:bg-fg/[0.06] hover:text-fg', isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}
                  title="Ubicar en el cronograma sin abrir la ficha (Mayús + Enter)"
                  aria-label={`Ubicar ${titulo} en el cronograma`}
                >
                  <Crosshair className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )];
          })}

          {remote.error && valida && (
            <p className="px-3 py-2 text-[12px] text-warning" role="status">{remote.error} Se muestran solo las semanas cargadas.</p>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface-2/60 px-4 py-2.5 text-[11.5px] text-fg-muted">
          <span className="flex items-center gap-1.5"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> moverse</span>
          <span className="flex items-center gap-1.5"><kbd className="kbd">Enter</kbd> abrir la ficha</span>
          <span className="flex items-center gap-1.5"><kbd className="kbd">{IS_APPLE_PLATFORM ? '⇧' : 'Mayús'}</kbd><kbd className="kbd">Enter</kbd> ubicar</span>
          <span className="ml-auto hidden items-center gap-1.5 sm:flex"><kbd className="kbd">{IS_APPLE_PLATFORM ? '⌘' : 'Ctrl'}</kbd><kbd className="kbd">K</kbd> abrir o cerrar</span>
        </footer>
      </div>
    </div>,
    document.body
  );
}
