import { describe, expect, it } from 'vitest';
import {
  conRuta, diferencias, escribirLista, escribirNumero, etiquetaRuta, leerLista, leerNumero, leerRuta, textoValor, tocaRuta, validar,
} from './metodo';

const contenido = () => ({
  parametros: {
    empuje: '5b',
    kD: 1,
    conveccion: { activa: true, clases: ['E1', 'E2', 'F1'], porEstabilizacion: [{ texto: 'MAYOR A 30 MINUTOS', deltaT: 3 }], deltaTSinDato: 7 },
    avisos: { excentricidadEnD: 2, lecturaVsCargaEnD: 4, uEnD: 3 },
    enUso: { k: 2, deltaT: 5, kT: null, factorKT: 1, fracciones: [0.01, 0.5, 1] },
    pesadaMinima: { exactitudes: [0.001, 0.01], factores: [1, 2] },
    densidades: [{ material: 'Acero inoxidable', claves: ['inox'], rho: 7950, u: 70 }],
  },
  textos: { metodo: 'Comparación con pesas patrón.', leyenda: ['Uno.'], pruebas: [], reglas: { SIMPLE: 'S', CONSERVADORA: 'C', NINGUNA: 'N' } },
});

describe('configuración del método', () => {
  it('nombra cada cambio con su fila', () => {
    expect(etiquetaRuta('parametros.kD')).toBe('Factor de deriva kD');
    expect(etiquetaRuta('parametros.densidades[2].rho')).toBe('Densidad: ρ · fila 3');
    expect(etiquetaRuta('parametros.densidades[0].claves[1]')).toBe('Densidad: palabra clave');
    expect(etiquetaRuta('parametros.enUso.fracciones[3]')).toBe('En uso: carga de la tabla');
    expect(etiquetaRuta('textos.reglas.SIMPLE')).toBe('Texto: regla simple');
    expect(etiquetaRuta('textos.leyenda[1]')).toBe('Texto: leyenda · fila 2');
  });

  it('muestra los valores como se leen', () => {
    expect(textoValor(1.5)).toBe('1,5');
    expect(textoValor(true)).toBe('Sí');
    expect(textoValor(null)).toBe('vacío');
    expect(textoValor(['E1', 'F1'])).toBe('E1; F1');
  });

  it('diferencias y si tocan una sección', () => {
    const antes = contenido();
    const despues = conRuta(antes, 'parametros.densidades[0].rho', 7960);
    expect(antes.parametros.densidades[0].rho).toBe(7950);
    const lista = diferencias(antes, despues);
    expect(lista).toEqual([{ ruta: 'parametros.densidades[0].rho', antes: 7950, despues: 7960 }]);
    expect(tocaRuta(lista, 'parametros.densidades')).toBe(true);
    expect(tocaRuta(lista, 'parametros.densidades[0]')).toBe(true);
    expect(tocaRuta(lista, 'parametros.kD')).toBe(false);
    expect(leerRuta(despues, 'parametros.densidades[0].rho')).toBe(7960);
  });

  it('lee números con coma y listas en porcentaje', () => {
    expect(leerNumero('1,5')).toBe(1.5);
    expect(leerNumero('')).toBeNull();
    expect(Number.isNaN(leerNumero('1,5 kg'))).toBe(true);
    expect(escribirNumero(0.1 + 0.2)).toBe('0,3');
    expect(leerLista('1; 5; 0,5', 0.01)).toEqual([0.01, 0.05, 0.005]);
    expect(leerLista('1; x', 0.01)).toBeNull();
    expect(escribirLista([0.01, 0.05, 0.5, 1], 0.01)).toBe('1; 5; 50; 100');
  });

  it('valida con los límites del backend', () => {
    expect(validar(contenido())).toEqual({});
    const mal = conRuta(conRuta(conRuta(contenido(), 'parametros.kD', 5), 'textos.metodo', '  '), 'parametros.enUso.fracciones', []);
    expect(validar(mal)).toEqual({
      'parametros.kD': 'Debe ser como máximo 3.',
      'textos.metodo': 'No puede quedar vacío.',
      'parametros.enUso.fracciones': 'Hace falta al menos un valor.',
    });
    expect(validar(conRuta(contenido(), 'parametros.enUso.fracciones', [0.5, 2]))).toEqual({ 'parametros.enUso.fracciones': 'Cada valor entre 0,1 y 100.' });
    expect(validar(conRuta(contenido(), 'parametros.densidades[0].claves', ['']))).toEqual({ 'parametros.densidades[0].claves[0]': 'No puede quedar vacío.' });
  });
});
