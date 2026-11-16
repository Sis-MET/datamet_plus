const test = require('node:test');
const assert = require('node:assert/strict');
const motor = require('../src/services/calibracion/motor');
const { calcularServicio } = require('../src/services/calibracion/motor/servicio');
const { modeloDeFila } = require('../src/services/calibration.fuente');
const { empR111 } = require('../src/services/calibration.patrones');
const {
  TEXTOS, coma, contenidoCertificado, nombreArchivo, numeroCertificado, textoEmision,
} = require('../src/services/calibration.certificado');

const fila = (extra = {}) => ({
  codigo_registro: 'PRUEBA-1', seca: '0051-11-C01-26', n_reca: '30', sticker: '9934', personal: 'Ing. Milena Guerrero C.',
  fecha_servicio: new Date('2026-10-26T00:00:00Z'), unidades: 'g', razon_social: 'CLIENTE S.A.', dir_planta: 'AV. SIEMPRE VIVA 1',
  tipo_equipo: 'Balanza', marca: 'METTLER TOLEDO', modelo: 'ICS425', serie: 'C05', cod_int: '11-WI-01', cod_metrica: '0051-11-035', ubicacion: 'LÍQUIDOS ORALES I',
  cap_max1: 600, d1: 0.01, e1: 0.01, dec1: 2,
  equipo1: 'F1-TEST', equipo6: 'TH-TEST',
  hora: new Date('1970-01-01T11:00:00Z'), hri: 35, ti: 24, patmi: 630,
  hora_fin: new Date('1970-01-01T12:00:00Z'), hri_fin: 36, ti_fin: 24.8, patmi_fin: 630.8,
  tipo_plataforma: 'Cuadrada', puntos_ind: 'Cuadrada 5F', carga: 200,
  posicion1: 1, indicacion1: 200, retorno1: 0, posicion2: 2, indicacion2: 200.01, retorno2: 0,
  posicion3: 3, indicacion3: 200, retorno3: 0, posicion4: 4, indicacion4: 199.99, retorno4: 0, posicion5: 5, indicacion5: 200, retorno5: 0,
  repetibilidad1: 200, indicacion1_1: 200, indicacion1_2: 200.01, indicacion1_3: 200, retorno1_1: 0, retorno1_2: 0, retorno1_3: 0,
  metodo: 'Ascenso evaluando ceros', metodo_carga: 'Sin método', ajuste: 'Sí', tipo: 'Externo', cargas_pesas: '500/F1',
  precarga1: 500, p_indicador1: 500.02,
  lin1: 100, ind1: 100, retorno_lin1: 0,
  lin2: 500, ind2: 500.01, retorno_lin2: 0,
  emp: 'No', indicar: 0.01, factor: 0, regla_aceptacion: 'Simple', observaciones: '',
  ...extra,
});
const pieza = (g, identificacion = '') => ({ nominalMg: g * 1000, identificacion, densidad: 7950, densidadU: 140, densidadK: 2, material: 'Acero inoxidable', activa: true });
const PIEZAS = [pieza(500), pieza(200), pieza(100), pieza(50)];
const calcular = (modelo) => calcularServicio(modelo, {
  juegos: [{ codigo: 'F1-TEST', clase: 'F1', piezas: PIEZAS, valores: new Map(PIEZAS.map(p => [`${p.nominalMg}|`, { correccionMg: 0.1, uMg: 0.5, k: 2 }])), verificado: true, condiciones: null }],
  termohigrometro: null,
  empR111,
  configuracion: motor.CONFIGURACION_V1,
});

test('número, emisión y nombre del PDF como el libro', () => {
  assert.equal(numeroCertificado({ negociacion: '0051-C01', reca: 30, anio: '2026' }), '0051-C01-30-26');
  assert.equal(numeroCertificado({ negociacion: '0051-C01', reca: 3, anio: 2026 }), '0051-C01-03-26');
  assert.equal(numeroCertificado({ negociacion: null, reca: 3, anio: 2026 }), null);
  assert.equal(textoEmision(2), '02');
  assert.equal(
    nombreArchivo({ numero: '0051-C01-30-26', emision: 1, razonSocial: 'GRUPO ALCOS S.A.', marca: 'METTLER TOLEDO', max: '600', unidad: 'g', idInstrumento: '0051-11-035' }),
    '0051-C01-30-26 01 GRUPO ALCOS S.A. METTLER TOLEDO 600 g 0051-11-035.pdf',
  );
  // Sin marca: «NI»; los caracteres que Windows no admite se reemplazan.
  assert.equal(nombreArchivo({ numero: 'N', emision: 1, razonSocial: 'A/B: "C"', marca: 'N/I', max: '6', unidad: 'kg', idInstrumento: 'X' }), 'N 01 A-B- -C- NI 6 kg X.pdf');
  assert.equal(coma(-0.001, 2), '0,00');
  assert.equal(coma(10.5), '10,5');
});

