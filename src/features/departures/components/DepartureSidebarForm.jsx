import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trash2, ChevronDown, Clock, Calendar, Users, MapPin, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, isWeekend
} from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useTheme } from '../../../shared/context/ThemeContext';
import { TIPOS_SALIDA } from '../constants';

const TIME_SLOTS = (() => {
  const s = [];
  for (let m = 0; m < 24 * 60; m += 30)
    s.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '00')}`);
  return s;
})();
const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// ── Selector de hora — igual al del CellPopoverForm ──
function TimeSelect({ value, onChange, slots, isDarkGantt }) {
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
    <div ref={ref} className="relative flex-1 min-w-0">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-1 py-2 text-xs font-semibold bg-transparent border-none outline-none cursor-pointer ${isDarkGantt ? 'text-gray-100' : 'text-gray-800'}`}>
        <span className="font-mono tracking-wide">{value}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''} ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`} />
      </button>
      {open && (
        <div className={`absolute z-[200] bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-24 rounded-xl border shadow-2xl overflow-hidden ${isDarkGantt ? 'bg-[#1e1e24] border-white/10 shadow-black/80' : 'bg-white border-gray-200 shadow-gray-300/40'}`}>
          <div ref={listRef} className="max-h-44 overflow-y-auto py-1 custom-scrollbar">
            {slots.map(t => (
              <button key={t} type="button" data-selected={t === value}
                onClick={() => { onChange(t); setOpen(false); }}
                className={`w-full text-left px-3 py-[5px] text-xs font-mono font-semibold transition-colors ${t === value ? (isDarkGantt ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600') : (isDarkGantt ? 'text-gray-300 hover:bg-white/6 hover:text-white' : 'text-gray-700 hover:bg-gray-50')}`}>
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
function MultiDatePicker({ selectedDates, onChange, isDarkGantt }) {
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

  return (
    <div>
      {/* Encabezado navegación mes */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setViewDate(d => subMonths(d, 1))}
          className={`p-1 rounded-lg transition-colors ${isDarkGantt ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-black/5'}`}>
          <ChevronLeft size={13} />
        </button>
        <span className={`text-[10px] font-bold uppercase tracking-widest capitalize ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>
          {title.charAt(0).toUpperCase() + title.slice(1)}
        </span>
        <button type="button" onClick={() => setViewDate(d => addMonths(d, 1))}
          className={`p-1 rounded-lg transition-colors ${isDarkGantt ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-black/5'}`}>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Grid días */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {['LU','MA','MI','JU','VI','SA','DO'].map(d => (
          <div key={d} className={`text-center text-[9px] font-bold pb-1 ${isDarkGantt ? 'text-gray-600' : 'text-gray-400'}`}>{d}</div>
        ))}
        {days.map((day, i) => {
          const sel     = selectedDates.some(d => isSameDay(d, day));
          const today   = isSameDay(day, new Date());
          const other   = !isSameMonth(day, viewDate);
          const weekend = isWeekend(day);
          return (
            <button key={i} type="button" onClick={() => toggleDay(day)}
              className={`flex items-center justify-center w-full aspect-square rounded-full text-[11px] font-semibold transition-all
                ${sel   ? 'bg-[#10b981] text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                  today ? `ring-2 ${isDarkGantt ? 'ring-[#3b82f6]/80 text-white' : 'ring-blue-500/60 text-blue-600'}` :
                  other ? (isDarkGantt ? 'text-gray-700' : 'text-gray-300') :
                  weekend ? (isDarkGantt ? 'text-orange-400/50 hover:bg-white/5' : 'text-orange-500/60 hover:bg-orange-50') :
                  (isDarkGantt ? 'text-gray-300 hover:bg-white/8' : 'text-gray-700 hover:bg-black/5')}`}>
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      {/* Días seleccionados */}
      {selectedDates.length > 0 && (
        <div className={`mt-2 pt-2 border-t ${isDarkGantt ? 'border-white/8' : 'border-gray-200'}`}>
          <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>
            {selectedDates.length} día{selectedDates.length > 1 ? 's' : ''} seleccionado{selectedDates.length > 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-1">
            {[...selectedDates].sort((a, b) => a - b).map(d => (
              <button key={format(d,'yyyy-MM-dd')} type="button" onClick={() => toggleDay(d)}
                className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${isDarkGantt ? 'bg-[#10b981]/20 text-[#10b981] hover:bg-red-500/20 hover:text-red-400' : 'bg-[#10b981]/10 text-[#059669] hover:bg-red-100 hover:text-red-600'}`}>
                {format(d, "d MMM", { locale: es })} ×
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulario lateral — estilo CellPopoverForm ──
export function DepartureSidebarForm({ tecnicos = [], onSaved, saving }) {
  const { isDarkGantt } = useTheme();
  const [tecnicoIds,    setTecnicoIds]    = useState([]);
  const [tipoSalida,    setTipoSalida]    = useState('');
  const [motivo,        setMotivo]        = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  const [horaInicio,    setHoraInicio]    = useState('08:30');
  const [horaFin,       setHoraFin]       = useState('18:30');
  const [tipoOpen,      setTipoOpen]      = useState(false);
  const tipoRef = useRef(null);

  // Agrupar técnicos por área
  const grupos = useMemo(() => {
    const map = {};
    tecnicos.forEach(t => {
      const area = (typeof t.area === 'string' && t.area.trim()) ? t.area.trim() : 'Sin Área';
      if (!map[area]) map[area] = [];
      map[area].push(t);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [tecnicos]);

  // Recalcular horario por defecto (min ingreso y max salida de los seleccionados)
  useEffect(() => {
    if (tecnicoIds.length === 0) {
      setHoraInicio('08:30');
      setHoraFin('18:30');
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
    
    setHoraInicio(formatTime(minI));
    setHoraFin(formatTime(maxF));
  }, [tecnicoIds, tecnicos]);

  useEffect(() => {
    if (!tipoOpen) return;
    const h = (e) => { if (tipoRef.current && !tipoRef.current.contains(e.target)) setTipoOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [tipoOpen]);

  const selectedTipo = TIPOS_SALIDA.find(t => t.value === tipoSalida);
  // Permitimos todas las horas para que si DATA_USERS está mal, igual puedan registrar
  const horaInicioSlots  = TIME_SLOTS;
  const horaFinSlots     = TIME_SLOTS.filter(t => toMin(t) > toMin(horaInicio));

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

  const handleReset = () => {
    setTecnicoIds([]); setTipoSalida(''); setMotivo('');
    setSelectedDates([]); setHoraInicio('08:30'); setHoraFin('18:30');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tecnicoIds.length === 0)    { toast.error('Selecciona al menos un miembro del personal.'); return; }
    if (!tipoSalida)                { toast.error('Selecciona el tipo de salida.'); return; }
    if (!motivo.trim())             { toast.error('Ingresa el motivo o lugar.'); return; }
    if (selectedDates.length === 0) { toast.error('Selecciona al menos una fecha.'); return; }
    if (toMin(horaFin) <= toMin(horaInicio)) { toast.error('La hora de retorno debe ser posterior a la hora de salida.'); return; }

    await onSaved({
      tecnicoIds,
      dates: selectedDates,
      tipoSalida,
      motivo: motivo.trim(),
      horaInicio,
      horaFin,
      estado: 'Solicitud',
      color: selectedTipo?.color || '#7c3aed',
    });
    handleReset();
  };

  // ── Mismo fondo sólido que CellPopoverForm ──
  const bgClass  = isDarkGantt ? 'bg-[#1a1a1d] border-gray-700/50' : 'bg-white border-gray-200';
  const lblClass = `text-[10px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`;
  const inputClass = `w-full border rounded-xl px-3 py-2 text-sm focus:outline-none transition-all ${isDarkGantt ? 'bg-[#111111] border-white/5 text-gray-200 placeholder-gray-700 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20'}`;
  const dividerClass = `h-px shrink-0 ${isDarkGantt ? 'bg-white/8' : 'bg-gray-100'}`;

  return (
    <div className={`flex flex-col border rounded-2xl shadow-2xl overflow-hidden flex-shrink-0 w-full h-full ${bgClass}`}>

      {/* ── Header — igual al CellPopoverForm ── */}
      <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${isDarkGantt ? 'border-gray-800 bg-[#1e1e22]' : 'border-gray-200 bg-gray-50'}`}>
        <div>
          <h3 className={`text-[11px] font-semibold uppercase tracking-widest mb-1 ${isDarkGantt ? 'text-gray-100' : 'text-gray-800'}`}>
            Registrar Salida
          </h3>
          <p className={`text-sm font-medium ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>
            Módulo administrativo
          </p>
        </div>
        <button type="button" onClick={handleReset}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${isDarkGantt ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300' : 'text-red-600 bg-red-50 hover:bg-red-100'}`}>
          <Trash2 className="w-3 h-3" /> Limpiar
        </button>
      </div>

      {/* ── Body ── */}
      <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto custom-scrollbar flex-1">

        {/* Personal Multiselect */}
        <div className="space-y-2 flex flex-col shrink-0">
          <label className={`flex items-center justify-between ${lblClass}`}>
            <span className="flex items-center gap-1.5"><Users size={10} />Personal Seleccionado</span>
            <span className={`text-[10px] font-black ${isDarkGantt ? 'text-blue-400' : 'text-blue-600'}`}>{tecnicoIds.length}</span>
          </label>
          <div className={`w-full rounded-xl border overflow-y-auto custom-scrollbar flex flex-col ${isDarkGantt ? 'bg-[#111111] border-white/5' : 'bg-gray-50 border-gray-200'}`} style={{ maxHeight: '180px' }}>
            {grupos.map(([area, tecs], idx) => {
              const allSelected = tecs.length > 0 && tecs.every(t => tecnicoIds.includes(t.id));
              return (
                <div key={area} className={idx > 0 ? "mt-2" : ""}>
                  <div className={`flex items-center justify-between px-3 py-2 sticky top-0 z-10 border-b border-transparent ${isDarkGantt ? 'bg-[#111111]' : 'bg-gray-50'}`}>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>{area}</span>
                    <button type="button" onClick={() => selectAllArea(tecs)} className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${isDarkGantt ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-100'}`}>
                      {allSelected ? 'Quitar todos' : 'Todos'}
                    </button>
                  </div>
                  <div className="flex flex-col gap-0.5 px-2 pb-1">
                    {tecs.map(t => {
                      const isSelected = tecnicoIds.includes(t.id);
                      return (
                        <div key={t.id} onClick={() => toggleTecnico(t.id)} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${isSelected ? (isDarkGantt ? 'bg-blue-500/20' : 'bg-blue-50') : (isDarkGantt ? 'hover:bg-white/5' : 'hover:bg-black/5')}`}>
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : (isDarkGantt ? 'border-gray-600 bg-transparent' : 'border-gray-300 bg-white')}`}>
                            {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                          </div>
                          <span className={`text-[11px] font-semibold truncate select-none ${isSelected ? (isDarkGantt ? 'text-blue-300' : 'text-blue-700') : (isDarkGantt ? 'text-gray-300' : 'text-gray-700')}`}>
                            {t.nombre}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={dividerClass} />

        {/* Tipo de salida */}
        <div className="space-y-2 shrink-0" ref={tipoRef}>
          <label className={`flex items-center gap-1.5 ${lblClass}`}><MapPin size={10} />Tipo de Salida</label>
          <div className="relative">
            <button type="button" onClick={() => setTipoOpen(o => !o)}
              className={`w-full flex items-center justify-between gap-2 border rounded-xl px-3 py-2 text-sm font-semibold transition-all ${isDarkGantt ? 'bg-[#111111] border-white/5 text-gray-200 hover:border-white/15' : 'bg-gray-50 border-gray-200 text-gray-800 hover:border-gray-300'}`}>
              <div className="flex items-center gap-2 min-w-0">
                {selectedTipo
                  ? <><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selectedTipo.color }} /><span className="truncate">{selectedTipo.label}</span></>
                  : <span className={isDarkGantt ? 'text-gray-600' : 'text-gray-400'}>— Seleccionar —</span>}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${tipoOpen ? 'rotate-180' : ''} ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`} />
            </button>
            {tipoOpen && (
              <div className={`absolute z-50 top-[calc(100%+4px)] left-0 right-0 rounded-xl border shadow-2xl overflow-hidden ${isDarkGantt ? 'bg-[#1e1e24] border-white/10' : 'bg-white border-gray-200'}`}>
                {TIPOS_SALIDA.map(tipo => (
                  <button key={tipo.value} type="button"
                    onClick={() => { setTipoSalida(tipo.value); setTipoOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors ${tipoSalida === tipo.value ? (isDarkGantt ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700') : (isDarkGantt ? 'text-gray-300 hover:bg-white/6 hover:text-white' : 'text-gray-700 hover:bg-gray-50')}`}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tipo.color }} />
                    {tipo.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={dividerClass} />

        {/* Motivo */}
        <div className="space-y-2 shrink-0">
          <label className={`flex items-center justify-between ${lblClass}`}>
            <span>Motivo / Lugar</span>
            <span className={motivo.length > 90 ? 'text-red-400' : (isDarkGantt ? 'text-gray-700' : 'text-gray-300')}>{motivo.length}/100</span>
          </label>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={100} rows={2} required
            placeholder="Ej: Visita a cliente, entrega de equipos..."
            className={`${inputClass} resize-none`} />
        </div>

        <div className={dividerClass} />

        {/* Fechas */}
        <div className="space-y-2 shrink-0">
          <label className={`flex items-center gap-1.5 ${lblClass}`}><Calendar size={10} />Fecha(s) de Salida</label>
          <MultiDatePicker selectedDates={selectedDates} onChange={setSelectedDates} isDarkGantt={isDarkGantt} />
        </div>

        <div className={dividerClass} />

        {/* Rango horario — mismo layout exacto que CellPopoverForm */}
        <div className="space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <Clock className={`w-3 h-3 ${isDarkGantt ? 'text-blue-400' : 'text-blue-500'}`} />
            <label className={lblClass}>Rango Horario</label>
          </div>
          <div className={`flex items-center rounded-xl border overflow-visible ${isDarkGantt ? 'bg-[#111]/60 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-1.5 pl-3 pr-2 py-0.5 flex-1 min-w-0">
              <span className={`text-[9px] font-bold uppercase tracking-widest shrink-0 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>De</span>
              <TimeSelect value={horaInicio} slots={horaInicioSlots} isDarkGantt={isDarkGantt}
                onChange={(v) => { setHoraInicio(v); if (toMin(horaFin) <= toMin(v)) { const nxt = TIME_SLOTS.find(t => toMin(t) > toMin(v)); if (nxt) setHoraFin(nxt); } }} />
            </div>
            <div className={`w-px self-stretch ${isDarkGantt ? 'bg-white/10' : 'bg-gray-200'}`} />
            <div className="flex items-center gap-1.5 pl-3 pr-2 py-0.5 flex-1 min-w-0">
              <span className={`text-[9px] font-bold uppercase tracking-widest shrink-0 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>A</span>
              <TimeSelect value={horaFin} slots={horaFinSlots} isDarkGantt={isDarkGantt} onChange={setHoraFin} />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button type="submit" disabled={saving}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 mt-4 ${saving ? 'opacity-60 cursor-wait' : 'hover:opacity-90 active:scale-[0.98]'} ${isDarkGantt ? 'bg-[#10b981] text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]' : 'bg-[#10b981] text-white shadow-[0_4px_12px_rgba(16,185,129,0.25)]'}`}>
          <Check size={16} />
          {saving ? 'Guardando...' : `Registrar Salida${selectedDates.length > 1 ? ` (${selectedDates.length} días)` : ''}`}
        </button>
      </form>
    </div>
  );
}
