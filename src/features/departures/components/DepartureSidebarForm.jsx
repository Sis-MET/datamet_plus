import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trash2, ChevronDown, Clock, Calendar, Users, MapPin, ChevronLeft, ChevronRight, Check, AlertTriangle, X } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, isWeekend
} from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { TIPOS_SALIDA } from '../constants';
import { API_BASE } from '../../../config/api';
import { safeStorage } from '../../../shared/utils/storage';

const TIME_SLOTS = (() => {
  const s = [];
  for (let m = 0; m < 24 * 60; m += 30)
    s.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '00')}`);
  return s;
})();
const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// ── Selector de hora — igual al del CellPopoverForm ──
function TimeSelect({ value, onChange, slots }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      const sel = listRef.current.querySelector('[data-selected="true"]');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
    }
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-1 rounded-md bg-transparent py-1.5 text-[13px] font-semibold tabular-nums text-fg outline-none">
        <span>{value}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="glass absolute bottom-[calc(100%+6px)] left-1/2 z-[200] w-24 -translate-x-1/2 overflow-hidden rounded-xl border p-1 animate-pop-in">
          <div ref={listRef} role="listbox" className="max-h-44 overflow-y-auto">
            {slots.map(t => (
              <button key={t} type="button" role="option" aria-selected={t === value} data-selected={t === value}
                onClick={() => { onChange(t); setOpen(false); }}
                className="menu-item justify-center py-1.5 tabular-nums">
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mini calendario multi-fecha ──
function MultiDatePicker({ selectedDates, onChange }) {
  const [viewDate, setViewDate] = useState(new Date());
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(viewDate),     { weekStartsOn: 1 }),
  });
  const title = format(viewDate, 'MMMM yyyy', { locale: es });

  const toggleDay = (day) => {
    const str = format(day, 'yyyy-MM-dd');
    const exists = selectedDates.find(d => format(d, 'yyyy-MM-dd') === str);
    if (exists) onChange(selectedDates.filter(d => format(d, 'yyyy-MM-dd') !== str));
    else onChange([...selectedDates, day]);
  };

  const navButton = 'flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg';

  return (
    <div>
      {/* Encabezado navegación mes */}
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setViewDate(d => subMonths(d, 1))} aria-label="Mes anterior" className={navButton}>
          <ChevronLeft size={15} />
        </button>
        <span className="text-[13px] font-semibold text-fg">
          {title.charAt(0).toUpperCase() + title.slice(1)}
        </span>
        <button type="button" onClick={() => setViewDate(d => addMonths(d, 1))} aria-label="Mes siguiente" className={navButton}>
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Grid días */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {['LU','MA','MI','JU','VI','SA','DO'].map(d => (
          <div key={d} className="pb-1 text-center text-[10px] font-medium text-fg-subtle">{d}</div>
        ))}
        {days.map((day, i) => {
          const sel     = selectedDates.some(d => isSameDay(d, day));
          const today   = isSameDay(day, new Date());
          const other   = !isSameMonth(day, viewDate);
          const weekend = isWeekend(day);
          return (
            <button key={i} type="button" onClick={() => toggleDay(day)} aria-pressed={sel}
              className={`mx-auto flex aspect-square w-full max-w-9 items-center justify-center rounded-full text-xs tabular-nums transition-colors ${
                sel   ? 'bg-accent font-semibold text-accent-fg' :
                today ? 'bg-brand font-semibold text-brand-fg' :
                other ? 'text-fg-subtle/60 hover:bg-fg/[0.05]' :
                weekend ? 'text-danger/80 hover:bg-fg/[0.05]' :
                'text-fg hover:bg-fg/[0.06]'}`}>
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      {/* Días seleccionados */}
      {selectedDates.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-1.5 text-xs text-fg-muted">
            {selectedDates.length} día{selectedDates.length > 1 ? 's' : ''} seleccionado{selectedDates.length > 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-1">
            {[...selectedDates].sort((a, b) => a - b).map(d => (
              <button key={format(d,'yyyy-MM-dd')} type="button" onClick={() => toggleDay(d)}
                aria-label={`Quitar ${format(d, "d MMM", { locale: es })}`}
                className="inline-flex items-center gap-1 rounded-full bg-fg/[0.07] px-2 py-0.5 text-[11px] font-medium text-fg transition-colors hover:bg-danger/10 hover:text-danger">
                {format(d, "d MMM", { locale: es })}
                <X size={11} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DepartureSidebarForm({ tecnicos = [], onSaved, saving }) {
  const [tecnicoIds,    setTecnicoIds]    = useState([]);
  const [tipoSalida,    setTipoSalida]    = useState('');
  const [motivo,        setMotivo]        = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  const [tipoOpen,      setTipoOpen]      = useState(false);
  const tipoRef = useRef(null);

  const [defaultSchedule, setDefaultSchedule] = useState({ inicio: '08:30', fin: '18:30' });
  const [daySchedules, setDaySchedules] = useState({});
  const [conflicts, setConflicts] = useState([]);

  const grupos = useMemo(() => {
    const map = {};
    tecnicos.forEach(t => {
      const area = (typeof t.area === 'string' && t.area.trim()) ? t.area.trim() : 'Sin Área';
      if (!map[area]) map[area] = [];
      map[area].push(t);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [tecnicos]);

  useEffect(() => {
    if (tecnicoIds.length === 0) {
      setDefaultSchedule({ inicio: '08:30', fin: '18:30' });
      return;
    }
    const selectedTecs = tecnicos.filter(t => tecnicoIds.includes(t.id));
    let minI = 24 * 60;
    let maxF = 0;
    
    selectedTecs.forEach(t => {
      const i = toMin(t.hora_ingreso?.substring(0, 5) || '08:30');
      const f = toMin(t.hora_salida?.substring(0, 5)  || '18:30');
      if (i < minI) minI = i;
      if (f > maxF) maxF = f;
    });
    
    const formatTime = (mins) => {
      if (mins < 0 || mins >= 24*60) return '08:30';
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    
    const newDefault = { inicio: formatTime(minI), fin: formatTime(maxF) };
    setDefaultSchedule(newDefault);
    
    setDaySchedules(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
         next[k] = { ...newDefault };
      });
      return next;
    });
  }, [tecnicoIds, tecnicos]);

  useEffect(() => {
    if (selectedDates.length === 0 || tecnicoIds.length === 0) {
      setConflicts([]);
      return;
    }
    const check = async () => {
      try {
        const datesStr = selectedDates.map(d => format(d, 'yyyy-MM-dd')).sort();
        const minDate = datesStr[0];
        const maxDate = datesStr[datesStr.length - 1];

        const token = safeStorage.getItem('datamet_token');
        const res = await fetch(`${API_BASE}/calendar/cronograma?start=${minDate}&end=${maxDate}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Error al cargar cronograma');
        const json = await res.json();
        const rows = Array.isArray(json) ? json : (json.data || []);

        const found = [];
        rows.forEach(row => {
           if (row.estado && row.estado.toLowerCase() === 'anulado') return;
           // tecnicoIds son strings "NOMBRE_APELLIDO"; row.id_usuario es el ID numérico
           // → buscamos el técnico por su string-id y comparamos su user_id numérico
           const matchedTec = tecnicos.find(t =>
             tecnicoIds.includes(t.id) && t.user_id === row.id_usuario
           );
           if (!matchedTec) return;
           const rowDate = row.fecha;
           if (datesStr.includes(rowDate)) {
             found.push({ tecName: matchedTec.nombre, date: rowDate, title: row.cotizacion || row.descripcion || 'Actividad' });
           }
        });
        setConflicts(found);
      } catch(e) {
        console.error("Error validando conflictos:", e);
      }
    };

    const timeout = setTimeout(check, 500);
    return () => clearTimeout(timeout);
  }, [selectedDates, tecnicoIds, tecnicos]);

  useEffect(() => {
    if (!tipoOpen) return;
    const h = (e) => { if (tipoRef.current && !tipoRef.current.contains(e.target)) setTipoOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [tipoOpen]);

  const selectedTipo = TIPOS_SALIDA.find(t => t.value === tipoSalida);

  const toggleTecnico = (id) => {
    setTecnicoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllArea = (areaTecs) => {
    const ids = areaTecs.map(t => t.id);
    const allSelected = ids.every(id => tecnicoIds.includes(id));
    if (allSelected) {
      setTecnicoIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setTecnicoIds(prev => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleDatesChange = (dates) => {
    setSelectedDates(dates);
    setDaySchedules(prev => {
      const next = { ...prev };
      dates.forEach(d => {
        const k = format(d, 'yyyy-MM-dd');
        if (!next[k]) next[k] = { ...defaultSchedule };
      });
      Object.keys(next).forEach(k => {
        if (!dates.some(d => format(d, 'yyyy-MM-dd') === k)) delete next[k];
      });
      return next;
    });
  };

  const handleReset = () => {
    setTecnicoIds([]); setTipoSalida(''); setMotivo('');
    setSelectedDates([]); setDaySchedules({});
    setConflicts([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tecnicoIds.length === 0)    { toast.error('Selecciona al menos un miembro del personal.'); return; }
    if (!tipoSalida)                { toast.error('Selecciona el tipo de salida.'); return; }
    if (!motivo.trim())             { toast.error('Ingresa el motivo o lugar.'); return; }
    if (selectedDates.length === 0) { toast.error('Selecciona al menos una fecha.'); return; }

    for (const d of selectedDates) {
      const k = format(d, 'yyyy-MM-dd');
      const sched = daySchedules[k];
      if (sched && toMin(sched.fin) <= toMin(sched.inicio)) {
        toast.error(`La hora de retorno del ${format(d, 'd MMM')} debe ser posterior a su salida.`);
        return;
      }
    }

    await onSaved({
      tecnicoIds,
      dates: selectedDates,
      tipoSalida,
      motivo: motivo.trim(),
      daySchedules,
      estado: 'Solicitud',
      color: selectedTipo?.color || '#7c3aed',
    });
    handleReset();
  };

  const lblClass = 'text-[13px] font-medium text-fg';
  const dividerClass = 'h-px shrink-0 bg-line';

  return (
    <div className="card flex h-full w-full flex-shrink-0 flex-col overflow-hidden shadow-card">

      <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-fg">
            Registrar Salida
          </h3>
          <p className="text-[13px] text-fg-muted">
            Módulo administrativo
          </p>
        </div>
        <button type="button" onClick={handleReset}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger">
          <Trash2 className="h-3.5 w-3.5" /> Limpiar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-5">

        <div className="flex shrink-0 flex-col space-y-2">
          <p className={`flex items-center justify-between ${lblClass}`}>
            <span className="flex items-center gap-1.5"><Users size={14} className="text-fg-muted" />Personal Seleccionado</span>
            <span className="rounded-full bg-fg/[0.07] px-2 py-0.5 text-xs font-semibold tabular-nums">{tecnicoIds.length}</span>
          </p>
          <div className="flex w-full flex-col overflow-y-auto rounded-xl border border-line bg-surface" style={{ maxHeight: '200px' }}>
            {grupos.map(([area, tecs]) => {
              const allSelected = tecs.length > 0 && tecs.every(t => tecnicoIds.includes(t.id));
              return (
                <div key={area}>
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface-2 px-3 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{area}</span>
                    <button type="button" onClick={() => selectAllArea(tecs)} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-fg transition-colors hover:bg-fg/[0.07]">
                      {allSelected ? 'Quitar todos' : 'Todos'}
                    </button>
                  </div>
                  <div className="flex flex-col gap-0.5 p-1">
                    {tecs.map(t => {
                      const isSelected = tecnicoIds.includes(t.id);
                      return (
                        <button type="button" key={t.id} onClick={() => toggleTecnico(t.id)} aria-pressed={isSelected}
                          className={`flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${isSelected ? 'bg-fg/[0.06]' : 'hover:bg-fg/[0.04]'}`}>
                          <span className={`flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors ${isSelected ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong bg-surface'}`}>
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </span>
                          <span className={`select-none truncate text-[13px] ${isSelected ? 'font-medium text-fg' : 'text-fg-muted'}`}>
                            {t.nombre}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={dividerClass} />

        <div className="shrink-0 space-y-2" ref={tipoRef}>
          <p className={`flex items-center gap-1.5 ${lblClass}`}><MapPin size={14} className="text-fg-muted" />Tipo de Salida</p>
          <div className="relative">
            <button type="button" onClick={() => setTipoOpen(o => !o)} aria-haspopup="listbox" aria-expanded={tipoOpen}
              className="field flex h-10 items-center justify-between gap-2 text-left font-medium">
              <span className="flex min-w-0 items-center gap-2">
                {selectedTipo
                  ? <><span className="h-2.5 w-2.5 flex-shrink-0 rounded-full ring-1 ring-inset ring-black/10" style={{ backgroundColor: selectedTipo.color }} /><span className="truncate">{selectedTipo.label}</span></>
                  : <span className="font-normal text-fg-subtle">Seleccionar</span>}
              </span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-fg-subtle transition-transform ${tipoOpen ? 'rotate-180' : ''}`} />
            </button>
            {tipoOpen && (
              <div role="listbox" className="glass absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border p-1 animate-pop-in">
                {TIPOS_SALIDA.map(tipo => (
                  <button key={tipo.value} type="button" role="option" aria-selected={tipoSalida === tipo.value}
                    onClick={() => { setTipoSalida(tipo.value); setTipoOpen(false); }}
                    className="menu-item">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full ring-1 ring-inset ring-black/10" style={{ backgroundColor: tipo.color }} />
                    {tipo.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={dividerClass} />

        <div className="shrink-0 space-y-2">
          <label htmlFor="departure-motivo" className={`flex items-center justify-between ${lblClass}`}>
            <span>Motivo / Lugar</span>
            <span className={`text-xs font-normal tabular-nums ${motivo.length > 90 ? 'text-danger' : 'text-fg-subtle'}`}>{motivo.length}/100</span>
          </label>
          <textarea id="departure-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={100} rows={2} required
            placeholder="Ej: Visita a cliente..."
            className="field resize-none py-2.5" />
        </div>

        <div className={dividerClass} />

        <div className="shrink-0 space-y-2">
          <p className={`flex items-center gap-1.5 ${lblClass}`}><Calendar size={14} className="text-fg-muted" />Fecha(s) de Salida</p>
          <MultiDatePicker selectedDates={selectedDates} onChange={handleDatesChange} />
        </div>

        {conflicts.length > 0 && (
          <div className="shrink-0 rounded-xl border border-warning/25 bg-warning/[0.08] p-3" role="alert">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-warning">
              <AlertTriangle size={13} /> Alerta de Disponibilidad
            </p>
            <p className="mb-2 text-xs leading-snug text-fg-muted">
              El personal seleccionado ya tiene actividades en estas fechas:
            </p>
            <ul className="max-h-24 list-disc space-y-0.5 overflow-y-auto pl-4 text-xs text-fg">
               {conflicts.map((c, i) => (
                 <li key={i}><strong className="font-semibold">{c.tecName}</strong> el {c.date}: {c.title}</li>
               ))}
            </ul>
          </div>
        )}

        <div className={dividerClass} />

        {selectedDates.length > 0 && (
          <div className="shrink-0 space-y-2">
            <p className={`flex items-center gap-1.5 ${lblClass}`}>
              <Clock size={14} className="text-fg-muted" />
              Horarios Asignados
            </p>
            <div className="flex flex-col gap-2">
              {[...selectedDates].sort((a,b)=>a-b).map(date => {
                const k = format(date, 'yyyy-MM-dd');
                const sched = daySchedules[k] || defaultSchedule;
                const setSched = (field, val) => {
                  setDaySchedules(prev => ({ ...prev, [k]: { ...prev[k], [field]: val } }));
                };
                const inicioSlots = TIME_SLOTS;
                const finSlots = TIME_SLOTS.filter(t => toMin(t) > toMin(sched.inicio));

                return (
                  <div key={k} className="flex items-center justify-between rounded-xl border border-line-strong bg-surface px-3 py-1 shadow-xs">
                    <span className="w-14 shrink-0 text-xs font-semibold text-fg">
                      {format(date, 'd MMM', { locale: es })}
                    </span>
                    <div className="flex min-w-0 flex-1 items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2">
                        <span className="shrink-0 text-[11px] text-fg-subtle">De</span>
                        <TimeSelect value={sched.inicio} slots={inicioSlots}
                          onChange={(v) => {
                            setSched('inicio', v);
                            if (toMin(sched.fin) <= toMin(v)) {
                              const nxt = TIME_SLOTS.find(t => toMin(t) > toMin(v));
                              if (nxt) setSched('fin', nxt);
                            }
                          }} />
                      </div>
                      <div className="h-6 w-px shrink-0 bg-line" />
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2">
                        <span className="shrink-0 text-[11px] text-fg-subtle">A</span>
                        <TimeSelect value={sched.fin} slots={finSlots} onChange={(v) => setSched('fin', v)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button type="submit" disabled={saving}
          className={`mt-4 flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-brand-fg shadow-xs ring-1 ring-inset ring-black/5 transition-[background-color,transform] duration-150 ${saving ? 'cursor-wait opacity-60' : 'hover:bg-brand-hover active:translate-y-px'}`}>
          <Check size={16} />
          {saving ? 'Guardando...' : `Registrar Salida${selectedDates.length > 1 ? ` (${selectedDates.length} días)` : ''}`}
        </button>
      </form>
    </div>
  );
}
