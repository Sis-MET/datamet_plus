const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildGroupsQuery,
  buildListQuery,
  claveTecnico,
  coercer,
  esEditable,
  mapColumna,
  mapFila,
  mapGrupo,
  mapResumen,
  normalizarFuente,
  planCambios,
  puedeEditarArea,
  verificarVersion,
} = require('../src/services/soporte.informes');
const { CLAVES_TIPO, TIPOS, numeroInforme } = require('../src/services/soporte.tipos');
const { leerClave, parse } = require('../src/services/soporte.validation');

const columnas = new Map([
  ['codigo_registro', { tipo: 'texto', max: 50 }],
  ['otst', { tipo: 'texto', max: 50 }],
  ['comentario_general', { tipo: 'texto', max: 20 }],
  ['vibracion_estado', { tipo: 'texto', max: 50 }],
  ['vibracion_foto', { tipo: 'texto', max: 200 }],
  ['d1', { tipo: 'decimal', max: null }],
  ['num_celdas', { tipo: 'entero', max: null }],
  ['fecha_prox_servicio', { tipo: 'fecha', max: null }],
  ['hora_fin', { tipo: 'hora', max: null }],
]);

const fuente = {
  codigo_registro: '26-0015-41-S08-MPR_STIL-0015-41-001',
  otst: '26-0015-41-S08',
  comentario_general: 'Original',
  vibracion_estado: '1 Bueno',
  d1: 0.05,
  num_celdas: 1,
  fecha_prox_servicio: '2027-08-13',
};

const params = (query) => Object.fromEntries(query.params.map(param => [param.name, param.value]));
const filtros = (overrides = {}) => parse('filtros', overrides);

test('los 8 servicios apuntan a sus tablas de ServiceMET', () => {
  assert.deepEqual(CLAVES_TIPO, ['MPR', 'MPA', 'MCR', 'DIG', 'INT', 'IBM', 'VFI', 'RVD']);
  assert.equal(TIPOS.DIG.tabla, 'DATA_SERVICIOS_DATOS_DIG');
  assert.equal(TIPOS.IBM.tabla, 'DATA_SERVICIOS_DATOS_IBM');
  assert.equal(TIPOS.INT.tabla, 'DATA_SERVICIOS_DATOS_INT');
  assert.equal(TIPOS.MCR.tabla, 'DATA_SERVICIOS_DATOS_MCR');
  assert.equal(TIPOS.MPA.tabla, 'DATA_SERVICIOS_DATOS_MPA_STAC');
  assert.equal(TIPOS.MPR.tabla, 'DATA_SERVICIOS_DATOS_MPR_STIL');
  assert.equal(TIPOS.RVD.tabla, 'DATA_SERVICIOS_DATOS_RVD');
  assert.equal(TIPOS.VFI.tabla, 'DATA_SERVICIOS_DATOS_VFI');
});

test('el número del informe es la OTST y los 3 últimos dígitos del código Métrica', () => {
  assert.equal(numeroInforme('26-0285-51-S01', '0285-51-002'), '26-0285-51-S01-002');
  assert.equal(numeroInforme(' 26-0285-51-S01 ', '12'), '26-0285-51-S01-12');
  assert.equal(numeroInforme('26-0285-51-S01', null), '26-0285-51-S01');
  assert.equal(numeroInforme(null, '0285-51-002'), '0285-51-002');
});

test('tipo de columna de SQL Server', () => {
  assert.deepEqual(mapColumna({ DATA_TYPE: 'nvarchar', CHARACTER_MAXIMUM_LENGTH: 50 }), { tipo: 'texto', max: 50 });
  assert.deepEqual(mapColumna({ DATA_TYPE: 'nvarchar', CHARACTER_MAXIMUM_LENGTH: -1 }), { tipo: 'texto', max: 4000 });
  assert.equal(mapColumna({ DATA_TYPE: 'decimal' }).tipo, 'decimal');
  assert.equal(mapColumna({ DATA_TYPE: 'int' }).tipo, 'entero');
  assert.equal(mapColumna({ DATA_TYPE: 'date' }).tipo, 'fecha');
  assert.equal(mapColumna({ DATA_TYPE: 'time' }).tipo, 'hora');
  assert.equal(mapColumna({ DATA_TYPE: 'datetimeoffset' }).tipo, 'fechahora');
});

test('la identidad del servicio, las fotos y los datos de sistema no se editan', () => {
  assert.equal(esEditable('comentario_general', columnas.get('comentario_general')), true);
  assert.equal(esEditable('d1', columnas.get('d1')), true);
  assert.equal(esEditable('otst', columnas.get('otst')), false);
  assert.equal(esEditable('codigo_registro', columnas.get('codigo_registro')), false);
  assert.equal(esEditable('vibracion_foto', columnas.get('vibracion_foto')), false);
  assert.equal(esEditable('hora_fin', columnas.get('hora_fin')), false);
  assert.equal(esEditable('inventado', undefined), false);
});

