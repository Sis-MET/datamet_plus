import { z } from 'zod';

export const formSchema = z.object({
  // Balanza
  serialNumber: z.string().min(1, 'Número de serie requerido'),
  model: z.string().min(1, 'Modelo requerido'),
  brand: z.string().min(1, 'Marca requerida'),
  deliveryDate: z.string().min(1, 'Fecha de entrega requerida'),
  status: z.enum(['nuevo', 'usado', 'reparado'], { errorMap: () => ({ message: 'Seleccione un estado' }) }),
  notes: z.string().optional(),

  // Cliente
  clientName: z.string().min(3, 'Nombre completorequerido'),
  companyName: z.string().min(1, 'Empresa/Razón social requerida'),
  taxId: z.string().min(1, 'RUT/NIT/Identificación requerido'),
  address: z.string().min(1, 'Dirección requerida'),
  phone: z.string().min(7, 'Teléfono válido requerido'),
  email: z.string().email('Email inválido'),
  city: z.string().min(1, 'Ciudad requerida'),

  // Técnico
  techName: z.string().min(1, 'Nombre del técnico requerido'),
  techId: z.string().min(1, 'ID del técnico requerido'),
  serviceTimestamp: z.string().min(1, 'Fecha y hora requerida'),

  // Firmas
  clientSignature: z.string({ required_error: 'Firma del cliente requerida' }).min(1, 'Firma del cliente requerida'),
  techSignature: z.string({ required_error: 'Firma del técnico requerida' }).min(1, 'Firma del técnico requerida'),

  // Evidencias (validamos length del array)
  photos: z.array(z.any()).min(2, 'Se requieren mínimo 2 fotos').max(5, 'Máximo 5 fotos'),
});
