import React, { useMemo, useState } from 'react';
import { Filter, Users, ChevronDown, ChevronRight, Info, Bell, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const glassStyle = {
  background: 'rgba(73, 73, 73, 0.35)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

export function LeftFilterSidebar({
  tecnicos = [],
  // Props del mini-calendario y detalle del día
  currentDate,
  selectedDay,
  calendarDays = [],
  onSelectDay,
  eventsForDay,
  isSameMonth,
  isSameDay,
  isToday,
  prevMonth,
  nextMonth,
  selectedDayEvents = [],
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // ── Mini calendario ──
  const monthTitle = currentDate ? format(currentDate, 'MMMM yyyy', { locale: es }) : '';
  const monthTitleCapitalized = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);
  const dayAbbreviations = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];

  const getDayClass = (day) => {
    let classes = 'relative flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-[13px] font-medium cursor-pointer transition-all ';
    if (isSameDay && selectedDay && isSameDay(day, selectedDay)) {
      classes += 'bg-[#10b981] text-white shadow-[0_0_12px_rgba(16,185,129,0.6)] font-bold ';
    } else if (isToday && isToday(day)) {
      classes += 'bg-transparent text-white font-bold ring-2 ring-[#3b82f6]/80 shadow-[0_0_10px_rgba(59,130,246,0.5)] ';
    } else if (isSameMonth && currentDate && !isSameMonth(day, currentDate)) {
      classes += 'text-gray-600 hover:text-gray-400 ';
    } else {
      classes += 'text-gray-300 hover:bg-white/5 hover:text-white ';
    }
    return classes;
  };

  // ── Detalle del día ──
  const getStateBadgeClass = (estado) => {
    switch(estado) {
      case 'Completado': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30';
      case 'En Proceso': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30';
      case 'Cancelado':  return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-red-500/20 text-red-400 ring-1 ring-red-500/30';
      default:           return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30';
    }
  };

  const tecnicoMap = {};
  selectedDayEvents.forEach(evt => {
    const key = evt.client;
    if (!tecnicoMap[key]) {
      tecnicoMap[key] = {
        client: key,
        morning: evt.morning || '',
        afternoon: evt.afternoon || '',
        colorAM: evt.colorAM || '',
        colorPM: evt.colorPM || '',
        estadoAM: evt.estadoAM || 'Pendiente',
        estadoPM: evt.estadoPM || 'Pendiente',
      };
    } else {
      if (!tecnicoMap[key].morning && evt.morning) { tecnicoMap[key].morning = evt.morning; tecnicoMap[key].estadoAM = evt.estadoAM || 'Pendiente'; }
      if (!tecnicoMap[key].afternoon && evt.afternoon) { tecnicoMap[key].afternoon = evt.afternoon; tecnicoMap[key].estadoPM = evt.estadoPM || 'Pendiente'; }
      if (!tecnicoMap[key].colorAM && evt.colorAM) tecnicoMap[key].colorAM = evt.colorAM;
      if (!tecnicoMap[key].colorPM && evt.colorPM) tecnicoMap[key].colorPM = evt.colorPM;
    }
  });
  const tecnicosDelDia = Object.values(tecnicoMap);

  return (
    <aside className="w-full xl:w-[300px] flex-shrink-0 flex flex-col gap-4 select-none">

      {/* ── 1. Mini Calendario ── */}
      {currentDate && (
        <div className="rounded-3xl border border-white/10 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative overflow-hidden" style={glassStyle}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[100px] bg-primary-500/10 blur-[50px] rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h2 className="text-[13px] font-bold text-gray-100 uppercase tracking-widest">{monthTitleCapitalized}</h2>
            <div className="flex gap-2">
              <button onClick={prevMonth} className="p-1.5 text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg">
                <ChevronLeft size={16} />
              </button>
              <button onClick={nextMonth} className="p-1.5 text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-1 relative z-10">
            {dayAbbreviations.map(day => (
              <div key={day} className="text-center text-[10px] font-bold text-gray-500 mb-2">{day}</div>
            ))}
            {calendarDays.map((day, idx) => {
              const evts = eventsForDay ? eventsForDay(day) : [];
              const amt = evts.length;
              return (
                <div key={idx} className="flex justify-center items-center relative group p-0.5">
                  <button onClick={() => onSelectDay && onSelectDay(day)} className={getDayClass(day)}>
                    <span className="relative z-10">{format(day, 'd')}</span>
                    {amt > 0 && isSameDay && selectedDay && !isSameDay(day, selectedDay) && (
                      <div className="absolute bottom-1 sm:bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-500/60 rounded-full" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. Detalle del Día (Compacto) ── */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 mb-1">Detalle del Día</h3>
        {tecnicosDelDia.length === 0 ? (
          <div className="border border-white/10 rounded-2xl p-3 flex items-center justify-center opacity-50" style={glassStyle}>
            <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase flex items-center gap-2">
              <Bell className="w-3 h-3" /> Sin Novedades
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[280px] custom-scrollbar pr-1">
            {tecnicosDelDia.map((evt, idx) => {
              const hasMorning   = evt.morning   && evt.morning.trim()   !== '';
              const hasAfternoon = evt.afternoon && evt.afternoon.trim() !== '';
              return (
                <div key={idx} className="border border-white/[0.07] rounded-xl px-3 py-2 hover:border-white/15 hover:bg-white/[0.03] transition-all" style={glassStyle}>
                  {/* Nombre + dots de turno */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-bold text-gray-100 truncate leading-none capitalize">
                      {evt.client?.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {hasMorning   && <div className="w-1.5 h-1.5 rounded-full ring-1 ring-black/20" style={{ backgroundColor: evt.colorAM || '#10B981' }} title="Mañana" />}
                      {hasAfternoon && <div className="w-1.5 h-1.5 rounded-full ring-1 ring-black/20" style={{ backgroundColor: evt.colorPM || '#F59E0B' }} title="Tarde" />}
                    </div>
                  </div>
                  {/* Turnos en filas compactas */}
                  <div className="flex flex-col gap-0.5">
                    {hasMorning && (
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold text-gray-600 uppercase w-3 flex-shrink-0">AM</span>
                        <p className="text-[10px] text-gray-400 truncate flex-1 leading-tight">{evt.morning}</p>
                        <span className={getStateBadgeClass(evt.estadoAM)}>{evt.estadoAM || 'Pendiente'}</span>
                      </div>
                    )}
                    {hasAfternoon && (
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold text-gray-600 uppercase w-3 flex-shrink-0">PM</span>
                        <p className="text-[10px] text-gray-400 truncate flex-1 leading-tight">{evt.afternoon}</p>
                        <span className={getStateBadgeClass(evt.estadoPM)}>{evt.estadoPM || 'Pendiente'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* ── 4. Referencia de Colores ── */}
      <div className="rounded-3xl border border-white/10 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative overflow-hidden" style={glassStyle}>
        <div className="absolute top-[-50px] right-[-50px] w-[150px] h-[150px] bg-white/5 blur-[50px] rounded-full pointer-events-none" />
        <div className="flex items-center gap-2.5 mb-4 relative z-10">
          <div className="p-1.5 bg-white/10 rounded-lg">
            <Info className="w-3.5 h-3.5 text-gray-300" />
          </div>
          <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">Referencia de Colores</h3>
        </div>
        <div className="flex flex-col gap-3.5 relative z-10">
          <div className="flex items-center gap-3 group">
            <div className="w-3 h-3 rounded-full bg-yellow-400 flex-shrink-0 shadow-[0_0_8px_rgba(250,204,21,0.6)] ring-2 ring-yellow-400/30 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] text-gray-200 font-medium">Domingos y Feriados (no laborable)</span>
          </div>
          <div className="flex items-center gap-3 group">
            <div className="w-3 h-3 rounded-full bg-[#0D3C66] flex-shrink-0 shadow-[0_0_8px_rgba(13,60,102,0.8)] ring-2 ring-[#0D3C66]/30 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] text-gray-200 font-medium">Día de Hoy</span>
          </div>
          <div className="flex items-center gap-3 group">
            <div className="w-3 h-3 rounded-full bg-blue-300 flex-shrink-0 shadow-[0_0_8px_rgba(147,197,253,0.6)] ring-2 ring-blue-300/30 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] text-gray-200 font-medium">Información Vehículos</span>
          </div>
        </div>
      </div>

    </aside>
  );
}