test('los valores se convierten al tipo de la columna', () => {
  assert.equal(coercer('d1', { tipo: 'decimal' }, '0,05'), 0.05);
  assert.equal(coercer('d1', { tipo: 'decimal' }, 12.5), 12.5);
  assert.equal(coercer('d1', { tipo: 'decimal' }, ''), null);
  assert.equal(coercer('d1', { tipo: 'decimal' }, null), null);
  assert.throws(() => coercer('d1', { tipo: 'decimal' }, 'abc'), /número/);
  assert.equal(coercer('num_celdas', { tipo: 'entero' }, '4'), 4);
  assert.throws(() => coercer('num_celdas', { tipo: 'entero' }, '4.5'), /entero/);
  assert.equal(coercer('fecha', { tipo: 'fecha' }, '2027-02-28'), '2027-02-28');
  assert.throws(() => coercer('fecha', { tipo: 'fecha' }, '2027-02-30'), /fecha/);
  assert.equal(coercer('hora', { tipo: 'hora' }, '09:05:10'), '09:05');
  assert.equal(coercer('texto', { tipo: 'texto', max: 10 }, '  hola\r\nmundo  '), 'hola\nmundo');
  assert.throws(() => coercer('texto', { tipo: 'texto', max: 3 }, 'largo'), /máximo 3/);
});

test('la fila original se normaliza: fechas, horas y textos', () => {
  const row = normalizarFuente({
    fecha_prox_servicio: new Date('2027-08-13T00:00:00Z'),
    hora_fin: new Date('1970-01-01T16:22:53Z'),
    comentario_general: '  texto  ',
    otst: '',
    d1: 0.05,
  }, columnas);
  assert.deepEqual(row, {
    fecha_prox_servicio: '2027-08-13',
    hora_fin: '16:22',
    comentario_general: 'texto',
    otst: null,
    d1: 0.05,
  });
});

test('planCambios registra antes y después y quita lo que vuelve al original', () => {
  const primero = planCambios({
    fuente,
    datos: {},
    entrantes: { comentario_general: 'Corregido', vibracion_estado: 'Regular', d1: '0.05' },
    columnas,
  });
  assert.deepEqual(primero.datos, { comentario_general: 'Corregido', vibracion_estado: 'Regular' });
  assert.deepEqual(primero.cambios, [
    { campo: 'comentario_general', antes: 'Original', despues: 'Corregido' },
    { campo: 'vibracion_estado', antes: '1 Bueno', despues: 'Regular' },
  ]);

  const segundo = planCambios({
    fuente,
    datos: primero.datos,
    entrantes: { comentario_general: 'Original', num_celdas: '' },
    columnas,
  });
  assert.deepEqual(segundo.datos, { num_celdas: null, vibracion_estado: 'Regular' });
  assert.deepEqual(segundo.cambios, [
    { campo: 'comentario_general', antes: 'Corregido', despues: 'Original' },
    { campo: 'num_celdas', antes: 1, despues: null },
  ]);

  assert.throws(
    () => planCambios({ fuente, datos: {}, entrantes: { otst: 'X' }, columnas }),
    error => error.statusCode === 400 && /otst/.test(error.message),
  );
});

test('editan el área Soporte Técnico y Sistemas (nivel 3)', () => {
  assert.equal(puedeEditarArea('Soporte Técnico', 0), true);
  assert.equal(puedeEditarArea(' soporte tecnico ', 2), true);
  assert.equal(puedeEditarArea('Calibración', 2), false);
  assert.equal(puedeEditarArea('Comercial', 3), true);
  assert.equal(puedeEditarArea(null, '3'), true);
});

test('la versión editada debe ser la vigente', () => {
  assert.doesNotThrow(() => verificarVersion(null, null));
  assert.throws(() => verificarVersion(null, 2), error => error.statusCode === 409);
  assert.doesNotThrow(() => verificarVersion({ version: 3 }, 3));
  assert.throws(() => verificarVersion({ version: 3 }, 2), error => error.statusCode === 409);
});

test('abrir una revisión exige un motivo de al menos 10 caracteres', () => {
  assert.throws(() => parse('abrirRevision', { version: 3 }), /motivo de la revisión/);
  assert.throws(() => parse('abrirRevision', { version: 3, motivo: 'corto' }), /10 caracteres/);
  assert.deepEqual(parse('abrirRevision', { version: '3', motivo: '  El cliente pidió corregir la ubicación ' }), {
    version: 3, motivo: 'El cliente pidió corregir la ubicación',
  });
  assert.equal(parse('reemision', { version: 4 }).version, 4);
  assert.equal(parse('cancelarRevision', {}).version, null);
  assert.equal(parse('filtros', { estado: 'en_revision' }).estado, 'EN_REVISION');
});

