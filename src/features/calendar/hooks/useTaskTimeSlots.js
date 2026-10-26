import { useMemo } from 'react';
import {
  TIME_SLOTS,
  buildOccupiedBlocks,
  computeSuggestedStart,
  getMaxEndForStart,
  timeToMinutes,
} from '../utils/calendarTime';

/**
 * Horarios de la ficha según la jornada del técnico y sus otras tareas del
 * día: bloques ocupados, próximo tramo libre y horas de inicio y fin elegibles.
 */
export function useTaskTimeSlots({ existingTasks, rowId, jornadaInicio, jornadaFin, horaInicio }) {
  const occupiedBlocks = useMemo(
    () => buildOccupiedBlocks(existingTasks, rowId, jornadaInicio),
    [existingTasks, rowId, jornadaInicio]
  );

  const suggestedStart = useMemo(
    () => computeSuggestedStart(existingTasks, rowId, jornadaInicio),
    [existingTasks, rowId, jornadaInicio]
  );

  const isJornadaFull = timeToMinutes(suggestedStart) >= timeToMinutes(jornadaFin);
  const maxFinMinutes = timeToMinutes(getMaxEndForStart(occupiedBlocks, horaInicio, jornadaFin));

  const isInsideOccupied = (time) => {
    const minutes = timeToMinutes(time);
    return occupiedBlocks.some(
      block => minutes >= timeToMinutes(block.start) && minutes < timeToMinutes(block.end)
    );
  };

  const horaInicioSlots = TIME_SLOTS.filter(time => {
    if (timeToMinutes(time) >= timeToMinutes(jornadaFin)) return false;
    return !isInsideOccupied(time) && timeToMinutes(time) >= timeToMinutes(jornadaInicio);
  });

  const horaFinSlots = TIME_SLOTS.filter(time => {
    const minutes = timeToMinutes(time);
    return minutes > timeToMinutes(horaInicio) && minutes <= maxFinMinutes;
  });

  return { occupiedBlocks, suggestedStart, isJornadaFull, horaInicioSlots, horaFinSlots };
}
