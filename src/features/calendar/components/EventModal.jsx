import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClipboardList, User, TerminalSquare } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

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
          <p className="text-xs text-gray-600 mt-1">Haga clic en un día del cronograma para ver detalles</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            return (
              <div
                key={ev.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border transition-all',
                  'bg-primary-500/10 border-primary-500/20'
                )}
              >
                <TerminalSquare className={cn('h-4 w-4 mt-0.5 shrink-0 text-primary-400')} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 mb-1">
                    <User className="h-3 w-3 text-gray-400 shrink-0" />
                    <p className="text-xs font-semibold text-gray-300 truncate">{ev.client || 'Sin Recurso'}</p>
                  </div>
                  <p className="text-sm text-gray-100 leading-snug whitespace-pre-wrap">{ev.title}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
