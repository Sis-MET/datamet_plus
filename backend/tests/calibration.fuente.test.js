const test = require('node:test');
const assert = require('node:assert/strict');
const {
  certificadoEn,
  codigoPatron,
  identificarTecnico,
  leerReca,
  leerSeca,
  modeloDeFila,
  segun,
} = require('../src/services/calibration.fuente');

const DANADO = '�';

// Fila sintética con la forma de DATA_SERVICIOS_DATOS_CALIBRACION (datos de
// prueba, no de un cliente real).
const base = () => ({
  n: 4856,
  codigo_registro: '0103-31-C05-26-5-0103-31-006',
  cliente: 'CLIENTE DE PRUEBA',
  razon_social: 'CLIENTE DE PRUEBA S.A.',
  planta: 'PLANTA NORTE',
  dep_planta: 'SANTA CRUZ',
  cod_planta: '0103-31',
  dir_planta: 'Av. Siempre Viva 123',
  personal: 'Ing. Jorge Ortuño R.',
  seca: '0103-31-C05-26',
  n_reca: '5',
  sticker: '8785',
  equipo1: 'M1-3-05XX', certificado1: '2026-02-04', ente_calibrador1: 'METRICA LTDA.', estado1: 'Vigente (196 dias)', cantidad1: 1,
  equipo6: 'TH-04', certificado6: '2025-10-30', ente_calibrador6: 'IBMETRO', cantidad6: 1,
  categoria_balanza: 'STIL',
  cod_metrica: '0103-31-006',
  cod_int: 'SC-B-30',
  tipo_equipo: 'BALANZA ELECTRONICA',
  marca: 'METTLER TOLEDO',
  modelo: 'IND231',
  serie: 'C036973249',
  unidades: 'kg',
  ubicacion: 'PRODUCCIÓN',
  cap_max1: 1500, d1: 0.5, e1: 0.5, dec1: 1, cap_max2: 0, d2: 0, e2: 0, dec2: 0, cap_max3: 0, d3: 0, e3: 0, dec3: 0,
  fecha_servicio: new Date('2026-07-23T00:00:00Z'),
  hora_inicio: new Date('1970-01-01T11:55:00Z'),
  tiempo_estab: 'Mayor a 15 minutos',
  t_ope_balanza: 'Mayor a 15 minutos',
  vibracion: 'Inexistente', nivelacion: 'Bueno',
  precarga1: 40, p_indicador1: 40, precarga2: 200, p_indicador2: 200,
  ajuste: 'No', tipo: 'NO APLICA', cargas_pesas: 'NO APLICA',
  hora: new Date('1970-01-01T11:55:00Z'), hri: 80, ti: 26.4, patmi: 965.4,
  tipo_plataforma: 'Cuadrada', puntos_ind: 'Cuadrada 5I', carga: 500,
  posicion1: 1, indicacion1: 500, retorno1: 0,
  posicion2: 2, indicacion2: 500, retorno2: 0,
  posicion3: 3, indicacion3: 500.5, retorno3: 0,
  posicion4: 4, indicacion4: 500, retorno4: 0,
  posicion5: 5, indicacion5: 500, retorno5: 0,
  repetibilidad1: 500, indicacion1_1: 500, retorno1_1: 0, indicacion1_2: 500, retorno1_2: 0, indicacion1_3: 500.5, retorno1_3: 0,
  metodo: 'Ascenso evaluando ceros', metodo_carga: 'Sin método',
  lin1: 5, ind1: 5, retorno_lin1: 0,
  lin2: 100, ind2: 100, retorno_lin2: 0,
  lin3: 500, ind3: 500, retorno_lin3: 0,
  lin4: 1000, ind4: 1000.5, retorno_lin4: 0,
  lin5: 0, ind5: 0, retorno_lin5: 0,
  hora_fin: new Date('1970-01-01T12:40:00Z'), hri_fin: 82, ti_fin: 26.4, patmi_fin: 965.2,
  mant_soporte: 'No', venta_pesas: 'No', reemplazo: 'No', observaciones: 'Ninguna.',
  emp: 'Sí', indicar: 0, factor: 1, regla_aceptacion: 'Simple',
  estado_servicio_bal: 'Balanza Calibrada', estado_servicio_csv: 'ACTIVO',
  session_id: '0005', tipo_servicio: 'CAL.B',
});

const USUARIOS = [
  { usuario: 'Ortuño', nombre1: 'Jorge', apellido1: 'Ortuño', apellido2: 'Ramirez', inicial: 'JOR' },
  { usuario: 'Galvez', nombre1: 'Antonio', apellido1: 'Galvez', apellido2: 'Flores', inicial: 'AGF' },
  { usuario: 'Guerrero', nombre1: 'Milena', apellido1: 'Guerrero', apellido2: 'Cari', inicial: 'MGC' },
];

