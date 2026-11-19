import { describe, expect, it } from 'vitest';
import {
  bs, bsCorto, cuadre, facturaDesdeFormulario, fecha, fechaHora, filtrosAParams, leerMonto, lineaVacia, opcionesCategorias,
  problemasFactura, repartirPago, sumar,
} from './comercial';

const formulario = (overrides = {}) => ({
  numero: '595',
  fechaEmision: '2026-11-18',
  cliente: { codigo: '0999' },
  razonSocial: ' Cliente de Ejemplo S.R.L. ',
  nit: '',
  monto: '2.750,00',
  observacion: '',
  cotizacion: '0999-s03-1-26',
  cotizacionCal: '',
  notaSalida: 'NS-4401-2026; NS-4402-2026',
  responsable1: '7',
  responsable2: '',
  cotizo: '',
  lineas: [
    { ...lineaVacia(), categoriaId: '3', monto: '2.400', cantidad: '4', regional: 'LPZ' },
    { ...lineaVacia(), categoriaId: '14', monto: '350', cantidad: '', regional: '' },
  ],
  ...overrides,
});

describe('montos y fechas', () => {
  it('lee montos con coma decimal y puntos de miles', () => {
    expect(leerMonto('1.234,50')).toBe(1234.5);
    expect(leerMonto('1234.5')).toBe(1234.5);
    expect(leerMonto('Bs 350')).toBe(350);
    expect(leerMonto('')).toBeNull();
    expect(leerMonto('abc')).toBeNull();
    expect(sumar(['0,1', '0,2'])).toBe(0.3);
  });

  it('formatea en bolivianos y fechas de Bolivia', () => {
    expect(bs(1129402.1)).toBe('Bs 1.129.402,10');
    expect(bs(null)).toBe('—');
    expect(bsCorto(5801268.65)).toBe('Bs 5,8 M');
    expect(bsCorto(784139.6)).toBe('Bs 784 mil');
    expect(fecha('2026-11-18')).toBe('18/11/2026');
    expect(fechaHora('2026-11-18T14:05:00')).toBe('18/11/2026 10:05');
  });
});

describe('formulario de factura', () => {
  it('cuadra las líneas con el monto', () => {
    expect(cuadre('2.750,00', formulario().lineas)).toMatchObject({ suma: 2750, cuadra: true, diferencia: 0 });
    expect(cuadre('2.700', formulario().lineas)).toMatchObject({ cuadra: false, diferencia: -50 });
  });

  it('señala lo que falta antes de enviar', () => {
    expect(problemasFactura(formulario())).toEqual({});
    expect(problemasFactura(formulario({ monto: '2.700' })).lineas).toMatch(/sumar el monto/);
    expect(problemasFactura(formulario({ numero: '', razonSocial: ' ' }))).toMatchObject({
      numero: expect.any(String), razonSocial: expect.any(String),
    });
  });

  it('arma lo que se envía: referencias en mayúsculas y responsables al 50 % si son dos', () => {
    const personal = [{ id: 7, nombre: 'Ana Pérez' }, { id: 8, nombre: 'Luis Rojas' }];
    const body = facturaDesdeFormulario(formulario({ responsable2: '8' }), personal);
    expect(body).toMatchObject({ numero: 595, clienteCodigo: '0999', razonSocial: 'Cliente de Ejemplo S.R.L.', nit: null, monto: 2750 });
    expect(body.lineas).toEqual([
      { categoriaId: 3, monto: 2400, cantidad: 4, regional: 'LPZ' },
      { categoriaId: 14, monto: 350, cantidad: null, regional: null },
    ]);
    expect(body.referencias).toEqual([
      { tipo: 'COTIZACION', valor: '0999-S03-1-26' },
      { tipo: 'NOTA_SALIDA', valor: 'NS-4401-2026' },
      { tipo: 'NOTA_SALIDA', valor: 'NS-4402-2026' },
    ]);
    expect(body.personas.map(p => [p.nombre, p.porcentaje])).toEqual([['Ana Pérez', 50], ['Luis Rojas', 50]]);
  });
});

describe('listas y pagos', () => {
  it('quita los filtros vacíos de los parámetros', () => {
    expect(filtrosAParams({ q: '', estado: 'pendiente', area: '' }, 2)).toEqual({ estado: 'pendiente', page: 2, pageSize: 25 });
  });

  it('agrupa las categorías vigentes por área', () => {
    const opciones = opcionesCategorias([
      { id: 1, nombre: 'Calibración de balanzas', area: 'CAL', vigente: true },
      { id: 2, nombre: 'Vieja', area: 'CAL', vigente: false },
    ]);
    expect(opciones).toEqual([{ value: '1', label: 'Calibración de balanzas', group: 'Calibración' }]);
  });

  it('reparte un pago en orden sin pasar el saldo de cada factura', () => {
    expect(repartirPago('1.200', [{ id: 1, saldo: 1000 }, { id: 2, saldo: 500 }, { id: 3, saldo: 50 }]))
      .toEqual([{ facturaId: 1, monto: 1000 }, { facturaId: 2, monto: 200 }, { facturaId: 3, monto: 0 }]);
  });
});
