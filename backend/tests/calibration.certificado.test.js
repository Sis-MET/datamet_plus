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