test('contenido del certificado: datos, tablas, ajuste, antes del ajuste y notas', () => {
  const { modelo } = modeloDeFila(fila());
  modelo.patrones.juegos[0].certificado = { numero: 'LP-CC-M-0182-2026', fecha: '2026-05-05' };
  const calculo = { ...calcular(modelo), juegos: [{ codigo: 'F1-TEST', clase: 'F1', rangoMg: { min: 50000, max: 500000 } }] };
  const { contenido: c, archivo, avisos } = contenidoCertificado({ modelo, calculo, creadoEn: '2026-10-27T15:00:00Z' });
  assert.equal(c.numero, '0051-C01-30-26');
  assert.equal(archivo, '0051-C01-30-26 01 CLIENTE S.A. METTLER TOLEDO 600 g 0051-11-035.pdf');
  assert.equal(c.instrumento.tipo, 'BALANZA');
  assert.equal(c.instrumento.max, '600');
  assert.equal(c.instrumento.d, '0,01');
  assert.equal(c.instrumento.e, null);
  assert.equal(c.calibracion.lugar, 'LÍQUIDOS ORALES I');
  assert.deepEqual(c.calibracion.patrones, ['Set de pesas patrón OIML F1; 50 g a 500 g; Código: F1-TEST']);
  assert.deepEqual(c.calibracion.trazabilidad, ['F1-TEST: Trazable a LP-CC-M-0182-2026; 2026-05-05']);
  // El ensayo no llegó a Max (600 g): el alcance va hasta Max′.
  assert.equal(c.calibracion.alcance, "Min': 100 g hasta Max': 500 g");
  assert.equal(c.calibracion.registro, 'SECA 0051-C01-26  N° 30; STICKER N° 9934');
  assert.equal(c.calibracion.ajuste, 'Se realizó ajuste externo con pesa patrón de 500 g (F1) antes de la calibración.');
  assert.match(c.calibracion.condiciones, /^Temperatura: 24,4 °C; Humedad: 35,5 %; Presión Atmosférica: 630,4 hPa$/);
  assert.equal(c.elaboradoPor, 'Ing. Milena Guerrero C.');
  // Excentricidad: posiciones 2 a 5 respecto del centro.
  assert.deepEqual(c.excentricidad.filas.map(f => f.diferencia), ['0,01 g', '0,00 g', '-0,01 g', '0,00 g']);
  assert.equal(c.repetibilidad.repeticiones, 3);
  assert.equal(c.repetibilidad.filas[0].difMax, '0,01 g');
  // d = 0,01 g: la desviación y el eje y de su gráfico con 3 decimales.
  assert.match(c.repetibilidad.filas[0].s, /^\d,\d{3} g$/);
  assert.equal(c.repetibilidad.decimales, 3);
  // Errores con k y tolerancia del cliente (0,01 %), marcada como dato del cliente.
  assert.equal(c.errores.encabezadoTolerancia, 'TOLERANCIA DEL CLIENTE 0,01 % *');
  assert.equal(c.errores.filas.length, 2);
  assert.match(c.errores.filas[0].k, /^\d,\d\d$/);
  assert.ok(['CONFORME', 'NO CONFORME'].includes(c.errores.filas[0].conformidad));
  assert.equal(c.notas.datosCliente, TEXTOS.datosCliente);
  // Antes del ajuste: la precarga.
  assert.deepEqual(c.antesDelAjuste, [{ carga: '500 g', indicacion: '500,02 g', error: '0,02 g' }]);
  assert.deepEqual(c.graficoErrores.asFound.map(p => p.x), [500]);
  assert.equal(c.notas.regla, TEXTOS.reglas.SIMPLE);
  assert.equal(c.notas.observaciones, 'Ninguna.');
  assert.equal(c.notas.pruebas.at(-1), TEXTOS.incertidumbre);
  assert.ok(avisos.every(a => !/registre sus piezas/.test(a)));
  // Datos del modelo sugerido: resumen, ambiente, patrones en tabla e indicación y masa de referencia.
  assert.equal(c.resumen.puntos, 2);
  assert.ok(['CONFORME', 'NO CONFORME'].includes(c.resumen.conformidad));
  assert.match(c.resumen.UMax, / g \(en \d+ g\)$/);
  assert.deepEqual(c.ambiente.inicio, { hora: '11:00', t: '24,0', hr: '35,0', p: '630,0' });
  assert.deepEqual(c.patronesDetalle, [{ codigo: 'F1-TEST', clase: 'OIML F1', alcance: '50 g a 500 g', certificado: 'LP-CC-M-0182-2026', fecha: '2026-05-05' }]);
  assert.match(c.errores.filas[0].mref, /^100,\d+ g$/);
  assert.equal(typeof c.graficoErrores.asLeft[0].U, 'number');
  assert.equal(c.repetibilidad.filas[0].n, 3);
});

