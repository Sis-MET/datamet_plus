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

test('emp NB 23001: sin clase se usa la sugerida por la R76 hasta confirmarla; con clase, la registrada', () => {
  const { modelo } = modeloDeFila(fila({ emp: 'Sí' }));
  // 1 500 kg con e = 0,5 kg: n = 3 000 y e ≥ 5 g → clase III (Tabla 3).
  const sinClase = calcularServicio(modelo, datos());
  assert.ok(sinClase.avisos.some(a => a.codigo === 'CLASE_SUGERIDA'));
  assert.ok(!sinClase.avisos.some(a => a.codigo === 'SIN_CLASE'));
  assert.equal(sinClase.clase.valor, 'III');
  assert.equal(sinClase.clase.registrada, false);
  assert.equal(sinClase.clase.requerida, true);
  assert.deepEqual(sinClase.clase.sugerida, { valor: 'III', n: 3000, e: 0.5, enTabla: true, regla: 'TABLA_3' });
  // 1000 kg: 2 000 e → 2 × 1 e = 1 kg.
  assert.equal(sinClase.puntos[2].tolerancia, 1);
  assert.equal(sinClase.puntos[2].conformidad.evaluada, true);
  // Con la clase registrada (II): 2 000 e ≤ 5 000 e → 2 × 0,5 e = 0,5 kg.
  const conClase = calcularServicio(modelo, datos({ claseInstrumento: 'II' }));
  assert.equal(conClase.clase.registrada, true);
  assert.equal(conClase.clase.sugerida, null);
  assert.ok(!conClase.avisos.some(a => a.codigo === 'CLASE_SUGERIDA'));
  assert.equal(conClase.puntos[2].tolerancia, 0.5);
});

test('tolerancia del cliente por rango: sin emp NB 23001 ni %, la del primer rango que contiene la carga', () => {
  const { modelo } = modeloDeFila(fila({ emp: 'No', indicar: 0 }));
  modelo.criterio.toleranciasRango = [{ hasta: 500, tolerancia: 0.5 }, { hasta: null, tolerancia: 1 }];
  const r = calcularServicio(modelo, datos());
  const porCarga = Object.fromEntries(r.puntos.filter(p => p.calculado).map(p => [p.carga, p.tolerancia]));
  assert.equal(porCarga[100], 0.5);
  assert.equal(porCarga[1000], 1);
  assert.equal(r.clase.requerida, false);
  assert.ok(!r.avisos.some(a => a.codigo === 'CLASE_SUGERIDA'));
  // El % del cliente manda sobre los rangos (como el libro).
  const conPorcentaje = modeloDeFila(fila({ emp: 'No', indicar: 0.1 })).modelo;
  conPorcentaje.criterio.toleranciasRango = [{ hasta: null, tolerancia: 5 }];
  const p = calcularServicio(conPorcentaje, datos()).puntos.find(x => x.carga === 1000);
  assert.equal(p.tolerancia, 1);
  // En divisiones: 1 d en todo el rango (Lab Delta), con la d del rango de cada carga.
  const enD = modeloDeFila(fila({ emp: 'No', indicar: 0 })).modelo;
  enD.criterio.toleranciasRango = [{ hasta: null, tolerancia: 1, en: 'D' }];
  const d = enD.instrumento.rangos[0].d;
  assert.ok(calcularServicio(enD, datos()).puntos.filter(x => x.calculado).every(x => Math.abs(x.tolerancia - d) < 1e-12));
  enD.criterio.toleranciasRango = [{ hasta: 500, tolerancia: 1, en: 'D' }, { hasta: null, tolerancia: 2, en: 'D' }];
  const dos = Object.fromEntries(calcularServicio(enD, datos()).puntos.filter(x => x.calculado).map(x => [x.carga, x.tolerancia]));
  assert.ok(Math.abs(dos[100] - d) < 1e-12 && Math.abs(dos[1000] - 2 * d) < 1e-12);
});

test('toleranciaDeCarga: la misma T para la conformidad y el gráfico', () => {
  const rangos = [{ max: 1500, d: 0.5, e: 0.5 }, { max: 600, d: 0.2, e: 0.2 }];
  const pct = motor.toleranciaDeCarga({ criterio: { toleranciaCliente: 0.5 }, rangos });
  assert.equal(pct(100), 0.5);
  // En d: la del rango de la carga (los rangos se ordenan solos).
  const enD = motor.toleranciaDeCarga({ criterio: { toleranciasRango: [{ hasta: null, tolerancia: 1, en: 'D' }] }, rangos });
  assert.equal(enD(500), 0.2);
  assert.equal(enD(1000), 0.5);
  // NB 23001 sin clase: sin tolerancia.
  assert.equal(motor.toleranciaDeCarga({ criterio: { empNB23001: true }, rangos })(100), null);
  assert.equal(motor.toleranciaDeCarga({ criterio: {}, rangos })(100), null);
});

