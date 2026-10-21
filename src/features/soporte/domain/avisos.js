/**
 * Revisión antes de emitir: lo que falta o parece incompleto en el informe.
 * No impide emitir; cada aviso dice dónde corregirlo (`seccion` es el id de
 * la sección del formulario, o 'fotos').
 */
import { aNumero, rangosInstrumento } from './calculos';

const vacio = (valor) => valor === null || valor === undefined || String(valor).trim() === '';
const sinDosPuntos = (texto) => String(texto || '').replace(/:$/, '');

/** Un texto de menos de 15 caracteres suele ser relleno («comen», «reporte»). */
const TEXTO_MINIMO = 15;

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Una lectura que se aparta más del 10 % de su carga suele ser un error de
 * transcripción (por ejemplo, 99.997 g con una carga de 10 g).
 */
const DESVIO_SOSPECHOSO = 0.1;
const sospechosa = (carga, lectura) => {
  const c = aNumero(carga);
  const l = aNumero(lectura);
  return c !== null && l !== null && c > 0 && Math.abs(l - c) > c * DESVIO_SOSPECHOSO;
};

function avisosTexto(bloque, valores, agregar) {
  const titulo = sinDosPuntos(bloque.titulo);
  const valor = valores[bloque.campo];
  if (vacio(valor)) {
    if (!bloque.opcional) agregar(bloque.id, `«${titulo}» está vacío.`);
    return;
  }
  const texto = String(valor).trim();
  if (texto.length < TEXTO_MINIMO) agregar(bloque.id, `«${titulo}» parece incompleto: «${texto}».`);
}

function avisosPruebas(bloque, esquema, valores, agregar) {
  const titulo = sinDosPuntos(bloque.editor?.titulo || bloque.titulo);
  const lecturas = (fn, max) => Array.from({ length: max }, (_, i) => valores[fn(i + 1)]).filter(v => !vacio(v));
  const exc = lecturas(esquema.exc.indicacion, esquema.exc.max);
  const rep = lecturas(esquema.rep.indicacion, esquema.rep.max);
  const lin = Array.from({ length: esquema.lin.max }, (_, i) => ({
    carga: valores[esquema.lin.carga(i + 1)],
    indicacion: valores[esquema.lin.indicacion(i + 1)],
  }));
  const linCompletos = lin.filter(p => !vacio(p.carga) && !vacio(p.indicacion));
  const linIncompletos = lin.filter(p => vacio(p.carga) !== vacio(p.indicacion));

  if (exc.length + rep.length + linCompletos.length === 0) {
    agregar(bloque.id, `«${titulo}» no tiene lecturas.`);
    return;
  }
  if (exc.length > 0 && vacio(valores[esquema.exc.carga])) agregar(bloque.id, `Falta la carga de excentricidad en «${titulo}».`);
  if (rep.length > 0 && vacio(valores[esquema.rep.carga])) agregar(bloque.id, `Falta la carga de repetibilidad en «${titulo}».`);
  if (linIncompletos.length > 0) {
    agregar(bloque.id, `Linealidad de «${titulo}»: ${plural(linIncompletos.length, 'punto tiene', 'puntos tienen')} carga sin indicación o al revés.`);
  }
  const noNumericos = [...exc, ...rep, ...linCompletos.flatMap(p => [p.carga, p.indicacion])].filter(v => aNumero(v) === null);
  if (noNumericos.length > 0) agregar(bloque.id, `«${titulo}» tiene ${plural(noNumericos.length, 'lectura que no es un número', 'lecturas que no son números')}.`);
  const unidad = String(valores.unidades ?? '').trim();
  const conUnidad = (valor) => `${valor}${unidad ? ` ${unidad}` : ''}`;
  for (const p of linCompletos.filter(punto => sospechosa(punto.carga, punto.indicacion))) {
    agregar(bloque.id, `Linealidad de «${titulo}»: con ${conUnidad(p.carga)} se registró ${conUnidad(p.indicacion)}. Revise si está bien transcrita.`);
  }
  const fueraExc = exc.filter(lectura => sospechosa(valores[esquema.exc.carga], lectura)).length;
  if (fueraExc > 0) agregar(bloque.id, `Excentricidad de «${titulo}»: ${plural(fueraExc, 'lectura se aparta', 'lecturas se apartan')} más del 10 % de la carga. Revise si están bien transcritas.`);
  const fueraRep = rep.filter(lectura => sospechosa(valores[esquema.rep.carga], lectura)).length;
  if (fueraRep > 0) agregar(bloque.id, `Repetibilidad de «${titulo}»: ${plural(fueraRep, 'lectura se aparta', 'lecturas se apartan')} más del 10 % de la carga. Revise si están bien transcritas.`);
  if (vacio(valores[esquema.retorno])) agregar(bloque.id, `Falta el retorno a cero en «${titulo}».`);
  if (vacio(valores[esquema.estabilidad])) agregar(bloque.id, `Falta la estabilidad en «${titulo}».`);
}

