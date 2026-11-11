const test = require('node:test');
const assert = require('node:assert/strict');
const { horaTexto, leerPeriodo } = require('../src/services/tiempos');
const soporte = require('../src/services/soporte.tiempos');
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
    tecnico: 'Jorge De La Rocha', cliente: 'MONOPOL', planta: null, codMetrica: '0103-11-004', equipo: 'BALANZA',
  });
});