const cert = (extra) => ({ id: 1, numero: '0000-C02-P3-26', fecha: '2026-02-04', vence: '2027-02-04', anulado: false, revisadoPor: 'GVS', transcrito: true, ...extra });

const contexto = (patrones = {}) => ({
  usuarios: USUARIOS,
  patrones: new Map(Object.entries({
    'M1-3-05XX': { id: 10, codigo: 'M1-3-05XX', estado: 'ACTIVO', certificados: [cert()] },
    'TH-04': { id: 20, codigo: 'TH-04', estado: 'ACTIVO', certificados: [cert({ id: 2, numero: 'LP-CC-H-1', fecha: '2025-10-30', vence: '2026-10-30' })] },
    ...patrones,
  })),
});

const codigos = (avisos, nivel) => avisos.filter(aviso => !nivel || aviso.nivel === nivel).map(aviso => aviso.codigo);

test('leerSeca entiende los tres formatos que tuvo ServiceMET', () => {
  assert.deepEqual(leerSeca('0090-11-C08-26'), {
    original: '0090-11-C08-26', cliente: '0090', planta: '11', negociacion: '0090-C08', anio: '26', libro: '0090-C08-26',
  });
  assert.equal(leerSeca('25-0095-32-C08').libro, '0095-C08-25');
  assert.equal(leerSeca('3001-C01-25').negociacion, '3001-C01');
  assert.equal(leerSeca('3001-C01-25').planta, null);
  assert.equal(leerSeca('26-NNNN-NN-C10').negociacion, null);
  assert.equal(leerSeca(''), null);
});

test('leerReca da el número con dos dígitos y rechaza lo que no es número', () => {
  assert.deepEqual(leerReca('5'), { original: '5', numero: 5, texto: '05' });
  assert.equal(leerReca('30').texto, '30');
  assert.equal(leerReca('¹').numero, null);
  assert.equal(leerReca('5a').numero, null);
});

test('identificarTecnico reconoce las formas en que se escribe el nombre', () => {
  for (const escrito of ['Ing. Jorge Ortuño R.', 'JORGE ORTUNO', `Ing. Jorge Ortu${DANADO}o`, 'Ing. Jorge Ortuño']) {
    const tecnico = identificarTecnico(escrito, USUARIOS);
    assert.equal(tecnico.usuario, 'Ortuño', escrito);
    assert.equal(tecnico.iniciales, 'JOR');
    assert.equal(tecnico.aproximada, false, escrito);
  }
  const typo = identificarTecnico('T.S. Antonio Glavez', USUARIOS);
  assert.equal(typo.usuario, 'Galvez');
  assert.equal(typo.aproximada, true);
  assert.equal(identificarTecnico('Usuario sin datos', USUARIOS).motivo, 'GENERICO');
  assert.equal(identificarTecnico('Usuario', USUARIOS).motivo, 'GENERICO');
  assert.equal(identificarTecnico('Ing. Pedro Pérez', USUARIOS).motivo, 'DESCONOCIDO');
});

test('segun repara los textos dañados con los diccionarios', () => {
  const si = { SI: ['Sí'], NO: ['No'] };
  assert.deepEqual(segun(`S${DANADO}`, si), { codigo: 'SI', reparado: true });
  assert.deepEqual(segun('Si', si), { codigo: 'SI', reparado: false });
  assert.deepEqual(segun('Talvez', si), { codigo: null, original: 'Talvez' });
  assert.equal(segun(`M${DANADO}todo 1`, { METODO_1: ['Método 1'] }).codigo, 'METODO_1');
});

test('codigoPatron separa la parte del juego indicada entre paréntesis', () => {
  assert.deepEqual(codigoPatron('E2-104 (g)'), { original: 'E2-104 (g)', codigo: 'E2-104', parte: 'g' });
  assert.deepEqual(codigoPatron(' f1-101 '), { original: 'f1-101', codigo: 'F1-101', parte: null });
});

test('certificadoEn toma el que regía en la fecha', () => {
  const lista = [cert({ id: 1, fecha: '2025-02-01', vence: '2026-02-01' }), cert({ id: 2, fecha: '2026-02-04', vence: '2027-02-04' })];
  assert.equal(certificadoEn(lista, '2025-12-31').id, 1);
  assert.equal(certificadoEn(lista, '2026-02-03'), null);
  assert.equal(certificadoEn(lista, '2026-07-23').id, 2);
  assert.equal(certificadoEn([cert({ anulado: true })], '2026-07-23'), null);
});