/**
 * Avisos del informe antes de emitirlo.
 * Devuelve [{ id, seccion, texto }] en el orden del informe.
 */
export function avisosEmision({ plantilla, valores, fotos = [] }) {
  const avisos = [];
  const agregar = (seccion, texto) => avisos.push({ id: `${seccion}:${avisos.length}`, seccion, texto });
  const esquemasVistos = new Set();

  for (const bloque of plantilla.bloques) {
    switch (bloque.tipo) {
      case 'datos': {
        const faltan = bloque.filas.flat().filter(c => !c.soloLectura && vacio(valores[c.campo])).map(c => sinDosPuntos(c.label));
        if (faltan.length > 0) agregar(bloque.id, `Faltan datos en «${sinDosPuntos(bloque.titulo)}»: ${faltan.join(', ')}.`);
        break;
      }
      case 'rangos': {
        if (rangosInstrumento(valores).length === 0) {
          agregar(bloque.id, 'Falta la resolución (d): no se pueden calcular los decimales ni los resultados en divisiones.');
        }
        const usaE = plantilla.bloques.some(b => b.division === 'e');
        const e1 = aNumero(valores.e1);
        if (usaE && (e1 === null || e1 <= 0)) {
          agregar(bloque.id, 'Falta la escala de verificación (e): los resultados se expresarán en d.');
        }
        if (vacio(valores.unidades)) agregar(bloque.id, 'Faltan las unidades del instrumento.');
        break;
      }
      case 'texto':
        avisosTexto(bloque, valores, agregar);
        break;
      case 'pruebas':
      case 'excentricidadAvanzado':
      case 'repetibilidadAvanzado':
      case 'linealidadAvanzado': {
        if (esquemasVistos.has(bloque.esquema)) break;
        esquemasVistos.add(bloque.esquema);
        // Las pruebas del preventivo avanzado se editan en una sola sección.
        const seccion = plantilla.bloques.find(b => b.esquema === bloque.esquema && b.editor !== null);
        avisosPruebas(seccion || bloque, bloque.esquema, valores, agregar);
        break;
      }
      case 'checklist': {
        const sinEstado = bloque.items.filter(item => vacio(valores[item.estado])).length;
        if (sinEstado > 0) agregar(bloque.id, `${plural(sinEstado, 'parámetro', 'parámetros')} sin estado en «${sinDosPuntos(bloque.titulo)}».`);
        break;
      }
      case 'checklist3': {
        const sinEstado = bloque.columnas.flat().filter(c => vacio(valores[c.campo])).length;
        if (sinEstado > 0) agregar(bloque.id, `${plural(sinEstado, 'parámetro', 'parámetros')} sin estado en «${sinDosPuntos(bloque.titulo)}».`);
        break;
      }
      case 'adicionales': {
        for (const definicion of bloque.campos) {
          if (definicion.unidad) continue;
          if (vacio(valores[definicion.campo])) agregar(bloque.id, `Falta «${sinDosPuntos(definicion.label)}».`);
        }
        const proxima = valores.fecha_prox_servicio;
        if (bloque.campos.some(c => c.campo === 'fecha_prox_servicio') && !vacio(proxima) && !vacio(valores.fecha_servicio)
          && String(proxima) <= String(valores.fecha_servicio)) {
          agregar(bloque.id, 'La fecha del próximo servicio no es posterior a la del servicio.');
        }
        break;
      }
      case 'conclusion': {
        const faltan = bloque.campos.filter(c => vacio(valores[c.campo])).map(c => sinDosPuntos(c.label).toLowerCase());
        if (faltan.length > 0) agregar(bloque.id, `Falta el estado ${faltan.join(', ')} en «${sinDosPuntos(bloque.titulo)}».`);
        break;
      }
      case 'tecnico':
        if (vacio(valores[bloque.campo])) agregar(bloque.id, 'Falta el técnico responsable.');
        break;
      default:
        break;
    }
  }

  if (fotos.length === 0) agregar('fotos', 'El informe no tiene fotografías.');
  return avisos;
}
