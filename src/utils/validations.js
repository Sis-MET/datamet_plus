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
  // Código métrica del equipo elegido en la búsqueda (vacío si se escribió a mano).
  codMetrica: z.string().optional(),

  // Cliente
  clientName: z.string().min(3, 'Nombre completo requerido'),
  clientCargo: z.string().min(3, 'Cargo requerido'),
  companyName: z.string().min(1, 'Empresa requerida'),
  companyRazonSocial: z.string().min(1, 'Razón Social requerida'),
  taxId: z.string().min(1, 'RUT/NIT/Identificación requerido'),
  address: z.string().optional(),
  phone: z.string().min(7, 'Teléfono válido requerido'),
  email: z.string().email('Email inválido'),
  city: z.string().optional(),
  planta: z.string().optional(),
  plantaDireccion: z.string().optional(),
  plantaDepartamento: z.string().optional(),
  unit: z.string().optional(),

  // Estado del Instrumento - Inventario
  inventory: z.object({
    indicator: z.enum(['present', 'missing', 'na']).optional(),
    voltageAdapter: z.enum(['present', 'missing', 'na']).optional(),
    powerCable: z.enum(['present', 'missing', 'na']).optional(),
    bracket: z.enum(['present', 'missing', 'na']).optional(),
    column: z.enum(['present', 'missing', 'na']).optional(),
    weighingPan: z.enum(['present', 'missing', 'na']).optional(),
    windShield: z.enum(['present', 'missing', 'na']).optional(),
    structure: z.enum(['present', 'missing', 'na']).optional(),
    loadCells: z.enum(['present', 'missing', 'na']).optional(),
    loadCellsQty: z.string().optional(),
    loadCellCable: z.enum(['present', 'missing', 'na']).optional(),
    loadCellConnector: z.enum(['present', 'missing', 'na']).optional(),
    junctionBox: z.enum(['present', 'missing', 'na']).optional(),
    feet: z.enum(['present', 'missing', 'na']).optional(),
    feetQty: z.string().optional(),
    manual: z.enum(['present', 'missing', 'na']).optional(),
    originalPackaging: z.enum(['present', 'missing', 'na']).optional(),
    otherItems: z.array(z.object({
      name: z.string(),
      status: z.enum(['present', 'missing', 'na'])
    })).optional(),
  }).optional(),
  inventoryNotes: z.string().optional(),

  // Estado del Instrumento - Daños Físicos
  damageLevel: z.enum(['excellent', 'good', 'fair', 'poor', 'critical'], {
    required_error: 'Seleccione el estado general'
  }).optional(),
  damageTypes: z.object({}).passthrough().optional(), // Permite cualquier estructura de objeto
  damageDescription: z.string().optional(),

  // Estado del Instrumento - Limpieza
  cleanlinessLevel: z.enum(['clean', 'light', 'moderate', 'heavy'], {
    required_error: 'Seleccione el nivel de limpieza'
  }).optional(),
  dirtTypes: z.object({}).passthrough().optional(), // Permite cualquier estructura de objeto
  affectedAreas: z.array(z.string()).optional(),
  cleanlinessNotes: z.string().optional(),

  // Síntomas del Instrumento
  functionalityTestPerformed: z.enum(['yes', 'no'], {
    required_error: 'Debe indicar si se realizaron pruebas'
  }),
  functionalityTestDescription: z.string().optional(),

  // 6.1 Recepción
  // El RIM se registra con el motivo y las dos firmas, como en ServiceMET.
  receptionReason: z.string().trim().min(5, 'Describa por qué se recibe el instrumento'),
  receptionClientSignature: z.string({ error: 'Falta la firma del cliente' }).min(1, 'Falta la firma del cliente'),
  receptionReceiverSignature: z.string({ error: 'Falta la firma del representante de Métrica' }).min(1, 'Falta la firma del representante de Métrica'),
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
  deliveryClientName: z.string().optional(),
  deliveryMetricaRepresentative: z.string().optional(),
  deliveryDate: z.string().optional(),
  deliveryLocation: z.string().optional(),

  photos: z.array(z.any()).max(5, 'Máximo 5 fotos').optional(),
});
