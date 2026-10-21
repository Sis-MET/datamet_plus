import { describe, expect, it } from 'vitest';
import { avisosEmision } from './avisos';
import { PLANTILLAS } from './plantillas';

/** Preventivo regular completo, para que cada prueba quite un dato. */
const completo = () => {
  const valores = {
    cliente: 'CBN', dir_planta: 'Av. 1', otst: '26-0015-41-S08', fecha_servicio: '2026-08-13', dep_planta: 'ORURO', planta: 'HUARI',
    tipo_equipo: 'BALANZA', ubicacion: 'ENVASADO', marca: 'LEXUS', cod_int: '7765', modelo: 'FOX', cod_metrica: '0015-41-001',
    serie: 'N/I', num_celdas: 1, cap_max1: 300, d1: 0.05, e1: 0.05, unidades: 'kg',
    comentario_general: 'La balanza funciona correctamente después del mantenimiento.',
    fecha_prox_servicio: '2027-08-13', recomendacion: 'Mnt Preventivo Regular',
    estado_fisico: 'Bueno', estado_operacional: 'Bueno', estado_metrologico: 'Bueno', personal: 'Brayan Benito M.',
  };
  for (const bloque of PLANTILLAS.MPR.bloques) {
    if (bloque.tipo === 'checklist') bloque.items.forEach(item => { valores[item.estado] = 'Bueno'; });
    if (bloque.tipo === 'pruebas') {
      const e = bloque.esquema;
      valores[e.exc.carga] = 100;
      valores[e.rep.carga] = 200;
      valores[e.retorno] = 'Bueno';
      valores[e.estabilidad] = 'Bueno';
      for (let i = 1; i <= 5; i += 1) valores[e.exc.indicacion(i)] = 100;
      for (let i = 1; i <= 3; i += 1) valores[e.rep.indicacion(i)] = 200;
      for (let i = 1; i <= 3; i += 1) {
        valores[e.lin.carga(i)] = i * 100;
        valores[e.lin.indicacion(i)] = i * 100;
      }
    }
  }
  return valores;
};

const textos = (valores, fotos = [{ id: 1 }], plantilla = PLANTILLAS.MPR) => avisosEmision({ plantilla, valores, fotos }).map(a => a.texto);

describe('avisos antes de emitir', () => {
  it('un informe completo no tiene avisos', () => {
    expect(avisosEmision({ plantilla: PLANTILLAS.MPR, valores: completo(), fotos: [{ id: 1 }] })).toEqual([]);
  });

  it('avisa de textos vacíos o de relleno y de la falta de fotos', () => {
    const valores = { ...completo(), comentario_general: 'comen' };
    expect(textos(valores, [])).toEqual([
      '«Observaciones y/o Recomendaciones» parece incompleto: «comen».',
      'El informe no tiene fotografías.',
    ]);
    expect(textos({ ...completo(), comentario_general: '' })).toEqual(['«Observaciones y/o Recomendaciones» está vacío.']);
    // La conclusión del técnico es opcional, pero no puede ser relleno.
    expect(textos({ ...completo(), conclusion: 'ok' })).toEqual(['«Conclusiones» parece incompleto: «ok».']);
  });

  it('avisa de pruebas sin carga, puntos incompletos y lecturas faltantes', () => {
    const valores = { ...completo(), carga_exc_inicial: null, lin_inicial_4: 400, retorno_cero_final_valoracion: '' };
    expect(textos(valores)).toEqual([
      'Falta la carga de excentricidad en «Pruebas Metrológicas Iniciales».',
      'Linealidad de «Pruebas Metrológicas Iniciales»: 1 punto tiene carga sin indicación o al revés.',
      'Falta el retorno a cero en «Pruebas Metrológicas Finales».',
    ]);
    const sinLecturas = completo();
    Object.keys(sinLecturas).filter(k => /_final(_\d+)?$/.test(k) && /^(indicacion|indicacion1|lin|ind)_/.test(k)).forEach(k => { sinLecturas[k] = null; });
    expect(textos(sinLecturas)).toContain('«Pruebas Metrológicas Finales» no tiene lecturas.');
  });

  it('avisa de la falta de d, de e en el preventivo avanzado y de estados', () => {
    expect(textos({ ...completo(), d1: null })).toContain('Falta la resolución (d): no se pueden calcular los decimales ni los resultados en divisiones.');
    expect(textos({ ...completo(), vibracion_estado: null, humedad_estado: '' })).toEqual(['2 parámetros sin estado en «Entorno de Trabajo».']);
    expect(textos({ ...completo(), estado_metrologico: null })).toEqual(['Falta el estado metrológico en «Conclusión».']);
    const avanzado = avisosEmision({ plantilla: PLANTILLAS.MPA, valores: { d1: 10, e1: null, cap_max1: 80000 }, fotos: [] });
    expect(avanzado.map(a => a.texto)).toContain('Falta la escala de verificación (e): los resultados se expresarán en d.');
    // Las pruebas del avanzado se avisan una sola vez, en su sección del formulario.
    const pruebas = avanzado.filter(a => a.texto.includes('no tiene lecturas'));
    expect(pruebas).toHaveLength(1);
    expect(pruebas[0].seccion).toBe('excentricidad');
  });

  // 26-0036-51-S01-004: carga de 10 g con una indicación de 99.997 g.
  it('avisa de lecturas que parecen mal transcritas', () => {
    const valores = { ...completo(), unidades: 'g', lin_inicial_2: 10, ind_inicial_2: 99.997, indicacion1_final_1: 250 };
    expect(textos(valores)).toEqual([
      'Linealidad de «Pruebas Metrológicas Iniciales»: con 10 g se registró 99.997 g. Revise si está bien transcrita.',
      'Repetibilidad de «Pruebas Metrológicas Finales»: 1 lectura se aparta más del 10 % de la carga. Revise si están bien transcritas.',
    ]);
  });

  it('avisa de fechas incoherentes', () => {
    expect(textos({ ...completo(), fecha_prox_servicio: '2026-08-13' })).toEqual(['La fecha del próximo servicio no es posterior a la del servicio.']);
    expect(textos({ ...completo(), fecha_prox_servicio: null })).toEqual(['Falta «Fecha próximo servicio sugerido».']);
  });
});
