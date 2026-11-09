import { describe, expect, it } from 'vitest';
import { filtrarPatrones, pasosDe, siguientePaso } from './patronesEstado';

const falta = (...codigos) => codigos.map(codigo => ({ codigo, texto: codigo }));
const patrones = [
  { codigo: 'F1-101', instrumento: 'Juego de pesas', tipo: 'PESAS', clase: 'F1', piezas: 0, certificado: { numero: 'LP-1', vence: '2027-05-05' }, listo: false, faltan: falta('SIN_PIEZAS', 'SIN_VALORES') },
  { codigo: 'TH-05', instrumento: 'Termohigrómetro', tipo: 'AMBIENTE', certificado: null, listo: false, faltan: falta('SIN_CERTIFICADO') },
  { codigo: 'E2-003', instrumento: 'Juego de pesas', tipo: 'PESAS', clase: 'E2', piezas: 21, certificado: { numero: 'LP-2', vence: '2027-01-01' }, listo: true, faltan: [] },
  { codigo: 'TH-02', instrumento: null, tipo: 'AMBIENTE', listo: false, faltan: falta('NO_EXISTE') },
];

describe('estado de los patrones', () => {
  it('pasos: ok, falta o a la espera del que falta', () => {
    expect(pasosDe(patrones[0]).map(p => [p.label, p.estado])).toEqual([
      ['En el gestor', 'ok'], ['Tipo de patrón', 'ok'], ['Piezas', 'falta'], ['Certificado vigente', 'ok'], ['Valores transcritos', 'falta'], ['Verificados', 'espera'],
    ]);
    // Un termohigrómetro no tiene piezas; sin certificado, valores y verificación esperan.
    expect(pasosDe(patrones[1]).map(p => p.estado)).toEqual(['ok', 'ok', 'falta', 'espera', 'espera']);
    expect(pasosDe(patrones[3]).map(p => p.estado)).toEqual(['falta', 'espera', 'espera', 'espera', 'espera']);
    const listo = pasosDe(patrones[2]);
    expect(listo.every(p => p.estado === 'ok')).toBe(true);
    expect(listo.find(p => p.codigo === 'SIN_PIEZAS').detalle).toBe('21');
    expect(listo.find(p => p.codigo === 'SIN_CERTIFICADO').detalle).toBe('LP-2 · vence 2027-01-01');
  });

  it('filtra por estado, tipo y texto', () => {
    expect(filtrarPatrones(patrones, { estado: 'LISTOS' }).map(p => p.codigo)).toEqual(['E2-003']);
    expect(filtrarPatrones(patrones, { estado: 'FALTAN', tipo: 'AMBIENTE' }).map(p => p.codigo)).toEqual(['TH-05', 'TH-02']);
    expect(filtrarPatrones(patrones, { q: 'termohigro' }).map(p => p.codigo)).toEqual(['TH-05']);
    expect(siguientePaso(patrones[0]).codigo).toBe('SIN_PIEZAS');
    expect(siguientePaso(patrones[2])).toBeNull();
  });
});
