const taskType = (payload = {}) => String(
  payload.tipo_tarea || payload.tipoTarea || payload.morning || ''
).trim();

const findTechnician = (technicians, resource) => (
  technicians.find(technician => technician.id === resource)
);

const buildOptimisticTask = ({ date, resource, payload, technicians, optimisticId, previousTask }) => {
  const technician = findTechnician(technicians, resource);
  const rowId = payload.rowId || null;
  const type = taskType(payload);

  return {
    id: rowId ? `task_${rowId}` : optimisticId,
    rowId,
    id_usuario: technician?.user_id || null,
    Tecnico: resource,
    fecha: new Date(`${date}T12:00:00`),
    tipoTarea: type,
    cotizacion: payload.cotizacion || '',
    morning: type,
    descripcion: payload.descripcion || '',
    cliente: payload.cliente || '',
    cod_cliente: payload.cod_cliente || '',
    planta: payload.planta || '',
    colorAM: payload.colorAM || payload.color || '#10B981',
    estadoAM: payload.estadoAM || payload.estado || 'Pendiente',
    horaInicio: payload.horaInicio || '',
    horaFin: payload.horaFin || '',
    horaTotal: payload.horaTotal ?? null,
    author: payload.autor || 'Sistema',
    timestampUpdated: payload.lastModified || '',
    createdBy: payload.autor || 'Sistema',
    createdAt: '',
    updatedBy: '',
    updatedAt: '',
    creadoEn: payload.creado_en || 'CronoMET',
    grupoId: payload.grupo_id || previousTask?.grupoId || null,
    createdById: previousTask?.createdById ?? null,
    optimistic: true,
    // Al editar, el creador sigue siendo el original: de él depende quién puede
    // tocar una reserva de vehículo.
    ...(previousTask ? {
      createdBy: previousTask.createdBy,
      createdAt: previousTask.createdAt,
      updatedBy: payload.autor || 'Sistema',
    } : {}),
  };
};

export function applyOptimisticAssignments(currentTasks, date, assignments, technicians, mutationId) {
  let nextTasks = currentTasks;
  const operations = [];

  assignments.forEach((assignment, index) => {
    const payload = assignment.payload || {};
    const rowId = payload.rowId || null;
    const optimisticId = `optimistic_${mutationId}_${index}`;
    const type = taskType(payload);
    const previousTask = rowId
      ? nextTasks.find(task => String(task.rowId) === String(rowId))
      : null;

    if (rowId) {
      nextTasks = nextTasks.filter(task => String(task.rowId) !== String(rowId));
    }

    const operation = {
      optimisticId,
      rowId,
      deleted: !type,
    };

    if (type) {
      const task = buildOptimisticTask({
        date: assignment.date || date,
        resource: assignment.resource,
        payload,
        technicians,
        optimisticId,
        previousTask,
      });
      nextTasks = [...nextTasks, task];
      operation.taskId = task.id;
    }

    operations.push(operation);
  });

  return { tasks: nextTasks, operations };
}

export function reconcileOptimisticAssignments(currentTasks, operations, serverResults = []) {
  return currentTasks.map((task) => {
    const operationIndex = operations.findIndex(operation => operation.taskId === task.id);
    if (operationIndex === -1) return task;

    const serverResult = serverResults[operationIndex] || {};
    const confirmedRowId = serverResult.id || operations[operationIndex].rowId || task.rowId;

    return {
      ...task,
      id: confirmedRowId ? `task_${confirmedRowId}` : task.id,
      rowId: confirmedRowId || null,
      timestampUpdated: serverResult.lastModified || task.timestampUpdated,
      optimistic: false,
    };
  });
}

export function hasUnconfirmedInserts(operations, serverResults = []) {
  return operations.some((operation, index) => (
    !operation.deleted && !operation.rowId && !serverResults[index]?.id
  ));
}
