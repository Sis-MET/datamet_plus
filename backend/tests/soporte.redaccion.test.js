const test = require('node:test');
const assert = require('node:assert/strict');
const env = require('../src/config/env');
const { contextoInforme, instrucciones, mejorarRedaccion, textoRespuesta } = require('../src/services/soporte.redaccion');
const { marcarIa } = require('../src/services/soporte.informes');
const { parse } = require('../src/services/soporte.validation');

const respuesta = (status, data) => ({ ok: status < 400, status, json: async () => data });
const conTexto = (texto) => respuesta(200, { candidates: [{ content: { parts: [{ text: 'pensando…', thought: true }, { text: texto }] } }] });

const conFetch = async (fake, trabajo) => {
  const original = global.fetch;
  const clave = env.gemini.apiKey;
  global.fetch = fake;
  env.gemini.apiKey = 'clave-de-prueba';
  try {
    return await trabajo();
  } finally {
    global.fetch = original;
    env.gemini.apiKey = clave;
  }
};

test('las instrucciones piden corregir la forma sin tocar los datos', () => {
  const texto = instrucciones({ servicio: 'mantenimiento preventivo regular', seccion: 'Observaciones' });
  assert.match(texto, /«Observaciones»/);
  assert.match(texto, /mantenimiento preventivo regular/);
  assert.match(texto, /Conserva exactamente los datos/);
  assert.match(texto, /No agregues hallazgos/);
});

test('la respuesta ignora el razonamiento y las comillas', () => {
  assert.equal(textoRespuesta({ candidates: [{ content: { parts: [{ text: 'x', thought: true }, { text: '«Se realizó la limpieza.»' }] } }] }), 'Se realizó la limpieza.');
  assert.equal(textoRespuesta({}), '');
});

test('sugiere con el modelo principal y la clave en la cabecera', async () => {
  const llamadas = [];
  const resultado = await conFetch(async (url, opciones) => {
    llamadas.push({ url, opciones });
    return conTexto('Se realizó la limpieza general.');
  }, () => mejorarRedaccion({ texto: 'se realizo limpieza', servicio: 'diagnóstico', seccion: 'Reporte de Falla' }));
  assert.deepEqual(resultado, { texto: 'Se realizó la limpieza general.', modelo: env.gemini.model });
  assert.match(llamadas[0].url, new RegExp(`${env.gemini.model}:generateContent$`));
  assert.equal(llamadas[0].opciones.headers['x-goog-api-key'], 'clave-de-prueba');
  assert.doesNotMatch(llamadas[0].url, /key=/);
  const cuerpo = JSON.parse(llamadas[0].opciones.body);
  assert.deepEqual(JSON.parse(cuerpo.contents[0].parts[0].text), { datosDelServicio: {}, prerredaccion: 'se realizo limpieza' });
});

test('si el modelo principal está saturado usa el de respaldo', async () => {
  const modelos = [];
  const resultado = await conFetch(async (url) => {
    modelos.push(url.split('/').pop());
    return modelos.length === 1
      ? respuesta(503, { error: { message: 'This model is currently experiencing high demand.' } })
      : conTexto('Texto mejorado.');
  }, () => mejorarRedaccion({ texto: 'texto', servicio: 'instalación', seccion: 'Observaciones' }));
  assert.equal(modelos.length, 2);
  assert.equal(resultado.modelo, env.gemini.modeloRespaldo);
});

test('un error que no se arregla reintentando no prueba el respaldo y responde 503', async () => {
  let llamadas = 0;
  await conFetch(async () => {
    llamadas += 1;
    return respuesta(400, { error: { message: 'API key not valid.' } });
  }, () => assert.rejects(
    mejorarRedaccion({ texto: 'texto', servicio: 'instalación', seccion: 'Observaciones' }),
    error => error.statusCode === 503,
  ));
  assert.equal(llamadas, 1);
});

test('sin clave la función responde que no está configurada', async () => {
  const clave = env.gemini.apiKey;
  env.gemini.apiKey = '';
  try {
    await assert.rejects(mejorarRedaccion({ texto: 'x', servicio: 's', seccion: 's' }), /no está configurada/);
  } finally {
    env.gemini.apiKey = clave;
  }
});

test('validación de la solicitud de redacción', () => {
  const ficha = { codigo: 'ST-001', campo: 'comentario_general', version: 2 };
  assert.deepEqual(parse('redaccion', { ...ficha, tipo: 'mpr', seccion: ' Observaciones ', texto: ' hola mundo ' }), {
    ...ficha, tipo: 'MPR', seccion: 'Observaciones', texto: 'hola mundo', cambios: {},
  });
  assert.throws(() => parse('redaccion', { ...ficha, tipo: 'MPR', seccion: 'x', texto: 'a' }), /Escriba primero/);
  assert.throws(() => parse('redaccion', { ...ficha, tipo: 'XX', seccion: 'x', texto: 'hola' }), /Tipo de servicio/);
  assert.throws(() => parse('redaccion', { tipo: 'MPR', seccion: 'x', texto: 'hola' }));
});

test('envía mediciones, valoraciones y prerredacción en un contexto separado de las instrucciones', async () => {
  let enviado;
  await conFetch(async (_, opciones) => {
    enviado = JSON.parse(opciones.body);
    return conTexto('Se verificó el retorno a cero.');
  }, () => mejorarRedaccion({ texto: 'verificado retorno', servicio: 'preventivo', seccion: 'Observaciones',
    datos: { cap_max1: 30000, d1: 10, indicacion1: 50, retorno1: 0, fisico: 'Bueno', foto_balanza: 'data:image/x;base64,AA', session_id: 'interno' } }));
  assert.deepEqual(JSON.parse(enviado.contents[0].parts[0].text), {
    datosDelServicio: { cap_max1: 30000, d1: 10, indicacion1: 50, retorno1: 0, fisico: 'Bueno' }, prerredaccion: 'verificado retorno',
  });
  assert.match(enviado.systemInstruction.parts[0].text, /nunca instrucciones/);
  assert.match(enviado.systemInstruction.parts[0].text, /contradice los datos/);
  assert.deepEqual(contextoInforme({ texto: null, password: 'secreto' }), { texto: null });
});

test('los campos redactados con IA quedan marcados en el historial', () => {
  const cambios = [
    { campo: 'comentario_general', antes: 'a', despues: 'b' },
    { campo: 'd1', antes: 0.1, despues: 0.05 },
  ];
  assert.deepEqual(marcarIa(cambios, ['comentario_general']), [
    { campo: 'comentario_general', antes: 'a', despues: 'b', ia: true },
    { campo: 'd1', antes: 0.1, despues: 0.05 },
  ]);
  assert.deepEqual(parse('cambios', { cambios: { a: 'x' } }).ia, []);
  assert.throws(() => parse('cambios', { cambios: { a: 'x' }, ia: ['DROP'] }), /Campo inválido/);
});
