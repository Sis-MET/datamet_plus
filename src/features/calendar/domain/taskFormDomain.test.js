import { describe, expect, it } from 'vitest';
import {
  buildTaskPayload,
  findVehicleConflict,
  parseActivityValue,
  validateTaskDraft,
} from './taskFormDomain';

describe('taskFormDomain', () => {
  it('separa tipos y cotizaciones heredadas', () => {
    expect(parseActivityValue('Servicio - 123.COT456')).toEqual({
      activityType: 'Servicio',
      quoteCode: '123.COT456',
    });
  });

  it('detecta solapamientos de vehículo pero permite límites contiguos', () => {
    const tasks = [{ tipoTarea: 'Visita', horaInicio: '09:00', horaFin: '10:30' }];
    expect(findVehicleConflict({ tasks, start: '10:00', end: '11:00' })).toEqual(tasks[0]);
    expect(findVehicleConflict({ tasks, start: '10:30', end: '11:00' })).toBeNull();
  });

  it('devuelve un error específico para horarios inválidos', () => {
    expect(validateTaskDraft({
      activityType: 'Otro',
      requiresPlantAssistance: false,
      cliente: '',
      color: '#123456',
      descripcion: 'Trabajo',
      horaInicio: '11:00',
      horaFin: '10:00',
      overlaps: false,
      vehicleConflict: null,
    })).toMatch(/posterior/);
  });

  it('construye el contrato normalizado sin combinar columnas', () => {
    const payload = buildTaskPayload({
      event: null,
      activityType: 'Visita',
      requiresQuote: false,
      cotizacionCode: 'ignorada',
      descripcion: '  Revisión  ',
      color: '#123456',
      estado: 'Pendiente',
      horaInicio: '08:30',
      horaFin: '09:30',
      cliente: '  Cliente  ',
      codCliente: '  100  ',
      planta: '100-2',
      additionalResources: ['Ana_Colque'],
      selectedVehicle: 'CAMIONETA_LPZ',
    });

    expect(payload).toMatchObject({
      tipo_tarea: 'Visita',
      cotizacion: '',
      descripcion: 'Revisión',
      cliente: 'Cliente',
      planta: '100-2',
      vehicleResource: 'CAMIONETA_LPZ',
    });
  });
});
