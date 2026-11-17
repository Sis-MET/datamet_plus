const test = require('node:test');
const assert = require('node:assert/strict');
const { hayGps, horaTexto, leerPeriodo, ubicacionTexto } = require('../src/services/tiempos');
const soporte = require('../src/services/soporte.tiempos');
const calibracion = require('../src/services/calibration.tiempos');
const { CLAVES_TIPO, TIPOS } = require('../src/services/soporte.tipos');

test('el período se valida: fechas ISO, en orden y hasta tres años', () => {
  assert.deepEqual(leerPeriodo({ desde: '2026-01-01', hasta: '2026-11-11' }), { desde: '2026-01-01', hasta: '2026-11-11' });
  assert.throws(() => leerPeriodo({ desde: '2026-05-01', hasta: '2026-01-01' }), e => e.statusCode === 400 && /posterior/.test(e.message));
  assert.throws(() => leerPeriodo({ desde: '2026-02-30', hasta: '2026-03-01' }), e => e.statusCode === 400);
  assert.throws(() => leerPeriodo({ desde: '2026-01-01' }), e => e.statusCode === 400);
  assert.throws(() => leerPeriodo({ desde: '2020-01-01', hasta: '2026-01-01' }), /tres años/);
});

test('las horas salen como HH:MM, de SQL Server o de una corrección', () => {
  assert.equal(horaTexto(new Date(Date.UTC(1970, 0, 1, 8, 5, 30))), '08:05');
  assert.equal(horaTexto('14:42'), '14:42');
  assert.equal(horaTexto('14:42:10.0000000'), '14:42');
  assert.equal(horaTexto('25:00'), null);
  assert.equal(horaTexto(null), null);
  assert.equal(horaTexto(''), null);
});

test('Soporte: los 8 tipos vigentes del período con la OTST del informe', () => {
  const sql = soporte.consultaTiempos();
  for (const tipo of CLAVES_TIPO) assert.match(sql, new RegExp(TIPOS[tipo].tabla));
  assert.match(sql, /<> N'ANULADO'/);
  assert.match(sql, /x\.rn = 1 AND x\.fecha_servicio BETWEEN @desde AND @hasta/);
  assert.match(sql, /JSON_VALUE\(i\.datos, '\$\.otst'\)/);
  const servicio = soporte.mapServicio({
    tipo: 'MPR', codigo_registro: 'C-1', otst: ' 26-0103-11-S01 ', fecha_servicio: new Date('2026-02-09T00:00:00Z'),
    hora_inicio: new Date(Date.UTC(1970, 0, 1, 10, 25)), hora_fin: new Date(Date.UTC(1970, 0, 1, 11, 2)),
    tecnico_clave: 'Jorge De La Rocha', cliente: 'MONOPOL', planta: null, cod_metrica: '0103-11-004', tipo_equipo: 'BALANZA',
  });
  assert.deepEqual(servicio, {
    codigo: 'C-1', grupo: 'MPR', orden: '26-0103-11-S01', fecha: '2026-02-09', inicio: '10:25', fin: '11:02',
    tecnico: 'Jorge De La Rocha', cliente: 'MONOPOL', planta: null, departamentoPlanta: null, codMetrica: '0103-11-004', equipo: 'BALANZA',
    ubicacion: null,
  });
});

test('la ubicación de ServiceMET llega con el servicio, si la base ya la recibe', () => {
  assert.deepEqual(ubicacionTexto({ latitud: '-16.5012345', longitud: -68.1500001, precision_gps: 12.6 }), { lat: -16.5012345, lng: -68.1500001, precision: 13 });
  assert.deepEqual(ubicacionTexto({ latitud: -17.78, longitud: -63.18, precision_gps: null }), { lat: -17.78, lng: -63.18, precision: null });
  assert.equal(ubicacionTexto({ latitud: null, longitud: -63.18 }), null);
  assert.equal(ubicacionTexto({ latitud: 0, longitud: 0 }), null);
  assert.equal(ubicacionTexto({ latitud: -95, longitud: -63.18 }), null);
  assert.equal(hayGps([{ latitud: 9, longitud: 9 }]), true);
  assert.equal(hayGps([{ latitud: null, longitud: null }]), false);

  // Con la columna: la última subida del registro que trae coordenadas.
  for (const sql of [soporte.consultaTiempos(true), calibracion.consultaTiempos(true, true)]) {
    assert.match(sql, /dbo\.DATA_SERVICIOS_DATOS d/);
    assert.match(sql, /ROW_NUMBER\(\) OVER \(PARTITION BY d\.codigo_registro ORDER BY d\.n DESC\) AS rn_gps/);
    assert.match(sql, /gps\.rn_gps = 1/);
    assert.match(sql, /dep_planta/);
  }
  // Sin la columna: van vacías y no se consulta el resumen.
  for (const sql of [soporte.consultaTiempos(false), calibracion.consultaTiempos(true, false)]) {
    assert.doesNotMatch(sql, /DATA_SERVICIOS_DATOS d/);
    assert.match(sql, /CAST\(NULL AS decimal\(10, 7\)\) AS latitud/);
  }
  const conPlanta = soporte.mapServicio({ tipo: 'RVD', codigo_registro: 'X', dep_planta: ' LA  PAZ ', latitud: -16.5, longitud: -68.15 });
  assert.equal(conPlanta.departamentoPlanta, 'LA PAZ');
  assert.deepEqual(conPlanta.ubicacion, { lat: -16.5, lng: -68.15, precision: null });
});

