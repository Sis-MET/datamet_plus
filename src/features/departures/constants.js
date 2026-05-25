/**
 * Tipos de salida del personal y sus colores identificadores.
 * Exportado desde un archivo compartido para evitar dependencias circulares
 * entre DepartureFormModal y DeparturesPanels.
 */
export const TIPOS_SALIDA = [
  { label: 'Entrega',       value: 'ENTREGA',       color: '#1d4ed8' },
  { label: 'Compras',       value: 'COMPRAS',       color: '#0369a1' },
  { label: 'Instalación',   value: 'INSTALACIÓN',   color: '#0891b2' },
  { label: 'Servicio',      value: 'SERVICIO',      color: '#059669' },
  { label: 'Visita',        value: 'VISITA',        color: '#16a34a' },
  { label: 'Compensación',  value: 'COMPENSACIÓN',  color: '#ca8a04' },
  { label: 'Permiso - Personal',      value: 'PERMISO - PERSONAL',      color: '#d97706' },
  { label: 'Personal - Vacación',     value: 'PERSONAL - VACACIÓN',     color: '#7c3aed' },
];

export const ESTADOS_SALIDA = ['Solicitud', 'Aceptado', 'Aprobado'];
