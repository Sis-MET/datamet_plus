// Cálculo de un servicio completo (motor, fase 3) a partir del modelo de
// ServiceMET y de los datos de los patrones. Datos sintéticos.
const test = require('node:test');
const assert = require('node:assert/strict');
const motor = require('../src/services/calibracion/motor');
const { calcularServicio } = require('../src/services/calibracion/motor/servicio');
const { modeloDeFila } = require('../src/services/calibration.fuente');
const { empR111 } = require('../src/services/calibration.patrones');

const fila = (extra = {}) => ({
  codigo_registro: 'PRUEBA-1', seca: '0103-31-C05-26', n_reca: '5', personal: 'Usuario',
  fecha_servicio: new Date('2026-07-23T00:00:00Z'), unidades: 'kg',
  cap_max1: 1500, d1: 0.5, e1: 0.5, dec1: 1,
  equipo1: 'M1-TEST', equipo6: 'TH-TEST',
  hora: new Date('1970-01-01T11:00:00Z'), hri: 50, ti: 20, patmi: 650,
  hora_fin: new Date('1970-01-01T12:00:00Z'), hri_fin: 52, ti_fin: 21, patmi_fin: 649.8,
  tipo_plataforma: 'Cuadrada', puntos_ind: 'Cuadrada 5F', carga: 500,
  posicion1: 1, indicacion1: 500, retorno1: 0, posicion2: 2, indicacion2: 500.5, retorno2: 0,
  posicion3: 3, indicacion3: 500, retorno3: 0, posicion4: 4, indicacion4: 499.5, retorno4: 0, posicion5: 5, indicacion5: 500, retorno5: 0,
  repetibilidad1: 500, indicacion1_1: 500, indicacion1_2: 500.5, indicacion1_3: 500, retorno1_1: 0, retorno1_2: 0, retorno1_3: 0,
  metodo: 'Ascenso evaluando ceros', metodo_carga: 'Sin método',
  lin1: 100, ind1: 100, retorno_lin1: 0,
  lin2: 500, ind2: 500.5, retorno_lin2: 0,
  lin3: 1000, ind3: 1000.5, retorno_lin3: 0,
  emp: 'No', indicar: 0.1, factor: 0, regla_aceptacion: 'Conservadora',
  ...extra,
});

const pieza = (nominalKg, identificacion = '') => ({ nominalMg: nominalKg * 1e6, identificacion, densidad: 7100, densidadU: 600, densidadK: 2, material: 'Fundición gris', activa: true });
const PIEZAS = [pieza(500), pieza(200), pieza(200, '*'), pieza(100), pieza(50), pieza(20), pieza(20, '*'), pieza(10)];
const valores = (correccionMg = 1000, uMg = 2000) => new Map(PIEZAS.map(p => [`${p.nominalMg}|${p.identificacion}`, { correccionMg, uMg, k: 2 }]));

const datos = (extra = {}) => ({
  juegos: [{ codigo: 'M1-TEST', clase: 'M1', piezas: PIEZAS, valores: valores(), verificado: true, condiciones: { temperatura: 20, humedad: 50, presion: 650 } }],
  termohigrometro: {
    codigo: 'TH-TEST',
    puntos: {
      T: [{ punto: 15, correccion: 0.1, u: 0.3, k: 2 }, { punto: 25, correccion: 0.3, u: 0.3, k: 2 }],
      HR: [{ punto: 30, correccion: -1, u: 2, k: 2 }, { punto: 70, correccion: 1, u: 2, k: 2 }],
      P: [{ punto: 600, correccion: 0.2, u: 0.4, k: 2 }, { punto: 700, correccion: 0.2, u: 0.4, k: 2 }],
    },
  },
  empR111,
  configuracion: motor.CONFIGURACION_V1,
  ...extra,
});

