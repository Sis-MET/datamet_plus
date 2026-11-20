import { describe, expect, it } from 'vitest';
import {
  fechaHora,
  filasDanos,
  filasInventario,
  filtrosAParams,
  filtrosVacios,
  formularioDesdeDetalle,
  hayFiltros,
  nuevoUuid,
  rangos,
  registroWebDesdeFormulario,
} from './rim';

describe('historial de RIM', () => {
  it('envía solo los filtros con valor, con la página', () => {
    expect(filtrosAParams({ ...filtrosVacios(), q: '  0103 ', area: 'soporte' }, 3)).toEqual({
      page: 3, pageSize: 25, q: '0103', area: 'soporte',
    });
    expect(hayFiltros(filtrosVacios())).toBe(false);
    expect(hayFiltros({ ...filtrosVacios(), situacion: 'anulado' })).toBe(true);
  });

  it('muestra la fecha en hora de Bolivia', () => {
    expect(fechaHora('2026-10-01T18:30:00.000Z')).toMatch(/14:30/);
    expect(fechaHora(null)).toBeNull();
    expect(fechaHora('no es fecha')).toBeNull();
  });
});

describe('numeración', () => {
  it('compacta los números en rangos', () => {
    expect(rangos([43, 41, 42, 47, 49, 48])).toBe('0041–0043, 0047–0049');
    expect(rangos([5])).toBe('0005');
    expect(rangos([])).toBe('');
  });
});

describe('detalle de un RIM', () => {
  it('ordena el inventario como el catálogo y agrega los adicionales', () => {
    const filas = filasInventario({
      items: { powerCable: 'missing', indicator: 'present', nuevoComponente: 'na' },
      cantidades: { loadCells: '4' },
      otros: [{ name: 'Cable RS232', status: 'present' }],
    });
    expect(filas.map(fila => fila.nombre)).toEqual(['Indicador', 'Cable de poder', 'nuevoComponente', 'Cable RS232']);
    expect(filas[1].estado).toBe('missing');
  });

  it('describe los daños con sus ubicaciones', () => {
    expect(filasDanos({ scratches: ['platform', 'display'], corrosion: [] })).toEqual([
      { tipo: 'Rayones', lugares: 'Plataforma, Display' },
      { tipo: 'Corrosión', lugares: '' },
    ]);
  });
});

describe('PDF de un RIM registrado', () => {
  const detalle = {
    codigo: 'RIM-26-0141',
    cliente: { codigo: '0722', nombre: 'LABORMET', razonSocial: 'METZELAR', nit: '6800651015' },
    instrumento: {
      tipo: 'Balanza', marca: 'Ohaus', modelo: 'Ranger 3000', serie: '8334530116',
      capacidad: '30000', division: '0.02', unidad: 'g', ubicacion: null, observaciones: null,
    },
    motivo: 'Presenta fallas',
    inventario: {
      items: { feet: 'present', indicator: 'present', nuevoComponente: 'na' },
      cantidades: { feet: 4 },
      otros: [{ name: 'Cable RS232', status: 'missing' }, { nombre: 'Base', estado: 'present' }],
      observaciones: 'Sin tapa',
    },
    estadoGeneral: 'fair',
    danos: { broken: ['structure'] },
    descripcionDanos: 'No funciona la burbuja de la balanza',
    nivelSuciedad: 'moderate',
    pruebas: { realizadas: true, descripcion: 'Se usaron pesas de 10 y 5 Kg' },
    recepcion: {
      contactoNombre: 'Juan Pérez', contactoCargo: 'Jefe', contactoTelefono: '70000000', contactoCorreo: null,
      representanteMetrica: 'Ana Quispe', lugar: 'Laboratorio', tecnicoAsignado: 'Luis Mamani',
    },
    firmas: { cliente: 'data:image/png;base64,AAA', representante: null },
    fotos: [{ orden: 1, nombre: 'Foto 1', url: 'data:image/jpeg;base64,CCC' }],
    anulacion: null,
  };

  it('usa las claves del formulario web, como el PDF que se descarga al registrar', () => {
    const datos = formularioDesdeDetalle(detalle);
    expect(datos).toMatchObject({
      companyName: 'LABORMET', companyRazonSocial: 'METZELAR', taxId: '6800651015',
      clientName: 'Juan Pérez', receptionClientName: 'Juan Pérez', clientCargo: 'Jefe', phone: '70000000',
      instrument: 'Balanza', brand: 'Ohaus', model: 'Ranger 3000', serialNumber: '8334530116',
      maxCapacity: '30000', resolution: '0.02', unit: 'g',
      inventoryNotes: 'Sin tapa',
      damageLevel: 'fair', damageTypes: { broken: ['structure'] }, damageDescription: 'No funciona la burbuja de la balanza',
      cleanlinessLevel: 'moderate', receptionReason: 'Presenta fallas',
      functionalityTestPerformed: 'yes', functionalityTestDescription: 'Se usaron pesas de 10 y 5 Kg',
      receptionMetricaRepresentative: 'Ana Quispe', receptionLocation: 'Laboratorio', executionAssignedTechnician: 'Luis Mamani',
      receptionClientSignature: 'data:image/png;base64,AAA', receptionReceiverSignature: null,
      photos: [{ name: 'Foto 1', content: 'data:image/jpeg;base64,CCC' }],
      anulacion: null,
    });
  });

  it('pasa las cantidades y deja como adicionales lo que no está en el catálogo', () => {
    expect(formularioDesdeDetalle(detalle).inventory).toEqual({
      feet: 'present',
      indicator: 'present',
      feetQty: '4',
      otherItems: [
        { name: 'nuevoComponente', status: 'na' },
        { name: 'Cable RS232', status: 'missing' },
        { name: 'Base', status: 'present' },
      ],
    });
    expect(formularioDesdeDetalle({ ...detalle, pruebas: { realizadas: false } }).functionalityTestPerformed).toBe('no');
  });

  it('marca el RIM anulado, con el motivo y quién lo anuló', () => {
    const datos = formularioDesdeDetalle({
      ...detalle,
      anulacion: {
        motivo: 'RIM duplicado', anuladoPor: 'qa', anuladoPorNombre: 'Usuario QA',
        anuladoEn: '2026-10-19T15:00:00.000Z', reemplazadoPor: 'RIM-26-0142',
      },
    });
    expect(datos.anulacion).toMatchObject({ motivo: 'RIM duplicado', por: 'Usuario QA', reemplazadoPor: 'RIM-26-0142' });
    expect(datos.anulacion.fecha).toMatch(/11:00/);
  });
});

