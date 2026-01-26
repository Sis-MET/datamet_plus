import { z } from 'zod';

export const formSchema = z.object({
  // Instrumento
  instrument: z.string().min(1, 'Tipo de instrumento requerido'),
  serialNumber: z.string().min(1, 'Número de serie requerido'),
  model: z.string().min(1, 'Modelo requerido'),
  brand: z.string().min(1, 'Marca requerida'),
  maxCapacity: z.string().min(1, 'Capacidad máxima requerida'),
  resolution: z.string().min(1, 'Resolución requerida'),
  workArea: z.string().min(1, 'Área de trabajo requerida'),
  notes: z.string().optional(),

  // Cliente
  clientName: z.string().min(3, 'Nombre completo requerido'),
  clientCargo: z.string().min(3, 'Cargo requerido'),
  companyName: z.string().min(1, 'Empresa requerida'),
  companyRazonSocial: z.string().min(1, 'Razón Social requerida'),
  taxId: z.string().min(1, 'RUT/NIT/Identificación requerido'),
  address: z.string().min(1, 'Dirección requerida'),
  phone: z.string().min(7, 'Teléfono válido requerido'),
  email: z.string().email('Email inválido'),
  city: z.string().min(1, 'Ciudad requerida'),

  // Estado del Instrumento - Inventario
  inventory: z.object({
    indicator: z.enum(['present', 'missing', 'na']),
    voltageAdapter: z.enum(['present', 'missing', 'na']),
    powerCable: z.enum(['present', 'missing', 'na']),
    bracket: z.enum(['present', 'missing', 'na']),
    column: z.enum(['present', 'missing', 'na']),
    weighingPan: z.enum(['present', 'missing', 'na']),
    windShield: z.enum(['present', 'missing', 'na']),
    structure: z.enum(['present', 'missing', 'na']),
    loadCells: z.enum(['present', 'missing', 'na']),
    loadCellsQty: z.string().optional(),
    loadCellCable: z.enum(['present', 'missing', 'na']),
    loadCellConnector: z.enum(['present', 'missing', 'na']),
    junctionBox: z.enum(['present', 'missing', 'na']),
    feet: z.enum(['present', 'missing', 'na']),
    feetQty: z.string().optional(),
    manual: z.enum(['present', 'missing', 'na']),
    originalPackaging: z.enum(['present', 'missing', 'na']),
    other: z.string().optional(),
  }),
  inventoryNotes: z.string().optional(),

  // Estado del Instrumento - Daños Físicos
  damageLevel: z.enum(['excellent', 'good', 'fair', 'poor', 'critical'], {
    required_error: 'Seleccione el estado general'
  }).optional(),
  damageTypes: z.record(z.array(z.string())).optional(), // { 'scratches': ['platform', 'display'], ... }
  damageDescription: z.string().optional(),

  // Estado del Instrumento - Limpieza
  cleanlinessLevel: z.enum(['clean', 'light', 'moderate', 'heavy'], {
    required_error: 'Seleccione el nivel de limpieza'
  }).optional(),
  dirtTypes: z.record(z.array(z.string())).optional(), // { 'dust': ['platform'], ... }
  affectedAreas: z.array(z.string()).optional(),
  cleanlinessNotes: z.string().optional(),

  // Síntomas del Instrumento
  functionalityTestPerformed: z.enum(['yes', 'no'], {
    required_error: 'Debe indicar si se realizaron pruebas'
  }),
  functionalityTestDescription: z.string().optional(),

  // 6.1 Recepción
  receptionClientSignature: z.string().optional(),
  receptionReceiverSignature: z.string().optional(),
  receptionClientName: z.string({ required_error: 'Nombre del cliente requerido' }).min(1),
  receptionMetricaRepresentative: z.string({ required_error: 'Representante de Métrica requerido' }).min(1),
  receptionDate: z.string().optional(), // Se obtiene del sistema
  receptionLocation: z.string({ required_error: 'Lugar de recepción requerido' }).min(1),

  // 6.2 Ejecución
  executionSTReception: z.string().optional(),
  executionSTEntryDate: z.string().optional(),
  executionAssignedTechnician: z.string().optional(),
  executionStartDate: z.string().optional(),
  executionReportDate: z.string().optional(),
  executionCompletionDate: z.string().optional(),
  executionQuoteNumber: z.string().optional(),
  executionReportNumber: z.string().optional(),
  executionInvoiceNumber: z.string().optional(),

  // 6.3 Entrega
  deliveryClientSignature: z.string().optional(),
  deliveryResponsibleSignature: z.string().optional(),
  deliveryClientName: z.string({ required_error: 'Nombre del cliente requerido' }).min(1),
  deliveryMetricaRepresentative: z.string({ required_error: 'Representante de Métrica requerido' }).min(1),
  deliveryDate: z.string().optional(),
  deliveryLocation: z.string({ required_error: 'Lugar de entrega requerido' }).min(1),

  photos: z.array(z.any()).max(5, 'Máximo 5 fotos').optional(),
});
