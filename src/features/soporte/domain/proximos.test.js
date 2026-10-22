import { describe, expect, it } from 'vitest';
import {
  agruparPorCliente, claveFiltroSugerido, cuando, detalleGrupo, enriquecerEvento, formaDe, gestionTitulo, otstDe,
  plantaVisible, proximoDeEquipo, rangoCorto, sugeridoLabel, toneDe,
} from './proximos';

const equipo = {
  id: '0058-11-001',
  codMetrica: '0058-11-001',
  cliente: 'LAS LOMAS',
  planta: 'LAS LOMAS - LA PAZ',
  ciudad: 'LA PAZ',
  instrumento: 'BALANZA',
  marca: 'OHAUS',
  modelo: 'SPX222',
  serie: 'B64',
  origen: { tipo: 'MPA', fecha: '2026-06-19', tecnico: 'Tec. Ana' },
  proximo: {
    id: 'MPA:R1', tipoSugerido: 'DIG', recomendacion: null, fecha: '2026-09-19', situacion: 'VENCIDO', diasRestantes: -33,
    ultimoContacto: null, descartada: false,
  },
};

describe('próximos servicios', () => {
  it('describe cuándo toca el próximo servicio', () => {
    expect(cuando({ situacion: 'PROGRAMADO', diasRestantes: 0 })).toBe('Hoy');
    expect(cuando({ situacion: 'PROXIMO', diasRestantes: 1 })).toBe('Mañana');
    expect(cuando({ situacion: 'PROXIMO', diasRestantes: 12 })).toBe('En 12 días');
    expect(cuando({ situacion: 'VENCIDO', diasRestantes: -1 })).toBe('Venció ayer');
    expect(cuando({ situacion: 'VENCIDO', diasRestantes: -33 })).toBe('Vencido hace 33 días');
    expect(cuando({ situacion: 'DESCARTADO', diasRestantes: -3 })).toBe('Descartado');
  });

  it('elige la forma por el tipo sugerido y, si no hay, por el servicio', () => {
    expect(formaDe({ clase: 'PROXIMO', tipo: 'MPA', tipoSugerido: 'MCR' })).toBe('diamond');
    expect(formaDe({ clase: 'PROXIMO', tipo: 'IBM', tipoSugerido: null })).toBe('square');
    expect(formaDe({ clase: 'PROXIMO', tipo: 'MPR', tipoSugerido: 'OTRO' })).toBe('circle');
    expect(formaDe({ clase: 'SERVICIO', tipo: 'DIG' })).toBe('diamond');
    // Un próximo servicio de «Requieren atención» (sin clase) usa su origen.
    expect(formaDe({ fechaSugerida: '2026-01-01', tipoSugerido: null, origen: { tipo: 'INT' } })).toBe('square');
  });

  it('nombra el tipo sugerido, incluido el texto libre antiguo', () => {
    expect(sugeridoLabel({ tipoSugerido: 'AJM' })).toBe('Ajuste metrológico');
    expect(sugeridoLabel({ tipoSugerido: 'OTRO', recomendacion: 'Superficie no adecuada.' })).toBe('Superficie no adecuada.');
    expect(sugeridoLabel({ tipoSugerido: null })).toBe('Sin tipo sugerido');
    expect(claveFiltroSugerido({ tipoSugerido: null })).toBe('NINGUNO');
  });

  it('usa los tonos de calibración', () => {
    expect(toneDe('VENCIDO')).toBe('danger');
    expect(toneDe('COORDINADO')).toBe('info');
    expect(toneDe('DESCARTADO')).toBe('muted');
    expect(toneDe('OTRA')).toBe('neutral');
  });

  it('completa las marcas y el próximo servicio con los datos del equipo', () => {
    const marca = enriquecerEvento({ id: 'P:MPA:R1', clase: 'PROXIMO', equipoId: equipo.id, tipo: 'MPA', fecha: '2026-09-19' }, equipo);
    expect(marca.cliente).toBe('LAS LOMAS');
    expect(marca.origen.tipo).toBe('MPA');
    const servicio = enriquecerEvento({ id: 'S:MPA:R1', clase: 'SERVICIO', equipoId: equipo.id, tipo: 'MPA' }, equipo);
    expect(servicio.origen).toBeUndefined();
    expect(proximoDeEquipo(equipo).codMetrica).toBe('0058-11-001');
    expect(proximoDeEquipo({ ...equipo, proximo: null })).toBeNull();
  });

  it('titula las gestiones del seguimiento', () => {
    expect(gestionTitulo({ accion: 'REPROGRAMACION', fechaNueva: '2026-11-12' })).toBe('Reprogramado al 12 de noviembre 2026');
    expect(gestionTitulo({ accion: 'COORDINACION', fechaNueva: '2026-11-05' })).toBe('Visita coordinada para el 5 de noviembre 2026');
    expect(gestionTitulo({ accion: 'DESCARTE' })).toBe('Descartado');
  });

  it('agrupa por cliente y planta; la OTST anterior no separa los equipos', () => {
    const proximo = (codMetrica, otst, fecha, situacion, extra = {}) => ({
      id: `P:${codMetrica}`, equipoId: codMetrica, codMetrica, cliente: 'COFAR', planta: 'COFAR - LA PAZ', ciudad: 'LA PAZ',
      fecha, situacion, tipoSugerido: 'MPR', origen: { tipo: 'MPR', otst }, ...extra,
    });
    const grupos = agruparPorCliente([
      proximo('0087-11-020', '25-0087-11-S01', '2026-05-18', 'VENCIDO'),
      proximo('0087-11-011', '25-0087-11-S07', '2026-06-01', 'VENCIDO'),
      proximo('0087-11-034', '25-0087-11-S01', '2026-05-19', 'VENCIDO', { tipoSugerido: null }),
      proximo('0087-21-001', '25-0087-21-S01', '2026-05-20', 'VENCIDO', { planta: 'COFAR - SANTA CRUZ', ciudad: 'SANTA CRUZ' }),
      proximo('0090-11-001', '25-0090-11-S01', '2026-05-18', 'PROXIMO', { cliente: 'LAFAR', planta: 'LAFAR' }),
    ]);
    expect(grupos.map(grupo => [grupo.cliente, grupo.planta, grupo.items.length])).toEqual([
      ['COFAR', 'COFAR - LA PAZ', 3],
      ['COFAR', 'COFAR - SANTA CRUZ', 1],
      ['LAFAR', 'LAFAR', 1],
    ]);
    const [cofar] = grupos;
    expect(cofar.items.map(item => item.codMetrica)).toEqual(['0087-11-020', '0087-11-034', '0087-11-011']);
    expect(cofar.items.map(otstDe)).toEqual(['25-0087-11-S01', '25-0087-11-S01', '25-0087-11-S07']);
    expect([cofar.fecha, cofar.fechaFin, cofar.situacion, cofar.ciudad]).toEqual(['2026-05-18', '2026-06-01', 'VENCIDO', 'LA PAZ']);
    expect(rangoCorto(cofar)).toBe('18 may – 1 jun');
    expect(detalleGrupo(cofar)).toBe('Varios tipos sugeridos');
    expect(plantaVisible(cofar)).toBe('COFAR - LA PAZ');
    expect(plantaVisible(grupos[2])).toBeNull();
  });

  it('el grupo toma la situación del equipo más urgente y separa lo realizado', () => {
    const grupos = agruparPorCliente([
      { id: 'a', clase: 'PROXIMO', equipoId: 'A', codMetrica: 'A', cliente: 'X', fecha: '2026-11-02', situacion: 'PROGRAMADO', origen: { otst: 'O1' } },
      { id: 'b', clase: 'PROXIMO', equipoId: 'B', codMetrica: 'B', cliente: 'X', fecha: '2026-11-05', situacion: 'PROXIMO', origen: { otst: 'O2' } },
      { id: 'c', clase: 'SERVICIO', equipoId: 'C', codMetrica: 'C', cliente: 'X', fecha: '2026-11-01', situacion: 'REALIZADO', otst: 'O3', tipo: 'MPR', tecnico: 'Ana' },
    ]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].situacion).toBe('PROXIMO');
    expect(grupos[0].principal.codMetrica).toBe('B');
    expect(rangoCorto(grupos[0])).toBe('2–5 nov');
    expect(rangoCorto({ fecha: '2026-11-02', fechaFin: '2026-11-02' })).toBeNull();
    expect(detalleGrupo(grupos[1])).toBe('Preventivo regular · Ana');
  });
});