describe('formulario web', () => {
  it('genera un UUID v4', () => {
    expect(nuevoUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('arma el registro con las mismas claves que el RIM de ServiceMET', () => {
    const registro = registroWebDesdeFormulario({
      companyName: 'EMBOL', companyRazonSocial: 'EMBOL S.A.', taxId: '1020304050', address: '', city: 'La Paz',
      planta: '0103-11', plantaDireccion: 'Planta Río Seco - Av. Juan Pablo II', plantaDepartamento: 'LA PAZ',
      instrument: 'Balanza', brand: 'Mettler', model: 'IND570', serialNumber: 'B123', maxCapacity: '600',
      resolution: '0.2', unit: 'kg', workArea: 'Despacho', notes: '',
      clientName: 'Juan Pérez', clientCargo: 'Jefe', phone: '70000000', email: 'juan@embol.com',
      receptionReason: 'No enciende',
      inventory: {
        indicator: 'present', loadCells: 'present', loadCellsQty: '4', feet: 'missing', feetQty: '2',
        otherItems: [{ name: ' Cable RS232 ', status: 'present' }, { name: '', status: 'na' }],
      },
      damageLevel: 'fair', damageTypes: { scratches: ['platform'] }, cleanlinessLevel: 'light',
      functionalityTestPerformed: 'no', receptionMetricaRepresentative: 'Ana Quispe', receptionLocation: 'Laboratorio',
      receptionClientSignature: 'data:image/png;base64,AAA', receptionReceiverSignature: 'data:image/png;base64,BBB',
    }, { uuid: 'u', clienteId: 103, plantaCodigo: '0103-11', plantaNombre: 'Planta Río Seco', fotos: [], appVersion: 'DataMET+ 2.8.0' });

    expect(registro.cliente).toMatchObject({ codigo: '103', nit: '1020304050', direccion: null });
    expect(registro.planta).toMatchObject({ codigo: '0103-11', nombre: 'Planta Río Seco' });
    expect(registro.instrumento).toMatchObject({ division: '0.2', ubicacion: 'Despacho', observaciones: null });
    expect(registro.inventario).toEqual({
      items: { indicator: 'present', loadCells: 'present', feet: 'missing' },
      // La cantidad de patas no se guarda si faltan.
      cantidades: { loadCells: '4' },
      otros: [{ nombre: 'Cable RS232', estado: 'present' }],
    });
    expect(registro.pruebas).toBe(false);
    expect(registro.motivo).toBe('No enciende');
    expect(registro.firmaCliente).toBe('data:image/png;base64,AAA');
  });
});