test('servicio completo: aire, composición, error, U y conformidad por punto', () => {
  const { modelo } = modeloDeFila(fila());
  const r = calcularServicio(modelo, datos());
  assert.equal(r.calculado, true);
  assert.equal(r.provisional, false);
  assert.equal(r.unidad, 'kg');
  // Aire con las lecturas corregidas (t ≈ 20,7 °C, HR = 51 %, p ≈ 650,1 hPa).
  assert.ok(r.aire.rho > 0.76 && r.aire.rho < 0.78, `ρa = ${r.aire.rho}`);
  assert.equal(r.puntos.length, 3);
  const [p100, p500, p1000] = r.puntos;
  assert.deepEqual(p100.piezas.map(p => p.nominal), [100]);
  assert.deepEqual(p1000.piezas.map(p => [p.nominal, p.identificacion]), [[500, ''], [200, ''], [200, '*'], [100, '']]);
  // mref = nominal + corrección del certificado (+1 g por pieza) + empuje (positivo en altura para fundición).
  assert.ok(p1000.mref > 1000.004 && p1000.mref < 1000.02, `mref = ${p1000.mref}`);
  assert.ok(Math.abs(p500.error - (500.5 - p500.mref)) < 1e-12);
  // u(E) incluye la repetibilidad (ν = 2): k mayor que 2.
  assert.ok(p500.k > 2, `k = ${p500.k}`);
  // Tolerancia: 0,1 % de la carga con regla conservadora.
  assert.equal(p1000.tolerancia, 1);
  assert.equal(p1000.conformidad.regla, 'CONSERVADORA');
  assert.equal(typeof p1000.conformidad.conforme, 'boolean');
  // Excentricidad por método 3: |ΔI|máx = 0,5 kg con 500 kg.
  assert.equal(r.excentricidad.maxima, 0.5);
});

test('provisional: juego sin piezas, sin valores o termohigrómetro sin certificado', () => {
  const { modelo } = modeloDeFila(fila());
  const sinPiezas = calcularServicio(modelo, datos({ juegos: [{ codigo: 'M1-TEST', clase: 'M1', material: 'Fundición gris', piezas: [], verificado: false }] }));
  assert.equal(sinPiezas.calculado, true);
  assert.equal(sinPiezas.provisional, true);
  assert.ok(sinPiezas.puntos.every(p => p.supuestas));
  assert.ok(sinPiezas.avisos.some(a => a.codigo === 'PIEZAS_SUPUESTAS'));
  // Sin material declarado, una clase M se toma como fundición: el empuje cuenta.
  const sinMaterial = calcularServicio(modelo, datos({ juegos: [{ codigo: 'M1-TEST', clase: 'M1', piezas: [], verificado: false }] }));
  assert.ok(sinMaterial.puntos[2].componentes.some(c => c.fuente === 'empuje' && c.u > 0));

  const sinValores = calcularServicio(modelo, datos({ juegos: [{ ...datos().juegos[0], valores: new Map() }] }));
  assert.ok(sinValores.avisos.some(a => a.codigo === 'PESAS_SIN_VALORES'));
  // Sin certificado, u(δmc) = emp/√3: mayor que con certificado.
  const conValores = calcularServicio(modelo, datos());
  assert.ok(sinValores.puntos[2].uReferencia > conValores.puntos[2].uReferencia);

  const sinThb = calcularServicio(modelo, datos({ termohigrometro: null }));
  const thb = sinThb.avisos.filter(a => a.codigo === 'THB_SIN_VALORES');
  assert.equal(thb.length, 1);
  assert.match(thb[0].mensaje, /la temperatura, la humedad y la presión/);
  assert.equal(sinThb.provisional, true);
});

test('puntos que no se calculan: sustitución y cargas que no se forman', () => {
  const { modelo } = modeloDeFila(fila({ lin4: 523, ind4: null, retorno_lin4: 0, lin5: 1234, ind5: 1234, retorno_lin5: 0 }));
  const r = calcularServicio(modelo, datos());
  const sustitucion = r.puntos.find(p => p.n === 4);
  const imposible = r.puntos.find(p => p.n === 5);
  assert.equal(sustitucion.calculado, false);
  assert.equal(imposible.calculado, false);
  assert.ok(r.avisos.some(a => a.codigo === 'PUNTO_SIN_INDICACION'));
  assert.ok(r.avisos.some(a => a.codigo === 'CARGA_NO_COMPUESTA'));
});

test('emp NB 23001: sin clase no se evalúa; con clase III se usa el emp en servicio', () => {
  const { modelo } = modeloDeFila(fila({ emp: 'Sí' }));
  const sinClase = calcularServicio(modelo, datos());
  assert.ok(sinClase.avisos.some(a => a.codigo === 'SIN_CLASE'));
  assert.equal(sinClase.puntos[0].conformidad.evaluada, false);
  const conClase = calcularServicio(modelo, datos({ claseInstrumento: 'III' }));
  // 1000 kg con e = 0,5 kg: 2 000 e → 2 × 1 e = 1 kg.
  assert.equal(conClase.puntos[2].tolerancia, 1);
  assert.equal(conClase.puntos[2].conformidad.evaluada, true);
});

