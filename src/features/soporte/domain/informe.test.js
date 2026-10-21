import { describe, expect, it } from 'vitest';
import {
  cambiosParaGuardar,
  estaCorregido,
  formatoFecha,
  hojasDeFotos,
  mismoValor,
  nombreArchivo,
  valorGuardado,
  valoresInforme,
} from './informe';
import { PLANTILLAS } from './plantillas';

const informe = {
  fuente: { comentario_general: 'Original', d1: 0.05, cliente: 'CBN', fecha_servicio: '2026-08-13' },
  datos: { comentario_general: 'Corregido' },
};

describe('valores del informe', () => {
  it('superpone corregidos y pendientes al dato original', () => {
    expect(valoresInforme(informe, { d1: '0,1' })).toEqual({
      comentario_general: 'Corregido', d1: '0,1', cliente: 'CBN', fecha_servicio: '2026-08-13',
    });
    expect(valorGuardado(informe, 'comentario_general')).toBe('Corregido');
    expect(valorGuardado(informe, 'd1')).toBe(0.05);
    expect(estaCorregido(informe, 'comentario_general')).toBe(true);
    expect(estaCorregido(informe, 'd1')).toBe(false);
  });

  it('compara números con coma o punto y vacíos como iguales', () => {
    expect(mismoValor('0,05', 0.05, 'numero')).toBe(true);
    expect(mismoValor('', null)).toBe(true);
    expect(mismoValor(' Bueno ', 'Bueno')).toBe(true);
    expect(mismoValor('Bueno', 'Regular')).toBe(false);
  });

  it('solo envía lo que cambió, con números como número', () => {
    expect(cambiosParaGuardar(informe, {
      comentario_general: 'Corregido',
      d1: '0,1',
      cliente: '  ',
      fecha_servicio: '2026-08-13',
    }, { d1: 'numero' })).toEqual({ d1: 0.1, cliente: null });
  });
});

describe('formatos', () => {
  it('fecha del informe', () => {
    expect(formatoFecha('2026-08-04')).toBe('04/08/2026');
    expect(formatoFecha(null)).toBe('');
  });

  it('nombre del PDF como en las macros', () => {
    expect(nombreArchivo(PLANTILLAS.MPR, '26-0285-51-S01-002', {
      cliente: 'AS INTERNATIONAL INSPECTIONS BOLIVIA',
      tipo_equipo: 'BALANZA - MESA',
      cap_max1: 3000,
      unidades: 'g',
      cod_int: 'N/I',
    })).toBe('IMPR-26-0285-51-S01-002-AS INTERNATIONAL INSPECTIONS BOLIVIA-BALANZA - MESA-3000-g-N_I');
    expect(nombreArchivo(PLANTILLAS.IBM, 'X', {})).toBe('AJML-X-SinDato-SinDato-SinDato-SinDato-SinDato');
  });

  it('fotos en hojas de 6', () => {
    expect(hojasDeFotos([1, 2, 3, 4, 5, 6, 7]).map(h => h.length)).toEqual([6, 1]);
    expect(hojasDeFotos([])).toEqual([]);
  });
});