test('un servicio completo da su modelo sin errores ni avisos', () => {
  const { modelo, avisos } = modeloDeFila(base(), contexto());
  assert.deepEqual(avisos, []);
  assert.equal(modelo.servicio.fecha, '2026-07-23');
  assert.equal(modelo.servicio.horaInicio, '11:55');
  assert.equal(modelo.servicio.seca.libro, '0103-C05-26');
  assert.equal(modelo.servicio.reca.texto, '05');
  assert.equal(modelo.servicio.tecnico.usuario, 'Ortuño');
  assert.equal(modelo.instrumento.unidad, 'kg');
  assert.deepEqual(modelo.instrumento.rangos, [{ columna: 1, max: 1500, d: 0.5, e: 0.5, decimales: 1 }]);
  assert.equal(modelo.instrumento.clase.origen, 'NO_DECLARADA');
  assert.equal(modelo.patrones.juegos[0].valores, 'VERIFICADOS');
  assert.equal(modelo.patrones.ambiente[0].codigo, 'TH-04');
  assert.deepEqual(modelo.ambiente.inicio, { hora: '11:55', t: 26.4, hr: 80, p: 965.4 });
  assert.equal(modelo.precarga.length, 2);
  assert.deepEqual(modelo.ajuste, { realizado: false, tipo: 'NO_APLICA', pesas: null });
  assert.equal(modelo.excentricidad.posiciones.length, 5);
  assert.equal(modelo.repetibilidad.ensayos[0].lecturas.length, 3);
  // El relleno en cero (lin5) no es un punto.
  assert.deepEqual(modelo.errores.puntos.map(p => p.n), [1, 2, 3, 4]);
  assert.equal(modelo.errores.metodo, 'EVALUANDO_CEROS');
  assert.deepEqual(modelo.criterio, { empNB23001: true, toleranciaCliente: 0, factorSeguridad: 1, regla: 'SIMPLE' });
  assert.equal(modelo.lugar.inspeccion.length, 14);
});

test('multirango: los rangos quedan de menor a mayor aunque ServiceMET ponga primero el mayor', () => {
  const fila = { ...base(), cap_max1: 60, d1: 0.01, e1: 0.02, dec1: 2, cap_max2: 30, d2: 0.005, e2: 0.02, dec2: 3 };
  const { modelo, avisos } = modeloDeFila(fila, contexto());
  assert.deepEqual(modelo.instrumento.rangos.map(r => [r.columna, r.max, r.d]), [[2, 30, 0.005], [1, 60, 0.01]]);
  assert.equal(modelo.instrumento.multirango, true);
  assert.ok(!codigos(avisos).some(codigo => codigo.startsWith('RANGOS')));

  const raros = modeloDeFila({ ...fila, cap_max2: 60, d2: 0.5 }, contexto()).avisos;
  assert.ok(codigos(raros).includes('RANGOS_IGUALES'));
});

test('hasta 60 puntos, con el relleno en cero en medio y una carga de sustitución sin indicación', () => {
  const fila = { ...base(), metodo_carga: 'Método 2', lin10: 0, ind10: 0, lin11: 0, ind11: 0 };
  for (let i = 5; i <= 9; i += 1) Object.assign(fila, { [`lin${i}`]: i * 100, [`ind${i}`]: i * 100, [`retorno_lin${i}`]: 0 });
  Object.assign(fila, { lin13: 523, ind13: null, retorno_lin13: 0, lin60: 1400, ind60: 1400.5, retorno_lin60: 0 });
  const { modelo, avisos } = modeloDeFila(fila, contexto());
  assert.deepEqual(modelo.errores.puntos.map(p => p.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 60]);
  assert.equal(modelo.errores.metodoCarga, 'METODO_2');
  const aviso = avisos.find(a => a.codigo === 'PUNTO_SIN_INDICACION');
  assert.match(aviso.mensaje, /punto 13 \(523\).*sustitución/);
});

test('excentricidad con 6 posiciones y la carga guardada sin decimales', () => {
  const fila = { ...base(), puntos_ind: 'Rectangular 5F', posicion6: 6, indicacion6: 500, retorno6: 0 };
  const { modelo, avisos } = modeloDeFila(fila, contexto());
  assert.equal(modelo.excentricidad.posiciones.length, 6);
  assert.ok(codigos(avisos).includes('POSICIONES_DISTINTAS'));

  const truncada = { ...base(), d1: 0.01, carga: 2 };
  for (let i = 1; i <= 5; i += 1) truncada[`indicacion${i}`] = 2.5;
  assert.ok(codigos(modeloDeFila(truncada, contexto()).avisos).includes('CARGA_EXCENTRICIDAD'));
});

