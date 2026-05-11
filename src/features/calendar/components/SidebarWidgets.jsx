import React from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Truck, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTheme } from '../../../shared/context/ThemeContext';

export function SidebarWidgets({
  currentDate,
  selectedDay,
  calendarDays,
  onSelectDay,
  eventsForDay,
  isSameMonth,
  isSameDay,
  isToday,
  prevMonth,
  nextMonth,
  selectedDayEvents
}) {
  const { isDarkGantt } = useTheme();
  const monthTitle = format(currentDate, "MMMM yyyy", { locale: es });
  const monthTitleCapitalized = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  const getStateBadgeClass = (estado) => {
    switch(estado) {
      case 'Completado': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30';
      case 'En Proceso': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30';
      case 'Cancelado': return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-red-500/20 text-red-400 ring-1 ring-red-500/30';
      default: return 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30'; // Pendiente
    }
  };

  const getDayClass = (day) => {
    let classes = 'relative flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-[13px] font-medium cursor-pointer transition-all ';
    
    if (isSameDay(day, selectedDay)) {
      classes += 'bg-[#f9e300] text-black shadow-[0_0_12px_rgba(249,227,0,0.6)] font-bold ';
    } else if (isToday(day)) {
      classes += 'bg-transparent text-white font-bold ring-2 ring-[#f9e300]/80 shadow-[0_0_10px_rgba(249,227,0,0.3)] ';
    } else if (!isSameMonth(day, currentDate)) {
      classes += 'text-gray-600 hover:text-gray-400 ';
    } else {
      classes += 'text-gray-300 hover:bg-white/5 hover:text-white ';
    }
    return classes;
  };

  const dayAbbreviations = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];

  // Agrupar eventos por técnico (los eventos vienen separados por turno AM/PM)
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
      // Si ya existe, completar datos que falten
      if (!tecnicoMap[key].morning && evt.morning) {
         tecnicoMap[key].morning = evt.morning;
         tecnicoMap[key].estadoAM = evt.estadoAM || 'Pendiente';
      }
      if (!tecnicoMap[key].afternoon && evt.afternoon) {
         tecnicoMap[key].afternoon = evt.afternoon;
         tecnicoMap[key].estadoPM = evt.estadoPM || 'Pendiente';
      }
      if (!tecnicoMap[key].colorAM && evt.colorAM) tecnicoMap[key].colorAM = evt.colorAM;
      if (!tecnicoMap[key].colorPM && evt.colorPM) tecnicoMap[key].colorPM = evt.colorPM;
    }
  });
  const tecnicosDelDia = Object.values(tecnicoMap);

  return (
    <div className="w-full xl:w-[350px] flex-shrink-0 flex flex-col gap-6">
      
      {/* ── Mini Calendario Oscuro ── */}
      <div 
        className="rounded-3xl border border-white/10 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative overflow-hidden select-none"
        style={{
          background: 'rgba(73, 73, 73, 0.35)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {/* Decorative ambient glow */}
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
            <div key={day} className="text-center text-[10px] font-bold text-gray-500 mb-2">
              {day}
            </div>
          ))}
          {calendarDays.map((day, idx) => {
            const evts = eventsForDay(day);
            const amt = evts.length;
            
            return (
              <div key={idx} className="flex justify-center items-center relative group p-0.5">
                <button
                  onClick={() => onSelectDay(day)}
                  className={getDayClass(day)}
                >
                  <span className="relative z-10">{format(day, 'd')}</span>
                  
                  {/* Indicators */}
                  {amt > 0 && !isSameDay(day, selectedDay) && (
                    <div className="absolute bottom-1 sm:bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-500/60 rounded-full" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Resumen Detallado por Técnico ── */}
      <div className="flex flex-col gap-2">
        <h3 className={`text-[10px] font-bold uppercase tracking-widest px-2 mb-1 ${isDarkGantt ? 'text-gray-500' : 'text-gray-600'}`}>Detalle del Día</h3>

        {tecnicosDelDia.length === 0 ? (
          <div 
            className="border border-white/10 rounded-2xl p-4 flex items-center justify-center opacity-60 h-20 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
            style={{
              background: 'rgba(73, 73, 73, 0.35)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <span className="text-[11px] text-gray-500 font-bold tracking-widest uppercase flex items-center gap-2">
              <Bell className="w-3.5 h-3.5" /> Sin Novedades
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-530px)] custom-scrollbar pr-1">
            {tecnicosDelDia.map((evt, idx) => {
              const hasMorning = evt.morning && evt.morning.trim() !== '';
              const hasAfternoon = evt.afternoon && evt.afternoon.trim() !== '';

              return (
                <div
                  key={idx}
                  className="border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-colors shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
                  style={{
                    background: 'rgba(73, 73, 73, 0.35)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                  }}
                >
                  {/* Nombre del técnico */}
                  <div className="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-white/5">
                    <span className="text-[12px] font-bold text-gray-200 capitalize">
                      {evt.client?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Turnos */}
                  <div className="px-3.5 py-2.5 flex flex-col gap-1.5">
                    {hasMorning && (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-white/20"
                              style={{ backgroundColor: evt.colorAM || '#10B981' }}
                            />
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Mañana</span>
                          </div>
                          <span className={getStateBadgeClass(evt.estadoAM)}>{evt.estadoAM || 'Pendiente'}</span>
                        </div>
                        <p className="text-[11px] text-gray-300 font-medium leading-tight pl-3.5">{evt.morning}</p>
                      </div>
                    )}
                    {hasAfternoon && (
                      <div className="flex flex-col gap-0.5 mt-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-white/20"
                              style={{ backgroundColor: evt.colorPM || '#F59E0B' }}
                            />
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Tarde</span>
                          </div>
                          <span className={getStateBadgeClass(evt.estadoPM)}>{evt.estadoPM || 'Pendiente'}</span>
                        </div>
                        <p className="text-[11px] text-gray-300 font-medium leading-tight pl-3.5">{evt.afternoon}</p>
                      </div>
                    )}
                    {!hasMorning && !hasAfternoon && (
                      <p className="text-[10px] text-gray-600 italic">Sin tarea registrada</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