test('validación de los cambios, la emisión y las fotos', () => {
  assert.deepEqual(parse('cambios', { version: '2', cambios: { comentario_general: 'x' } }), {
    version: 2, motivo: null, ia: [], cambios: { comentario_general: 'x' },
  });
  assert.equal(parse('cambios', { cambios: { a: 1 } }).version, null);
  assert.throws(() => parse('cambios', { cambios: {} }), /No hay cambios/);
  assert.throws(() => parse('cambios', { cambios: { 'DROP TABLE': 1 } }), /Campo inválido/);
  assert.equal(parse('emision', {}).version, null);

  const png = `data:image/png;base64,${Buffer.from('foto').toString('base64')}`;
  const foto = parse('foto', { contenido: png, descripcion: ' Plataforma ' });
  assert.equal(foto.contenido.tipo, 'image/png');
  assert.equal(foto.contenido.bytes.toString(), 'foto');
  assert.equal(foto.descripcion, 'Plataforma');
  assert.throws(() => parse('foto', { contenido: 'data:image/gif;base64,AAAA' }), /JPG, PNG o WEBP/);
  assert.throws(() => parse('fotosOrden', { ids: [1, 1] }), /repetidas/);
});

test('el tipo y el código de la URL se validan', () => {
  assert.deepEqual(leerClave('mpr', '26-0015-41-S08-MPR_STIL-0015-41-001'), {
    tipo: 'MPR', codigo: '26-0015-41-S08-MPR_STIL-0015-41-001',
  });
  assert.throws(() => leerClave('XYZ', 'abc'), error => error.statusCode === 404);
  assert.throws(() => leerClave('MPR', "x'; DROP"), error => error.statusCode === 400);
});

test('la lista une los 8 servicios vigentes y filtra con parámetros', () => {
  const query = buildListQuery(filtros({ q: '50%', cliente: 'CBN', tecnico: 'Brayan', desde: '2026-01-01', hasta: '2026-12-31', estado: 'emitido', page: 2, pageSize: 10 }));
  for (const tipo of CLAVES_TIPO) assert.match(query.rows.text, new RegExp(TIPOS[tipo].tabla));
  assert.match(query.rows.text, /<> N'ANULADO'/);
  assert.match(query.rows.text, /OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY/);
  const valores = params(query.rows);
  assert.equal(valores.q, '%50\\%%');
  assert.equal(valores.cliente, 'CBN');
  assert.equal(valores.tecnico, 'Brayan');
  assert.equal(valores.estado, 'EMITIDO');
  assert.equal(valores.desde.toISOString(), '2026-01-01T00:00:00.000Z');
  // Los conteos no filtran por tipo ni estado: cada chip cuenta su grupo.
  assert.equal(params(query.counts).estado, undefined);
  assert.doesNotMatch(query.counts.text, /@estado|@tipo/);

  const soloMpa = buildListQuery(filtros({ tipo: 'MPA' }));
  assert.match(soloMpa.rows.text, /DATA_SERVICIOS_DATOS_MPA_STAC/);
  assert.doesNotMatch(soloMpa.rows.text, /DATA_SERVICIOS_DATOS_RVD/);
  assert.match(soloMpa.counts.text, /DATA_SERVICIOS_DATOS_RVD/);
});

test('los conteos de un chip respetan el filtro del otro', () => {
  const rows = [
    { tipo: 'MPR', estado: 'PENDIENTE', cantidad: 5 },
    { tipo: 'MPR', estado: 'EMITIDO', cantidad: 2 },
    { tipo: 'MPA', estado: 'EMITIDO', cantidad: 3 },
  ];
  const resumen = mapResumen(rows, { tipo: 'MPR', estado: 'EMITIDO' });
  assert.equal(resumen.tipos.MPR, 2);
  assert.equal(resumen.tipos.MPA, 3);
  assert.equal(resumen.estados.PENDIENTE, 5);
  assert.equal(resumen.estados.EMITIDO, 2);
  assert.equal(resumen.total, 10);
});

test('fila de la lista', () => {
  const fila = mapFila({
    tipo: 'MPR', codigo_registro: 'C', otst: '26-0015-41-S08', cod_metrica: '0015-41-001', numero: null,
    fecha_servicio: new Date('2026-08-13T00:00:00Z'), personal: 'Brayan Benito M.', cliente: 'CBN', planta: 'HUARI',
    tipo_equipo: 'BALANZA', marca: 'LEXUS', modelo: 'FOX', serie: 'N/I', estado: 'PENDIENTE', fotos: null,
  });
  assert.equal(fila.numero, '26-0015-41-S08-001');
  assert.equal(fila.fechaServicio, '2026-08-13');
  assert.equal(fila.tipoLabel, 'Mantenimiento preventivo regular');
  assert.equal(fila.fotos, 0);
});

