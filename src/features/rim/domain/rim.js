/**
 * Catálogos y ayudas del módulo RIM (recepción de instrumentos de pesaje).
 * Las claves son las mismas en ServiceMET y en el formulario web, así un
 * RIM se lee igual venga de donde venga.
 */

export const COMPONENTES = {
  indicator: 'Indicador',
  voltageAdapter: 'Adaptador de voltaje',
  powerCable: 'Cable de poder',
  bracket: 'Bracket',
  column: 'Columna',
  weighingPan: 'Bandeja de pesaje',
  windShield: 'Cabina corta aire',
  structure: 'Estructura',
  loadCells: 'Celda(s) de carga',
  loadCellCable: 'Cable de celda',
  loadCellConnector: 'Conector de celda',
  junctionBox: 'Caja sumadora',
  feet: 'Patas',
  manual: 'Manual',
  originalPackaging: 'Embalaje original',
};

export const ESTADOS_COMPONENTE = {
  present: { label: 'Presente', tone: 'success' },
  missing: { label: 'Faltante', tone: 'danger' },
  na: { label: 'N/A', tone: 'muted' },
};

export const ESTADOS_GENERALES = {
  excellent: 'Excelente',
  good: 'Bueno',
  fair: 'Regular',
  poor: 'Malo',
  critical: 'Crítico',
};

export const TIPOS_DANO = {
  scratches: 'Rayones',
  dents: 'Abolladuras',
  corrosion: 'Corrosión',
  cracks: 'Grietas',
  broken: 'Piezas rotas',
  wear: 'Desgaste',
  other: 'Otros',
};

export const UBICACIONES_DANO = {
  platform: 'Plataforma',
  display: 'Display',
  structure: 'Estructura',
  loadCells: 'Celdas',
  wiring: 'Cableado',
};

export const NIVELES_SUCIEDAD = {
  clean: 'Limpio',
  light: 'Polvo ligero',
  moderate: 'Moderado',
  heavy: 'Muy sucio',
};

export const AREAS = [
  { value: 'calibracion', label: 'Calibración' },
  { value: 'soporte', label: 'Soporte técnico' },
  { value: 'directo', label: 'Registro directo' },
];

export const ESTADOS_RIM = {
  vigente: { label: 'Vigente', tone: 'success' },
  anulado: { label: 'Anulado', tone: 'danger' },
};

/** Motivos frecuentes de anulación; «Otro» exige escribirlo. */
export const MOTIVOS_ANULACION = [
  'Se registró el instrumento equivocado',
  'Datos del cliente o de la planta incorrectos',
  'RIM duplicado',
  'El instrumento no llegó a recibirse',
];

export const MOTIVOS_CIERRE = {
  telefono_perdido: 'Teléfono perdido o dañado',
  reinstalacion: 'App reinstalada o teléfono reemplazado',
  otro: 'Otro motivo',
  fin_gestion: 'Fin de la gestión (informado por el teléfono)',
};

export const ESTADOS_TALONARIO = {
  en_uso: { label: 'En uso', tone: 'info' },
  completo: { label: 'Completo', tone: 'success' },
  cerrado: { label: 'Cerrado', tone: 'neutral' },
};

export const PAGE_SIZE = 25;

export const filtrosVacios = () => ({
  q: '',
  cliente: '',
  planta: '',
  desde: '',
  hasta: '',
  area: '',
  estado: '',
});

/** Parámetros de la consulta del historial: sin los filtros vacíos. */
export function filtrosAParams(filtros, page = 1, pageSize = PAGE_SIZE) {
  const params = { page, pageSize };
  for (const [key, value] of Object.entries(filtros)) {
    const text = String(value ?? '').trim();
    if (text) params[key] = text;
  }
  return params;
}

export const hayFiltros = (filtros) => Object.values(filtros).some(value => String(value ?? '').trim());

/** Fecha y hora en Bolivia, legible ("1 oct 2026, 14:30"). */
export function fechaHora(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('es-BO', {
    dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23', timeZone: 'America/La_Paz',
  });
}

/** Rangos compactos de números: [41, 42, 43, 47] → "0041–0043, 0047". */
export function rangos(numeros) {
  const ordenados = [...new Set(numeros)].sort((a, b) => a - b);
  const pad = (numero) => String(numero).padStart(4, '0');
  const partes = [];
  for (let i = 0; i < ordenados.length; i += 1) {
    const inicio = ordenados[i];
    let fin = inicio;
    while (ordenados[i + 1] === fin + 1) {
      fin = ordenados[i + 1];
      i += 1;
    }
    partes.push(inicio === fin ? pad(inicio) : `${pad(inicio)}–${pad(fin)}`);
  }
  return partes.join(', ');
}

