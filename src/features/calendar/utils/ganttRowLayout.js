// Medidas compartidas por la ficha de tarea (GanttTaskCell) y el cálculo de la
// altura de cada fila. Si cambia una, la otra debe seguirla: las filas se
// virtualizan con esta altura fija.
export const TASK_CARD_LINES_HEIGHT = 56; // título 16 + detalle 14 + horario 14 + tipo 12
export const TASK_CARD_PADDING_Y = 3;
export const TASK_CARD_HEIGHT = TASK_CARD_LINES_HEIGHT + (TASK_CARD_PADDING_Y * 2);
export const TASK_CARD_GAP = 4;
/** Padding vertical total de `.gantt-cell` (3px arriba + 3px abajo). */
export const CELL_PADDING_Y = 6;
const MIN_ROW_HEIGHT = 64;

export function getGanttRowLayout(tecnicoId, weekDays, previewDays, tasksForCell) {
  const activeCells = weekDays.map(day => ({ day, tasks: tasksForCell(tecnicoId, day) }));
  const previewCells = previewDays.map(day => ({ day, tasks: tasksForCell(tecnicoId, day) }));
  const visibleTaskCount = [...activeCells, ...previewCells].reduce((maximum, cell) => {
    const count = cell.tasks.reduce((total, task) => total + (task?.morning ? 1 : 0), 0);
    return Math.max(maximum, count);
  }, 1);
  const rowHeight = Math.max(
    MIN_ROW_HEIGHT,
    (visibleTaskCount * TASK_CARD_HEIGHT) + ((visibleTaskCount - 1) * TASK_CARD_GAP) + CELL_PADDING_Y
  );

  return { activeCells, previewCells, rowHeight };
}
