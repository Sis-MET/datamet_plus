export function getGanttRowLayout(tecnicoId, weekDays, previewDays, tasksForCell) {
  const activeCells = weekDays.map(day => ({ day, tasks: tasksForCell(tecnicoId, day) }));
  const previewCells = previewDays.map(day => ({ day, tasks: tasksForCell(tecnicoId, day) }));
  const visibleTaskCount = [...activeCells, ...previewCells].reduce((maximum, cell) => {
    const count = cell.tasks.reduce((total, task) => total + (task?.morning ? 1 : 0), 0);
    return Math.max(maximum, count);
  }, 1);
  const rowHeight = Math.max(64, (visibleTaskCount * 54) + ((visibleTaskCount - 1) * 4) + 6);

  return { activeCells, previewCells, rowHeight };
}