test('Calibración: capacidad en kg y su rango', () => {
  assert.equal(calibracion.capacidadKg({ cap_max1: 220, unidades: 'g' }), 0.22);
  assert.equal(calibracion.capacidadKg({ cap_max1: 30, cap_max2: 60, unidades: 'kg' }), 60);
  assert.equal(calibracion.capacidadKg({ cap_max1: 3, unidades: 't' }), 3000);
  assert.equal(calibracion.capacidadKg({ cap_max1: null, unidades: 'kg' }), null);
  assert.equal(calibracion.capacidadKg({ cap_max1: 10, unidades: 'lb' }), null);
  assert.equal(calibracion.rangoDe(0.22), 'HASTA_1KG');
  assert.equal(calibracion.rangoDe(1), 'HASTA_1KG');
  assert.equal(calibracion.rangoDe(60), 'HASTA_60KG');
  assert.equal(calibracion.rangoDe(600), 'HASTA_1500KG');
  assert.equal(calibracion.rangoDe(60000), 'MAS_1500KG');
  assert.equal(calibracion.rangoDe(null), 'SIN_CAPACIDAD');
  assert.deepEqual(calibracion.GRUPOS.map(g => g.id), ['HASTA_1KG', 'HASTA_60KG', 'HASTA_1500KG', 'MAS_1500KG', 'SIN_CAPACIDAD']);
});

test('Calibración: el técnico se reconoce en DATA_USERS y vale la hora final corregida', () => {
  const usuarios = [
    { id: 16, usuario: 'Ortuño', nombre1: 'Jorge', apellido1: 'Ortuño', apellido2: 'Ramirez', inicial: 'JOR', estado: 'ACTIVO' },
    { id: 19, usuario: 'Galvez', nombre1: 'Antonio', apellido1: 'Galvez', apellido2: 'Flores', inicial: 'AGF', estado: 'ACTIVO' },
  ];
  const hora = (h, m) => new Date(Date.UTC(1970, 0, 1, h, m));
  const fila = {
    codigo_registro: 'C-1', seca: '0032-11-C20-26', fecha_servicio: new Date('2026-08-13T00:00:00Z'),
    hora_inicio: hora(14, 17), hora: hora(14, 17), hora_fin: hora(14, 18), personal: 'Ing. Jorge Ortuño R.',
    cliente: 'CBN', planta: 'LP', cod_metrica: '0032-11-001', tipo_equipo: 'BALANZA', cap_max1: 30, unidades: 'kg', registro_datos: null,
  };
  const base = calibracion.mapServicio(fila, usuarios);
  assert.deepEqual([base.tecnico, base.grupo, base.orden, base.inicio, base.fin], ['Jorge Ortuño Ramirez', 'HASTA_60KG', '0032-11-C20-26', '14:17', '14:18']);
  // Variantes del mismo técnico suman juntas.
  assert.equal(calibracion.mapServicio({ ...fila, personal: 'JORGE ORTUNO' }, usuarios).tecnico, 'Jorge Ortuño Ramirez');
  // ServiceMET sin técnico: sin identificar.
  assert.equal(calibracion.mapServicio({ ...fila, personal: 'Usuario sin datos' }, usuarios).tecnico, null);
  // Desconocido: el nombre escrito, sin título.
  assert.equal(calibracion.mapServicio({ ...fila, personal: 'Pas. Kevin Aguilar  .' }, usuarios).tecnico, 'Kevin Aguilar');
  // La hora final corregida en el registro reemplaza a la de ServiceMET.
  const corregida = calibracion.mapServicio({ ...fila, registro_datos: JSON.stringify({ columnas: { hora_fin: '15:05' } }) }, usuarios);
  assert.equal(corregida.fin, '15:05');
  // Sin hora_inicio vale la de las condiciones iniciales (corregida si la hay).
  const sinInicio = calibracion.mapServicio({ ...fila, hora_inicio: null, registro_datos: JSON.stringify({ columnas: { hora: '14:10' } }) }, usuarios);
  assert.equal(sinInicio.inicio, '14:10');
  assert.equal(calibracion.mapServicio({ ...fila, registro_datos: '{roto' }, usuarios).fin, '14:18');
});
