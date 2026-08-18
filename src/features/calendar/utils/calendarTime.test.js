import { describe, expect, it } from 'vitest';
import { getFirstFreeSlot, getMaxEndForStart, hasTimeOverlap } from './calendarTime';

describe('calendarTime', () => {
  const blocks = [
    { start: '08:30', end: '10:00' },
    { start: '11:00', end: '12:30' },
  ];

  it('encuentra el primer tramo libre', () => {
    expect(getFirstFreeSlot(blocks, '08:30')).toBe('10:00');
  });

  it('limita el fin al inicio del siguiente bloque', () => {
    expect(getMaxEndForStart(blocks, '10:00', '18:30')).toBe('11:00');
  });

  it('considera contiguos como disponibles', () => {
    expect(hasTimeOverlap(blocks, '10:00', '11:00')).toBe(false);
    expect(hasTimeOverlap(blocks, '09:30', '10:30')).toBe(true);
  });
});
