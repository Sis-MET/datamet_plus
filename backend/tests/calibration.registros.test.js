const test = require('node:test');
const assert = require('node:assert/strict');
const {
  esEditable, huellaDe, permisosDe, planClase, planComposiciones, planCorrecciones, textoComposicion,
} = require('../src/services/calibration.registros');
const { parse } = require('../src/services/calibration.validation');

const columnas = new Map([
  ['ind3', { tipo: 'decimal', max: null }],
  ['lin3', { tipo: 'decimal', max: null }],
  ['carga', { tipo: 'decimal', max: null }],
  ['personal', { tipo: 'texto', max: 50 }],
  ['n_reca', { tipo: 'texto', max: 50 }],
  ['hora_fin', { tipo: 'hora', max: null }],
  ['seca', { tipo: 'texto', max: 15 }],
  ['codigo_registro', { tipo: 'texto', max: 100 }],
  ['vibracion_foto', { tipo: 'texto', max: 300 }],
]);
const fuente = { ind3: 100.5, lin3: 100, carga: 2, personal: 'Usuario sin datos', n_reca: '5a', hora_fin: '12:40', seca: '0103-31-C05-26' };

test('qué columnas se corrigen: datos de medición sí; identidad, cliente y fotos no', () => {
  assert.equal(esEditable('ind3', columnas.get('ind3')), true);
  assert.equal(esEditable('hora_fin', columnas.get('hora_fin')), true); // en calibración es la hora de las condiciones finales
  assert.equal(esEditable('n_reca', columnas.get('n_reca')), true);
  assert.equal(esEditable('seca', columnas.get('seca')), false);
  assert.equal(esEditable('codigo_registro', columnas.get('codigo_registro')), false);
  assert.equal(esEditable('vibracion_foto', columnas.get('vibracion_foto')), false);
  assert.equal(esEditable('inexistente', undefined), false);
});

test('correcciones por columna: antes → después y vuelta al valor de ServiceMET', () => {
  const primera = planCorrecciones({ fuente, columnas, actuales: {}, entrantes: { ind3: '100,4', carga: 2.5, personal: 'Ing. Jorge Ortuño R.', n_reca: '5' } });
  assert.deepEqual(primera.columnas, { carga: 2.5, ind3: 100.4, n_reca: '5', personal: 'Ing. Jorge Ortuño R.' });
  assert.deepEqual(primera.cambios.find(c => c.campo === 'ind3'), { campo: 'ind3', antes: 100.5, despues: 100.4 });
  // Volver al valor original quita la corrección y deja el cambio en el historial.
  const segunda = planCorrecciones({ fuente, columnas, actuales: primera.columnas, entrantes: { ind3: 100.5, carga: 2.5 } });
  assert.deepEqual(segunda.columnas, { carga: 2.5, n_reca: '5', personal: 'Ing. Jorge Ortuño R.' });
  assert.deepEqual(segunda.cambios, [{ campo: 'ind3', antes: 100.4, despues: 100.5 }]);
  assert.throws(() => planCorrecciones({ fuente, columnas, actuales: {}, entrantes: { seca: 'X' } }), /no se puede corregir/);
  assert.throws(() => planCorrecciones({ fuente, columnas, actuales: {}, entrantes: { ind3: 'abc' } }), /número/);
  assert.throws(() => planCorrecciones({ fuente, columnas, actuales: {}, entrantes: { hora_fin: '25:00' } }), /hora/);
});

test('clase del instrumento con su origen', () => {
  assert.deepEqual(planClase(null, { valor: 'III', origen: 'PLACA' }), {
    clase: { valor: 'III', origen: 'PLACA' },
    cambio: { campo: 'clase', antes: null, despues: 'III (Placa)' },
  });
  assert.equal(planClase({ valor: 'III', origen: 'PLACA' }, { valor: 'III', origen: 'PLACA' }).cambio, null);
  assert.equal(planClase({ valor: 'III', origen: 'PLACA' }, undefined).cambio, null);
  assert.equal(planClase({ valor: 'III', origen: 'PLACA' }, null).clase, null);
  assert.throws(() => planClase(null, { valor: 'III', origen: null }), /de dónde sale/);
});

