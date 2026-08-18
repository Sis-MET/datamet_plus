import { z } from 'zod';

const nullableText = z.string().nullable().optional();

export const scheduleRowSchema = z.object({
  id: z.coerce.number(),
  id_usuario: z.coerce.number().nullable().optional(),
  usuario: nullableText,
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipo_tarea: nullableText,
  cotizacion: nullableText,
  descripcion: nullableText,
  cliente: nullableText,
  cod_cliente: nullableText,
  planta: nullableText,
  color: nullableText,
  estado: nullableText,
  hora_inicio: nullableText,
  hora_fin: nullableText,
  hora_total: z.coerce.number().nullable().optional(),
  creado_por: nullableText,
  creado_en: nullableText,
  fecha_creacion: nullableText,
  hora_creacion: nullableText,
  actualizado_por: nullableText,
  fecha_modificacion: nullableText,
  hora_modificacion: nullableText,
}).passthrough();

export const technicianSchema = z.object({
  user_id: z.coerce.number(),
  id: z.string().min(1),
  nombre: z.string().min(1),
  cargo: nullableText,
  area: nullableText,
  hora_ingreso: nullableText,
  hora_salida: nullableText,
}).passthrough();

const apiList = (itemSchema) => z.object({
  success: z.literal(true),
  data: z.array(itemSchema),
});

export const parseScheduleResponse = (value) => apiList(scheduleRowSchema).parse(value);
export const parseTechniciansResponse = (value) => apiList(technicianSchema).parse(value);