test('patrones: fuera del gestor, sin certificado en la fecha, sin valores o sin verificar', () => {
  const fila = { ...base(), equipo2: 'E2-104 (g)', equipo3: 'F1-101', equipo4: 'F1-104', equipo5: 'E2-005' };
  const { modelo, avisos } = modeloDeFila(fila, contexto({
    'F1-101': { id: 11, codigo: 'F1-101', estado: 'ACTIVO', certificados: [cert({ id: 5, fecha: '2025-01-01', vence: '2026-01-01' })] },
    'F1-104': { id: 12, codigo: 'F1-104', estado: 'ACTIVO', certificados: [cert({ id: 6, transcrito: false })] },
    'E2-005': { id: 13, codigo: 'E2-005', estado: 'ACTIVO', certificados: [cert({ id: 7, revisadoPor: null })] },
  }));
  const [, e2104, f1101, f1104, e2005] = modelo.patrones.juegos;
  assert.deepEqual([e2104.codigo, e2104.parte, e2104.estado], ['E2-104', 'g', 'NO_EXISTE']);
  assert.equal(f1101.estado, 'SIN_CERTIFICADO');
  assert.equal(f1104.valores, 'SIN_VALORES');
  assert.equal(e2005.valores, 'SIN_VERIFICAR');
  for (const codigo of ['PATRON_CON_PARTE', 'PATRON_NO_EXISTE', 'PATRON_SIN_CERTIFICADO', 'PATRON_SIN_VALORES', 'PATRON_SIN_VERIFICAR']) {
    assert.ok(codigos(avisos).includes(codigo), codigo);
  }
});

test('marcas de validación de cargas y condiciones fuera de rango', () => {
  const validadas = modeloDeFila({ ...base(), metodo_carga: 'cargas_validadas:7' }, contexto()).modelo.errores;
  assert.deepEqual([validadas.metodoCarga, validadas.cargasValidadas, validadas.validacionPesas], ['NINGUNO', 7, 'VALIDADAS']);

  const { avisos } = modeloDeFila({ ...base(), metodo_carga: 'validacion_pesas_pendiente', patmi: 66, emp: `S${DANADO}` }, contexto());
  assert.ok(codigos(avisos).includes('VALIDACION_PENDIENTE'));
  assert.match(avisos.find(a => a.codigo === 'AMBIENTE_FUERA_DE_RANGO').mensaje, /presión al inicio \(66 hPa\)/);
  assert.ok(codigos(avisos, 'info').includes('TEXTO_REPARADO'));
});

test('sin los datos esenciales el servicio queda con errores', () => {
  const vacia = { codigo_registro: 'X-1', personal: 'Usuario sin datos' };
  const { modelo, avisos } = modeloDeFila(vacia, contexto());
  for (const codigo of ['SIN_FECHA', 'SIN_SECA', 'SIN_RECA', 'SIN_UNIDAD', 'SIN_RANGOS', 'SIN_PESAS', 'SIN_EXCENTRICIDAD', 'SIN_REPETIBILIDAD', 'SIN_ERRORES']) {
    assert.ok(codigos(avisos, 'error').includes(codigo), codigo);
  }
  assert.ok(codigos(avisos).includes('TECNICO_SIN_IDENTIFICAR'));
  assert.equal(modelo.servicio.codigo, 'X-1');
});

test('el filtro de la lista de servicios valida las fechas', () => {
  const { parse } = require('../src/services/calibration.validation');
  assert.deepEqual(parse('serviciosFiltro', { desde: '2026-07-01', q: '  mono ' }), { desde: '2026-07-01', q: 'mono', tecnico: null });
  assert.throws(() => parse('serviciosFiltro', { desde: '2026-13-01' }), /desde» no es válida/);
  assert.throws(() => parse('serviciosFiltro', { desde: '2026-08-01', hasta: '2026-07-01' }), /posterior/);
});

test('normalizarCodigo da al código Métrica la forma de ServiceMET', () => {
  const { normalizarCodigo } = require('../src/services/calibration.fuente');
  assert.equal(normalizarCodigo('174-31-3'), '0174-31-003');
  assert.equal(normalizarCodigo(' 0066-31-001 '), '0066-31-001');
  assert.equal(normalizarCodigo('0032-11-130826143831'), null);
  assert.equal(normalizarCodigo('0114-C02-24'), null);
});
