import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Check, ChevronDown, Clock, Calendar, User, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, isWeekend } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTheme } from '../../../shared/context/ThemeContext';
import { toast } from 'sonner';
import { TIPOS_SALIDA } from '../constants';



const TIME_SLOTS = (() => {
  const s = [];
  for (let m = 0; m < 24 * 60; m += 30)
    s.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return s;
})();
const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function TimeSelect({ value, onChange, slots, isDarkGantt }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="relative flex-1">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-1 px-3 py-2 rounded-xl border text-xs font-mono font-semibold transition-all ${isDarkGantt ? 'bg-white/5 border-white/10 text-gray-200 hover:border-white/25' : 'bg-white border-gray-200 text-gray-800 hover:border-gray-300'}`}>
        {value}
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`} />
      </button>
      {open && (
        <div className={`absolute z-[200] top-[calc(100%+4px)] left-0 w-28 rounded-xl border shadow-2xl overflow-hidden ${isDarkGantt ? 'bg-[#1e1e24] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="max-h-44 overflow-y-auto py-1 custom-scrollbar">
            {slots.map(t => (
              <button key={t} type="button" onClick={() => { onChange(t); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono font-semibold transition-colors ${t === value ? (isDarkGantt ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-600') : (isDarkGantt ? 'text-gray-300 hover:bg-white/6' : 'text-gray-700 hover:bg-gray-50')}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MultiDatePicker({ selectedDates, onChange, isDarkGantt }) {
  const [viewDate, setViewDate] = useState(new Date());
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const title = format(viewDate, 'MMMM yyyy', { locale: es });
  const titleCap = title.charAt(0).toUpperCase() + title.slice(1);

  const toggleDay = (day) => {
    const str = format(day, 'yyyy-MM-dd');
    const exists = selectedDates.find(d => format(d, 'yyyy-MM-dd') === str);
    if (exists) onChange(selectedDates.filter(d => format(d, 'yyyy-MM-dd') !== str));
    else onChange([...selectedDates, day]);
  };

  const isSelected = (day) => selectedDates.some(d => isSameDay(d, day));
  const isToday = (day) => isSameDay(day, new Date());

  return (
    <div className={`rounded-2xl border p-4 ${isDarkGantt ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setViewDate(d => subMonths(d, 1))}
          className={`p-1.5 rounded-lg transition-colors ${isDarkGantt ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>
          <ChevronLeft size={14} />
        </button>
        <span className={`text-xs font-bold uppercase tracking-wider ${isDarkGantt ? 'text-gray-200' : 'text-gray-700'}`}>{titleCap}</span>
        <button type="button" onClick={() => setViewDate(d => addMonths(d, 1))}
          className={`p-1.5 rounded-lg transition-colors ${isDarkGantt ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {['LU','MA','MI','JU','VI','SA','DO'].map(d => (
          <div key={d} className={`text-center text-[9px] font-bold pb-1.5 ${isDarkGantt ? 'text-gray-600' : 'text-gray-400'}`}>{d}</div>
        ))}
        {days.map((day, i) => {
          const sel = isSelected(day);
          const today = isToday(day);
          const otherMonth = !isSameMonth(day, viewDate);
          const weekend = isWeekend(day);
          return (
            <button key={i} type="button" onClick={() => toggleDay(day)}
              className={`flex items-center justify-center w-full aspect-square rounded-lg text-[11px] font-semibold transition-all
                ${sel ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-400/40' :
                  today ? (isDarkGantt ? 'ring-2 ring-blue-400/60 text-blue-300' : 'ring-2 ring-blue-500/50 text-blue-600') :
                  otherMonth ? (isDarkGantt ? 'text-gray-700' : 'text-gray-300') :
                  weekend ? (isDarkGantt ? 'text-orange-400/60 hover:bg-orange-500/10' : 'text-orange-500/70 hover:bg-orange-50') :
                  (isDarkGantt ? 'text-gray-300 hover:bg-white/8' : 'text-gray-700 hover:bg-gray-200')}`}>
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
      {selectedDates.length > 0 && (
        <div className="mt-3 pt-3 border-t border-dashed border-purple-500/30">
          <p className={`text-[10px] font-semibold mb-1.5 ${isDarkGantt ? 'text-purple-400' : 'text-purple-600'}`}>
            {selectedDates.length} día{selectedDates.length > 1 ? 's' : ''} seleccionado{selectedDates.length > 1 ? 's' : ''}:
          </p>
          <div className="flex flex-wrap gap-1">
            {[...selectedDates].sort((a,b) => a-b).map(d => (
              <span key={format(d,'yyyy-MM-dd')} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDarkGantt ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                {format(d, "d MMM", { locale: es })}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DepartureFormModal({ onClose, onSaved, tecnicos = [], saving }) {
  const { isDarkGantt } = useTheme();
  const [tecnicoId,    setTecnicoId]    = useState('');
  const [tipoSalida,   setTipoSalida]   = useState('');
  const [motivo,       setMotivo]       = useState('');
  const [selectedDates,setSelectedDates]= useState([]);
  const [horaInicio,   setHoraInicio]   = useState('08:30');
  const [horaFin,      setHoraFin]      = useState('18:30');
  const [tipoOpen,     setTipoOpen]     = useState(false);
  const tipoRef = useRef(null);

  // Horario del técnico seleccionado
  const selectedTec = useMemo(() => tecnicos.find(t => t.id === tecnicoId), [tecnicos, tecnicoId]);
  const jInicio = selectedTec?.hora_ingreso?.substring(0, 5) || '08:30';
  const jFin    = selectedTec?.hora_salida?.substring(0, 5)  || '18:30';

  useEffect(() => {
    setHoraInicio(jInicio);
    setHoraFin(jFin);
  }, [jInicio, jFin]);

  useEffect(() => {
    if (!tipoOpen) return;
    const h = (e) => { if (tipoRef.current && !tipoRef.current.contains(e.target)) setTipoOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [tipoOpen]);

  const selectedTipo = TIPOS_SALIDA.find(t => t.value === tipoSalida);

  const horaInicioSlots = TIME_SLOTS.filter(t => toMin(t) >= toMin(jInicio) && toMin(t) < toMin(jFin));
  const horaFinSlots    = TIME_SLOTS.filter(t => toMin(t) > toMin(horaInicio) && toMin(t) <= toMin(jFin));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tecnicoId)             { toast.error('Selecciona el personal.'); return; }
    if (!tipoSalida)            { toast.error('Selecciona el tipo de salida.'); return; }
    if (!motivo.trim())         { toast.error('Ingresa el motivo o lugar de la salida.'); return; }
    if (selectedDates.length === 0) { toast.error('Selecciona al menos una fecha.'); return; }
    if (toMin(horaFin) <= toMin(horaInicio)) { toast.error('La hora de retorno debe ser posterior a la hora de salida.'); return; }

    await onSaved({
      tecnicoId,
      dates: selectedDates,
      tipoSalida,
      motivo: motivo.trim(),
      horaInicio,
      horaFin,
      estado: 'Solicitud',
      color: selectedTipo?.color || '#7c3aed',
    });
  };

  const glassModal = {
    background: isDarkGantt ? 'rgba(22,22,28,0.96)' : 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-3xl shadow-2xl border animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] ${isDarkGantt ? 'border-white/10' : 'border-gray-200'}`} style={glassModal}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${isDarkGantt ? 'border-white/8' : 'border-gray-100'}`}>
          <div>
            <h2 className={`text-base font-bold tracking-tight ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>Nueva Salida del Personal</h2>
            <p className={`text-[11px] mt-0.5 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>Registro administrativo — se guarda en CronoMET</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${isDarkGantt ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-900'}`}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form id="departure-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5 custom-scrollbar">

          {/* Personal */}
          <div className="space-y-1.5">
            <label className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>
              <User size={11} /> Personal
            </label>
            <select value={tecnicoId} onChange={e => setTecnicoId(e.target.value)} required
              className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${isDarkGantt ? 'bg-white/5 border-white/10 text-gray-200 focus:border-purple-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500'}`}>
              <option value="">— Seleccionar personal —</option>
              {tecnicos.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} {t.area ? `(${t.area})` : ''}</option>
              ))}
            </select>
            {selectedTec && (
              <p className={`text-[10px] pl-1 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>
                Jornada: <span className="font-semibold font-mono">{jInicio} → {jFin}</span>
              </p>
            )}
          </div>

          {/* Tipo de Salida */}
          <div className="space-y-1.5" ref={tipoRef}>
            <label className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>
              <MapPin size={11} /> Tipo de Salida
            </label>
            <div className="relative">
              <button type="button" onClick={() => setTipoOpen(o => !o)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${isDarkGantt ? 'bg-white/5 border-white/10 text-gray-200 hover:border-purple-500/50' : 'bg-gray-50 border-gray-200 text-gray-800 hover:border-purple-400'}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  {selectedTipo
                    ? <><span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedTipo.color }} /><span className="truncate">{selectedTipo.label}</span></>
                    : <span className={isDarkGantt ? 'text-gray-500' : 'text-gray-400'}>— Seleccionar tipo —</span>}
                </div>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${tipoOpen ? 'rotate-180' : ''} ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`} />
              </button>
              {tipoOpen && (
                <div className={`absolute z-50 top-[calc(100%+4px)] left-0 right-0 rounded-2xl border shadow-2xl overflow-hidden ${isDarkGantt ? 'bg-[#1e1e28] border-white/10' : 'bg-white border-gray-200'}`}>
                  {TIPOS_SALIDA.map(tipo => (
                    <button key={tipo.value} type="button"
                      onClick={() => { setTipoSalida(tipo.value); setTipoOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors ${tipoSalida === tipo.value ? (isDarkGantt ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200') : (isDarkGantt ? 'text-gray-300 hover:bg-white/10 hover:text-white border border-transparent' : 'text-gray-700 hover:bg-gray-100 border border-transparent hover:text-gray-900')}`}>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tipo.color }} />
                      {tipo.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>
              <span>Motivo / Lugar</span>
              <span className={motivo.length > 90 ? 'text-red-400' : (isDarkGantt ? 'text-gray-600' : 'text-gray-300')}>{motivo.length}/100</span>
            </label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={100} rows={2} required
              placeholder="Ej: Visita a cliente en Planta Norte, entrega de equipos..."
              className={`w-full px-3 py-2.5 rounded-xl border text-sm resize-none outline-none transition-all ${isDarkGantt ? 'bg-white/5 border-white/10 text-gray-200 placeholder-gray-600 focus:border-purple-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-500'}`} />
          </div>

          {/* Fechas */}
          <div className="space-y-1.5">
            <label className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>
              <Calendar size={11} /> Fecha(s) de Salida
            </label>
            <MultiDatePicker selectedDates={selectedDates} onChange={setSelectedDates} isDarkGantt={isDarkGantt} />
          </div>

          {/* Rango Horario */}
          <div className="space-y-1.5">
            <label className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>
              <Clock size={11} /> Horario (Salida → Retorno estimado)
            </label>
            <div className="flex gap-3 items-center">
              <TimeSelect value={horaInicio} onChange={v => { setHoraInicio(v); if (toMin(horaFin) <= toMin(v)) { const nxt = TIME_SLOTS.find(t => toMin(t) > toMin(v)); if (nxt) setHoraFin(nxt); } }} slots={horaInicioSlots} isDarkGantt={isDarkGantt} />
              <span className={`text-xs font-bold flex-shrink-0 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>→</span>
              <TimeSelect value={horaFin} onChange={setHoraFin} slots={horaFinSlots} isDarkGantt={isDarkGantt} />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className={`flex gap-3 px-6 py-4 border-t flex-shrink-0 ${isDarkGantt ? 'border-white/8' : 'border-gray-100'}`}>
          <button type="button" onClick={onClose}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-colors ${isDarkGantt ? 'bg-white/5 hover:bg-white/10 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
            Cancelar
          </button>
          <button id="departure-submit-btn" type="submit" form="departure-form" disabled={saving}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold transition-all ${saving ? 'opacity-60 cursor-wait' : 'hover:scale-[1.02] active:scale-[0.98]'} ${isDarkGantt ? 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white' : 'bg-gray-900 hover:bg-gray-700 text-white'}`}>
            <Check size={16} />
            {saving ? 'Guardando...' : `Registrar${selectedDates.length > 1 ? ` (${selectedDates.length} días)` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
