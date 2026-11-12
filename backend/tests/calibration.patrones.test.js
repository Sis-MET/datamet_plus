const test = require('node:test');
const assert = require('node:assert/strict');
const {
  aptaR111,
  avisosAmbiente,
  avisosPesas,
  claseSugerida,
  densidadR111,
  empR111,
  formatNominal,
  piezaKey,
  resumenPiezas,
  tipoSugerido,
  transcripcionVacia,
  transcripcionVersion,
  vigenteEn,
} = require('../src/services/calibration.patrones');
const { parse } = require('../src/services/calibration.validation');

const G = 1e3;
const KG = 1e6;

test('emp de la OIML R111 (Tabla 1) por clase y valor nominal, en mg', () => {
  assert.equal(empR111('E2', 1 * KG), 1.6);
  assert.equal(empR111('F1', 200), 0.06);
  assert.equal(empR111('M1', 20 * KG), 1000);
  assert.equal(empR111('M3', 5000 * KG), 2500000);
  // Sin extrapolar: valores que la clase no tiene.
  assert.equal(empR111('M2', 50), null);
  assert.equal(empR111('M1-2', 20 * KG), null);
  assert.equal(empR111('E1', 100 * KG), null);
  assert.equal(empR111('X9', 1 * KG), null);
  assert.equal(empR111('E2', 3 * KG), null);
});

test('límites de densidad de la OIML R111 (Tabla 5)', () => {
  assert.deepEqual(densidadR111('E2', 1 * KG), { min: 7810, max: 8210 });
  assert.deepEqual(densidadR111('F1', 500 * KG), { min: 7390, max: 8730 });
  assert.deepEqual(densidadR111('M1', 5 * KG), { min: 4400, max: null });
  assert.deepEqual(densidadR111('E1', 100), { min: 4400, max: null });
  assert.deepEqual(densidadR111('F1', 500), { min: 2200, max: null });
  assert.deepEqual(densidadR111('E2', 50 * G), { min: 7740, max: 8280 });
  // Sin límite para esa clase o ese valor.
  assert.equal(densidadR111('E2', 100), null);
  assert.equal(densidadR111('M3', 20 * KG), null);
  assert.equal(densidadR111('E2', 10), null);
});

test('muestra el valor nominal en la unidad que corresponde', () => {
  assert.equal(formatNominal(500), '500 mg');
  assert.equal(formatNominal(1000), '1 g');
  assert.equal(formatNominal(2500), '2,5 g');
  assert.equal(formatNominal(20 * KG), '20 kg');
  assert.equal(formatNominal(0.5), '0,5 mg');
});

test('sugiere el tipo y la clase del patrón por su instrumento y su código', () => {
  assert.equal(tipoSugerido('Pesas Patron'), 'PESAS');
  assert.equal(tipoSugerido('Termohigrobarómetro'), 'AMBIENTE');
  assert.equal(tipoSugerido('Barómetro'), 'AMBIENTE');
  assert.equal(tipoSugerido('Termohigrómetro'), 'AMBIENTE');
  assert.equal(tipoSugerido('Balanza'), null);
  assert.equal(claseSugerida('E2-003'), 'E2');
  assert.equal(claseSugerida('M1-1-20XX '), 'M1');
  assert.equal(claseSugerida('F1-101'), 'F1');
  assert.equal(claseSugerida('CZ16'), null);
});