test('el técnico se agrupa sin título, punto final ni inicial del segundo apellido', () => {
  assert.equal(claveTecnico('Aux. Elvis Villca  .'), 'Elvis Villca');
  assert.equal(claveTecnico('Tec. Elvis Villca  .'), 'Elvis Villca');
  assert.equal(claveTecnico('Tec. Jhonatan Barrau F.'), 'Jhonatan Barrau');
  assert.equal(claveTecnico('Tec. Jhonatan Barrau'), 'Jhonatan Barrau');
  assert.equal(claveTecnico('Jorge De La Rocha D.'), 'Jorge De La Rocha');
  assert.equal(claveTecnico('Ing. Milena Guerrero C.'), 'Milena Guerrero');
  assert.equal(claveTecnico('  '), null);
});

test('la agrupación se valida y un grupo pide su agrupación', () => {
  assert.equal(parse('filtros', { por: 'OTST' }).por, 'otst');
  assert.equal(parse('filtros', {}).por, null);
  assert.equal(parse('filtros', { por: 'tecnico', grupo: '' }).grupo, '');
  assert.throws(() => parse('filtros', { por: 'cliente' }), /Agrupación inválida/);
  assert.throws(() => parse('filtros', { grupo: 'X' }), /agrupación del grupo/);
});

test('los informes de un grupo se filtran por su clave y una OTST va en orden de instrumentos', () => {
  const query = buildListQuery(filtros({ por: 'otst', grupo: '26-0285-51-S01' }));
  assert.equal(params(query.rows).grupo, '26-0285-51-S01');
  assert.match(query.rows.text, /ISNULL\(LTRIM\(RTRIM\(f\.otst\)\), N''\) = @grupo/);
  assert.match(query.rows.text, /ORDER BY f\.cod_metrica/);
  // Los conteos de los chips no se limitan al grupo.
  assert.equal(params(buildListQuery(filtros({ por: 'otst' })).counts).grupo, undefined);

  const tecnico = buildListQuery(filtros({ por: 'tecnico', grupo: 'Elvis Villca', tecnico: 'Aux. Elvis Villca .' }));
  assert.match(tecnico.rows.text, /ISNULL\(f\.tecnico_clave, N''\) = @grupo/);
  assert.equal(params(tecnico.rows).tecnico, 'Elvis Villca');
});

test('los grupos se paginan y su detalle pide solo las claves de la página', () => {
  const query = buildGroupsQuery(filtros({ por: 'tecnico', estado: 'pendiente', page: 2, pageSize: 20 }));
  assert.match(query.grupos.text, /GROUP BY clave/);
  assert.match(query.grupos.text, /ORDER BY clave/);
  assert.match(query.grupos.text, /OFFSET 20 ROWS FETCH NEXT 20 ROWS ONLY/);
  assert.equal(params(query.grupos).estado, 'PENDIENTE');
  const detalle = query.detalle(['Elvis Villca', 'Jason Cali']);
  assert.match(detalle.text, /clave IN \(@g0, @g1\)/);
  assert.equal(params(detalle).g1, 'Jason Cali');
  assert.match(buildGroupsQuery(filtros({ por: 'otst' })).grupos.text, /ORDER BY MAX\(fecha_servicio\) DESC/);
});

test('resumen de un grupo', () => {
  const grupo = mapGrupo(
    { clave: '26-0131-51-S02', total: 3, pendientes: 1, borradores: 0, emitidos: 2, otsts: 1,
      desde: new Date('2026-08-12T00:00:00Z'), hasta: new Date('2026-08-13T00:00:00Z') },
    [
      { clave: '26-0131-51-S02', tipo: 'MCR', cliente: 'SINCHI WAYRA', planta: 'DON DIEGO', tecnico_clave: 'Jorge De La Rocha' },
      { clave: '26-0131-51-S02', tipo: 'MPA', cliente: 'SINCHI WAYRA', planta: 'DON DIEGO', tecnico_clave: 'Jason Cali' },
      { clave: 'OTRA', tipo: 'RVD', cliente: 'X', planta: 'Y', tecnico_clave: 'Z' },
    ],
  );
  assert.deepEqual(grupo.estados, { PENDIENTE: 1, BORRADOR: 0, EMITIDO: 2, EN_REVISION: 0 });
  assert.deepEqual(grupo.tipos, ['MPA', 'MCR']);
  assert.deepEqual(grupo.clientes, ['SINCHI WAYRA']);
  assert.deepEqual(grupo.tecnicos, ['Jason Cali', 'Jorge De La Rocha']);
  assert.equal(grupo.desde, '2026-08-12');
});
