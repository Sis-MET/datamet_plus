import { afterEach, describe, expect, it, vi } from 'vitest';
import { leerRuta, navegar, rutaDe } from './ruta';

describe('leerRuta', () => {
  it('separa el apartado del resto de la dirección', () => {
    expect(leerRuta('/soporte/proximos')).toEqual({ vista: 'soporte', resto: ['proximos'] });
    expect(leerRuta('/cronograma')).toEqual({ vista: 'calendar', resto: [] });
    expect(leerRuta('/calibracion/equipos/')).toEqual({ vista: 'calibration', resto: ['equipos'] });
  });

  it('reconoce los apartados de dos partes', () => {
    expect(leerRuta('/sistema/fallas')).toEqual({ vista: 'failures', resto: [] });
    expect(leerRuta('/sistema/cambios')).toEqual({ vista: 'changes', resto: [] });
  });

  it('decodifica el código de un informe', () => {
    expect(leerRuta('/soporte/informes/MPR/ST%2F001%20A')).toEqual({ vista: 'soporte', resto: ['informes', 'MPR', 'ST/001 A'] });
  });

  it('la raíz y las direcciones desconocidas no tienen apartado', () => {
    expect(leerRuta('/').vista).toBeNull();
    expect(leerRuta('/sistema').vista).toBeNull();
    expect(leerRuta('/otra/cosa').vista).toBeNull();
  });
});

describe('rutaDe', () => {
  it('arma la dirección con sus partes codificadas', () => {
    expect(rutaDe('soporte', 'informes', 'MPR', 'ST/001 A')).toBe('/soporte/informes/MPR/ST%2F001%20A');
    expect(rutaDe('failures')).toBe('/sistema/fallas');
  });

  it('omite las partes vacías y vuelve a RIM si el apartado no existe', () => {
    expect(rutaDe('calibration', null, '', undefined)).toBe('/calibracion');
    expect(rutaDe('inexistente')).toBe('/rim');
  });

  it('ida y vuelta: lo que arma rutaDe lo lee leerRuta', () => {
    const ruta = rutaDe('soporte', 'proximos', 'INT', '26-0538-31-S01-INT-0538-31-009');
    expect(leerRuta(ruta)).toEqual({ vista: 'soporte', resto: ['proximos', 'INT', '26-0538-31-S01-INT-0538-31-009'] });
  });
});

describe('navegar', () => {
  afterEach(() => vi.unstubAllGlobals());

  const ventana = (pathname) => {
    const historial = [];
    const win = {
      location: { pathname },
      history: {
        state: null,
        pushState: (_estado, _titulo, ruta) => { historial.push(['push', ruta]); win.location.pathname = ruta; },
        replaceState: (_estado, _titulo, ruta) => { historial.push(['replace', ruta]); win.location.pathname = ruta; },
      },
      dispatchEvent: vi.fn(),
    };
    vi.stubGlobal('window', win);
    vi.stubGlobal('Event', class { constructor(type) { this.type = type; } });
    return { win, historial };
  };

  it('suma un paso al historial o corrige el actual', () => {
    const { win, historial } = ventana('/rim');
    navegar('/cronograma');
    navegar('/cronograma/hoy', { reemplazar: true });
    expect(historial).toEqual([['push', '/cronograma'], ['replace', '/cronograma/hoy']]);
    expect(win.dispatchEvent).toHaveBeenCalledTimes(2);
  });

  it('no repite la dirección en la que ya se está, pero corre alCambiar', () => {
    const { historial } = ventana('/rim/registros');
    const alCambiar = vi.fn();
    navegar('/rim/registros', { alCambiar });
    expect(historial).toEqual([]);
    expect(alCambiar).toHaveBeenCalledOnce();
  });
});
