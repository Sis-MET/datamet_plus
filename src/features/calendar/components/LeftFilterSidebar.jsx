import React, { useMemo, useState } from 'react';
import { Filter, Users, ChevronDown, ChevronRight, Info, Bell, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useTheme } from '../../../shared/context/ThemeContext';

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
  const { isDarkGantt } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const glassStyle = {
    background: isDarkGantt ? 'rgba(73, 73, 73, 0.35)' : 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  };

  // ── Mini calendario ──
  const monthTitle = currentDate ? format(currentDate, 'MMMM yyyy', { locale: es }) : '';
  const monthTitleCapitalized = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);
  const dayAbbreviations = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];

  const getDayClass = (day) => {
    let classes = 'relative flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-[13px] font-medium cursor-pointer transition-all ';
    if (isSameDay && selectedDay && isSameDay(day, selectedDay)) {
      classes += 'bg-[#10b981] text-white shadow-[0_0_12px_rgba(16,185,129,0.6)] font-bold ';
    } else if (isToday && isToday(day)) {
      classes += `bg-transparent font-bold ring-2 ring-[#3b82f6]/80 shadow-[0_0_10px_rgba(59,130,246,0.5)] ${isDarkGantt ? 'text-white' : 'text-blue-600'} `;
    } else if (isSameMonth && currentDate && !isSameMonth(day, currentDate)) {
      classes += isDarkGantt ? 'text-gray-600 hover:text-gray-400 ' : 'text-gray-400 hover:text-gray-500 ';
    } else {
      classes += isDarkGantt ? 'text-gray-300 hover:bg-white/5 hover:text-white ' : 'text-gray-700 hover:bg-black/5 hover:text-black ';
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
    // Buscar nombre real del tecnico
    const tecObj = tecnicos.find(t => t.id === evt.client);
    const tecName = tecObj ? tecObj.nombre : evt.client;
    
    if (!tecnicoMap[tecName]) {
      tecnicoMap[tecName] = {
        name: tecName,
        tasks: []
      };
    }
    tecnicoMap[tecName].tasks.push(evt);
  });
  const tecnicosDelDia = Object.values(tecnicoMap);

  return (
    <aside className="w-full xl:w-[300px] flex-shrink-0 flex flex-col gap-4 select-none">

      {/* ── 1. Mini Calendario ── */}
      {currentDate && (
        <div className={`rounded-3xl border p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative overflow-hidden ${isDarkGantt ? 'border-white/10' : 'border-gray-200'}`} style={glassStyle}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[100px] bg-primary-500/10 blur-[50px] rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h2 className={`text-[13px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-100' : 'text-gray-800'}`}>{monthTitleCapitalized}</h2>
            <div className="flex gap-2">
              <button onClick={prevMonth} className={`p-1.5 transition-colors rounded-lg ${isDarkGantt ? 'text-gray-400 hover:text-white bg-white/5 hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 bg-black/5 hover:bg-black/10'}`}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={nextMonth} className={`p-1.5 transition-colors rounded-lg ${isDarkGantt ? 'text-gray-400 hover:text-white bg-white/5 hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 bg-black/5 hover:bg-black/10'}`}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-1 relative z-10">
            {dayAbbreviations.map(day => (
              <div key={day} className={`text-center text-[10px] font-bold mb-2 ${isDarkGantt ? 'text-white' : 'text-gray-500'}`}>{day}</div>
            ))}
            {calendarDays.map((day, idx) => {
              const evts = eventsForDay ? eventsForDay(day) : [];
              const amt = evts.length;
              return (
                <div key={idx} className="flex justify-center items-center relative group p-0.5">
                  <button onClick={() => onSelectDay && onSelectDay(day)} className={getDayClass(day)}>
                    <span className="relative z-10">{format(day, 'd')}</span>
                    {amt > 0 && isSameDay && selectedDay && !isSameDay(day, selectedDay) && (
                      <div className={`absolute bottom-1 sm:bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isDarkGantt ? 'bg-yellow-400 shadow-[0_0_4px_rgba(250,204,21,0.6)]' : 'bg-yellow-500'}`} />
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
        <h3 className={`text-[10px] font-bold uppercase tracking-widest px-2 mb-1 ${isDarkGantt ? 'text-white' : 'text-gray-600'}`}>Detalle del Día</h3>
        {tecnicosDelDia.length === 0 ? (
          <div className={`border rounded-2xl p-3 flex items-center justify-center opacity-50 ${isDarkGantt ? 'border-white/10' : 'border-gray-300'}`} style={glassStyle}>
            <span className={`text-[10px] font-bold tracking-widest uppercase flex items-center gap-2 ${isDarkGantt ? 'text-gray-500' : 'text-gray-700'}`}>
              <Bell className="w-3 h-3" /> Sin Novedades
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[280px] custom-scrollbar pr-1">
            {tecnicosDelDia.map((tecnico, idx) => {
              return (
                <div key={idx} className={`border rounded-xl px-3 py-2 transition-all ${isDarkGantt ? 'border-white/[0.07] hover:border-white/15 hover:bg-white/[0.03]' : 'border-gray-200 hover:border-gray-300 hover:bg-black/[0.03]'}`} style={glassStyle}>
                  {/* Nombre */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[13px] font-bold truncate leading-none capitalize ${isDarkGantt ? 'text-gray-100' : 'text-gray-900'}`}>
                      {tecnico.name?.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {tecnico.tasks.map((t, i) => (
                        <div key={i} className="w-2 h-2 rounded-full ring-1 ring-black/20" style={{ backgroundColor: t.colorAM || '#10B981' }} title={t.estadoAM || 'Pendiente'} />
                      ))}
                    </div>
                  </div>
                  {/* Tareas en filas compactas */}
                  <div className="flex flex-col gap-2.5 mt-2">
                    {tecnico.tasks.map((task, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className={`w-2 h-2 rounded-full shrink-0 mt-[5px] animate-pulse`} style={{ backgroundColor: task.colorAM || '#10B981' }} />
                        <div className="flex flex-col flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate leading-tight font-mono ${isDarkGantt ? 'text-gray-200' : 'text-gray-800'}`}>{task.morning}</p>
                          {task.descripcion && (
                            <p className={`text-[10px] truncate leading-tight mt-0.5 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>
                              {task.descripcion}
                            </p>
                          )}
                          {(task.horaInicio || task.horaFin) && (
                            <p className={`text-[10px] font-mono font-semibold leading-none mt-1 opacity-80 ${isDarkGantt ? 'text-blue-300' : 'text-blue-600'}`}>
                              {task.horaInicio || '08:30'} {task.horaFin ? `→ ${task.horaFin}` : ''}
                            </p>
                          )}
                        </div>
                        <span className={`${getStateBadgeClass(task.estadoAM)} whitespace-nowrap mt-0.5`}>{task.estadoAM || 'Pendiente'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* ── 4. Referencia de Colores ── */}
      <div className={`rounded-3xl border p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative overflow-hidden ${isDarkGantt ? 'border-white/10' : 'border-gray-200'}`} style={glassStyle}>
        <div className={`absolute top-[-50px] right-[-50px] w-[150px] h-[150px] blur-[50px] rounded-full pointer-events-none ${isDarkGantt ? 'bg-white/5' : 'bg-black/5'}`} />
        <div className="flex items-center gap-2.5 mb-4 relative z-10">
          <div className={`p-1.5 rounded-lg ${isDarkGantt ? 'bg-white/10' : 'bg-black/5'}`}>
            <Info className={`w-3.5 h-3.5 ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`} />
          </div>
          <h3 className={`text-[11px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>Referencia de Colores</h3>
        </div>
        <div className="flex flex-col gap-3.5 relative z-10">
          <div className="flex items-center gap-3 group">
            <div className="w-3 h-3 rounded-full bg-yellow-400 flex-shrink-0 shadow-[0_0_8px_rgba(250,204,21,0.6)] ring-2 ring-yellow-400/30 group-hover:scale-110 transition-transform" />
            <span className={`text-[11px] font-medium ${isDarkGantt ? 'text-gray-200' : 'text-gray-700'}`}>Domingos y Feriados (no laborable)</span>
          </div>
          <div className="flex items-center gap-3 group">
            <div className="w-3 h-3 rounded-full bg-[#10B981] flex-shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.25)] ring-2 ring-[#10B981]/30 group-hover:scale-110 transition-transform" />
            <span className={`text-[11px] font-medium ${isDarkGantt ? 'text-gray-200' : 'text-gray-700'}`}>Día de Hoy</span>
          </div>
          <div className="flex items-center gap-3 group">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ring-2 group-hover:scale-110 transition-transform ${isDarkGantt ? 'bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.6)] ring-blue-300/30' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] ring-blue-500/30'}`} />
            <span className={`text-[11px] font-medium ${isDarkGantt ? 'text-gray-200' : 'text-gray-700'}`}>Información Vehículos</span>
          </div>
        </div>
      </div>

    </aside>
  );
}