import { describe, expect, it } from 'vitest';
import {
  activityTitle,
  alertSummary,
  effectiveAlert,
  expiryOf,
  frequencyLabel,
  matchesQuery,
  occurrenceWhen,
  periodLabel,
  relativeDays,
  vigenciaOf,
  yearFraction,
} from './format';

describe('bitácora de un equipo', () => {
  it('titula los cambios del equipo, de su plan y de sus fechas', () => {
    expect(activityTitle({ fuente: 'EQUIPO', accion: 'REVISION' })).toBe('Certificado revisado');
    expect(activityTitle({ fuente: 'PLAN', tipo: 'VERIFICACION', accion: 'EDICION' })).toBe('Verificación interna: configuración modificada');
    expect(activityTitle({ fuente: 'PLAN', tipo: 'ACTIVIDAD', accion: 'CREACION' })).toBe('Actividad creada');
    expect(activityTitle({ fuente: 'FECHA', tipo: 'VERIFICACION', accion: 'MODIFICACION', fechaProgramada: '2026-01-15' }))
      .toBe('Verificación interna del 15 ene 2026: modificada');
  });
});

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

  it('calcula el vencimiento y la vigencia de un certificado', () => {
    expect(expiryOf('2026-06-11', 730)).toBe('2028-06-10');
    expect(expiryOf('2026-01-22', 183)).toBe('2026-07-24');
    expect(expiryOf('2026-01-22', 0)).toBeNull();
    expect(vigenciaOf('2026-10-20', '2026-10-06', 30)).toBe('POR_VENCER');
    expect(vigenciaOf('2026-10-05', '2026-10-06', 30)).toBe('VENCIDO');
    expect(vigenciaOf('2027-10-05', '2026-10-06', 30)).toBe('VIGENTE');
    expect(vigenciaOf(null, '2026-10-06', 30)).toBe('SIN_DATOS');
  });

  it('busca sin distinguir tildes ni mayúsculas', () => {
    expect(matchesQuery('termohigro', 'Termohigrobarómetro')).toBe(true);
    expect(matchesQuery('POLITICA', 'Revisar política de calidad')).toBe(true);
    expect(matchesQuery('THB', 'F1-202', 'Pesas')).toBe(false);
  });
});
