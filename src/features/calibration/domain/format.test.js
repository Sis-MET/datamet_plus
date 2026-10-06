import { describe, expect, it } from 'vitest';
import {
  alertSummary,
  effectiveAlert,
  frequencyLabel,
  matchesQuery,
  occurrenceWhen,
  periodLabel,
  relativeDays,
  yearFraction,
} from './format';

describe('formato del cronograma de calibración', () => {
  it('expresa el periodo del certificado en meses o años', () => {
    expect(periodLabel(183)).toBe('6 meses');
    expect(periodLabel(365)).toBe('1 año');
    expect(periodLabel(730)).toBe('2 años');
    expect(periodLabel(null)).toBe('—');
  });

  it('nombra las frecuencias habituales del área', () => {
    expect(frequencyLabel(0)).toBe('Una sola vez');
    expect(frequencyLabel(6)).toBe('Semestral');
    expect(frequencyLabel(5)).toBe('Cada 5 meses');
  });

  it('distingue calibraciones vencidas de tareas atrasadas', () => {
    expect(relativeDays(-74, 'CALIBRACION')).toBe('Vencida hace 74 días');
    expect(relativeDays(-1, 'ACTIVIDAD')).toBe('Atrasada 1 día');
    expect(relativeDays(0, 'VERIFICACION')).toBe('Hoy');
    expect(relativeDays(12, 'VERIFICACION')).toBe('En 12 días');
    expect(occurrenceWhen({ situacion: 'REALIZADO', fecha: '2026-03-04' })).toBe('Realizada el 4 mar');
  });

  it('usa la alerta general cuando la serie no define la suya', () => {
    const ajustes = { alertaDias: 30, alertaFrecuencia: 'SEMANAL', alertaCorreo: true };
    expect(effectiveAlert({ alertaDias: 15 }, ajustes)).toEqual({ dias: 15, frecuencia: 'SEMANAL', correo: true });
    // Con la configuración de correo oculta el resumen solo dice la anticipación.
    expect(alertSummary(effectiveAlert(null, ajustes))).toBe('30 días antes');
    expect(alertSummary({ dias: 7, frecuencia: 'NINGUNA', correo: true })).toBe('Sin avisos');
  });

  it('ubica cada día en la línea del año', () => {
    expect(yearFraction('2026-01-01', 2026)).toBeCloseTo(0.5 / 365);
    expect(yearFraction('2026-12-31', 2026)).toBeCloseTo(364.5 / 365);
    expect(yearFraction('2025-12-31', 2026)).toBe(0);
    expect(yearFraction('2027-01-01', 2026)).toBe(1);
  });

  it('busca sin distinguir tildes ni mayúsculas', () => {
    expect(matchesQuery('termohigro', 'Termohigrobarómetro')).toBe(true);
    expect(matchesQuery('POLITICA', 'Revisar política de calidad')).toBe(true);
    expect(matchesQuery('THB', 'F1-202', 'Pesas')).toBe(false);
  });
});
