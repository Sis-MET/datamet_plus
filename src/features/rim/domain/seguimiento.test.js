import { describe, expect, it } from 'vitest';
import { filtrosAParams, filtrosVacios } from './rim';
import {
  cambiosEjecucion,
  cambiosEntrega,
  cuerpoEjecucion,
  cuerpoEntrega,
  fechaCorta,
  fechaLaPaz,
  nombresPersonal,
  quien,
  valorLegible,
  valoresEjecucion,
  valoresEntrega,
} from './seguimiento';

const FIRMA = 'data:image/png;base64,iVBORw0KGgo=';

const rim = (seguimiento = {}) => ({
  recepcion: { contactoNombre: 'Juan Pérez', lugar: 'Planta Río Seco', tecnicoAsignado: 'Luis Choque' },
  seguimiento: {
    ejecucion: { vigente: null, historial: [] },
    entrega: { vigente: null, ultimaId: null, historial: [] },
    ...seguimiento,
  },
});

const datosEjecucion = {
  recepcionSt: 'Rosa Mamani', fechaIngreso: '2026-10-02', tecnicoAsignado: 'Luis Choque',
  fechaInicio: null, fechaInforme: null, fechaConclusion: null,
  nroCotizacion: 'COT-26-118', nroInforme: null, nroFactura: null,
};

describe('ejecución del RIM', () => {
  it('la primera vez propone el técnico asignado en la recepción', () => {
    const valores = valoresEjecucion(rim());
    expect(valores.tecnicoAsignado).toBe('Luis Choque');
    expect(valores.recepcionSt).toBe('');
    // Después, los datos vigentes (los vacíos como texto vacío).
    const vigentes = valoresEjecucion(rim({ ejecucion: { vigente: { id: 1, datos: datosEjecucion }, historial: [] } }));
    expect(vigentes.recepcionSt).toBe('Rosa Mamani');
    expect(vigentes.fechaInicio).toBe('');
  });

  it('anticipa si se registra, se completa o se corrige, como el servidor', () => {
    expect(cambiosEjecucion(null, { recepcionSt: ' Rosa ' }).tipo).toBe('registro');
    expect(cambiosEjecucion(null, { recepcionSt: '  ' }).tipo).toBeNull();

    const completar = cambiosEjecucion(datosEjecucion, { ...datosEjecucion, fechaInicio: '2026-10-03' });
    expect(completar.tipo).toBe('avance');
    expect(completar.cambios).toEqual([{ campo: 'fechaInicio', antes: null, despues: '2026-10-03' }]);

    const corregir = cambiosEjecucion(datosEjecucion, { ...datosEjecucion, tecnicoAsignado: 'Mario Flores', fechaInicio: '2026-10-03' });
    expect(corregir.tipo).toBe('correccion');
    expect(corregir.cambios.map(cambio => cambio.campo)).toEqual(['tecnicoAsignado', 'fechaInicio']);

    // Borrar un dato también es corregir.
    expect(cambiosEjecucion(datosEjecucion, { ...datosEjecucion, nroCotizacion: '' }).tipo).toBe('correccion');
    expect(cambiosEjecucion(datosEjecucion, { ...datosEjecucion, recepcionSt: 'Rosa Mamani ' }).tipo).toBeNull();
  });

  it('envía los vacíos como null, la versión que reemplaza y el motivo', () => {
    expect(cuerpoEjecucion({ ...datosEjecucion, fechaInicio: '', nroFactura: ' F-9 ' }, { anteriorId: 4, motivo: ' ' })).toEqual({
      anteriorId: 4,
      ...datosEjecucion,
      nroFactura: 'F-9',
      motivo: null,
    });
    expect(cuerpoEjecucion({ recepcionSt: 'Rosa' }, { anteriorId: undefined, motivo: null }).anteriorId).toBeNull();
  });
});

