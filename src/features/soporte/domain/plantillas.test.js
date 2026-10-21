import { describe, expect, it } from 'vitest';
import columnas from './columnas.fixture.json';
import { PLANTILLAS, TIPOS_SERVICIO, etiquetasCampos, filasVisibles, seccionesEditor } from './plantillas';
import { claseValoracion } from './valoraciones';

// Columnas reales de DATA_SERVICIOS_DATOS_* (octubre 2026). Si ServiceMET
// agrega o renombra columnas, actualizar columnas.fixture.json.
const COLUMNAS = Object.fromEntries(Object.entries(columnas).map(([tipo, lista]) => [tipo, new Set(lista)]));

/** Campos que una plantilla imprime sin que existan en su tabla (se ven como «-»). */
const AUSENTES_PERMITIDOS = {
  // Las pruebas admiten hasta 12 puntos; cada tabla trae los que trae.
  pruebas: /^(posicion|indicacion|indicacion1|lin|ind|excentricidad_\w+_pos|repetibilidad_\w+_prueba|linealidad_\w+_punto)/,
};

const camposDeBloque = (bloque) => {
  switch (bloque.tipo) {
    case 'datos': return bloque.filas.flat().map(c => c.campo);
    case 'texto':
    case 'tecnico': return [bloque.campo];
    case 'checklist': return bloque.items.flatMap(item => [item.estado, item.ajuste]);
    case 'checklist3': return bloque.columnas.flat().map(c => c.campo);
    case 'adicionales': return bloque.campos.map(c => c.campo);
    case 'conclusion': return [...bloque.campos, ...(bloque.extras || [])].map(c => c.campo);
    case 'pruebas':
    case 'excentricidadAvanzado':
    case 'repetibilidadAvanzado':
    case 'linealidadAvanzado':
    case 'retornoEstabilidad': {
      const e = bloque.esquema;
      const lista = [e.exc.carga, e.rep.carga, e.retorno, e.estabilidad, e.plataforma?.tipo, e.plataforma?.puntos].filter(Boolean);
      for (let i = 1; i <= e.exc.filas; i += 1) lista.push(e.exc.indicacion(i));
      for (let i = 1; i <= e.rep.filas; i += 1) lista.push(e.rep.indicacion(i));
      for (let i = 1; i <= e.lin.filas; i += 1) lista.push(e.lin.carga(i), e.lin.indicacion(i));
      return lista;
    }
    case 'rangos': return ['cap_max1', 'd1', 'e1', 'unidades'];
    default: return [];
  }
};

describe('plantillas', () => {
  it('hay una plantilla por cada uno de los 8 servicios', () => {
    expect(Object.keys(PLANTILLAS).sort()).toEqual(TIPOS_SERVICIO.map(t => t.value).sort());
    for (const plantilla of Object.values(PLANTILLAS)) {
      expect(plantilla.titulo).toBeTruthy();
      expect(plantilla.prefijo).toMatch(/^[A-Z]{4}$/);
    }
  });

  it.each(Object.keys(PLANTILLAS))('%s solo usa columnas que existen en su tabla', (tipo) => {
    const faltan = [];
    for (const bloque of PLANTILLAS[tipo].bloques) {
      for (const nombre of camposDeBloque(bloque)) {
        if (COLUMNAS[tipo].has(nombre)) continue;
        if (bloque.tipo === 'pruebas' && AUSENTES_PERMITIDOS.pruebas.test(nombre)) continue;
        faltan.push(`${bloque.id}: ${nombre}`);
      }
    }
    expect(faltan).toEqual([]);
  });

  it('cada sección del formulario tiene campos y nombres para el historial', () => {
    for (const plantilla of Object.values(PLANTILLAS)) {
      const secciones = seccionesEditor(plantilla);
      expect(secciones.length).toBeGreaterThan(3);
      for (const seccion of secciones) expect(seccion.campos.length).toBeGreaterThan(0);
    }
    const etiquetas = etiquetasCampos(PLANTILLAS.MPR);
    expect(etiquetas.get('comentario_general')).toBe('Observaciones y/o Recomendaciones');
    expect(etiquetas.get('vibracion_estado')).toBe('Vibración · estado');
    expect(etiquetas.get('ind_inicial_3')).toBe('Pruebas Metrológicas Iniciales · linealidad, indicación 3');
  });

  it('las pruebas del preventivo avanzado se editan en una sola sección', () => {
    const pruebas = seccionesEditor(PLANTILLAS.MPA).filter(s => s.tipo === 'pruebas');
    expect(pruebas).toHaveLength(1);
    expect(pruebas[0].division).toBe('e');
  });

  it('muestra las filas de la plantilla y las que traen datos', () => {
    const exc = PLANTILLAS.MPR.bloques.find(b => b.id === 'pruebas-inicial').esquema.exc;
    const presentes = COLUMNAS.MPR;
    expect(filasVisibles(exc, {}, presentes)).toBe(5);
    expect(filasVisibles(exc, { indicacion_inicial_6: 100 }, presentes)).toBe(6);
    // MPR_STIL tiene 6 posiciones: no se ofrece una séptima.
    expect(filasVisibles(exc, { indicacion_inicial_7: 100 }, presentes)).toBe(5);
  });
});

describe('valoraciones', () => {
  it('reconoce los estados nuevos y los anteriores de ServiceMET', () => {
    expect(claseValoracion('Bueno')).toBe('bueno');
    expect(claseValoracion('1 Bueno')).toBe('bueno');
    expect(claseValoracion('Sí')).toBe('bueno');
    expect(claseValoracion('Regular')).toBe('regular');
    expect(claseValoracion('2 Aceptable')).toBe('regular');
    expect(claseValoracion('Se intentó')).toBe('regular');
    expect(claseValoracion('3 MALO')).toBe('malo');
    expect(claseValoracion('No')).toBe('malo');
    expect(claseValoracion('4 No aplica')).toBe('noaplica');
    expect(claseValoracion('No aplica')).toBe('noaplica');
    expect(claseValoracion('Se ajusta')).toBeNull();
    expect(claseValoracion('Polvoso')).toBeNull();
    expect(claseValoracion(1)).toBeNull();
    expect(claseValoracion(null)).toBeNull();
  });
});
