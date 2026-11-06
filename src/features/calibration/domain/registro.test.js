import { describe, expect, it } from 'vitest';
import {
  aTexto, agruparPiezas, avisosParaEnvio, camposDeSeccion, columnasCambiadas, columnasDeSeccion, etiquetaColumna, opcionesDeColumna, sumaPiezas, textoNominal,
} from './registro';

describe('registro de calibración', () => {
  it('nombra cada columna de ServiceMET', () => {
    expect(etiquetaColumna('ind12')).toBe('Error, punto 12: indicación');
    expect(etiquetaColumna('retorno_lin3')).toBe('Error, punto 3: retorno');
    expect(etiquetaColumna('indicacion2_7')).toBe('Repetibilidad 2, lectura 7');
    expect(etiquetaColumna('indicacion4')).toBe('Excentricidad 4: indicación');
    expect(etiquetaColumna('cap_max2')).toBe('Rango 2: Max');
    expect(etiquetaColumna('hri_fin')).toBe('Humedad (fin)');
    expect(etiquetaColumna('equipo6')).toBe('Patrón 6');
    expect(etiquetaColumna('composicion3')).toBe('Error, punto 3: piezas de la carga');
    expect(etiquetaColumna('desconocida')).toBe('desconocida');
  });

  it('el ensayo de error muestra los puntos con datos y dos vacíos para agregar', () => {
    const campos = camposDeSeccion('errores', { lin1: 10, ind1: 10, lin2: 20, ind2: 20.1, lin13: 523 });
    expect(campos.tablas[0].filas.map(f => f.etiqueta)).toEqual(['Punto 1', 'Punto 2', 'Punto 13', 'Punto 14', 'Punto 15']);
    expect(camposDeSeccion('errores', {}).tablas[0].filas.map(f => f.etiqueta)).toEqual(['Punto 1', 'Punto 2']);
  });

  it('reúne las columnas de una sección, cabeceras de tabla incluidas', () => {
    const columnas = columnasDeSeccion(camposDeSeccion('repetibilidad'));
    expect(columnas).toContain('repetibilidad3');
    expect(columnas).toContain('indicacion1_10');
    expect(columnas).toHaveLength(3 + 3 * 20);
  });

  it('ofrece la lista de ServiceMET y conserva un valor que no est\u00e1 en ella', () => {
    expect(opcionesDeColumna('observaciones', 'x')).toBeNull();
    expect(opcionesDeColumna('regla_aceptacion', 'Simple').map(o => o.value)).toEqual(['', 'Ninguna', 'Simple', 'Conservadora']);
    const carga = opcionesDeColumna('metodo_carga', 'cargas_validadas:7');
    expect(carga.at(-1)).toEqual({ value: 'cargas_validadas:7', label: 'cargas_validadas:7 (como est\u00e1)' });
    expect(opcionesDeColumna('ajuste', null)).toHaveLength(3);
  });

  it('piezas para elegir la composición: por juego, de mayor a menor, y su suma', () => {
    const disponibles = [
      { clave: 'A|1|', juego: 'E2-005', nominal: 0.001, identificacion: '' },
      { clave: 'A|2|*', juego: 'E2-005', nominal: 0.002, identificacion: '*' },
      { clave: 'A|2|', juego: 'E2-005', nominal: 0.002, identificacion: '' },
      { clave: 'B|5|', juego: 'M1-02', nominal: 5, identificacion: '' },
    ];
    const grupos = agruparPiezas(disponibles);
    expect(grupos.map(g => g.juego)).toEqual(['E2-005', 'M1-02']);
    expect(grupos[0].piezas.map(p => p.clave)).toEqual(['A|2|', 'A|2|*', 'A|1|']);
    expect(sumaPiezas(disponibles, ['A|2|', 'A|1|', 'X'])).toBeCloseTo(0.003, 12);
    expect(textoNominal(0.1 + 0.2)).toBe('0,3');
  });

  it('detecta solo lo que cambió, con coma o punto decimal', () => {
    const efectivos = { ind1: 100.5, lin1: 100, personal: 'Usuario' };
    expect(aTexto(100.5)).toBe('100,5');
    expect(columnasCambiadas(efectivos, { ind1: '100,5', lin1: '100.0', personal: 'Usuario' })).toEqual({ lin1: '100.0' });
    expect(columnasCambiadas(efectivos, { ind1: '100,4', personal: '' })).toEqual({ ind1: '100,4', personal: null });
  });

  it('avisos antes de enviar: los de los datos y los del cálculo, sin repetir; las notas se cuentan', () => {
    const avisos = [
      { nivel: 'aviso', codigo: 'TECNICO_APROXIMADO', seccion: 'servicio', mensaje: 'a' },
      { nivel: 'error', codigo: 'SIN_REPETIBILIDAD', seccion: 'repetibilidad', mensaje: 'b' },
      { nivel: 'info', codigo: 'TEXTO_REPARADO', seccion: 'cliente', mensaje: 'c' },
    ];
    const calculo = { avisos: [
      { nivel: 'error', codigo: 'SIN_REPETIBILIDAD', mensaje: 'b2' },
      { nivel: 'aviso', codigo: 'LECTURA_LEJOS_DE_CARGA', mensaje: 'd' },
      { nivel: 'info', codigo: 'U_MAYOR_QUE_3D', mensaje: 'e' },
      { nivel: 'aviso', codigo: 'PESAS_SIN_VERIFICAR', mensaje: 'a' },
    ] };
    const { revisar, notas } = avisosParaEnvio(avisos, calculo);
    expect(revisar.map(a => [a.codigo, a.seccion])).toEqual([
      ['SIN_REPETIBILIDAD', 'repetibilidad'], ['TECNICO_APROXIMADO', 'servicio'], ['LECTURA_LEJOS_DE_CARGA', 'resultados'],
    ]);
    expect(notas).toBe(2);
    expect(avisosParaEnvio([], null)).toEqual({ revisar: [], notas: 0 });
  });
});
