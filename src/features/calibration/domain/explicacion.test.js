import { describe, expect, it } from 'vitest';
import { cifras, decimalesDe, fijo, grados, porcentaje, presupuesto, textoComposicion } from './explicacion';

describe('cómo se calcula', () => {
  it('formatea con coma, cifras significativas y potencias de 10', () => {
    expect(cifras(0.000118, 3)).toBe('0,000118');
    expect(cifras(0.0000118, 3)).toBe('1,18·10⁻⁵');
    expect(cifras(0.7824, 4)).toBe('0,7824');
    expect(cifras(0)).toBe('0');
    expect(cifras(null)).toBe('—');
    expect(fijo(-0.00001, 4)).toBe('0,0000');
    expect(fijo(100.00023, 5)).toBe('100,00023');
    expect(decimalesDe(0.01)).toBe(2);
    expect(decimalesDe(1e-7)).toBe(7);
    expect(grados(Infinity)).toBe('∞');
    expect(grados(4.53)).toBe('4');
    expect(porcentaje(0.734)).toBe('73 %');
    expect(porcentaje(0.0042)).toBe('< 1 %');
  });

  it('agrupa el presupuesto y nombra la componente que más pesa', () => {
    const punto = {
      componentes: [
        { fuente: 'redondeoCero', u: 0.0029, nu: Infinity, grupo: 'indicacion' },
        { fuente: 'repetibilidad', u: 0.01, nu: 4, grupo: 'indicacion' },
        { fuente: 'certificado', u: 0.004, nu: Infinity, grupo: 'referencia' },
        { fuente: 'conveccion', u: 0, nu: Infinity, grupo: 'referencia' },
      ],
    };
    const p = presupuesto(punto);
    expect(p.indicacion.map(f => f.etiqueta)).toEqual(['Redondeo en cero', 'Repetibilidad']);
    expect(p.referencia).toHaveLength(1);
    expect(p.mayor.fuente).toBe('repetibilidad');
    expect(p.tipoA.map(f => f.fuente)).toEqual(['repetibilidad']);
    const suma = [...p.indicacion, ...p.referencia].reduce((s, f) => s + f.aporte, 0);
    expect(suma).toBeCloseTo(1, 12);
    expect(textoComposicion({ composicion: 'REGLA' })).toMatch(/menos piezas/);
  });
});
