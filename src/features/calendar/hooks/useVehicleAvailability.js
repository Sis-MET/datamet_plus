import { useMemo } from 'react';
import { findVehicleConflict, getVehicleTaskLabel } from '../domain/taskFormDomain';

export function useVehicleAvailability({
  vehicles,
  date,
  start,
  end,
  ignoredRowIds,
  getTasksForResource,
}) {
  return useMemo(() => Object.fromEntries(
    vehicles.map(vehicle => {
      const tasks = typeof getTasksForResource === 'function'
        ? getTasksForResource(vehicle.id, date) || []
        : [];
      const conflict = findVehicleConflict({ tasks, ignoredRowIds, start, end });

      return [vehicle.id, {
        available: !conflict,
        conflict: conflict ? {
          start: conflict.horaInicio || 'Inicio del día',
          end: conflict.horaFin || 'Fin del día',
          label: getVehicleTaskLabel(conflict),
        } : null,
      }];
    })
  ), [date, end, getTasksForResource, ignoredRowIds, start, vehicles]);
}