test('clase NB 23001 con su origen y regla sin conformidad', () => {
  const { modelo } = modeloDeFila(fila({ emp: 'Sí', regla_aceptacion: 'Ninguna', ajuste: 'No', lin3: 600, ind3: 600 }));
  modelo.instrumento.clase = { valor: 'II', origen: 'PLACA' };
  const { contenido: c, bloqueos } = contenidoCertificado({ modelo, calculo: calcular(modelo) });
  assert.equal(c.instrumento.clase, 'II (placa)');
  assert.equal(c.errores.encabezadoTolerancia, 'EMP (NB 23001)');
  assert.ok(c.errores.filas.every(f => f.conformidad === 'NO APLICA' && f.tolerancia === 'NO APLICA'));
  assert.equal(c.calibracion.ajuste, 'No se realizó ajuste.');
  assert.equal(c.antesDelAjuste, null);
  // Sin ajuste, las precargas igual van en el gráfico como AS FOUND (como la planilla).
  assert.deepEqual(c.graficoErrores.asFound.map(p => p.x), [500]);
  assert.ok(Math.abs(c.graficoErrores.asFound[0].y - 0.02) < 1e-9);
  assert.equal(c.calibracion.alcance, "Min': 100 g hasta Max: 600 g");
  assert.equal(c.notas.regla, TEXTOS.reglas.NINGUNA);
  assert.equal(c.notas.datosCliente, null);
  // Sin certificado del patrón no se puede autorizar (trazabilidad).
  assert.ok(bloqueos.some(a => /sin certificado vigente/.test(a)));
  modelo.instrumento.clase = { valor: 'III', origen: 'CLIENTE' };
  const cliente = contenidoCertificado({ modelo, calculo: calcular(modelo) }).contenido;
  assert.equal(cliente.instrumento.clase, 'III *');
  assert.equal(cliente.notas.datosCliente, TEXTOS.datosCliente);
});

test('anexo de información adicional solo a pedido: incertidumbre en uso y pesada mínima', () => {
  const { modelo } = modeloDeFila(fila({ emp: 'Sí' }));
  modelo.instrumento.clase = { valor: 'III', origen: 'PLACA' };
  const calculo = calcular(modelo);
  assert.equal(contenidoCertificado({ modelo, calculo }).contenido.anexo, null);
  const { anexo } = contenidoCertificado({ modelo, calculo, anexo: true }).contenido;
  assert.match(anexo.aviso, /no forma parte del certificado/);
  assert.equal(anexo.tabla.length, 6);
  assert.match(anexo.tabla.at(-1).R, /^600 g$/);
  assert.match(anexo.tabla.at(-1).U, /^0,\d+ g$/);
  assert.match(anexo.ecuaciones[0].U, /^U\(W\) = .+ g \+ .+ · R$/);
  assert.match(anexo.supuestos[1], /OIML R 76 para la clase III/);
  assert.equal(anexo.pesadaMinima.factores.length, 5);
  assert.equal(anexo.pesadaMinima.filas.length, 6);
  // Cada pesada mínima es una carga en g, o «—» si no se alcanza en el rango; crece con el factor.
  const fila01 = anexo.pesadaMinima.filas[0].valores;
  assert.ok(fila01.every(v => v === '—' || / g$/.test(v)));
  const numeros = fila01.filter(v => v !== '—').map(v => Number(v.replace(' g', '').replace(',', '.')));
  assert.deepEqual([...numeros].sort((x, y) => x - y), numeros);
});

