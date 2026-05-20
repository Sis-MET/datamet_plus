export const TIME_SLOTS = (() => {
  const slots = [];
  for (let mins = 0; mins < 24 * 60; mins += 30) {
    slots.push(
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
    );
  }
  return slots;
})();

export const timeToMinutes = (time) => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const buildOccupiedBlocks = (existingTasks, editingRowId, jornadaInicio) => {
  return (existingTasks || [])
    .filter(task => task.rowId !== editingRowId && task.horaFin)
    .map(task => ({
      start: task.horaInicio || jornadaInicio,
      end: task.horaFin,
      color: task.colorAM || '#37A65F',
      label: task.morning || '',
    }));
};

export const computeSuggestedStart = (existingTasks, editingRowId, jornadaInicio) => {
  const others = (existingTasks || []).filter(
    task => task.horaFin && task.rowId !== editingRowId
  );

  if (others.length === 0) return jornadaInicio;

  return others.reduce((max, task) => {
    const minutes = timeToMinutes(task.horaFin);
    return minutes > timeToMinutes(max) ? task.horaFin : max;
  }, jornadaInicio);
};

export const getFirstFreeSlot = (occupiedBlocks, jornadaInicio) => {
  const sorted = [...occupiedBlocks].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );

  let cursor = jornadaInicio;
  for (const block of sorted) {
    if (timeToMinutes(block.start) > timeToMinutes(cursor)) break;
    if (timeToMinutes(block.end) > timeToMinutes(cursor)) cursor = block.end;
  }

  return cursor;
};

export const getMaxEndForStart = (occupiedBlocks, start, jornadaFin) => {
  const startMinutes = timeToMinutes(start);
  const nextBlock = occupiedBlocks
    .filter(block => timeToMinutes(block.start) > startMinutes)
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))[0];

  return nextBlock ? nextBlock.start : jornadaFin;
};

export const hasTimeOverlap = (occupiedBlocks, start, end) => {
  const startA = timeToMinutes(start);
  const endA = timeToMinutes(end);

  return occupiedBlocks.some(block => {
    const startB = timeToMinutes(block.start);
    const endB = timeToMinutes(block.end);
    return startA < endB && endA > startB;
  });
};
