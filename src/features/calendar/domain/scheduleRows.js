/**
 * Filas de DATA_CRONOGRAMA como tareas del cronograma. Lo usan la carga de
 * las semanas visibles (useGantt) y el buscador (Ctrl + K), para que una
 * tarea encontrada sea la misma que muestra la grilla.
 */

/**
 * Recurso (persona o vehículo) de una fila. Vehículos y personas pueden
 * compartir el mismo id numérico: se busca por id y nombre a la vez y, si no
 * hay coincidencia exacta, por nombre y luego por id.
 */
export const resolveResourceId = (row, tecnicos = []) => {
  let resourceId = row.id_usuario || row.usuario || '';
  if (row.id_usuario) {
    let tec = tecnicos.find(t => t.user_id === row.id_usuario && (t.nombre === row.usuario || t.id === row.usuario));
    if (!tec) tec = tecnicos.find(t => t.nombre === row.usuario);
    if (!tec) tec = tecnicos.find(t => t.user_id === row.id_usuario);
    if (tec) resourceId = tec.id;
  }
  return resourceId;
};

/** Una fila del servidor como tarea del cronograma; null si no se puede ubicar o está anulada. */
export const mapScheduleRow = (row, tecnicos = []) => {
  const resourceId = resolveResourceId(row, tecnicos);
  if (!resourceId) return null;

  // row.fecha viene como YYYY-MM-DD
  const rowDate = new Date(row.fecha + 'T12:00:00');

  if (row.estado && row.estado.toLowerCase() === 'anulado') return null;

  let formattedTimestamp = '';
  if (row.fecha_modificacion) {
    formattedTimestamp = `${row.fecha_modificacion} ${row.hora_modificacion || ''}`.trim();
  } else if (row.fecha_creacion) {
    formattedTimestamp = `${row.fecha_creacion} ${row.hora_creacion || ''}`.trim();
  }

  let mappedEstado = row.estado || 'Pendiente';
  if (row.creado_en !== 'Salida Personal' && row.creado_en !== 'SalidaMET') {
    if (mappedEstado.toLowerCase() === 'solicitud') mappedEstado = 'Pendiente';
    if (mappedEstado.toLowerCase() === 'aceptación' || mappedEstado.toLowerCase() === 'aceptacion') mappedEstado = 'Completado';
  }

  return {
    id: `task_${row.id}`,
    rowId: row.id,
    id_usuario: row.id_usuario,
    Tecnico: resourceId,
    fecha: rowDate,
    tipoTarea: row.tipo_tarea || row.cotizacion || row.descripcion || '',
    cotizacion: row.cotizacion || '',
    // morning se conserva como alias de presentación para la grilla.
    morning: row.tipo_tarea || row.cotizacion || row.descripcion || '',
    descripcion: row.descripcion || '',
    cliente: row.cliente || '',
    cod_cliente: row.cod_cliente || '',
    planta: row.planta || '',
    colorAM: row.color || '#37A65F',
    estadoAM: mappedEstado,
    horaInicio: row.hora_inicio ? row.hora_inicio.substring(0, 5) : '',
    horaFin:    row.hora_fin    ? row.hora_fin.substring(0, 5)    : '',
    horaTotal: row.hora_total ?? null,
    author: row.actualizado_por || row.creado_por || '',
    timestampUpdated: formattedTimestamp,
    createdBy: row.creado_por || '',
    createdAt: row.fecha_creacion && row.hora_creacion ? `${row.fecha_creacion} ${row.hora_creacion}`.trim() : '',
    updatedBy: row.actualizado_por || '',
    updatedAt: row.fecha_modificacion && row.hora_modificacion ? `${row.fecha_modificacion} ${row.hora_modificacion}`.trim() : '',
    creadoEn: row.creado_en || '',
    grupoId: row.grupo_id || null,
    createdById: row.id_creador ?? null,
  };
};
