import { describe, expect, it } from 'vitest';
import {
  cambiosParaGuardar,
  estaCorregido,
  formatoFecha,
  hojasDeFotos,
  mismoValor,
  nombreArchivo,
  notasRevision,
  pieDeInforme,
  pieDeRevision,
  prepararPdfEmitido,
  FORMATO_OTST,
  normalizarOtst,
  numeroInforme,
  sinCambios,
  textoPie,
  valorGuardado,
  valoresInforme,
} from './informe';
import { PLANTILLAS } from './plantillas';

const informe = {
  fuente: { comentario_general: 'Original', d1: 0.05, cliente: 'CBN', fecha_servicio: '2026-08-13' },
  datos: { comentario_general: 'Corregido' },
};

it('prepara el PDF de la revisión recién emitida con su versión y contenido efectivos', () => {
  const emitido = { ...informe, numero: '26-001', estado: 'EMITIDO', revision: 2, version: 9,
    fotos: [{ id: 1 }], revisiones: [{ revision: 2, motivo: 'Corrección solicitada', emitidoEn: '2026-10-23' }], trazabilidad: {} };
  const pdf = prepararPdfEmitido(emitido, PLANTILLAS.MPR);
  expect(pdf).toMatchObject({ version: 9, revision: 2, documento: { borrador: false, valores: { comentario_general: 'Corregido' }, fotos: [{ id: 1 }] } });
  expect(pdf.titulo).toBe(nombreArchivo(PLANTILLAS.MPR, emitido.numero, valoresInforme(emitido), 2));
  expect(pdf.documento.notas).toContain('Corrección solicitada');
  expect(() => prepararPdfEmitido({ ...emitido, estado: 'EN_REVISION' }, PLANTILLAS.MPR)).toThrow('todavía');
});

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

  it('conserva el punto o la coma mientras se escribe un número', () => {
    // Guardado 50: «50.» y «50,0» son pasos para llegar a 50.01.
    for (const texto of ['50.', '50,', '50.0', '50,0', '050']) expect(sinCambios(texto, 50, 'numero')).toBe(false);
    expect(sinCambios('50.0', 50)).toBe(false);
    expect(sinCambios('50', 50, 'numero')).toBe(true);
    expect(sinCambios('0.05', 0.05, 'numero')).toBe(true);
    expect(sinCambios('', null, 'numero')).toBe(true);
    expect(sinCambios(0.05, 0.05, 'numero')).toBe(true);
    expect(sinCambios(' Bueno ', 'Bueno')).toBe(true);
    // Al guardar se comparan como número: «50.0» no envía nada.
    expect(cambiosParaGuardar({ fuente: { d1: 50 }, datos: {} }, { d1: '50.0' }, { d1: 'numero' })).toEqual({});
    expect(cambiosParaGuardar({ fuente: { d1: 50 }, datos: {} }, { d1: '50,01' }, { d1: 'numero' })).toEqual({ d1: 50.01 });
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

describe('OTST y número del informe', () => {
  it('arma el número como el servidor', () => {
    expect(numeroInforme('26-0285-51-S01', '0285-51-002')).toBe('26-0285-51-S01-002');
    expect(numeroInforme(' 26-0285-51-S01 ', '12')).toBe('26-0285-51-S01-12');
    expect(numeroInforme(null, '0285-51-002')).toBe('0285-51-002');
  });

  it('acepta las OTST actuales y las antiguas, en mayúsculas y sin espacios', () => {
    expect(normalizarOtst(' 26-0285-51-s01 ')).toBe('26-0285-51-S01');
    for (const otst of ['26-0285-51-S01', '0000-S16-1-25']) expect(FORMATO_OTST.test(otst)).toBe(true);
    for (const otst of ['260285', '26--0285', '-26-0285', '26/0285']) expect(FORMATO_OTST.test(otst)).toBe(false);
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

describe('revisiones y pie del informe', () => {
  // Mediodía UTC: la fecha local (dd/mm/aaaa) no cambia con la zona horaria.
  const copias = [
    { revision: 0, motivo: null, emitidoPor: { usuario: 'ana', nombre: 'Ana Rojas' }, emitidoEn: '2026-10-18T12:00:00Z', posterior: false },
    { revision: 1, motivo: 'El cliente pidió corregir la ubicación.', emitidoPor: { usuario: 'luis', nombre: 'Luis Paz' }, emitidoEn: '2026-10-22T12:00:00Z', posterior: false },
  ];
  const base = { numero: '26-0087-11-S01-020', trazabilidad: { emitidoEn: '2026-10-18T12:00:00Z', emitidoPor: { usuario: 'ana', nombre: 'Ana Rojas' } } };

  it('la Rev. 0 dice quién la emitió y cuándo', () => {
    const pie = pieDeInforme({ ...base, estado: 'EMITIDO', revision: 0, revisiones: copias.slice(0, 1) });
    expect(textoPie(pie)).toBe('Informe N° 26-0087-11-S01-020 · Rev. 0 · Emitido el 18/10/2026 por Ana Rojas');
  });

  it('una reemisión dice quién la reemitió y a qué revisión reemplaza', () => {
    const pie = pieDeInforme({ ...base, estado: 'EMITIDO', revision: 1, revisiones: copias });
    expect(textoPie(pie)).toBe(
      'Informe N° 26-0087-11-S01-020 · Rev. 1 del 22/10/2026 por Luis Paz · Reemplaza a la Rev. 0 del 18/10/2026',
    );
  });

  it('con la revisión abierta el documento es su borrador', () => {
    const pie = pieDeInforme({ ...base, estado: 'EN_REVISION', revision: 1, revisiones: copias, revisionAbierta: { revision: 2 } });
    expect(textoPie(pie)).toBe('Informe N° 26-0087-11-S01-020 · Borrador de la Rev. 2 · Vigente: Rev. 1');
    expect(textoPie(pieDeInforme({ ...base, estado: 'BORRADOR', revision: 0 }))).toBe('Informe N° 26-0087-11-S01-020 · Borrador sin emitir');
  });

  it('un informe corregido antes de las revisiones conserva su pie anterior', () => {
    const pie = pieDeInforme({
      ...base, estado: 'EMITIDO', revision: 2, revisiones: [], trazabilidad: { ...base.trazabilidad, actualizadoEn: '2026-10-20T12:00:00Z' },
    });
    expect(textoPie(pie)).toBe('Informe N° 26-0087-11-S01-020 · Rev. 2 del 20/10/2026 · Emitido el 18/10/2026 por Ana Rojas');
  });

  it('el pie de una revisión anterior al reimprimirla', () => {
    expect(textoPie(pieDeRevision({ ...copias[1], revisiones: copias }, base.numero)))
      .toBe('Informe N° 26-0087-11-S01-020 · Rev. 1 del 22/10/2026 por Luis Paz · Reemplaza a la Rev. 0 del 18/10/2026');
    expect(textoPie(pieDeRevision({ ...copias[0], revisiones: copias.slice(0, 1) }, base.numero)))
      .toBe('Informe N° 26-0087-11-S01-020 · Rev. 0 · Emitido el 18/10/2026 por Ana Rojas');
  });

  it('las notas del final llevan el motivo de cada revisión', () => {
    expect(notasRevision(copias.slice(0, 1))).toBeNull();
    expect(notasRevision(copias)).toBe('Rev. 1 (22/10/2026): El cliente pidió corregir la ubicación.');
    expect(notasRevision(copias, { revision: 2, motivo: 'Cambiar la foto 3.' })).toBe(
      'Rev. 1 (22/10/2026): El cliente pidió corregir la ubicación.\nRev. 2 (en borrador): Cambiar la foto 3.',
    );
  });

  it('el PDF de una reemisión lleva su revisión en el nombre', () => {
    expect(nombreArchivo(PLANTILLAS.IBM, 'X', {}, 2)).toBe('AJML-X-SinDato-SinDato-SinDato-SinDato-SinDato-Rev2');
    expect(nombreArchivo(PLANTILLAS.IBM, 'X', {}, 0)).toBe('AJML-X-SinDato-SinDato-SinDato-SinDato-SinDato');
  });
});