test('avisa las piezas sin valores y las que no cumplen la R111', () => {
  const piezas = [
    { nominalMg: 1 * KG, identificacion: '', activa: true, densidad: 7950, densidadU: 140 },
    { nominalMg: 500 * G, identificacion: '', activa: true, densidad: 7950, densidadU: 140 },
    { nominalMg: 200 * G, identificacion: '', activa: true, densidad: 6000, densidadU: 140 },
    { nominalMg: 200 * G, identificacion: '*', activa: false, densidad: null },
    { nominalMg: 100 * G, identificacion: '', activa: true, densidad: null },
  ];
  const valores = [
    // F1, 1 kg: emp 5 mg. U (k = 2) = 2 mg > 5/3 mg.
    { nominalMg: 1 * KG, identificacion: '', correccionMg: 1, uMg: 2, k: 2 },
    // 500 g: emp 2,5 mg; U = 0,5 mg; |corrección| 2,1 > 2,5 − 0,5.
    { nominalMg: 500 * G, identificacion: '', correccionMg: -2.1, uMg: 0.5, k: 2 },
    { nominalMg: 200 * G, identificacion: '', correccionMg: 0.1, uMg: 0.3, k: 2 },
  ];
  const avisos = avisosPesas({ clase: 'F1', piezas, valores });
  const de = (nominal, ident = '') => avisos.filter(aviso => aviso.pieza === piezaKey({ nominalMg: nominal, identificacion: ident }));

  assert.match(de(1 * KG)[0].mensaje, /supera un tercio del emp/);
  assert.equal(de(500 * G).length, 1);
  assert.match(de(500 * G)[0].mensaje, /R111 5\.3/);
  assert.match(de(200 * G)[0].mensaje, /fuera de 7390 a 8730/);
  // Las desactivadas no avisan; las que no tienen valores, sí.
  assert.equal(de(200 * G, '*').length, 0);
  assert.deepEqual(de(100 * G).map(aviso => aviso.tipo).sort(), ['falta', 'info']);
});

test('«Apta» se calcula con la clase y los valores del certificado (R111 5.2 y 5.3)', () => {
  // F1, 1 kg: emp 5 mg; un tercio 1,667 mg.
  assert.equal(aptaR111({ clase: 'F1', nominalMg: 1 * KG, correccionMg: 4, uMg: 1, k: 2 }).apta, true);
  // |corrección| justo en emp − U.
  assert.equal(aptaR111({ clase: 'F1', nominalMg: 1 * KG, correccionMg: -4, uMg: 1, k: 2 }).apta, true);
  assert.equal(aptaR111({ clase: 'F1', nominalMg: 1 * KG, correccionMg: 4.1, uMg: 1, k: 2 }).cumpleCorreccion, false);
  // U = 2 mg (k = 2) supera emp/3.
  const grande = aptaR111({ clase: 'F1', nominalMg: 1 * KG, correccionMg: 0, uMg: 2, k: 2 });
  assert.deepEqual([grande.apta, grande.cumpleU, grande.cumpleCorreccion], [false, false, true]);
  // La U se lleva a k = 2: 0,9 mg con k = 1 son 1,8 mg.
  assert.equal(aptaR111({ clase: 'F1', nominalMg: 1 * KG, correccionMg: 0, uMg: 0.9, k: 1 }).cumpleU, false);
  // Sin clase, valor nominal que la clase no tiene o sin valores: no se decide.
  assert.equal(aptaR111({ clase: null, nominalMg: 1 * KG, correccionMg: 0, uMg: 1, k: 2 }).apta, null);
  assert.equal(aptaR111({ clase: 'F1', nominalMg: 3 * KG, correccionMg: 0, uMg: 1, k: 2 }).apta, null);
  assert.equal(aptaR111({ clase: 'F1', nominalMg: 1 * KG, correccionMg: null, uMg: 1, k: 2 }).apta, null);
  assert.equal(aptaR111({ clase: 'F1', nominalMg: 1 * KG, correccionMg: 0, uMg: 1, k: 0 }).apta, null);
});

