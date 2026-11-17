import { describe, expect, it } from 'vitest';
import {
  ALTO, ANCHO, LISTA_DEPARTAMENTOS, SIN_DEPARTAMENTO, agruparPuntos, departamentoEnPunto, desproyectar, geometriaDepartamentos,
  nombreDepartamento, normalizarDepartamento, poligonosDepartamentos, proyectar, ubicarServicio,
} from './ubicacion';

const departamentoDe = (lat, lng) => {
  const punto = proyectar(lat, lng);
  return punto ? departamentoEnPunto(punto[0], punto[1]) : null;
};

describe('mapa de Bolivia', () => {
  it('tiene los nueve departamentos con su nombre', () => {
    expect(LISTA_DEPARTAMENTOS.map(d => d.nombre)).toEqual([
      'Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro', 'Pando', 'Potosí', 'Santa Cruz', 'Tarija',
    ]);
    expect(nombreDepartamento('POTOSI')).toBe('Potosí');
    expect(nombreDepartamento(SIN_DEPARTAMENTO)).toBe('Sin departamento');
  });

  it('ubica cada capital en su departamento y lo de fuera de Bolivia en ninguno', () => {
    expect(departamentoDe(-16.4955, -68.1336)).toBe('LA PAZ');
    expect(departamentoDe(-16.5047, -68.1633)).toBe('LA PAZ');
    expect(departamentoDe(-17.7833, -63.1821)).toBe('SANTA CRUZ');
    expect(departamentoDe(-17.3895, -66.1568)).toBe('COCHABAMBA');
    expect(departamentoDe(-19.5836, -65.7531)).toBe('POTOSI');
    expect(departamentoDe(-17.9647, -67.106)).toBe('ORURO');
    expect(departamentoDe(-21.5355, -64.7296)).toBe('TARIJA');
    expect(departamentoDe(-19.0196, -65.2619)).toBe('CHUQUISACA');
    expect(departamentoDe(-14.8333, -64.9)).toBe('BENI');
    expect(departamentoDe(-11.1, -67.55)).toBe('PANDO');
    expect(departamentoDe(-12.0464, -77.0428)).toBeNull();
  });

  it('proyectar y desproyectar son inversas; los contornos salen en latitud y longitud', () => {
    const [x, y] = proyectar(-16.5, -68.15);
    const [lat, lng] = desproyectar(x, y);
    expect(lat).toBeCloseTo(-16.5, 6);
    expect(lng).toBeCloseTo(-68.15, 6);
    const laPaz = poligonosDepartamentos().find(d => d.id === 'LA PAZ');
    const [primerLat, primerLng] = laPaz.anillos[0][0];
    expect(primerLat).toBeGreaterThan(-23);
    expect(primerLat).toBeLessThan(-9.5);
    expect(primerLng).toBeGreaterThan(-70);
    expect(primerLng).toBeLessThan(-57);
  });

  it('las coordenadas inválidas no se proyectan', () => {
    expect(proyectar(null, -68)).toBeNull();
    expect(proyectar(0, 0)).toBeNull();
    expect(proyectar(-95, -68)).toBeNull();
    const [x, y] = proyectar(-16.5, -68.15);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(ANCHO);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(ALTO);
  });

  it('el nombre de cada departamento cae dentro de él', () => {
    for (const departamento of geometriaDepartamentos()) {
      const [x, y] = departamento.etiqueta;
      expect(departamentoEnPunto(x, y)).toBe(departamento.id);
      expect(departamento.ruta.startsWith('M')).toBe(true);
    }
  });
});

describe('departamento escrito en la planta', () => {
  it('reconoce nombres con o sin tildes, dañados y abreviados', () => {
    expect(normalizarDepartamento('SANTA CRUZ')).toBe('SANTA CRUZ');
    expect(normalizarDepartamento('Potosí')).toBe('POTOSI');
    expect(normalizarDepartamento(`POTOS${String.fromCharCode(0xfffd)}`)).toBe('POTOSI');
    expect(normalizarDepartamento('scz')).toBe('SANTA CRUZ');
    expect(normalizarDepartamento('El Alto')).toBe('LA PAZ');
    expect(normalizarDepartamento('Dpto. de La Paz')).toBe('LA PAZ');
    expect(normalizarDepartamento('Sucre')).toBe('CHUQUISACA');
    expect(normalizarDepartamento('')).toBeNull();
    expect(normalizarDepartamento('Lima')).toBeNull();
  });
});

describe('servicios en el mapa', () => {
  it('la ubicación GPS manda; sin ella vale la planta', () => {
    const conGps = ubicarServicio({ codigo: 'A', departamentoPlanta: 'LA PAZ', ubicacion: { lat: -17.7833, lng: -63.1821 } });
    expect(conGps).toMatchObject({ departamento: 'SANTA CRUZ', origenUbicacion: 'gps' });
    expect(conGps.punto).toHaveLength(2);
    expect(ubicarServicio({ codigo: 'B', departamentoPlanta: 'ORURO', ubicacion: null }))
      .toMatchObject({ departamento: 'ORURO', origenUbicacion: 'planta', punto: null });
    // Ubicación fuera de Bolivia: no se dibuja y cuenta por la planta.
    expect(ubicarServicio({ codigo: 'C', departamentoPlanta: 'TARIJA', ubicacion: { lat: -12.05, lng: -77.04 } }))
      .toMatchObject({ departamento: 'TARIJA', origenUbicacion: 'planta', punto: null });
    expect(ubicarServicio({ codigo: 'D' })).toMatchObject({ departamento: SIN_DEPARTAMENTO, origenUbicacion: null });
  });

  it('junta los puntos cercanos con el grupo que más se repite', () => {
    const servicios = [
      { codigo: 1, grupo: 'MPR', punto: [100, 100] },
      { codigo: 2, grupo: 'RVD', punto: [102, 101] },
      { codigo: 3, grupo: 'RVD', punto: [101, 99] },
      { codigo: 4, grupo: 'MPR', punto: [400, 500] },
      { codigo: 5, grupo: 'MPR', punto: null },
    ];
    const grupos = agruparPuntos(servicios, 12);
    expect(grupos).toHaveLength(2);
    expect(grupos[0]).toMatchObject({ grupo: 'RVD' });
    expect(grupos[0].servicios).toHaveLength(3);
    expect(grupos[0].x).toBeCloseTo(101);
  });
});
