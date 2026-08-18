import { describe, expect, it } from 'vitest';
import { parseScheduleResponse } from './scheduleContract';

describe('scheduleContract', () => {
  it('acepta el contrato normalizado del backend', () => {
    const response = parseScheduleResponse({
      success: true,
      data: [{ id: 1, fecha: '2026-08-17', usuario: 'Usuario QA' }],
    });
    expect(response.data[0].id).toBe(1);
  });

  it('rechaza fechas ambiguas', () => {
    expect(() => parseScheduleResponse({
      success: true,
      data: [{ id: 1, fecha: '17/08/2026' }],
    })).toThrow();
  });
});