test('con el criterio del laboratorio solo decide |corrección| + U ≤ emp y la 5.2 queda como dato', () => {
  // E2-003, 10 mg (IBMETRO): U = 0,003 mg supera emp/3 = 0,00267 mg, pero 0,002 + 0,003 ≤ 0,008.
  const pieza = { clase: 'E2', nominalMg: 10, correccionMg: 0.002, uMg: 0.003, k: 2 };
  assert.equal(aptaR111(pieza).apta, false);
  assert.deepEqual(aptaR111({ ...pieza, criterio: 'SUMA_EMP' }), { apta: true, emp: 0.008, u2: 0.003, cumpleU: false, cumpleCorreccion: true });
  // La suma que se pasa del emp no es apta con ningún criterio.
  assert.equal(aptaR111({ ...pieza, correccionMg: 0.006, criterio: 'SUMA_EMP' }).apta, false);

  const piezas = [{ nominalMg: 10, identificacion: '', activa: true, densidad: 7950, densidadU: 60 }];
  const valores = [{ nominalMg: 10, identificacion: '', correccionMg: 0.002, uMg: 0.003, k: 2 }];
  const r111 = avisosPesas({ clase: 'E2', piezas, valores });
  assert.deepEqual(r111.map(a => a.tipo), ['aviso']);
  assert.match(r111[0].mensaje, /supera un tercio del emp de E2/);
  // Con el criterio del laboratorio no hay alerta: queda informado.
  const laboratorio = avisosPesas({ clase: 'E2', piezas, valores, criterio: 'SUMA_EMP' });
  assert.deepEqual(laboratorio.map(a => a.tipo), ['info']);
  assert.match(laboratorio[0].mensaje, /el criterio del laboratorio no lo exige/);
  // Si la suma pasa el emp, sí alerta.
  const fuera = avisosPesas({ clase: 'E2', piezas, valores: [{ ...valores[0], correccionMg: 0.006 }], criterio: 'SUMA_EMP' });
  assert.ok(fuera.some(a => a.tipo === 'aviso' && /R111 5\.3/.test(a.mensaje)));
});

test('una corrección justo en el límite emp − U no avisa', () => {
  const piezas = [{ nominalMg: 1 * KG, identificacion: '', activa: true, densidad: 7950, densidadU: 140 }];
  const valores = [{ nominalMg: 1 * KG, identificacion: '', correccionMg: 4, uMg: 1, k: 2 }];
  assert.deepEqual(avisosPesas({ clase: 'F1', piezas, valores }), []);
});

test('un valor nominal que la clase no tiene se avisa', () => {
  const piezas = [{ nominalMg: 3 * KG, identificacion: '', activa: true, densidad: 7950, densidadU: 140 }];
  const valores = [{ nominalMg: 3 * KG, identificacion: '', correccionMg: 0, uMg: 1, k: 2 }];
  assert.match(avisosPesas({ clase: 'F1', piezas, valores })[0].mensaje, /no tiene ese valor nominal/);
});

test('avisa las magnitudes sin puntos en un termohigrobarómetro', () => {
  assert.equal(avisosAmbiente({ puntos: [] })[0].tipo, 'falta');
  const soloT = avisosAmbiente({ puntos: [{ magnitud: 'T', punto: 20 }] });
  assert.deepEqual(soloT.map(aviso => aviso.tipo), ['aviso', 'info']);
  assert.match(soloT[0].mensaje, /humedad/);
  assert.match(soloT[1].mensaje, /presión por defecto/);
  assert.deepEqual(avisosAmbiente({ puntos: [{ magnitud: 'T' }, { magnitud: 'HR' }, { magnitud: 'P' }] }), []);
});

test('elige el certificado que regía en la fecha de la calibración', () => {
  const certificados = [
    { id: 1, fecha: '2025-04-01', vence: '2026-04-01', anulado: false },
    { id: 2, fecha: '2026-04-06', vence: '2027-04-06', anulado: false },
    { id: 3, fecha: '2026-06-01', vence: '2027-06-01', anulado: true },
  ];
  assert.equal(vigenteEn(certificados, '2026-03-15').id, 1);
  assert.equal(vigenteEn(certificados, '2026-04-06').id, 2);
  // El anulado no rige.
  assert.equal(vigenteEn(certificados, '2026-10-26').id, 2);
  // Antes del primero, o con todos vencidos, no hay certificado.
  assert.equal(vigenteEn(certificados, '2025-01-01'), null);
  assert.equal(vigenteEn([{ id: 4, fecha: '2024-01-01', vence: '2025-01-01', anulado: false }], '2026-01-01'), null);
});

test('resume los cambios de las piezas', () => {
  const antes = [
    { id: 1, nominalMg: 1000, identificacion: '', activa: true },
    { id: 2, nominalMg: 2000, identificacion: '', activa: true },
    { id: 3, nominalMg: 2000, identificacion: '*', activa: true },
  ];
  const despues = [
    { id: 1, nominalMg: 1000, identificacion: '', activa: true },
    { id: 2, nominalMg: 2000, identificacion: '', activa: true, densidad: 7950 },
    { id: 3, nominalMg: 2000, identificacion: '*', activa: false },
    { id: null, nominalMg: 5000, identificacion: '', activa: true },
  ];
  assert.equal(resumenPiezas(antes, despues), '1 pieza nueva · 1 pieza modificada · 1 pieza desactivada');
  assert.equal(resumenPiezas(antes, antes), '');
});

