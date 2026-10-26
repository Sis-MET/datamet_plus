import { CalendarClock, ChevronDown, Clock } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';
import { TimelineBar } from '../TimelineBar';
import { TimeSelect } from '../TimeSelect';

/** Horario de la tarea y, a pedido, la disponibilidad del día del técnico. */
export function TaskScheduleFields({
  horaInicio,
  horaFin,
  horaInicioSlots,
  horaFinSlots,
  onHoraInicioChange,
  onHoraFinChange,
  isJornadaFull,
  occupiedBlocks,
  suggestedStart,
  jornadaInicio,
  jornadaFin,
  showAvailability,
  onToggleAvailability,
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Clock className="h-4 w-4 text-fg-muted" />
        <span className="text-[13px] font-medium text-fg">
          Horario
        </span>
        {isJornadaFull && (
          <span className="ml-auto rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
            Jornada completa
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-xl border border-line-strong bg-surface shadow-xs">
        <div className="min-w-0 px-3.5 py-1.5">
          <span className="block text-[11px] text-fg-subtle">Desde</span>
          <TimeSelect
            value={horaInicio}
            slots={horaInicioSlots}
            onChange={onHoraInicioChange}
          />
        </div>
        <span className="h-8 w-px bg-line" />
        <div className="min-w-0 px-3.5 py-1.5">
          <span className="block text-[11px] text-fg-subtle">Hasta</span>
          <TimeSelect value={horaFin} slots={horaFinSlots} onChange={onHoraFinChange} />
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleAvailability}
        aria-expanded={showAvailability}
        className="mt-2 flex min-h-9 w-full items-center justify-between rounded-lg px-2.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-fg/[0.05] hover:text-fg"
      >
        <span className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          {showAvailability ? 'Ocultar disponibilidad' : 'Ver disponibilidad del día'}
        </span>
        <ChevronDown className={cn('h-4 w-4 transition-transform duration-150', showAvailability && 'rotate-180')} />
      </button>

      <div className={`task-disclosure ${showAvailability ? 'is-open' : ''}`} aria-hidden={!showAvailability}>
        <div>
          <div className="space-y-2 px-1 pb-1 pt-2">
            <TimelineBar
              occupiedBlocks={occupiedBlocks}
              horaInicio={horaInicio}
              horaFin={horaFin}
              jInicio={jornadaInicio}
              jFin={jornadaFin}
            />
            {!isJornadaFull && occupiedBlocks.length > 0 && (
              <p className="text-xs text-fg-muted">
                Próximo tramo libre: <span className="font-semibold tabular-nums text-fg">{suggestedStart}–{jornadaFin}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