test('sin condiciones ambientales no se calcula (el empuje no se puede corregir)', () => {
  const { modelo } = modeloDeFila(fila({ hri: null, ti: null, patmi: null, hri_fin: null, ti_fin: null, patmi_fin: null }));
  const r = calcularServicio(modelo, datos());
  assert.equal(r.calculado, false);
  assert.ok(r.avisos.some(a => a.codigo === 'SIN_AIRE' && a.nivel === 'error'));
  // Presión imposible (3 hPa): tampoco.
  const imposible = calcularServicio(modeloDeFila(fila({ patmi: 3, patmi_fin: 3 })).modelo, datos({ termohigrometro: null }));
  assert.equal(imposible.calculado, false);
  assert.match(imposible.avisos.find(a => a.codigo === 'SIN_AIRE').mensaje, /fuera de rango/);
});

test('cargas y sustitución: composición y 7.1.2-15a/b', () => {
  const juego = [500, 200, 200, 100, 50, 20, 20, 10].map((nominal, i) => ({ nominal, identificacion: i === 2 || i === 6 ? '*' : '' }));
  assert.deepEqual(motor.componerCarga(400, juego).map(p => p.identificacion), ['', '*']);
  assert.equal(motor.componerCarga(1234, juego), null);
  assert.deepEqual(motor.piezasSupuestas(1023, { maximo: 500 }).map(p => p.nominal), [500, 500, 20, 2, 1]);
  // 15a con u(I) constante = 16a: n²u²(mref) + 2(n − 1)u²(I).
  const a = motor.cargaSustitucion({ mref: 500, uMref: 0.01, diferencias: [0.2, -0.1], uIndicaciones: [0.05, 0.05] });
  assert.equal(a.valor, 1500.1);
  assert.ok(Math.abs(a.u - Math.sqrt(9 * 0.01 ** 2 + 2 * 2 * 0.05 ** 2)) < 1e-15);
  const b = motor.cargaSustitucion({ mref: 500, uMref: 0.01, diferencias: [0.2], uIndicaciones: [0.05], parcial: { mref: 200, u: 0.004 } });
  assert.equal(b.ecuacion, '7.1.2-15b');
  assert.ok(Math.abs(b.u - Math.sqrt((0.01 + 0.004) ** 2 + 2 * 0.05 ** 2)) < 1e-15);
});

test('termohigrómetro: corrección interpolada entre los puntos de su certificado', () => {
  const puntos = [{ punto: 15, correccion: -0.2, u: 0.3, k: 2 }, { punto: 25, correccion: 0.2, u: 0.5, k: 2 }];
  assert.deepEqual(motor.corregirLectura(20, puntos), { valor: 20, correccion: 0, U: 0.4, k: 2, fuera: false, sinCertificado: false });
  assert.equal(motor.corregirLectura(10, puntos).fuera, true);
  assert.equal(motor.corregirLectura(10, puntos).valor, 9.8);
});

test('sustitución: la carga mayor que todas las pesas se calcula con 7.1.2-15b o 15a', () => {
  // El juego suma 1 100 kg. 1 600 = 1 × 1 100 + 500 (15b); 2 200 = 2 × 1 100 (15a).
  const { modelo } = modeloDeFila(fila({ lin4: 1600, ind4: 1600.5, retorno_lin4: 0, lin5: 2200, ind5: 2200, retorno_lin5: 0, cap_max1: 3000 }));
  const r = calcularServicio(modelo, datos());
  const p1600 = r.puntos.find(p => p.n === 4);
  const p2200 = r.puntos.find(p => p.n === 5);
  assert.equal(p1600.calculado, true);
  assert.equal(p1600.sustitucion.ecuacion, '7.1.2-15b');
  assert.equal(p1600.sustitucion.n, 2);
  assert.equal(p2200.sustitucion.ecuacion, '7.1.2-15a');
  assert.equal(p2200.sustitucion.n, 2);
  // ΔI = 0: mref = (n − 1)·mref(1 100) + mref(500), cerca de 1 600 con correcciones y empuje.
  assert.ok(Math.abs(p1600.mref - 1600) < 0.05, `mref = ${p1600.mref}`);
  // La incertidumbre de la sustitución supera la de las pesas solas: suma lineal de mref y las u(I) del paso.
  const directo = calcularServicio(modelo, datos()).puntos.find(p => p.n === 3);
  assert.ok(p1600.uReferencia > directo.uReferencia);
  assert.ok(p1600.componentes.some(c => c.fuente === 'sustitucionIndicaciones'));
  assert.ok(r.avisos.some(a => a.codigo === 'SUSTITUCION'));
});

