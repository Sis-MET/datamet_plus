import { describe, expect, it } from 'vitest';
import {
  buscarRecursos, buscarTareas, combinarTareas, esBusquedaValida, normalizarBusqueda, palabrasBusqueda, resaltar,
} from './scheduleSearch';
import { mapScheduleRow, resolveResourceId } from './scheduleRows';

const hoy = new Date('2026-11-17T12:00:00');
const tarea = (rowId, fecha, extra = {}) => ({
  rowId, id: `task_${rowId}`, Tecnico: 'Ana_Paz', fecha: new Date(`${fecha}T12:00:00`), tipoTarea: 'Servicio', ...extra,
});

describe('buscador del cronograma', () => {
  it('compara sin tildes ni mayúsculas y pide al menos 2 caracteres', () => {
    expect(normalizarBusqueda('  Potosí   NORTE ')).toBe('potosi norte');
    expect(palabrasBusqueda('cbn CBN la  paz')).toEqual(['cbn', 'la', 'paz']);
    expect(esBusquedaValida('a')).toBe(false);
    expect(esBusquedaValida('ab')).toBe(true);
  });

  it('exige todas las palabras en cualquier campo, también el nombre de la persona', () => {
    const tareas = [
      tarea(1, '2026-11-18', { cliente: 'CBN', planta: 'Huari', cotizacion: 'OTST 26-0285-51-S01' }),
      tarea(2, '2026-11-10', { cliente: 'Monopol', descripcion: 'Calibración en Potosí' }),
      tarea(3, '2026-11-17', { cliente: 'CBN', planta: 'El Alto', Tecnico: 'Luis_Rojas' }),
    ];
    const nombreDe = id => id.replace(/_/g, ' ');
    expect(buscarTareas(tareas, 'cbn huari', { hoy, nombreDe }).map(t => t.rowId)).toEqual([1]);
    expect(buscarTareas(tareas, 'potosi', { hoy, nombreDe }).map(t => t.rowId)).toEqual([2]);
    expect(buscarTareas(tareas, '26-0285', { hoy, nombreDe }).map(t => t.rowId)).toEqual([1]);
    expect(buscarTareas(tareas, 'luis cbn', { hoy, nombreDe }).map(t => t.rowId)).toEqual([3]);
    // Lo más cercano a hoy primero.
    expect(buscarTareas(tareas, 'cbn', { hoy, nombreDe }).map(t => t.rowId)).toEqual([3, 1]);
    expect(buscarTareas(tareas, 'c', { hoy, nombreDe })).toEqual([]);
  });

  it('encuentra personas y vehículos por nombre, cargo o área', () => {
    const recursos = [
      { id: 'Ana_Paz', nombre: 'Ana Paz', cargo: 'Técnico', area: 'Calibración' },
      { id: 'CAMIONETA_LPZ', nombre: 'CAMIONETA LPZ', cargo: 'VEHICULO', area: 'VEHÍCULOS' },
    ];
    expect(buscarRecursos(recursos, 'calibracion').map(r => r.id)).toEqual(['Ana_Paz']);
    expect(buscarRecursos(recursos, 'vehiculos lpz').map(r => r.id)).toEqual(['CAMIONETA_LPZ']);
  });

  it('junta las tareas cargadas y las del servidor sin repetir filas', () => {
    const locales = [tarea(1, '2026-11-18', { cliente: 'local' })];
    const remotas = [tarea(1, '2026-11-18', { cliente: 'remota' }), tarea(9, '2025-02-01')];
    const juntas = combinarTareas(locales, remotas, { hoy });
    expect(juntas.map(t => [t.rowId, t.cliente])).toEqual([[1, 'local'], [9, undefined]]);
  });

  it('resalta lo buscado conservando las tildes del texto', () => {
    expect(resaltar('Calibración Potosí', 'potosi')).toEqual([
      { texto: 'Calibración ', marca: false },
      { texto: 'Potosí', marca: true },
    ]);
    expect(resaltar('CBN', '')).toEqual([{ texto: 'CBN', marca: false }]);
  });
});

describe('filas del cronograma', () => {
  const tecnicos = [
    { user_id: 8, id: 'Ana_Paz', nombre: 'Ana Paz' },
    { user_id: 8, id: 'CAMIONETA_LPZ', nombre: 'CAMIONETA LPZ' },
  ];

  it('distingue persona y vehículo con el mismo id por el nombre', () => {
    expect(resolveResourceId({ id_usuario: 8, usuario: 'CAMIONETA LPZ' }, tecnicos)).toBe('CAMIONETA_LPZ');
    expect(resolveResourceId({ id_usuario: 8, usuario: 'Ana Paz' }, tecnicos)).toBe('Ana_Paz');
  });

  it('arma la tarea y descarta las anuladas', () => {
    const fila = {
      id: 5, id_usuario: 8, usuario: 'Ana Paz', fecha: '2026-11-18', tipo_tarea: 'Servicio', cotizacion: 'SECA 0051-C01-26',
      estado: 'Solicitud', hora_inicio: '08:30:00', hora_fin: '12:00:00', creado_en: 'CronoMET',
    };
    const mapeada = mapScheduleRow(fila, tecnicos);
    expect(mapeada).toMatchObject({
      id: 'task_5', rowId: 5, Tecnico: 'Ana_Paz', cotizacion: 'SECA 0051-C01-26', estadoAM: 'Pendiente', horaInicio: '08:30', horaFin: '12:00',
    });
    expect(mapScheduleRow({ ...fila, estado: 'Anulado' }, tecnicos)).toBeNull();
  });
});
