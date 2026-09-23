import { describe, expect, it } from 'vitest';
import {
  canManageVehicleReservation,
  getVehicleDayAvailability,
  isVehicleResource,
  summarizeVehicleAvailability,
} from './vehicleAvailability';

const vehicle = { id: 'v1', nombre: 'FURGON', area: 'VEHÍCULOS' };

describe('vehicleAvailability', () => {
  it('reconoce el área de vehículos sin depender de acentos', () => {
    expect(isVehicleResource(vehicle)).toBe(true);
    expect(isVehicleResource({ area: 'vehiculos' })).toBe(true);
    expect(isVehicleResource({ area: 'CALIBRACIÓN' })).toBe(false);
  });

  it('marca libre el vehículo sin tareas', () => {
    const status = getVehicleDayAvailability(vehicle, []);
    expect(status.state).toBe('free');
    expect(status.freeWindows).toEqual([{ start: '08:30', end: '18:30' }]);
  });

  it('ignora las filas sin contenido real', () => {
    const status = getVehicleDayAvailability(vehicle, [{ horaInicio: '09:00', horaFin: '10:00' }]);
    expect(status.state).toBe('free');
    expect(status.taskCount).toBe(0);
  });

  it('deja los huecos entre tareas como ventanas libres', () => {
    const status = getVehicleDayAvailability(vehicle, [
      { morning: 'Servicio', horaInicio: '08:30', horaFin: '12:30' },
      { morning: 'Entrega', horaInicio: '14:00', horaFin: '16:00' },
    ]);
    expect(status.state).toBe('partial');
    expect(status.freeWindows).toEqual([
      { start: '12:30', end: '14:00' },
      { start: '16:00', end: '18:30' },
    ]);
    expect(status.taskCount).toBe(2);
  });

  it('une tramos solapados y ocupa la jornada completa', () => {
    const status = getVehicleDayAvailability(vehicle, [
      { morning: 'Servicio', horaInicio: '08:30', horaFin: '14:00' },
      { morning: 'Otro', horaInicio: '13:00', horaFin: '18:30' },
    ]);
    expect(status.state).toBe('busy');
    expect(status.busyBlocks).toHaveLength(1);
    expect(status.busyBlocks[0]).toMatchObject({ start: '08:30', end: '18:30' });
    expect(status.freeWindows).toEqual([]);
  });

  it('respeta la jornada propia del vehículo', () => {
    const status = getVehicleDayAvailability(
      { ...vehicle, hora_ingreso: '07:00:00', hora_salida: '15:00:00' },
      [{ morning: 'Servicio', horaInicio: '07:00', horaFin: '15:00' }]
    );
    expect(status.state).toBe('busy');
    expect(status.shiftStart).toBe('07:00');
    expect(status.shiftEnd).toBe('15:00');
  });

  it('ordena primero los libres y cuenta cada estado', () => {
    const tasks = {
      ocupado: [{ morning: 'Servicio', horaInicio: '08:30', horaFin: '18:30' }],
      parcial: [{ morning: 'Servicio', horaInicio: '08:30', horaFin: '12:30' }],
    };
    const summary = summarizeVehicleAvailability({
      vehicles: [
        { id: 'ocupado', nombre: 'CAMIONETA' },
        { id: 'libre-b', nombre: 'MOVIL B' },
        { id: 'parcial', nombre: 'FURGON' },
        { id: 'libre-a', nombre: 'MOVIL A' },
      ],
      getTasksForVehicle: (id) => tasks[id],
    });

    expect(summary.rows.map(row => row.vehicle.id)).toEqual([
      'libre-a', 'libre-b', 'parcial', 'ocupado',
    ]);
    expect(summary).toMatchObject({ total: 4, freeCount: 2, partialCount: 1, busyCount: 1 });
  });
});

describe('canManageVehicleReservation', () => {
  const admin = { usuario: 'jperez', nombre: 'Juan', acceso_cron: '2' };

  it('permite al creador por usuario o por nombre', () => {
    expect(canManageVehicleReservation({ createdBy: 'JPerez' }, admin)).toBe(true);
    expect(canManageVehicleReservation({ createdBy: 'Juán ' }, admin)).toBe(true);
  });

  it('bloquea a otro administrador', () => {
    expect(canManageVehicleReservation({ createdBy: 'mlopez' }, admin)).toBe(false);
  });

  it('con id de creador compara por id y no por nombre', () => {
    expect(canManageVehicleReservation({ createdById: 7, createdBy: 'x' }, { ...admin, id: 7 })).toBe(true);
    expect(canManageVehicleReservation({ createdById: 7, createdBy: 'jperez' }, { ...admin, id: 9 })).toBe(false);
  });

  it('deja pasar a desarrolladores y reservas sin creador real', () => {
    expect(canManageVehicleReservation({ createdBy: 'mlopez' }, { usuario: 'dev', acceso_cron: '3' })).toBe(true);
    expect(canManageVehicleReservation({ createdBy: 'Sistema' }, admin)).toBe(true);
    expect(canManageVehicleReservation({ createdBy: '' }, admin)).toBe(true);
  });
});