test('composición elegida a mano: se usa si suma la carga; si no, avisa y vuelve a la regla', () => {
  const { modelo } = modeloDeFila(fila());
  const automatica = calcularServicio(modelo, datos());
  assert.equal(automatica.puntos[1].composicion, 'REGLA');
  assert.equal(automatica.piezasDisponibles.length, PIEZAS.length);
  // 500 kg con 200 + 200* + 50 + 20 + 20* + 10 en vez de la pieza de 500 kg.
  const claves = ['M1-TEST|200000000|', 'M1-TEST|200000000|*', 'M1-TEST|50000000|', 'M1-TEST|20000000|', 'M1-TEST|20000000|*', 'M1-TEST|10000000|'];
  const elegida = calcularServicio(modelo, datos({ composiciones: { 2: claves } }));
  const p500 = elegida.puntos[1];
  assert.equal(p500.composicion, 'ELEGIDA');
  assert.deepEqual(p500.piezas.map(p => p.clave), claves);
  // Seis piezas con u = 1 g cada una: más incertidumbre que la de 500 kg sola.
  assert.ok(p500.u > automatica.puntos[1].u);
  assert.ok(!elegida.avisos.some(a => a.codigo === 'COMPOSICION_INVALIDA'));

  const noSuma = calcularServicio(modelo, datos({ composiciones: { 2: claves.slice(1) } }));
  assert.equal(noSuma.puntos[1].composicion, 'REGLA');
  assert.match(noSuma.avisos.find(a => a.codigo === 'COMPOSICION_INVALIDA').mensaje, /Punto 2: .*suma 300, no 500/);
  const ajena = calcularServicio(modelo, datos({ composiciones: { 2: ['OTRO|500000000|'] } }));
  assert.match(ajena.avisos.find(a => a.codigo === 'COMPOSICION_INVALIDA').mensaje, /no están en los juegos/);
  const repetida = calcularServicio(modelo, datos({ composiciones: { 1: ['M1-TEST|50000000|', 'M1-TEST|50000000|'] } }));
  assert.match(repetida.avisos.find(a => a.codigo === 'COMPOSICION_INVALIDA').mensaje, /repite una pieza/);
});

test('convección (7.1.2-13) solo en pesas F1 o mejores, con ΔT por el tiempo de estabilización', () => {
  const { modelo } = modeloDeFila(fila({ tiempo_estab: 'Mayor a 15 minutos' }));
  const conE2 = calcularServicio(modelo, datos({ juegos: [{ ...datos().juegos[0], clase: 'E2' }] }));
  const p500 = conE2.puntos[1];
  const conveccion = p500.componentes.find(c => c.fuente === 'conveccion');
  // 500 kg con ΔT = 5 K: fila de 500 kg fuera de tabla → escala la de 50 kg (32,27 mg) por 10; u = Δm/√3, en kg.
  assert.ok(conveccion && Math.abs(conveccion.u - (32.27 * 10 / 1e6) / Math.sqrt(3)) < 1e-12, `u = ${conveccion?.u}`);
  assert.ok(conE2.avisos.some(a => a.codigo === 'CONVECCION' && /ΔT = 5 K/.test(a.mensaje)));
  assert.deepEqual(conE2.conveccion, { deltaT: 5, estabilizacion: 'Mayor a 15 minutos' });
  // Con más tiempo de estabilización, menos ΔT.
  const { modelo: largo } = modeloDeFila(fila({ tiempo_estab: 'Mayor a 30 minutos' }));
  assert.equal(calcularServicio(largo, datos({ juegos: [{ ...datos().juegos[0], clase: 'E2' }] })).conveccion.deltaT, 3);
  // Pesas M1: no aplica.
  const m1 = calcularServicio(modelo, datos());
  assert.equal(m1.conveccion, null);
  assert.ok(!m1.puntos[1].componentes.some(c => c.fuente === 'conveccion' && c.u > 0));
});
