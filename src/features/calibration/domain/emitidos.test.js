import { describe, expect, it } from 'vitest';
import { aniosDe, capacidad, contarEstados, filtrarEmitidos, textoEmision, textoInstrumento } from './emitidos';

const certificados = [
  { numero: '0051-C01-30-26', anio: 2026, estado: 'VIGENTE', codigo: 'SRV-1', cliente: 'Minera Ñandú S.A.', instrumento: { tipo: 'BALANZA', marca: 'OHAUS', modelo: 'PA214', id: '0051-11-035', serie: 'B123', max: '220', unidad: 'g' } },
  { numero: '0052-C02-01-26', anio: 2026, estado: 'POR_FIRMAR', codigo: 'SRV-2', cliente: 'Laboratorio Andino', instrumento: { tipo: 'BÁSCULA', marca: 'METTLER TOLEDO', id: '0052-11-001' } },
  { numero: '0040-C01-12-25', anio: 2025, estado: 'ANULADO', codigo: 'SRV-3', cliente: 'Cooperativa', instrumento: {} },
];

describe('certificados emitidos', () => {
  it('busca sin tildes por n.º, cliente, instrumento, ID. o serie', () => {
    expect(filtrarEmitidos(certificados, { q: 'nandu' }).map(c => c.numero)).toEqual(['0051-C01-30-26']);
    expect(filtrarEmitidos(certificados, { q: 'bascula mettler' }).map(c => c.numero)).toEqual(['0052-C02-01-26']);
    expect(filtrarEmitidos(certificados, { q: '0051-11-035' })).toHaveLength(1);
    expect(filtrarEmitidos(certificados, { q: 'b123' })).toHaveLength(1);
    expect(filtrarEmitidos(certificados, { q: '' })).toHaveLength(3);
  });

  it('filtra por estado y año, y cuenta los estados', () => {
    expect(filtrarEmitidos(certificados, { estado: 'VIGENTE' })).toHaveLength(1);
    expect(filtrarEmitidos(certificados, { anio: 2025 }).map(c => c.estado)).toEqual(['ANULADO']);
    expect(aniosDe(certificados)).toEqual([2026, 2025]);
    expect(contarEstados(certificados)).toEqual({ TODOS: 3, VIGENTE: 1, POR_FIRMAR: 1, ANULADO: 1 });
  });

  it('textos del instrumento y de la emisión', () => {
    expect(textoInstrumento(certificados[0].instrumento)).toBe('BALANZA · OHAUS · PA214');
    expect(capacidad(certificados[0].instrumento)).toBe('220 g');
    expect(textoEmision(2)).toBe('02');
  });
});