test('la versión de una transcripción no depende del orden de las filas', () => {
  const valores = [
    { nominalMg: 1000, identificacion: '', correccionMg: 0.01, uMg: 0.03, k: 2 },
    { nominalMg: 2000, identificacion: '', correccionMg: -0.02, uMg: 0.04, k: 2 },
  ];
  const a = transcripcionVersion({ temperatura: 20.5, valores, puntos: [] });
  const b = transcripcionVersion({ temperatura: 20.5, valores: [...valores].reverse(), puntos: [] });
  assert.deepEqual(a, b);
  // «Apta» se deriva de los valores: no cuenta como cambio.
  assert.deepEqual(transcripcionVersion({ temperatura: 20.5, valores: valores.map(v => ({ ...v, conforme: true })), puntos: [] }), a);
  // La temperatura de un punto de humedad y las U de las condiciones sí cuentan.
  const punto = { magnitud: 'HR', punto: 50.6, correccion: 0.3, u: 3, k: 2 };
  assert.notDeepEqual(
    transcripcionVersion({ valores: [], puntos: [{ ...punto, temperatura: 15.2 }] }),
    transcripcionVersion({ valores: [], puntos: [{ ...punto, temperatura: 25.3 }] })
  );
  assert.equal(transcripcionVersion({ presionU: 0.4, valores: [], puntos: [] }).presionU, 0.4);
  // Si el certificado daba el error o la corrección también cuenta; sin dato, corrección.
  const presion = { magnitud: 'P', punto: 650, correccion: -1.33, u: 1.42, k: 2 };
  assert.equal(transcripcionVersion({ valores: [], puntos: [presion] }).puntos[0].expresadoComo, 'CORRECCION');
  assert.notDeepEqual(
    transcripcionVersion({ valores: [], puntos: [presion] }),
    transcripcionVersion({ valores: [], puntos: [{ ...presion, expresadoComo: 'ERROR' }] })
  );
});

test('guardar solo las piezas no cuenta como transcribir el certificado', () => {
  // Lo que manda la ficha cuando el certificado vigente aún no tiene valores.
  assert.equal(transcripcionVacia(transcripcionVersion({ observaciones: '', valores: [], puntos: [] })), true);
  // Cualquier dato ya es una transcripción.
  assert.equal(transcripcionVacia(transcripcionVersion({ temperatura: 20.5, valores: [], puntos: [] })), false);
  assert.equal(transcripcionVacia(transcripcionVersion({ observaciones: 'Tres documentos', valores: [], puntos: [] })), false);
  assert.equal(transcripcionVacia(transcripcionVersion({
    valores: [{ nominalMg: 1000, identificacion: '', correccionMg: 0.01, uMg: 0.03, k: 2 }], puntos: [],
  })), false);
});

test('valida y redondea los datos de un patrón', () => {
  const data = parse('patron', {
    tipo: 'PESAS',
    clase: 'F1',
    piezas: [
      { nominalMg: 1000, identificacion: ' * ', densidad: 7950.004, densidadU: 140, densidadK: 2, densidadOrigen: 'SUPUESTA' },
      { nominalMg: 1000 },
    ],
    certificado: {
      temperatura: 20.456,
      temperaturaU: 0.5,
      humedadU: 1.6,
      presionU: 0.4,
      valores: [{ nominalMg: 1000, identificacion: '*', correccionMg: 0.0123456789, uMg: 0.03, k: 2, conforme: true }],
    },
  });
  assert.equal(data.piezas[0].identificacion, '*');
  assert.equal(data.piezas[0].densidad, 7950);
  assert.equal(data.piezas[1].identificacion, '');
  assert.equal(data.piezas[1].activa, true);
  assert.equal(data.certificado.temperatura, 20.46);
  assert.equal(data.certificado.valores[0].correccionMg, 0.012346);
  // «Apta» la calcula el servidor: lo que llegue se descarta.
  assert.equal('conforme' in data.certificado.valores[0], false);
  assert.deepEqual(
    [data.certificado.temperaturaU, data.certificado.humedadU, data.certificado.presionU, data.certificado.condicionesK],
    [0.5, 1.6, 0.4, null]
  );
  assert.equal(data.certificado.version, null);
  assert.deepEqual(data.certificado.puntos, []);
  assert.equal(data.motivo, null);
});

