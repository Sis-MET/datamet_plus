import React from 'react';
import { timeToMinutes } from '../utils/calendarTime';

export function TimelineBar({ occupiedBlocks, horaInicio, horaFin, isDarkGantt, jInicio, jFin }) {
  const offset = timeToMinutes(jInicio);
  const totalMin = timeToMinutes(jFin) - offset;
  const clamp = (value) => Math.max(0, Math.min(100, value));
  const toPercent = (time) => clamp(((timeToMinutes(time) - offset) / (totalMin || 600)) * 100);

  const selectedLeft = toPercent(horaInicio);
  const selectedWidth = Math.max(0, toPercent(horaFin) - selectedLeft);

  const selectedMinutes = Math.max(0, timeToMinutes(horaFin) - timeToMinutes(horaInicio));
  const durationHours = Math.floor(selectedMinutes / 60);
  const durationMinutes = selectedMinutes % 60;
  const durationLabel = selectedMinutes > 0
    ? durationMinutes > 0 ? `${durationHours}h ${durationMinutes}m` : `${durationHours}h`
    : null;

  const hourTicks = [];
  const startHour = Math.ceil(timeToMinutes(jInicio) / 60);
  const endHour = Math.floor(timeToMinutes(jFin) / 60);
  for (let hour = startHour; hour <= endHour; hour++) {
    const percent = clamp(((hour * 60 - offset) / (totalMin || 600)) * 100);
    hourTicks.push({ hour, percent });
  }

  return (
    <div className="select-none space-y-1.5 mt-2">
      <div className="flex items-center justify-between px-0.5">
        <span className={`text-[9px] font-mono font-semibold ${isDarkGantt ? 'text-slate-400' : 'text-slate-600'}`}>
          {horaInicio}
        </span>
        {durationLabel && (
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
            isDarkGantt
              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
              : 'bg-blue-50 text-blue-600 border border-blue-100'
          }`}>
            Tiempo disponible {durationLabel}
          </span>
        )}
        <span className={`text-[9px] font-mono font-semibold ${isDarkGantt ? 'text-slate-400' : 'text-slate-600'}`}>
          {horaFin}
        </span>
      </div>

      <div className="relative">
        <div className={`relative h-3 rounded-lg overflow-hidden flex ${
          isDarkGantt ? 'bg-white/5' : 'bg-gray-100'
        }`}>
          {hourTicks.slice(0, -1).map(({ hour, percent }, index) => {
            const nextPercent = hourTicks[index + 1]?.percent ?? 100;
            return (
              <div
                key={hour}
                className="absolute top-0 h-full"
                style={{
                  left: `${percent}%`,
                  width: `${nextPercent - percent}%`,
                  backgroundColor: isDarkGantt
                    ? index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)'
                    : index % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.04)',
                }}
              />
            );
          })}

          {hourTicks.map(({ hour, percent }) => (
            <div
              key={`tick-${hour}`}
              className={`absolute top-0 w-px h-full ${isDarkGantt ? 'bg-white/8' : 'bg-gray-200/80'}`}
              style={{ left: `${percent}%` }}
            />
          ))}

          {occupiedBlocks.map((block, index) => {
            const left = toPercent(block.start);
            const width = Math.max(0, toPercent(block.end) - left);
            return (
              <div
                key={index}
                className="absolute top-0 h-full opacity-65"
                style={{ left: `${left}%`, width: `${width}%`, backgroundColor: block.color }}
              />
            );
          })}

          {selectedWidth > 0 && (
            <div
              className="absolute top-0 h-full"
              style={{
                left: `${selectedLeft}%`,
                width: `${selectedWidth}%`,
                background: 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)',
                boxShadow: '0 0 6px rgba(59,130,246,0.35)',
              }}
            />
          )}
        </div>

        <div className="relative h-4 mt-0.5">
          {hourTicks.filter((_, index) => index % 2 === 0).map(({ hour, percent }) => (
            <span
              key={`lbl-${hour}`}
              className={`absolute text-[8px] font-mono -translate-x-1/2 top-0 ${
                isDarkGantt ? 'text-slate-500' : 'text-slate-500'
              }`}
              style={{ left: `${percent}%` }}
            >
              {String(hour).padStart(2, '0')}
            </span>
          ))}
          <span className={`absolute text-[8px] font-mono top-0 left-0 ${isDarkGantt ? 'text-slate-500' : 'text-slate-500'}`}>
            {jInicio.split(':')[0]}
          </span>
          <span className={`absolute text-[8px] font-mono top-0 right-0 translate-x-1/2 ${isDarkGantt ? 'text-slate-500' : 'text-slate-500'}`}>
            {jFin.split(':')[0]}
          </span>
        </div>
      </div>
    </div>
  );
}
