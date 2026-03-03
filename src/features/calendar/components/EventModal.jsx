import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClipboardList, Clock, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  in_progress: { label: 'En Proceso', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  completed: { label: 'Completado', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
};

export function EventModal({ selectedDay, events }) {
  const dayLabel = format(selectedDay, "EEEE d 'de' MMMM", { locale: es });
  // Capitalize first letter
  const dayLabelFormatted = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Día seleccionado</p>
        <h3 className="text-base font-semibold text-gray-100">{dayLabelFormatted}</h3>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ClipboardList className="h-10 w-10 text-gray-600 mb-3" />
          <p className="text-sm text-gray-500">No hay registros para este día</p>
          <p className="text-xs text-gray-600 mt-1">Los instrumentos recibidos aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => {
            const cfg = STATUS_CONFIG[ev.status] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <div
                key={ev.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border transition-all',
                  cfg.bg
                )}
              >
                <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', cfg.color)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-100 font-mono truncate">{ev.title}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3 text-gray-500 shrink-0" />
                    <p className="text-xs text-gray-400 truncate">{ev.client}</p>
                  </div>
                  <span className={cn('text-[10px] font-medium mt-1 inline-block', cfg.color)}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
