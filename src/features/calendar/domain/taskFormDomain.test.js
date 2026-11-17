import { describe, expect, it } from 'vitest';
import {
  buildTaskPayload,
  findVehicleConflict,
  parseActivityValue,
  recognizeServiceReference,
  requiresServiceReference,
  serviceReferenceLabel,
  validateTaskDraft,
} from './taskFormDomain';

describe('referencia del servicio de la salida', () => {
  it('reconoce OTST, SECA y cotización en sus formatos', () => {
    expect(recognizeServiceReference('otst 26-0285-51-s01')).toEqual({ tipo: 'OTST', codigo: '26-0285-51-S01' });
    expect(recognizeServiceReference('0000-S16-1-25')).toEqual({ tipo: 'OTST', codigo: '0000-S16-1-25' });
    expect(recognizeServiceReference('SECA 0051-C01-26')).toEqual({ tipo: 'SECA', codigo: '0051-C01-26' });
    expect(recognizeServiceReference('0103-31-C05-26')).toEqual({ tipo: 'SECA', codigo: '0103-31-C05-26' });
    expect(recognizeServiceReference('123.cot456')).toEqual({ tipo: 'COTIZACION', codigo: '123.COT456' });
    expect(recognizeServiceReference('OTST pendiente').tipo).toBe('OTST');
    expect(recognizeServiceReference('pedido 45')).toEqual({ tipo: null, codigo: 'PEDIDO 45' });
    expect(recognizeServiceReference('  ')).toEqual({ tipo: null, codigo: '' });
    expect(serviceReferenceLabel('0051-C01-26')).toBe('SECA');
    expect(serviceReferenceLabel('pedido 45')).toBe('Referencia');
  });

  it('se pide en las salidas, no en permisos ni compensaciones', () => {
    expect(requiresServiceReference('Servicio')).toBe(true);
    expect(requiresServiceReference('Visita')).toBe(true);
    expect(requiresServiceReference('')).toBe(true);
    expect(requiresServiceReference('Permiso - Vacacion')).toBe(false);
    expect(requiresServiceReference('Compensacion')).toBe(false);
  });

  it('se guarda en la columna de la cotización, en mayúsculas y sin espacios de más', () => {
    const base = { event: null, activityType: 'Servicio', requiresQuote: false, cotizacionCode: '', descripcion: 'x', color: '#000', estado: 'Pendiente', horaInicio: '08:30', horaFin: '10:00', cliente: '', codCliente: '', planta: '', additionalResources: [], selectedVehicle: '' };
    expect(buildTaskPayload({ ...base, serviceReference: '  otst   26-0285-51-s01 ' }).cotizacion).toBe('OTST 26-0285-51-S01');
    expect(buildTaskPayload({ ...base, activityType: 'Permiso - Personal', serviceReference: 'OTST 1' }).cotizacion).toBe('');
    expect(buildTaskPayload(base).cotizacion).toBe('');
  });
});

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