test('anexo con la USP ⟨41⟩ (a pedido) y las condiciones que revisó el técnico', () => {
  const { modelo } = modeloDeFila(fila({
    emp: 'Sí', vibracion: 'Bueno', nivelacion: 'Malo', nivelacion_comentario: 'Burbuja fuera del círculo', tiempo_estab: 'Mayor a 30 minutos',
  }));
  modelo.instrumento.clase = { valor: 'II', origen: 'PLACA' };
  const calculo = calcular(modelo);
  assert.ok(calculo.usp);
  const sinUsp = contenidoCertificado({ modelo, calculo, anexo: true }).contenido.anexo;
  assert.equal(sinUsp.usp, null);
  assert.deepEqual(sinUsp.condiciones, [
    { condicion: 'Estabilización de las pesas', estado: 'Mayor a 30 minutos', observacion: '' },
    { condicion: 'Vibración', estado: 'Bueno', observacion: '' },
    { condicion: 'Nivelación', estado: 'Malo', observacion: 'Burbuja fuera del círculo' },
  ]);
  // Sin anexo no hay USP aunque se pida.
  assert.equal(contenidoCertificado({ modelo, calculo, usp: true }).contenido.anexo, null);
  const { usp } = contenidoCertificado({ modelo, calculo, anexo: true, usp: true }).contenido.anexo;
  assert.match(usp.titulo, /USP ⟨41⟩/);
  // m = 5 % de 600 g; la s medida (0,0058 g) es mayor que 0,41 · d.
  assert.equal(usp.repetibilidad[0].valor, '30 g (5 % de Max)');
  assert.equal(usp.repetibilidad[5].valor, '≤ 0,1 %');
  assert.match(usp.repetibilidad[6].valor, /^(APROBADO|REPROBADO)$/);
  // Exactitud solo entre 30 g y 600 g: el punto de 100 g y el de 500 g.
  assert.deepEqual(usp.exactitud.filas.map(f => f.carga), ['100 g', '500 g']);
  assert.equal(usp.exactitud.filas[0].limite, '± 0,1 g');
  assert.equal(usp.pesoMinimo.filas.length, 6);
});

test('riesgo bajo el umbral del método', () => {
  const { modelo } = modeloDeFila(fila({ emp: 'Sí' }));
  modelo.instrumento.clase = { valor: 'III', origen: 'PLACA' };
  const calculo = calcular(modelo);
  // Riesgos conocidos: 0,3 % y 3 %.
  const puntos = calculo.puntos.map((p, i) => ({ ...p, conformidad: { ...p.conformidad, evaluada: true, conforme: true, riesgo: i === 0 ? 0.003 : 0.03 } }));
  const riesgos = c => contenidoCertificado({ modelo, calculo: c }).contenido.errores.filas.map(f => f.riesgo);
  assert.deepEqual(riesgos({ ...calculo, puntos }), ['< 5,00', '< 5,00']);
  assert.deepEqual(riesgos({ ...calculo, puntos, reglas: { ...calculo.reglas, riesgoUmbral: 0.01 } }), ['< 1,00', '3,00']);
});

test('gráfico: tolerancia en % como un cono; por rangos, escalones en los límites del cliente', () => {
  // 0,01 % de la carga (la fila de prueba): recta desde el origen hasta la carga mayor (MONOPOL).
  const { modelo } = modeloDeFila(fila());
  const c = contenidoCertificado({ modelo, calculo: calcular(modelo) }).contenido;
  assert.deepEqual(c.graficoErrores.emp, [{ x: 0, y: 0 }, { x: 500, y: 0.05 }]);
  // Por rangos del cliente: el escalón cae en el límite (300 g), no en una carga medida.
  const porRango = modeloDeFila(fila({ indicar: 0 })).modelo;
  porRango.criterio.toleranciasRango = [{ hasta: 300, tolerancia: 0.1 }, { hasta: null, tolerancia: 0.2 }];
  const emp = contenidoCertificado({ modelo: porRango, calculo: calcular(porRango) }).contenido.graficoErrores.emp;
  assert.equal(emp[0].x, 0);
  assert.equal(emp[0].y, 0.1);
  const escalon = emp.find(p => p.y === 0.2);
  assert.ok(Math.abs(escalon.x - 300) < 1e-6, `escalón en ${escalon.x}`);
  assert.equal(emp.at(-1).x, 500);
});

