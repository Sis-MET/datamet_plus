import React from 'react';
import { timeToMinutes } from '../utils/calendarTime';

export function TimelineBar({ occupiedBlocks, horaInicio, horaFin, jInicio, jFin }) {
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
    <div className="mt-2 select-none space-y-1.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-medium tabular-nums text-fg-muted">
          {horaInicio}
        </span>
        {durationLabel && (
          <span className="rounded-full bg-fg/[0.07] px-2 py-0.5 text-[11px] font-medium tabular-nums text-fg">
            Tiempo disponible {durationLabel}
          </span>
        )}
        <span className="text-[11px] font-medium tabular-nums text-fg-muted">
          {horaFin}
        </span>
      </div>

      <div className="relative">
        <div className="relative flex h-3 overflow-hidden rounded-full bg-fg/[0.06]">
          {hourTicks.map(({ hour, percent }) => (
            <div
              key={`tick-${hour}`}
              className="absolute top-0 h-full w-px bg-fg/10"
              style={{ left: `${percent}%` }}
            />
          ))}

          {occupiedBlocks.map((block, index) => {
            const left = toPercent(block.start);
            const width = Math.max(0, toPercent(block.end) - left);
            return (
              <div
                key={index}
                className="absolute top-0 h-full opacity-70"
                style={{ left: `${left}%`, width: `${width}%`, backgroundColor: block.color }}
              />
            );
          })}

          {selectedWidth > 0 && (
            <div
              className="absolute top-0 h-full rounded-full bg-fg"
              style={{
                left: `${selectedLeft}%`,
                width: `${selectedWidth}%`,
              }}
            />
          )}
        </div>

        <div className="relative mt-1 h-4">
          {hourTicks.filter((_, index) => index % 2 === 0).map(({ hour, percent }) => (
            <span
              key={`lbl-${hour}`}
              className="absolute top-0 -translate-x-1/2 text-[10px] tabular-nums text-fg-subtle"
              style={{ left: `${percent}%` }}
            >
              {String(hour).padStart(2, '0')}
            </span>
          ))}
          <span className="absolute left-0 top-0 text-[10px] tabular-nums text-fg-subtle">
            {jInicio.split(':')[0]}
          </span>
          <span className="absolute right-0 top-0 translate-x-1/2 text-[10px] tabular-nums text-fg-subtle">
            {jFin.split(':')[0]}
          </span>
        </div>
      </div>
    </div>
  );
}