/** "Cliente · Planta" sin partes vacías. */
export const clientePlanta = (rim) =>
  [rim.cliente?.nombre, rim.planta?.nombre].filter(Boolean).join(' · ');

/** "Balanza · Marca Modelo" sin partes vacías. */
export const descripcionInstrumento = (instrumento = {}) =>
  [instrumento.tipo, [instrumento.marca, instrumento.modelo].filter(Boolean).join(' ')]
    .filter(Boolean).join(' · ');

/** Componentes del inventario en el orden del catálogo, con los adicionales al final. */
export function filasInventario(inventario = {}) {
  const items = inventario.items || {};
  const cantidades = inventario.cantidades || {};
  const conocidos = Object.keys(COMPONENTES).filter(key => items[key]);
  const otrosDelCatalogo = Object.keys(items).filter(key => !COMPONENTES[key]);
  return [
    ...[...conocidos, ...otrosDelCatalogo].map(key => ({
      key,
      nombre: COMPONENTES[key] || key,
      estado: items[key],
      cantidad: cantidades[key] || null,
    })),
    ...(inventario.otros || []).map((item, index) => ({
      key: `otro-${index}`,
      nombre: item.name,
      estado: item.status,
      cantidad: null,
    })),
  ];
}

/** Daños con sus ubicaciones legibles: [{ tipo: 'Rayones', lugares: 'Plataforma, Display' }]. */
export const filasDanos = (danos = {}) => Object.entries(danos).map(([tipo, lugares]) => ({
  tipo: TIPOS_DANO[tipo] || tipo,
  lugares: (lugares || []).map(lugar => UBICACIONES_DANO[lugar] || lugar).join(', '),
}));

/** UUID v4 para identificar un RIM antes de registrarlo. */
export function nuevoUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Cuerpo de `POST /api/rim/registros` a partir de los valores del
 * formulario web. Las fotos llegan ya como data URL.
 */
export function registroWebDesdeFormulario(data, { uuid, clienteId, plantaCodigo, plantaNombre, fotos, appVersion }) {
  const inventory = data.inventory || {};
  const items = {};
  const cantidades = {};
  for (const key of Object.keys(COMPONENTES)) {
    if (inventory[key]) items[key] = inventory[key];
  }
  if (inventory.loadCells === 'present' && inventory.loadCellsQty) cantidades.loadCells = String(inventory.loadCellsQty);
  if (inventory.feet === 'present' && inventory.feetQty) cantidades.feet = String(inventory.feetQty);
  return {
    uuid,
    cliente: {
      codigo: clienteId ? String(clienteId) : null,
      nombre: data.companyName,
      razonSocial: data.companyRazonSocial,
      nit: data.taxId,
      direccion: data.address || null,
      ciudad: data.city || null,
    },
    planta: {
      codigo: plantaCodigo || null,
      nombre: plantaNombre || null,
      direccion: data.plantaDireccion || null,
      departamento: data.plantaDepartamento || null,
    },
    instrumento: {
      codMetrica: data.codMetrica || null,
      tipo: data.instrument,
      marca: data.brand,
      modelo: data.model,
      serie: data.serialNumber,
      capacidad: data.maxCapacity,
      division: data.resolution,
      unidad: data.unit || null,
      ubicacion: data.workArea,
      observaciones: data.notes || null,
    },
    // Quien entrega y firma; si no se indicó, el contacto del cliente.
    contacto: {
      nombre: data.receptionClientName || data.clientName,
      cargo: data.clientCargo,
      telefono: data.phone,
      correo: data.email,
    },
    motivo: data.receptionReason,
    inventario: {
      items,
      cantidades,
      otros: (inventory.otherItems || [])
        .filter(item => item?.name?.trim())
        .map(item => ({ nombre: item.name.trim(), estado: item.status || 'present' })),
    },
    obsInventario: data.inventoryNotes || null,
    estadoGeneral: data.damageLevel,
    danos: data.damageTypes || {},
    descripcionDanos: data.damageDescription || null,
    nivelSuciedad: data.cleanlinessLevel,
    pruebas: data.functionalityTestPerformed === 'yes',
    descripcionPruebas: data.functionalityTestDescription || null,
    representanteMetrica: data.receptionMetricaRepresentative,
    lugarRecepcion: data.receptionLocation,
    tecnicoAsignado: data.executionAssignedTechnician || null,
    firmaCliente: data.receptionClientSignature,
    firmaRepresentante: data.receptionReceiverSignature,
    fotos,
    appVersion,
  };
}
