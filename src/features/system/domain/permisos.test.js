import { describe, expect, it } from 'vitest';
import {
  alcanza, describirRegla, filtrarPersonal, ganarianAlConceder, iniciales, nivelDe, normalizar, origenDe, pierdenAlRevocar,
} from './permisos';

const personal = [
  { id: 22, nombre: 'Jhonatan Barrau', usuario: 'Barrau', area: 'Administración', cargo: 'Auxiliar de Sistemas', nivel: '3',
    permisos: [{ clave: 'tiempos.soporte.ver', sistemas: true, concesiones: [] }] },
  { id: 2, nombre: 'Edgar Delgado', usuario: 'Delgado', area: 'Comercial', cargo: 'Jefe de Area', nivel: '2',
    permisos: [{ clave: 'tiempos.soporte.ver', sistemas: false, concesiones: [1] }] },
  { id: 9, nombre: 'Bruno Paz', usuario: 'Paz', area: 'Calibración', cargo: 'Técnico', nivel: '2',
    permisos: [{ clave: 'tiempos.soporte.ver', sistemas: false, concesiones: [1, 3] }] },
  { id: 3, nombre: 'Ana Rojas', usuario: 'Rojas', area: 'Comercial', cargo: 'Auxiliar Comercial', nivel: '2', permisos: [] },
];
const concesiones = [
  { id: 1, permiso: 'tiempos.soporte.ver', tipo: 'GRUPO', usuarioId: null, area: null, cargo: 'jefe de area', sujeto: 'Jefes de área de todas las áreas' },
  { id: 3, permiso: 'tiempos.soporte.ver', tipo: 'PERSONA', usuarioId: 9, area: null, cargo: null, sujeto: 'Bruno Paz' },
];
const areas = [{ clave: 'comercial', nombre: 'Comercial' }, { clave: 'calibracion', nombre: 'Calibración' }];
const cargos = [{ clave: 'jefe de area', nombre: 'Jefe de Area' }, { clave: 'tecnico', nombre: 'Técnico' }];

describe('gestión de permisos en la pantalla', () => {
  it('compara áreas y cargos como el backend', () => {
    expect(normalizar('  Jefe de   Área ')).toBe('jefe de area');
    expect(alcanza({ usuarioId: null, area: null, cargo: 'jefe de area' }, { area: 'Gerencia', cargo: 'JEFE DE ÁREA' })).toBe(true);
    expect(alcanza({ usuarioId: null, area: 'comercial', cargo: null }, personal[3])).toBe(true);
    expect(alcanza({ usuarioId: null, area: 'comercial', cargo: 'jefe de area' }, personal[3])).toBe(false);
    expect(alcanza({ usuarioId: 9 }, personal[2])).toBe(true);
    expect(alcanza({ usuarioId: null, area: null, cargo: null }, personal[3])).toBe(false);
  });

  it('busca por nombre, usuario, área o cargo, sin tildes, y filtra por área y permiso', () => {
    expect(filtrarPersonal(personal, { texto: 'calibracion' }).map(p => p.id)).toEqual([9]);
    expect(filtrarPersonal(personal, { texto: 'jefe comercial' }).map(p => p.id)).toEqual([2]);
    expect(filtrarPersonal(personal, { texto: 'rojas' }).map(p => p.id)).toEqual([3]);
    expect(filtrarPersonal(personal, { area: 'comercial' }).map(p => p.id)).toEqual([2, 3]);
    expect(filtrarPersonal(personal, { permiso: 'tiempos.soporte.ver' }).map(p => p.id)).toEqual([22, 2, 9]);
    expect(filtrarPersonal(personal, {})).toHaveLength(4);
  });

  it('dice de dónde viene cada permiso y quién lo pierde al revocar', () => {
    expect(origenDe(personal[0], 'tiempos.soporte.ver', concesiones)).toEqual({ sistemas: true, propia: null, grupos: [] });
    expect(origenDe(personal[2], 'tiempos.soporte.ver', concesiones)).toMatchObject({ sistemas: false, propia: { id: 3 }, grupos: [{ id: 1 }] });
    expect(origenDe(personal[3], 'tiempos.soporte.ver', concesiones)).toBeNull();
    // Bruno Paz lo conserva por su concesión propia; Sistemas, siempre.
    expect(pierdenAlRevocar(concesiones[0], personal).map(p => p.id)).toEqual([2]);
    expect(pierdenAlRevocar(concesiones[1], personal)).toEqual([]);
  });

  it('anticipa a quién alcanza una concesión nueva y cómo se llamará', () => {
    expect(ganarianAlConceder({ usuarioId: null, area: 'comercial', cargo: null }, 'tiempos.soporte.ver', personal).map(p => p.id)).toEqual([3]);
    expect(ganarianAlConceder({ usuarioId: 2 }, 'tiempos.soporte.ver', personal)).toEqual([]);
    const contexto = { personal, areas, cargos };
    expect(describirRegla({ usuarioId: null, area: null, cargo: 'jefe de area' }, contexto)).toBe('Jefes de área de todas las áreas');
    expect(describirRegla({ usuarioId: null, area: 'calibracion', cargo: 'tecnico' }, contexto)).toBe('Técnico de Calibración');
    expect(describirRegla({ usuarioId: null, area: 'comercial', cargo: null }, contexto)).toBe('Todo el personal de Comercial');
    expect(describirRegla({ usuarioId: null, area: null, cargo: 'tecnico' }, contexto)).toBe('Cargo «Técnico» en todas las áreas');
    expect(describirRegla({ usuarioId: 9 }, contexto)).toBe('Bruno Paz');
    expect(describirRegla({ usuarioId: null, area: null, cargo: null }, contexto)).toMatch(/Elige/);
  });

  it('muestra el nivel y las iniciales', () => {
    expect(nivelDe('3')).toBe('Sistemas');
    expect(nivelDe(2)).toBe('Nivel 2');
    expect(iniciales('Jhonatan Barrau')).toBe('JB');
    expect(iniciales('')).toBe('?');
  });
});
