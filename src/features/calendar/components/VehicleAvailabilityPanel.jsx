import React from 'react';
import { CheckCircle2, CircleSlash2, Clock, Truck } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { isVehicleResource, summarizeVehicleAvailability } from '../domain/vehicleAvailability';

const STATE_STYLE = {
  free:    { dot: 'bg-success', text: 'text-success', Icon: CheckCircle2 },
  partial: { dot: 'bg-warning', text: 'text-warning', Icon: Clock },
  busy:    { dot: 'bg-danger',  text: 'text-danger',  Icon: CircleSlash2 },
};

const formatWindow = ({ start, end }) => `${start} – ${end}`;

/** Una línea por vehículo: estado, y el tramo que importa según ese estado. */
function getStatusLabel(row) {
  if (row.state === 'free') return 'Libre toda la jornada';
  if (row.state === 'busy') return `Ocupado ${formatWindow(row.busyBlocks[0])}`;

  const [firstWindow] = row.freeWindows;
  const extra = row.freeWindows.length - 1;
  return `Libre ${formatWindow(firstWindow)}${extra > 0 ? ` (+${extra})` : ''}`;
}

export function VehicleAvailabilityPanel({ tecnicos = [], selectedDayEvents = [] }) {
  const vehicles = React.useMemo(
    () => tecnicos.filter(isVehicleResource),
    [tecnicos]
  );

  // Las tareas del día ya vienen resueltas por la agenda; `client` es el recurso.
  const tasksByVehicle = React.useMemo(() => {
    const map = new Map();
    selectedDayEvents.forEach(event => {
      if (!map.has(event.client)) map.set(event.client, []);
      map.get(event.client).push(event);
    });
    return map;
  }, [selectedDayEvents]);

  const { rows, total, freeCount } = React.useMemo(
    () => summarizeVehicleAvailability({
      vehicles,
      getTasksForVehicle: (id) => tasksByVehicle.get(id),
    }),
    [tasksByVehicle, vehicles]
  );

  if (total === 0) return null;

  return (
    <div className="calendar-vehicle-availability flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
          <Truck className="h-3.5 w-3.5 text-info" aria-hidden="true" />
          Disponibilidad de Vehículos
        </h3>
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ring-inset',
            freeCount > 0
              ? 'bg-success/10 text-success ring-success/25'
              : 'bg-danger/10 text-danger ring-danger/25'
          )}
        >
          {freeCount}/{total} libres
        </span>
      </div>

      <ul className="card divide-y divide-line shadow-xs" aria-label="Disponibilidad de vehículos del día">
        {rows.map((row) => {
          const style = STATE_STYLE[row.state];
          return (
            <li key={row.vehicle.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <span className={cn('h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-black/15', style.dot)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold leading-tight text-fg">
                  {(row.vehicle.nombre || '').replace(/_/g, ' ')}
                </span>
                <span className={cn('block truncate text-[11px] leading-tight tabular-nums', style.text)}>
                  {getStatusLabel(row)}
                </span>
              </span>
              <style.Icon className={cn('h-4 w-4 shrink-0', style.text)} aria-hidden="true" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