test('permisos: elabora el personal del área; revisa el jefe y nunca quien lo envió', () => {
  const tecnico = { usuario: 'Ortuño', jefe: false, editor: true };
  const jefe = { usuario: 'Vallejos', jefe: true, editor: true };
  assert.deepEqual(permisosDe(tecnico, null), {
    editar: true, enviar: true, retirar: false, revisar: false, reabrir: false,
    autorizar: false, anularAutorizacion: false, subirFirmado: false, abrirRevision: false, motivoRevisar: null,
  });
  const enRevision = { estado: 'EN_REVISION', enviado_por: 'Ortuño' };
  assert.equal(permisosDe(tecnico, enRevision).editar, false);
  assert.equal(permisosDe(tecnico, enRevision).retirar, true);
  assert.equal(permisosDe(tecnico, enRevision).revisar, false);
  assert.equal(permisosDe(jefe, enRevision).revisar, true);
  // Si lo envió el jefe, no puede revisarlo él mismo.
  const propio = permisosDe(jefe, { estado: 'EN_REVISION', enviado_por: 'vallejos' });
  assert.equal(propio.revisar, false);
  assert.match(propio.motivoRevisar, /otra persona/);
  assert.equal(permisosDe(jefe, { estado: 'APROBADO' }).reabrir, true);
  // Certificado (fase 5): autoriza, sube el firmado y abre revisiones el jefe.
  assert.equal(permisosDe(jefe, { estado: 'APROBADO' }).autorizar, true);
  assert.equal(permisosDe(tecnico, { estado: 'APROBADO' }).autorizar, false);
  assert.equal(permisosDe(jefe, { estado: 'AUTORIZADO' }).subirFirmado, true);
  assert.equal(permisosDe(jefe, { estado: 'AUTORIZADO' }).anularAutorizacion, true);
  assert.equal(permisosDe(jefe, { estado: 'EMITIDO' }).abrirRevision, true);
  assert.equal(permisosDe(jefe, { estado: 'EMITIDO' }).editar, false);
  assert.equal(permisosDe(tecnico, { estado: 'APROBADO' }).reabrir, false);
  assert.equal(permisosDe(tecnico, { estado: 'OBSERVADO' }).editar, true);
  assert.equal(permisosDe({ usuario: 'X', jefe: false, editor: false }, null).editar, false);
});

test('huella: cambia si cambia la fila de ServiceMET o una corrección, no por el orden', () => {
  const base = huellaDe({ fuente: { a: 1, b: 2 }, datos: { columnas: { ind3: 1 }, clase: null } });
  assert.equal(base, huellaDe({ fuente: { b: 2, a: 1 }, datos: { clase: null, columnas: { ind3: 1 } } }));
  assert.notEqual(base, huellaDe({ fuente: { a: 1, b: 3 }, datos: { columnas: { ind3: 1 }, clase: null } }));
  assert.notEqual(base, huellaDe({ fuente: { a: 1, b: 2 }, datos: { columnas: { ind3: 2 }, clase: null } }));
});

test('validación de lo que llega al guardar y al revisar', () => {
  assert.deepEqual(parse('registroGuardar', { columnas: { ind3: 1.2 } }), { version: null, columnas: { ind3: 1.2 }, motivo: null });
  assert.equal(parse('registroGuardar', { clase: { valor: 'II', origen: 'CLIENTE' } }).clase.valor, 'II');
  assert.throws(() => parse('registroGuardar', { clase: { valor: 'V', origen: 'PLACA' } }));
  assert.throws(() => parse('registroRevision', { decision: 'OBSERVAR' }), /observación/);
  assert.equal(parse('registroRevision', { decision: 'APROBAR' }).decision, 'APROBAR');
  assert.throws(() => parse('registroReapertura', {}), /reabre/);
});

test('composición elegida a mano: legible en el historial y vuelta a la regla', () => {
  const claves = ['E2-005|2000000|', 'E2-005|1000000|*', 'M1-02|500000|'];
  assert.equal(textoComposicion(claves, 'kg'), 'E2-005: 2 + 1* · M1-02: 0,5 kg');
  const primera = planComposiciones({}, { 3: claves }, 'kg');
  assert.deepEqual(primera.composiciones, { 3: claves });
  assert.deepEqual(primera.cambios, [{ campo: 'composicion3', antes: 'Regla automática', despues: 'E2-005: 2 + 1* · M1-02: 0,5 kg' }]);
  // La misma composición no es un cambio; null vuelve a la regla.
  assert.equal(planComposiciones(primera.composiciones, { 3: [...claves] }, 'kg').cambios.length, 0);
  const vuelta = planComposiciones(primera.composiciones, { 3: null }, 'kg');
  assert.deepEqual(vuelta.composiciones, {});
  assert.equal(vuelta.cambios[0].despues, 'Regla automática');
  assert.deepEqual(planComposiciones(primera.composiciones, undefined, 'kg').composiciones, { 3: claves });
  assert.throws(() => planComposiciones({}, { 61: claves }, 'kg'), /no existe/);
  assert.throws(() => planComposiciones({}, { 2: [claves[0], claves[0]] }, 'kg'), /repite/);
  assert.equal(parse('registroGuardar', { composiciones: { 3: claves, 4: null } }).composiciones[4], null);
  assert.throws(() => parse('registroGuardar', { composiciones: { x: claves } }));
});