describe('entrega del RIM', () => {
  it('para registrarla propone quien entregó en la recepción, el lugar y la fecha de hoy', () => {
    expect(valoresEntrega(rim(), 'registro', '2026-10-19')).toEqual({
      recibeNombre: 'Juan Pérez', entregaPor: '', fechaEntrega: '2026-10-19', lugarEntrega: 'Planta Río Seco', observaciones: '',
    });
    const vigente = { recibeNombre: 'Juan Pérez', entregaPor: 'Ana Quispe', fechaEntrega: '2026-10-15', lugarEntrega: 'Laboratorio', observaciones: null };
    const corregir = valoresEntrega(rim({ entrega: { vigente: { id: 3, datos: vigente }, ultimaId: 3, historial: [] } }), 'correccion');
    expect(corregir.entregaPor).toBe('Ana Quispe');
    expect(corregir.observaciones).toBe('');
    expect(cambiosEntrega(vigente, { ...corregir, lugarEntrega: 'Planta' })).toEqual([
      { campo: 'lugarEntrega', antes: 'Laboratorio', despues: 'Planta' },
    ]);
  });

  it('registra con las dos firmas; la corrección no las envía; la anulación solo el motivo', () => {
    const valores = { recibeNombre: ' Juan Pérez ', entregaPor: 'Ana Quispe', fechaEntrega: '2026-10-15', lugarEntrega: 'Laboratorio', observaciones: '' };
    expect(cuerpoEntrega('registro', valores, { anteriorId: null, firmas: { cliente: FIRMA, representante: FIRMA } })).toEqual({
      accion: 'registro', anteriorId: null, recibeNombre: 'Juan Pérez', entregaPor: 'Ana Quispe', fechaEntrega: '2026-10-15',
      lugarEntrega: 'Laboratorio', observaciones: null, firmaCliente: FIRMA, firmaRepresentante: FIRMA,
    });
    const correccion = cuerpoEntrega('correccion', valores, { anteriorId: 3, firmas: { cliente: FIRMA }, motivo: 'Lugar mal escrito' });
    expect(correccion.motivo).toBe('Lugar mal escrito');
    expect(correccion).not.toHaveProperty('firmaCliente');
    expect(cuerpoEntrega('anulacion', valores, { anteriorId: 3, motivo: 'RIM equivocado, era el 0043' })).toEqual({
      accion: 'anulacion', anteriorId: 3, motivo: 'RIM equivocado, era el 0043',
    });
  });
});

describe('valores legibles', () => {
  it('muestra las fechas como dd/mm/aaaa y oculta los vacíos', () => {
    expect(fechaCorta('2026-10-03')).toBe('03/10/2026');
    expect(valorLegible('fechaInforme', '2026-10-05')).toBe('05/10/2026');
    expect(valorLegible('nroInforme', 'INF-26-77')).toBe('INF-26-77');
    expect(valorLegible('nroInforme', null)).toBeNull();
    expect(valorLegible('recibeNombre', '')).toBeNull();
  });

  it('toma la fecha de La Paz, no la de UTC', () => {
    // 19/10/2026 22:30 en La Paz = 20/10/2026 02:30 UTC.
    expect(fechaLaPaz(new Date('2026-10-20T02:30:00Z'))).toBe('2026-10-19');
    expect(fechaLaPaz('2026-10-01T18:30:00.000Z')).toBe('2026-10-01');
    expect(fechaLaPaz('no es fecha')).toBeNull();
  });

  it('sugiere al personal activo sin vehículos ni repetidos', () => {
    expect(nombresPersonal([
      { nombre: 'Luis Choque', area: 'SOPORTE' },
      { nombre: 'Toyota Hilux 2045-XYZ', area: 'VEHICULOS' },
      { nombre: 'Ana Quispe', area: 'CALIBRACION' },
      { nombre: 'Luis Choque', area: 'SOPORTE' },
      { nombre: ' ', area: 'SOPORTE' },
    ])).toEqual(['Ana Quispe', 'Luis Choque']);
  });

  it('nombra a quien registró con su usuario', () => {
    expect(quien({ usuario: 'aquispe', usuarioNombre: 'Ana Quispe' })).toBe('Ana Quispe (aquispe)');
    expect(quien({ usuario: 'aquispe', usuarioNombre: null })).toBe('aquispe');
  });

  it('el filtro por etapa viaja con el historial', () => {
    expect(filtrosAParams({ ...filtrosVacios(), etapa: 'concluido' })).toEqual({ page: 1, pageSize: 25, etapa: 'concluido' });
  });
});
