import { describe, expect, it } from 'vitest';
import {
  applyOptimisticAssignments,
  hasUnconfirmedInserts,
  reconcileOptimisticAssignments,
} from './optimisticSchedule';

const technicians = [{ id: 'Ana_QA', user_id: 7 }];

describe('optimisticSchedule', () => {
  it('inserta una tarea local y la reconcilia con el id del servidor', () => {
    const optimistic = applyOptimisticAssignments([], '2026-08-17', [{
      resource: 'Ana_QA',
      payload: { tipo_tarea: 'Visita', descripcion: 'Inspección' },
    }], technicians, 'save-1');

    expect(optimistic.tasks[0]).toMatchObject({
      id: 'optimistic_save-1_0',
      Tecnico: 'Ana_QA',
      morning: 'Visita',
      optimistic: true,
    });

    const confirmed = reconcileOptimisticAssignments(
      optimistic.tasks,
      optimistic.operations,
      [{ id: 42, lastModified: '2026-08-17 10:15:00' }]
    );
    expect(confirmed[0]).toMatchObject({
      id: 'task_42',
      rowId: 42,
      optimistic: false,
      timestampUpdated: '2026-08-17 10:15:00',
    });
  });

  it('reemplaza y elimina por rowId sin duplicar la ficha', () => {
    const current = [{ id: 'task_9', rowId: 9, morning: 'Servicio' }];
    const updated = applyOptimisticAssignments(current, '2026-08-18', [{
      resource: 'Ana_QA',
      payload: { rowId: 9, tipo_tarea: 'Otro', descripcion: 'Actualizada' },
    }], technicians, 'save-2');
    expect(updated.tasks).toHaveLength(1);
    expect(updated.tasks[0].morning).toBe('Otro');

    const deleted = applyOptimisticAssignments(updated.tasks, '2026-08-18', [{
      resource: 'Ana_QA',
      payload: { rowId: 9, tipo_tarea: '' },
    }], technicians, 'save-3');
    expect(deleted.tasks).toHaveLength(0);
  });

  it('detecta servidores antiguos que no retornan ids de inserción', () => {
    const optimistic = applyOptimisticAssignments([], '2026-08-17', [{
      resource: 'Ana_QA', payload: { tipo_tarea: 'Visita' },
    }], technicians, 'save-4');
    expect(hasUnconfirmedInserts(optimistic.operations, [])).toBe(true);
  });
});