test('tolerancias del cliente por rango: se ordenan, se validan y dejan su cambio para el historial', () => {
  const { planTolerancias } = require('../src/services/calibration.registros');
  const r = planTolerancias([], [{ hasta: 600, tolerancia: 0.2 }, { hasta: 300, tolerancia: 0.1 }], 'g');
  assert.deepEqual(r.tolerancias, [{ hasta: 300, tolerancia: 0.1 }, { hasta: 600, tolerancia: 0.2 }]);
  assert.deepEqual(r.cambio, { campo: 'tolerancias', antes: null, despues: 'hasta 300 g: ± 0,1 g; hasta 600 g: ± 0,2 g' });
  assert.equal(planTolerancias(r.tolerancias, undefined, 'g').cambio, null);
  assert.equal(planTolerancias(r.tolerancias, [{ hasta: 300, tolerancia: 0.1 }, { hasta: 600, tolerancia: 0.2 }], 'g').cambio, null);
  // Quitarlas.
  assert.deepEqual(planTolerancias(r.tolerancias, null, 'g').tolerancias, []);
  // Solo el último puede quedar «en adelante»; sin repetir límites; tolerancia > 0.
  assert.deepEqual(planTolerancias([], [{ hasta: null, tolerancia: 1 }, { hasta: 100, tolerancia: 0.5 }], 'kg').tolerancias,
    [{ hasta: 100, tolerancia: 0.5 }, { hasta: null, tolerancia: 1 }]);
  assert.throws(() => planTolerancias([], [{ hasta: null, tolerancia: 1 }, { hasta: null, tolerancia: 2 }], 'kg'), /último rango/);
  assert.throws(() => planTolerancias([], [{ hasta: 10, tolerancia: 1 }, { hasta: 10, tolerancia: 2 }], 'kg'), /mismo límite/);
  assert.throws(() => planTolerancias([], [{ hasta: 10, tolerancia: 0 }], 'kg'), /mayor que cero/);
  // Lab Delta: 1 d en todo el rango.
  const enD = planTolerancias([], [{ hasta: null, tolerancia: 1, en: 'D' }], 'kg');
  assert.deepEqual(enD.tolerancias, [{ hasta: null, tolerancia: 1, en: 'D' }]);
  assert.equal(enD.cambio.despues, 'en adelante: ± 1 d');
  // Pasar de d a kg es un cambio, aunque el número sea el mismo.
  assert.equal(planTolerancias(enD.tolerancias, [{ hasta: null, tolerancia: 1 }], 'kg').cambio.despues, 'en adelante: ± 1 kg');
});

test('con emp NB 23001 pedido, la clase tiene que estar en el registro para enviar o aprobar', () => {
  const { faltaClase } = require('../src/services/calibration.registros');
  const modelo = { criterio: { empNB23001: true } };
  const calculo = { clase: { sugerida: { valor: 'III' } } };
  assert.match(faltaClase(modelo, { clase: null }, calculo), /se sugiere la clase III/);
  assert.equal(faltaClase(modelo, { clase: { valor: 'III', origen: 'DEDUCIDA' } }, calculo), null);
  assert.equal(faltaClase({ criterio: { empNB23001: false } }, { clase: null }, calculo), null);
});

test('huella: un registro enviado antes de los campos nuevos (USP, tolerancias) no aparece cambiado', () => {
  const { coincideHuella, huellaDe, datosDe, planUsp } = require('../src/services/calibration.registros');
  const fuente = { lin1: 100, ind1: 100.1 };
  // Así se guardaba la huella antes: sin «tolerancias» ni «usp».
  const antes = { columnas: { ind1: 100.2 }, clase: null, composiciones: {}, anexo: true };
  const huellaVieja = huellaDe({ fuente, datos: antes });
  const ahora = datosDe(JSON.stringify(antes));
  assert.equal(ahora.usp, false);
  assert.deepEqual(ahora.tolerancias, []);
  assert.equal(coincideHuella({ fuente, datos: ahora }, huellaVieja), true);
  assert.equal(coincideHuella({ fuente, datos: ahora }, huellaDe({ fuente, datos: ahora })), true);
  // Con las tolerancias vacías, pero ya con el campo (antes de la USP).
  const { usp, ...conTolerancias } = ahora;
  assert.equal(usp, false);
  assert.equal(coincideHuella({ fuente, datos: ahora }, huellaDe({ fuente, datos: conTolerancias })), true);
  // Un cambio real sí se nota.
  assert.equal(coincideHuella({ fuente, datos: { ...ahora, usp: true } }, huellaVieja), false);
  assert.equal(coincideHuella({ fuente, datos: { ...ahora, columnas: { ind1: 100.3 } } }, huellaVieja), false);
  assert.equal(coincideHuella({ fuente, datos: ahora }, null), false);
  // Pedido de la USP con su historial.
  assert.deepEqual(planUsp(false, true), { usp: true, cambio: { campo: 'usp', antes: 'No', despues: 'Sí' } });
  assert.deepEqual(planUsp(true, undefined), { usp: true, cambio: null });
});