test('sustitución con material: el resto que no se forma con piezas es ΣΔI (4.3.3-5a)', () => {
  // El juego suma 1 100 kg. 2 195,3 = 2 × 1 100 − 4,7 y 3 333,7 = 3 × 1 100 + 33,7: lo que
  // sobra no se forma con piezas, es el material de sustitución (ΣΔI, 15a).
  const { modelo } = modeloDeFila(fila({ lin4: 2195.3, ind4: 2195.3, retorno_lin4: 0, lin5: 3333.7, ind5: 3333.9, retorno_lin5: 0, cap_max1: 3500 }));
  const r = calcularServicio(modelo, datos());
  const p2195 = r.puntos.find(p => p.n === 4);
  const p3333 = r.puntos.find(p => p.n === 5);
  assert.equal(p2195.calculado, true);
  assert.equal(p2195.sustitucion.ecuacion, '7.1.2-15a');
  assert.equal(p2195.sustitucion.n, 2);
  assert.equal(p2195.sustitucion.descripcion, '2 × 1100 en pesas − 4,7 de diferencias de indicación (ΣΔI)');
  // mref = 2·mref(1 100) + ΣΔI, cerca de la carga declarada.
  assert.ok(Math.abs(p2195.mref - 2195.3) < 0.05, `mref = ${p2195.mref}`);
  // n = 3: dos pasos de indicación, más incertidumbre.
  assert.equal(p3333.calculado, true);
  assert.equal(p3333.sustitucion.n, 3);
  assert.ok(Math.abs(p3333.error - 0.2) < 0.05, `E = ${p3333.error}`);
  assert.ok(p3333.uReferencia > p2195.uReferencia);
  assert.ok(r.avisos.some(a => a.codigo === 'SUSTITUCION' && /su suma sale de la carga declarada/.test(a.mensaje)));
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

test('termohigrómetro: la humedad calibrada a dos temperaturas se interpola en temperatura', () => {
  // Como el THB-02: tres puntos de humedad a 15,2 °C y tres a 25,3 °C, con 50,6 % repetido.
  const puntos = [
    { temperatura: 15.2, punto: 31, correccion: 0.3, u: 3, k: 2 },
    { temperatura: 15.2, punto: 50.6, correccion: 0.3, u: 3, k: 2 },
    { temperatura: 15.2, punto: 69.4, correccion: -1.4, u: 3, k: 2 },
    { temperatura: 25.3, punto: 30.7, correccion: -0.3, u: 3, k: 2 },
    { temperatura: 25.3, punto: 50.6, correccion: 0.2, u: 3, k: 2 },
    { temperatura: 25.3, punto: 69.3, correccion: -0.3, u: 3, k: 2 },
  ];
  // En las temperaturas calibradas, los puntos de esa temperatura.
  assert.ok(Math.abs(motor.corregirHumedad(50.6, 15.2, puntos).correccion - 0.3) < 1e-12);
  assert.ok(Math.abs(motor.corregirHumedad(50.6, 25.3, puntos).correccion - 0.2) < 1e-12);
  // A mitad de camino, la media de las dos correcciones.
  const medio = motor.corregirHumedad(50.6, (15.2 + 25.3) / 2, puntos);
  assert.ok(Math.abs(medio.correccion - 0.25) < 1e-12);
  assert.equal(medio.U, 3);
  assert.equal(medio.fuera, false);
  // Fuera de las temperaturas calibradas, la más cercana.
  assert.ok(Math.abs(motor.corregirHumedad(50.6, 12, puntos).correccion - 0.3) < 1e-12);
  assert.ok(Math.abs(motor.corregirHumedad(50.6, 28, puntos).correccion - 0.2) < 1e-12);
  // Sin temperaturas (o con una sola), igual que antes.
  const sinTemperatura = puntos.slice(0, 3).map(({ temperatura: _t, ...punto }) => punto);
  assert.deepEqual(motor.corregirHumedad(40, 20, sinTemperatura), motor.corregirLectura(40, sinTemperatura));
  assert.deepEqual(motor.corregirHumedad(40, 20, puntos.slice(0, 3)), motor.corregirLectura(40, puntos.slice(0, 3)));
});

test('servicio: la humedad se corrige a la temperatura medida', () => {
  const { modelo } = modeloDeFila(fila());
  const conTemperaturas = datos({
    termohigrometro: {
      codigo: 'TH-TEST',
      puntos: {
        ...datos().termohigrometro.puntos,
        HR: [
          { temperatura: 15, punto: 30, correccion: -1, u: 2, k: 2 }, { temperatura: 15, punto: 70, correccion: 1, u: 2, k: 2 },
          { temperatura: 25, punto: 30, correccion: 1, u: 2, k: 2 }, { temperatura: 25, punto: 70, correccion: 3, u: 2, k: 2 },
        ],
      },
    },
  });
  const antes = calcularServicio(modelo, datos());
  const despues = calcularServicio(modelo, conTemperaturas);
  // Lecturas a unos 20,7 °C (corregidas): la corrección de la humedad sube con la temperatura.
  assert.ok(despues.aire.condiciones.hr > antes.aire.condiciones.hr + 0.9, `${despues.aire.condiciones.hr} vs ${antes.aire.condiciones.hr}`);
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

test('sustitución con material: el paso es la mayor carga armada solo con pesas (MONOPOL, ANDEAN VALLEY)', () => {
  // Pesas por 600 kg; el técnico arma hasta 500 kg y sustituye con ese paso.
  const p600 = [pieza(500), pieza(50), pieza(20), pieza(20, '*'), pieza(10)];
  const juego600 = [{
    codigo: 'M1-TEST', clase: 'M1', piezas: p600, verificado: true, condiciones: { temperatura: 20, humedad: 50, presion: 650 },
    valores: new Map(p600.map(p => [`${p.nominalMg}|${p.identificacion}`, { correccionMg: 1000, uMg: 2000, k: 2 }])),
  }];
  // MONOPOL (0103-11-056): 1 007,6 = 2 × 500 + 7,6 y 1 567 = 3 × 500 + 67, no 3 × 600 − 233.
  const monopol = modeloDeFila(fila({
    cap_max1: 2000, lin3: 1007.6, ind3: 1007.6, lin4: 1567, ind4: 1566.5, retorno_lin4: 0,
  })).modelo;
  const r = calcularServicio(monopol, datos({ juegos: juego600 }));
  const p1007 = r.puntos.find(p => p.carga === 1007.6);
  const p1567 = r.puntos.find(p => p.carga === 1567);
  assert.equal(p1007.calculado, true);
  assert.equal(p1007.sustitucion.descripcion, '2 × 500 en pesas + 7,6 de diferencias de indicación (ΣΔI)');
  assert.equal(p1567.calculado, true);
  assert.equal(p1567.sustitucion.descripcion, '3 × 500 en pesas + 67 de diferencias de indicación (ΣΔI)');
  assert.ok(Math.abs(p1567.error + 0.5) < 0.05, `E = ${p1567.error}`);
  // La carga patrón es la de 500 kg: la del paso más que la de las pesas que sobran.
  assert.ok(p1567.piezas.every(p => p.nominal === 500));
  // ANDEAN VALLEY (0004-11-022): 1 057,6 = 2 × 500 + 57,6 y 1 482,8 = 3 × 500 − 17,2.
  const andean = modeloDeFila(fila({
    cap_max1: 1500, lin3: 1057.6, ind3: 1057.6, lin4: 1482.8, ind4: 1483, retorno_lin4: 0,
  })).modelo;
  const a = calcularServicio(andean, datos({ juegos: juego600 })).puntos;
  assert.equal(a.find(p => p.carga === 1057.6).sustitucion.descripcion, '2 × 500 en pesas + 57,6 de diferencias de indicación (ΣΔI)');
  assert.equal(a.find(p => p.carga === 1482.8).sustitucion.descripcion, '3 × 500 en pesas − 17,2 de diferencias de indicación (ΣΔI)');
  assert.ok(a.every(p => p.calculado));
});

test('Método 1 del laboratorio: cadena con la carga de pesas validada (ejemplo 2 del personal)', () => {
  // Pesas por 1 100 kg, pero el técnico valida 500 kg: E(500) = +0,5. Con el material
  // la indicación es 495 → ΔI1 = −5,5, LT2 = 994,5 (lee 995,5, E = +1); luego ΔI2 = +5,5,
  // LT3 = 3 × 500 = 1 500 (lee 1 502, E = +2).
  const cadena = { lin3: 994.5, ind3: 995.5, retorno_lin3: 0, lin4: 1500, ind4: 1502, retorno_lin4: 0, cap_max1: 1500 };
  const r = calcularServicio(modeloDeFila(fila({ ...cadena, metodo_carga: 'Método 1' })).modelo, datos());
  const p994 = r.puntos.find(p => p.carga === 994.5);
  const p1500 = r.puntos.find(p => p.carga === 1500);
  assert.equal(p994.calculado, true);
  assert.equal(p994.sustitucion.descripcion, '2 × 500 en pesas − 5,5 de diferencias de indicación (ΣΔI)');
  assert.ok(Math.abs(p994.error - 1) < 0.05, `E = ${p994.error}`);
  assert.equal(p1500.calculado, true);
  assert.equal(p1500.sustitucion.ecuacion, '7.1.2-15a');
  assert.equal(p1500.sustitucion.n, 3);
  assert.equal(p1500.sustitucion.descripcion, '3 × 500 en pesas');
  assert.ok(Math.abs(p1500.error - 2) < 0.05, `E = ${p1500.error}`);
  // La carga patrón es la de pesas validada, no las piezas que sobran (sin 15b).
  assert.ok(p1500.piezas.every(p => p.nominal === 500));
  assert.ok(p1500.uReferencia > p994.uReferencia);
  // Sin «Método 1», 994,5 no llega al total de las pesas (no se calcula) y 1 500 = 1 100 + 400 en pesas (15b).
  const sin = calcularServicio(modeloDeFila(fila({ ...cadena, metodo_carga: 'Sin método' })).modelo, datos()).puntos;
  assert.equal(sin.find(p => p.carga === 994.5).calculado, false);
  assert.equal(sin.find(p => p.carga === 1500).sustitucion.ecuacion, '7.1.2-15b');
});

test('Método 2 del laboratorio: cargas sustitutivas pesadas solas y puestas con las pesas (ejemplo del personal)', () => {
  // LT = (k + 1)·mref + Σ Is,j − k·Iref: u²(LT) = (k + 1)²·u²(mref) + Σ u²(Is,j) + k²·u²(Iref).
  const m2 = motor.cargaMetodo2({
    mref: 500, uMref: 0.01, nominal: 500, uIndicacionPatron: 0.04, sustitutas: [{ masa: 491, uIndicacion: 0.05 }, { masa: 502, uIndicacion: 0.05 }],
  });
  assert.equal(m2.n, 3);
  assert.equal(m2.valor, 1493);
  assert.ok(Math.abs(m2.uPatron - 3 * 0.01) < 1e-15);
  assert.ok(Math.abs(m2.u - Math.sqrt(0.03 ** 2 + 2 * 0.05 ** 2 + (2 * 0.04) ** 2)) < 1e-15);
  // Con la mref real, cada carga sustitutiva suma mref − nominal (su masa se halló con E = Iref − mref).
  assert.ok(Math.abs(motor.cargaMetodo2({ mref: 500.01, uMref: 0, nominal: 500, uIndicacionPatron: 0, sustitutas: [{ masa: 495.5, uIndicacion: 0 }] }).valor - 995.52) < 1e-9);
  // Caso ideal: 500 en pesas con E = 0; las cargas sustitutivas leen 491, 502 y 498, y se
  // suben una por una con las pesas: 991, 1 493 y 1 991, que leen lo mismo.
  const cargas = { ind2: 500, lin3: 991, ind3: 991, retorno_lin3: 0, lin4: 1493, ind4: 1493, retorno_lin4: 0, lin5: 1991, ind5: 1991, retorno_lin5: 0, cap_max1: 2000 };
  const puntos = calcularServicio(modeloDeFila(fila({ ...cargas, metodo_carga: 'Método 2' })).modelo, datos()).puntos;
  const p991 = puntos.find(p => p.carga === 991);
  const p1493 = puntos.find(p => p.carga === 1493);
  const p1991 = puntos.find(p => p.carga === 1991);
  assert.ok([p991, p1493, p1991].every(p => p.calculado));
  assert.equal(p991.sustitucion.metodo, 'METODO_2');
  assert.equal(p991.sustitucion.descripcion, '500 en pesas + 491 en una carga sustitutiva');
  assert.equal(p1493.sustitucion.descripcion, '500 en pesas + 993 en 2 cargas sustitutivas');
  assert.equal(p1991.sustitucion.descripcion, '500 en pesas + 1491 en 3 cargas sustitutivas');
  assert.equal(p1991.sustitucion.n, 4);
  for (const p of [p991, p1493, p1991]) assert.ok(Math.abs(p.error) < 0.05, `E(${p.carga}) = ${p.error}`);
  assert.ok(p991.uReferencia < p1493.uReferencia && p1493.uReferencia < p1991.uReferencia);
  assert.ok(p1991.piezas.every(p => p.nominal === 500));
  // Las pesas entran k + 1 veces, como en la cadena: la misma u de la carga patrón.
  const cadena = calcularServicio(modeloDeFila(fila({ ...cargas, metodo_carga: 'Método 1' })).modelo, datos()).puntos;
  const c1991 = cadena.find(p => p.carga === 1991);
  assert.equal(c1991.sustitucion.descripcion, '4 × 500 en pesas − 9 de diferencias de indicación (ΣΔI)');
  const uDe = (p, fuente) => p.componentes.find(c => c.fuente === fuente).u;
  assert.ok(Math.abs(uDe(p1991, 'sustitucionPatron') - uDe(c1991, 'sustitucionPatron')) < 1e-12);
  // Segundo ejemplo: 500 lee 499,5 (E = −0,5); las cargas sustitutivas leen 495, 502 y 490, así
  // que valen 495,5, 502,5 y 490,5; 995,5 lee 996 (E = +0,5), 1 498 lee 1 499 (+1) y 1 988,5 lee 1 990 (+1,5).
  const ejemplo2 = { ind2: 499.5, lin3: 995.5, ind3: 996, retorno_lin3: 0, lin4: 1498, ind4: 1499, retorno_lin4: 0, lin5: 1988.5, ind5: 1990, retorno_lin5: 0, cap_max1: 2000 };
  const e2 = calcularServicio(modeloDeFila(fila({ ...ejemplo2, metodo_carga: 'Método 2' })).modelo, datos()).puntos;
  assert.equal(e2.find(p => p.carga === 995.5).sustitucion.descripcion, '500 en pesas + 495,5 en una carga sustitutiva');
  assert.equal(e2.find(p => p.carga === 1988.5).sustitucion.descripcion, '500 en pesas + 1488,5 en 3 cargas sustitutivas');
  for (const [carga, esperado] of [[995.5, 0.5], [1498, 1], [1988.5, 1.5]]) {
    const p = e2.find(x => x.carga === carga);
    assert.ok(Math.abs(p.error - esperado) < 0.05, `E(${carga}) = ${p.error}`);
  }
  // Como 0103-11-013 (25 pesas de 20 kg): 830,4 = 500 + 330,4 no es una cadena de 500,
  // así que sin el Método 2 no se calculaba; 1 346 = 500 + 846 en dos cargas sustitutivas.
  const p20 = Array.from({ length: 25 }, (_, i) => pieza(20, String(i + 1)));
  const juego20 = [{
    codigo: 'M1-TEST', clase: 'M1', piezas: p20, verificado: true, condiciones: { temperatura: 20, humedad: 50, presion: 650 },
    valores: new Map(p20.map(p => [`${p.nominalMg}|${p.identificacion}`, { correccionMg: 100, uMg: 200, k: 2 }])),
  }];
  const real = { ind2: 500, lin3: 830.4, ind3: 830.6, retorno_lin3: 0, lin4: 955.6, ind4: 955.8, retorno_lin4: 0, lin5: 1346, ind5: 1346.4, retorno_lin5: 0 };
  const conMetodo2 = calcularServicio(modeloDeFila(fila({ ...real, metodo_carga: 'Método 2' })).modelo, datos({ juegos: juego20 })).puntos;
  assert.equal(conMetodo2.find(p => p.carga === 830.4).sustitucion.descripcion, '500 en pesas + 330,4 en una carga sustitutiva');
  assert.equal(conMetodo2.find(p => p.carga === 1346).sustitucion.descripcion, '500 en pesas + 846 en 2 cargas sustitutivas');
  assert.ok(Math.abs(conMetodo2.find(p => p.carga === 830.4).error - 0.2) < 0.05);
  const sinMetodo = calcularServicio(modeloDeFila(fila({ ...real, metodo_carga: 'Sin método' })).modelo, datos({ juegos: juego20 })).puntos;
  assert.equal(sinMetodo.find(p => p.carga === 830.4).calculado, false);
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
