import { describe, expect, it } from 'vitest';
import {
  CAMBIOS_BITRIX, bs, bsCorto, cuadre, enlaceSeguro, mesCorto, paramsReporte, periodoDe, facturaDesdeFormulario, fecha, fechaHora, filtrosAParams, formularioDesdePropuesta, haceCuanto,
  leerMonto, lineaVacia, montoTexto, opcionesCategorias, porcentaje, problemasFactura, repartirPago, sumar, valorCambio,
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

  it('porcentajes del saldo: redondeados y «< 1 %» si hay algo pero no llega', () => {
    expect(porcentaje(784139.6, 1129402.1)).toBe('69 %');
    expect(porcentaje(100, 1129402.1)).toBe('< 1 %');
    expect(porcentaje(0, 1129402.1)).toBe('0 %');
    expect(porcentaje(5, 0)).toBe('0 %');
  });

  it('reparte un pago en orden sin pasar el saldo de cada factura', () => {
    expect(repartirPago('1.200', [{ id: 1, saldo: 1000 }, { id: 2, saldo: 500 }, { id: 3, saldo: 50 }]))
      .toEqual([{ facturaId: 1, monto: 1000 }, { facturaId: 2, monto: 200 }, { facturaId: 3, monto: 0 }]);
  });
});

describe('Comercial: reportes', () => {
  it('períodos rápidos en días de Bolivia', () => {
    expect(periodoDe('gestion', '2026-11-20')).toEqual({ desde: '2026-01-01', hasta: '2026-11-20' });
    expect(periodoDe('mes', '2026-11-20')).toEqual({ desde: '2026-11-01', hasta: '2026-11-20' });
    expect(periodoDe('trimestre', '2026-11-20')).toEqual({ desde: '2026-09-01', hasta: '2026-11-20' });
    expect(periodoDe('trimestre', '2026-02-10')).toEqual({ desde: '2025-12-01', hasta: '2026-02-10' });
    expect(periodoDe('anterior', '2026-11-20')).toEqual({ desde: '2025-01-01', hasta: '2025-12-31' });
  });

  it('meses cortos y filtros sin vacíos', () => {
    expect(mesCorto('2026-03')).toBe('mar');
    expect(mesCorto('2025-12', true)).toBe('dic 25');
    expect(paramsReporte({ desde: '2026-01-01', hasta: '2026-11-20', area: '', tipo: 'VENTA' })).toEqual({ desde: '2026-01-01', hasta: '2026-11-20', tipo: 'VENTA' });
  });
});

describe('Comercial: factura desde una negociación de Bitrix24', () => {
  const propuesta = {
    dealId: 5120,
    cliente: { codigo: '0999', razonSocial: 'Cliente de Ejemplo S.R.L.', nit: '7654321' },
    razonSocial: 'Cliente de Ejemplo S.R.L.',
    nit: '7654321',
    monto: 3900.5,
    lineas: [{ categoriaId: 19, monto: 3900.5, cantidad: 6, regional: 'SCZ' }],
    referencias: [
      { tipo: 'COTIZACION', valor: '0999-C02-26 1' }, { tipo: 'COTIZACION', valor: '0999-C03-26 1' },
      { tipo: 'NOTA_SALIDA', valor: 'NS-4401-2026' }, { tipo: 'BITRIX', valor: '5120' },
    ],
    personas: [
      { rol: 'RESPONSABLE', usuarioId: 7, nombre: 'Ana Comercial', porcentaje: null },
      { rol: 'EJECUTO_ST', usuarioId: null, nombre: 'Mario Peña', porcentaje: null },
    ],
    avisos: [],
  };

  it('llena el formulario y lo que no es campo va aparte', () => {
    const form = formularioDesdePropuesta(propuesta, formulario({ numero: '', cotizacion: '', notaSalida: '', responsable1: '', lineas: [lineaVacia()] }));
    expect(form).toMatchObject({
      cliente: propuesta.cliente, razonSocial: 'Cliente de Ejemplo S.R.L.', nit: '7654321', monto: '3900,50',
      cotizacion: '0999-C02-26 1, 0999-C03-26 1', notaSalida: 'NS-4401-2026', responsable1: '7', responsable2: '',
    });
    expect(form.lineas.map(({ clave: _clave, ...l }) => l)).toEqual([{ categoriaId: '19', monto: '3900,50', cantidad: '6', regional: 'SCZ' }]);
    expect(form.extras).toEqual({ dealId: 5120, referencias: [{ tipo: 'BITRIX', valor: '5120' }], personas: [propuesta.personas[1]] });
    expect(problemasFactura({ ...form, numero: '596' })).toEqual({});
  });

  it('lo que se envía anota la negociación y los técnicos', () => {
    const form = formularioDesdePropuesta(propuesta, formulario({ cotizacion: '', notaSalida: '', responsable1: '', lineas: [lineaVacia()] }));
    const enviada = facturaDesdeFormulario(form, [{ id: 7, nombre: 'Ana Comercial' }]);
    expect(enviada.monto).toBe(3900.5);
    expect(enviada.referencias).toEqual([
      { tipo: 'COTIZACION', valor: '0999-C02-26 1' }, { tipo: 'COTIZACION', valor: '0999-C03-26 1' },
      { tipo: 'NOTA_SALIDA', valor: 'NS-4401-2026' }, { tipo: 'BITRIX', valor: '5120' },
    ]);
    expect(enviada.personas.map(p => [p.rol, p.usuarioId, p.nombre])).toEqual([['RESPONSABLE', 7, 'Ana Comercial'], ['EJECUTO_ST', null, 'Mario Peña']]);
  });

  it('sin líneas propuestas deja la línea vacía para elegir la categoría', () => {
    const base = formulario({ lineas: [lineaVacia()] });
    const form = formularioDesdePropuesta({ ...propuesta, lineas: [], monto: null, cliente: null }, base);
    expect(form.lineas).toBe(base.lineas);
    expect(form.monto).toBe('');
    expect(form.cliente).toBeNull();
  });

  it('cambios para Bitrix24: de qué a qué, en palabras', () => {
    expect(valorCambio(false)).toBe('No');
    expect(valorCambio(true)).toBe('Sí');
    expect(valorCambio({ id: 'C21:UC_UAOYL5', nombre: 'Pendiente de pago' })).toBe('Pendiente de pago');
    expect(valorCambio(null)).toBe('—');
    expect(valorCambio('594, 601')).toBe('594, 601');
    expect(Object.keys(CAMBIOS_BITRIX)).toEqual(['facturado', 'numeroFactura', 'etapa', 'cierre']);
  });

  it('montos, horas relativas y enlaces seguros', () => {
    expect(montoTexto(2400)).toBe('2400,00');
    expect(leerMonto(montoTexto(1234.5))).toBe(1234.5);
    const ahora = new Date('2026-11-19T14:00:00Z');
    expect(haceCuanto('2026-11-19T13:58:00', ahora)).toBe('hace 2 min');
    expect(haceCuanto('2026-11-19T11:00:00', ahora)).toBe('hace 3 h');
    expect(haceCuanto('2026-11-18T14:00:00', ahora)).toBe('hace 1 día');
    expect(haceCuanto(null, ahora)).toBeNull();
    expect(enlaceSeguro('https://b24-prueba.bitrix24.es/crm/deal/details/5120/')).toBe('https://b24-prueba.bitrix24.es/crm/deal/details/5120/');
    expect(enlaceSeguro('javascript:alert(1)')).toBeNull();
    expect(enlaceSeguro('http://b24.bitrix24.es/')).toBeNull();
  });
});
