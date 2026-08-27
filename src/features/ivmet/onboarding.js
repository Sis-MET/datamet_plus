export function onboardingPending(scope) {
  return Boolean(scope && scope.syncStatus !== 'SUCCEEDED');
}

export function workerAvailability(workers = [], scopeId = null) {
  const available = workers.filter(
    (worker) =>
      worker.available && (!worker.scope_id || worker.scope_id === scopeId)
  );
  if (available.length)
    return available.some((worker) => worker.state === 'ONLINE')
      ? 'ONLINE'
      : 'DEGRADED';
  if (workers.some((worker) => worker.available && worker.scope_id))
    return 'RESTRICTED';
  return 'OFFLINE';
}

export const syncDescription = (scope) =>
  ({
    QUEUED:
      'La solicitud está guardada. El servicio corporativo importará únicamente el alcance autorizado.',
    RUNNING:
      'Importación en curso. Puedes cerrar esta ventana; el proceso continúa en el servidor.',
    RETRYING:
      'El intento anterior se interrumpió. El servicio lo recuperará automáticamente sin duplicar registros.',
    FAILED:
      'No se pudo completar la importación. Se reintentará automáticamente; revisa las incidencias y la disponibilidad del servicio.',
    PARTIAL:
      'Parte del catálogo se importó. Revisa las incidencias; los registros pendientes se reintentarán automáticamente.',
    SUCCEEDED:
      'Catálogo importado. Ya puedes gestionar contratos, usuarios y licencias; la importación no los activa por sí sola.',
    SUSPENDED:
      'Este alcance está suspendido. No se importarán nuevos datos mientras permanezca así.',
  })[scope?.syncStatus] || 'Consultando el estado de la incorporación.';

export const syncDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat('es-BO', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/La_Paz',
      }).format(new Date(value))
    : '—';

export const issueText = (code) =>
  ({
    CLIENT_IMPORT_FAILED:
      'No se pudo importar el cliente; revisar identidad y conexión.',
    PLANT_NOT_FOUND: 'La planta ya no está disponible en DataMET.',
    PLANT_AMBIGUOUS: 'La planta tiene códigos duplicados en DataMET.',
    PLANT_IMPORT_FAILED: 'No se pudo importar esta planta.',
    EQUIPMENT_NOT_FOUND: 'La balanza ya no está disponible en DataMET.',
    EQUIPMENT_AMBIGUOUS: 'La balanza tiene códigos duplicados en DataMET.',
    EQUIPMENT_INVALID: 'Los datos técnicos no son válidos.',
    EQUIPMENT_PLANT_NOT_AVAILABLE:
      'Primero debe importarse la planta de esta balanza.',
    EQUIPMENT_IMPORT_FAILED: 'No se pudo importar esta balanza.',
    EQUIPMENT_REQUIRES_REVIEW:
      'Importada, pero requiere revisar sus datos técnicos en DataMET.',
    SCOPE_WITHOUT_PLANTS: 'El alcance no contiene plantas.',
    SCOPE_WITHOUT_EQUIPMENT: 'El alcance no contiene balanzas.',
  })[code] ||
  'Incidencia de sincronización. Consulta al responsable del servicio.';