test('rechaza patrones mal cargados', () => {
  assert.throws(() => parse('patron', { tipo: 'AMBIENTE', clase: 'F1' }), /Solo un juego de pesas/);
  assert.throws(() => parse('patron', { tipo: 'PESAS', piezas: [{ nominalMg: 1000 }, { nominalMg: 1000 }] }), /repetidas/);
  assert.throws(() => parse('patron', { tipo: 'PESAS', piezas: [{ nominalMg: 0 }] }), /mayor que cero/);
  assert.throws(() => parse('patron', { tipo: 'PESAS', piezas: [{ nominalMg: 1000, densidad: 7950, densidadU: 140 }] }), /el k de la incertidumbre/);
  assert.throws(() => parse('patron', {
    tipo: 'PESAS',
    certificado: { valores: [{ nominalMg: 1000, correccionMg: 0, uMg: -1, k: 2 }] },
  }), /no puede ser negativa/);
  assert.throws(() => parse('patron', {
    tipo: 'AMBIENTE',
    certificado: { puntos: [
      { magnitud: 'T', punto: 20, correccion: 0.1, u: 0.2, k: 2 },
      { magnitud: 'T', punto: 20, correccion: 0.2, u: 0.2, k: 2 },
    ] },
  }), /punto repetido/);
  assert.throws(() => parse('patron', { tipo: 'AMBIENTE', certificado: { presion: 101.3 } }), /hPa/);
  assert.throws(() => parse('patron', {
    tipo: 'AMBIENTE',
    certificado: { puntos: [{ magnitud: 'T', temperatura: 20, punto: 20, correccion: 0.1, u: 0.2, k: 2 }] },
  }), /Solo los puntos de humedad/);
  assert.throws(() => parse('patron', {
    tipo: 'AMBIENTE',
    certificado: { puntos: [
      { magnitud: 'HR', temperatura: 15.2, punto: 50.6, correccion: 0.3, u: 3, k: 2 },
      { magnitud: 'HR', temperatura: 15.2, punto: 50.6, correccion: 0.2, u: 3, k: 2 },
    ] },
  }), /punto repetido/);
  assert.throws(() => parse('patron', { tipo: 'PESAS', certificado: { presionU: -1 } }), /negativa/);
});

test('el mismo valor de humedad a dos temperaturas no es un punto repetido', () => {
  const data = parse('patron', {
    tipo: 'AMBIENTE',
    certificado: { puntos: [
      { magnitud: 'HR', temperatura: 15.2, punto: 50.6, correccion: 0.3, u: 3, k: 2 },
      { magnitud: 'HR', temperatura: 25.3, punto: 50.6, correccion: 0.2, u: 3, k: 2 },
      { magnitud: 'T', punto: 15.2, correccion: 0.5, u: 0.41, k: 2 },
    ] },
  });
  assert.deepEqual(data.certificado.puntos.map(p => p.temperatura), [15.2, 25.3, null]);
  assert.deepEqual(data.certificado.puntos.map(p => p.expresadoComo), ['CORRECCION', 'CORRECCION', 'CORRECCION']);
});

test('un punto puede venir del certificado como error', () => {
  const data = parse('patron', {
    tipo: 'AMBIENTE',
    certificado: { puntos: [{ magnitud: 'P', punto: 750, correccion: -1.33, expresadoComo: 'ERROR', u: 1.42, k: 2 }] },
  });
  assert.equal(data.certificado.puntos[0].expresadoComo, 'ERROR');
  assert.equal(data.certificado.puntos[0].correccion, -1.33);
  assert.throws(() => parse('patron', {
    tipo: 'AMBIENTE',
    certificado: { puntos: [{ magnitud: 'P', punto: 750, correccion: 1, expresadoComo: 'DESVIO', u: 1, k: 2 }] },
  }));
});
