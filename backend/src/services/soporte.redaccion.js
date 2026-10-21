/**
 * Mejora de redacción de los textos de un informe con Google Gemini.
 *
 * Solo reescribe la forma: el técnico propone el texto, Gemini devuelve una
 * sugerencia y el usuario decide si la usa. Nada se guarda aquí; al guardar
 * el informe, el campo queda en el historial marcado como redactado con IA.
 * A Gemini solo se envían el texto, el tipo de servicio y el nombre de la
 * sección (nunca el cliente ni otros datos del informe).
 */
const env = require('../config/env');
const { httpError } = require('./soporte.validation');

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELO = /^[a-z0-9][a-z0-9.-]{1,60}$/;
const TIEMPO_MAXIMO_MS = 20000;

const disponible = () => Boolean(env.gemini.apiKey);

/** Instrucciones fijas: corregir la forma sin tocar los datos. */
const instrucciones = ({ servicio, seccion }) => [
  'Eres redactor técnico de Métrica Ltda., empresa boliviana de mantenimiento y calibración de instrumentos de pesaje.',
  `Mejora la redacción del texto que escribió un técnico para la sección «${seccion}» de un informe de ${servicio}.`,
  'Reglas:',
  '- Corrige ortografía, tildes, puntuación, gramática y concordancia. Usa español formal y técnico, claro y conciso, en forma impersonal (se realizó, se observó, se recomienda).',
  '- Conserva exactamente los datos: cifras, unidades, códigos, nombres, marcas, modelos y valores.',
  '- No agregues hallazgos, causas, recomendaciones ni conclusiones que no estén en el texto, y no elimines información.',
  '- Usa la terminología de pesaje: celda de carga, excentricidad, repetibilidad, linealidad, retorno a cero, indicador, plataforma, receptor de carga.',
  '- Conserva los saltos de párrafo. Si el texto ya está bien escrito, devuélvelo igual.',
  '- Responde solo con el texto final, sin comillas, títulos, viñetas nuevas ni comentarios.',
].join('\n');

/** Texto de la respuesta de Gemini, sin las partes de razonamiento. */
const textoRespuesta = (data) => {
  const partes = data?.candidates?.[0]?.content?.parts || [];
  return partes.filter(parte => !parte.thought && typeof parte.text === 'string')
    .map(parte => parte.text)
    .join('')
    .replace(/^["«“]+|["»”]+$/g, '')
    .trim();
};

/** Saturado o no disponible: se prueba con el modelo de respaldo. */
const reintentable = (status, mensaje) => [429, 500, 503, 504].includes(status)
  || /no longer available|not found|high demand/i.test(mensaje || '');

const llamar = async (modelo, cuerpo) => {
  if (!MODELO.test(modelo)) throw httpError(503, 'El modelo de Gemini configurado no es válido.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIEMPO_MAXIMO_MS);
  try {
    const respuesta = await fetch(`${API}/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.gemini.apiKey },
      body: JSON.stringify(cuerpo),
      signal: controller.signal,
    });
    const data = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      const error = new Error(data?.error?.message || `Gemini respondió ${respuesta.status}.`);
      error.reintentable = reintentable(respuesta.status, data?.error?.message);
      throw error;
    }
    const texto = textoRespuesta(data);
    if (!texto) {
      const error = new Error('Gemini no devolvió texto.');
      error.reintentable = true;
      throw error;
    }
    return texto;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeout = new Error('Gemini tardó demasiado en responder.');
      timeout.reintentable = true;
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Sugerencia de redacción para un texto del informe.
 * Devuelve { texto, modelo }.
 */
const mejorarRedaccion = async ({ texto, servicio, seccion }) => {
  if (!disponible()) throw httpError(503, 'La mejora de redacción no está configurada en el servidor (falta GEMINI_API_KEY).');
  const cuerpo = {
    systemInstruction: { parts: [{ text: instrucciones({ servicio, seccion }) }] },
    contents: [{ role: 'user', parts: [{ text: texto }] }],
    generationConfig: { temperature: 0.2, thinkingConfig: { thinkingLevel: 'minimal' } },
  };
  const modelos = [...new Set([env.gemini.model, env.gemini.modeloRespaldo].filter(Boolean))];
  let ultimo;
  for (const modelo of modelos) {
    try {
      return { texto: await llamar(modelo, cuerpo), modelo };
    } catch (error) {
      ultimo = error;
      if (!error.reintentable) break;
    }
  }
  console.warn('Gemini no pudo mejorar la redacción:', ultimo?.message);
  throw httpError(503, 'No se pudo mejorar la redacción en este momento. Inténtelo de nuevo en unos segundos.');
};

module.exports = { disponible, instrucciones, mejorarRedaccion, textoRespuesta };