test('regla de decisión sin tolerancia: no se puede emitir hasta definirla', () => {
  const { modelo } = modeloDeFila(fila({ indicar: 0 }));
  const sin = contenidoCertificado({ modelo, calculo: calcular(modelo) });
  assert.ok(sin.bloqueos.some(b => /regla de decisión simple.*no tienen tolerancia.*Criterio y cierre/.test(b)));
  assert.ok(sin.contenido.errores.filas.every(f => f.conformidad === 'NO APLICA'));
  // Con 1 d en todo el rango (Lab Delta) ya se evalúa: T = d = 0,01 g.
  modelo.criterio.toleranciasRango = [{ hasta: null, tolerancia: 1, en: 'D' }];
  const con = contenidoCertificado({ modelo, calculo: calcular(modelo) });
  assert.ok(!con.bloqueos.some(b => /no tienen tolerancia/.test(b)));
  assert.ok(con.contenido.errores.filas.every(f => f.tolerancia === '0,01 g'));
  // Sin regla (Ninguna) no hace falta.
  const ninguna = modeloDeFila(fila({ indicar: 0, regla_aceptacion: 'Ninguna' })).modelo;
  assert.ok(!contenidoCertificado({ modelo: ninguna, calculo: calcular(ninguna) }).bloqueos.some(b => /tolerancia/.test(b)));
});

test('alcance: Max′ es la carga mayor que sale en el certificado, salvo que llegue a Max', () => {
  // 600 g de Max: hasta 550 g sale Max′ = 550 g, no Max.
  const casi = modeloDeFila(fila({ lin3: 550, ind3: 550 })).modelo;
  assert.equal(contenidoCertificado({ modelo: casi, calculo: calcular(casi) }).contenido.calibracion.alcance, "Min': 100 g hasta Max': 550 g");
  // Una carga que no se calcula (599,9 g no se forma con las piezas) no cuenta para el alcance.
  const sinCalcular = modeloDeFila(fila({ lin3: 599.9, ind3: 599.9 })).modelo;
  assert.equal(contenidoCertificado({ modelo: sinCalcular, calculo: calcular(sinCalcular) }).contenido.calibracion.alcance, "Min': 100 g hasta Max': 500 g");
  const max = modeloDeFila(fila({ lin3: 600, ind3: 600 })).modelo;
  assert.equal(contenidoCertificado({ modelo: max, calculo: calcular(max) }).contenido.calibracion.alcance, "Min': 100 g hasta Max: 600 g");
});

test('con el método del laboratorio: error con los decimales del rango, U con uno más y k sin decimales', () => {
  const { modelo } = modeloDeFila(fila({ emp: 'Sí' }));
  modelo.instrumento.clase = { valor: 'III', origen: 'PLACA' };
  const config = { ...motor.CONFIGURACION_V1, presentacion: { decimales: 'POR_RANGO', k: 'SIN_DECIMALES' }, conformidad: { bandaGuarda: 1, riesgoUmbral: 0.05, riesgo: 'PLANILLA' } };
  const calculo = calcularServicio(modelo, {
    juegos: [{ codigo: 'F1-TEST', clase: 'F1', piezas: PIEZAS, valores: new Map(PIEZAS.map(p => [`${p.nominalMg}|`, { correccionMg: 0.1, uMg: 0.5, k: 2 }])), verificado: true, condiciones: null }],
    termohigrometro: null,
    empR111,
    configuracion: config,
  });
  const { filas } = contenidoCertificado({ modelo, calculo }).contenido.errores;
  // El rango declara 2 decimales: el error con 2 y la U con 3.
  for (const f of filas) {
    assert.match(f.error, /^-?\d+,\d{2} g$/);
    assert.match(f.U, /^\d+,\d{3} g$/);
  }
  // k sin decimales; si no fuera entero, con los suyos.
  assert.ok(filas.every(f => /^\d(,\d{1,2})?$/.test(f.k)));
  const conK = (k) => contenidoCertificado({ modelo, calculo: { ...calculo, puntos: calculo.puntos.map(p => ({ ...p, k })) } }).contenido.errores.filas[0].k;
  assert.equal(conK(2), '2');
  assert.equal(conK(2.05), '2,05');
  // Con la versión 1, como antes: k = 2,00.
  assert.match(contenidoCertificado({ modelo, calculo: calcular(modelo) }).contenido.errores.filas[0].k, /^\d,\d\d$/);
});
