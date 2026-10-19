const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildListQuery,
  clasificarNumeros,
  gestionActual,
  mapDetalle,
  mapFila,
  puedeGestionar,
  tablesFor,
  webRimColumns,
} = require('../src/services/rim.registros');
const { leerCodigo, parse, rimCodigo } = require('../src/services/rim.validation');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('firma')]);
const firma = `data:image/png;base64,${PNG.toString('base64')}`;
const foto = `data:image/jpeg;base64,${Buffer.from('jpeg').toString('base64')}`;

const filtros = (overrides = {}) => parse('filtros', overrides);
const params = (query) => Object.fromEntries(query.params.map(param => [param.name, param.value]));

/** RIM del formulario web, válido. */
const registroWeb = (overrides = {}) => ({
  uuid: '3F2A8C1E-7B4D-4E9A-A1C2-5D6E7F8091AB',
  cliente: { codigo: '0103', nombre: 'EMBOL', razonSocial: 'EMBOL S.A.', nit: 1020304050, direccion: 'Av. Blanco Galindo', ciudad: 'Cochabamba' },
  planta: { codigo: '0103-11', nombre: 'Planta Río Seco', direccion: 'Av. Juan Pablo II', departamento: 'LA PAZ' },
  instrumento: {
    codMetrica: '0103-11-005', tipo: 'Balanza de plataforma', marca: 'Mettler Toledo', modelo: 'IND570',
    serie: 'B123', capacidad: '600', division: '0.2', unidad: 'kg', ubicacion: 'Despacho', observaciones: '',
  },
  contacto: { nombre: 'Juan Pérez', cargo: 'Jefe de planta', telefono: '70000000', correo: 'juan@embol.com' },
  motivo: 'El indicador no enciende.',
  inventario: { items: { indicator: 'present', loadCells: 'present' }, cantidades: { loadCells: '4', feet: '' }, otros: [{ nombre: 'Cable RS232', estado: 'present' }] },
  estadoGeneral: 'fair',
  danos: { scratches: ['platform', 'platform', 'display'] },
  nivelSuciedad: 'moderate',
  pruebas: false,
  descripcionPruebas: 'no debería guardarse',
  representanteMetrica: 'Ing. Ana Quispe',
  lugarRecepcion: 'Laboratorio Métrica',
  firmaCliente: firma,
  firmaRepresentante: firma,
  fotos: [{ nombre: 'frente.jpg', contenido: foto }],
  appVersion: 'DataMET+ 2.8.0',
  ...overrides,
});

test('el código RIM-AA-NNNN se arma y se lee', () => {
  assert.equal(rimCodigo(2026, 42), 'RIM-26-0042');
  assert.equal(rimCodigo(2027, 12345), 'RIM-27-12345');
  assert.deepEqual(leerCodigo('rim-26-0042'), { gestion: 2026, numero: 42 });
  assert.equal(leerCodigo('RIM-0103-11-26'), null);
});

test('la gestión en curso es la de La Paz, no la de UTC', () => {
  // 31/12/2026 23:30 en La Paz = 01/01/2027 03:30 UTC.
  assert.equal(gestionActual(new Date('2027-01-01T03:30:00Z')), 2026);
  assert.equal(gestionActual(new Date('2027-01-01T04:30:00Z')), 2027);
});

test('el nombre de la base de los RIM no admite inyección', () => {
  assert.equal(tablesFor('servicios_extras').rim, '[servicios_extras].[dbo].[form_rim]');
  assert.throws(() => tablesFor('x]; DROP TABLE t;--'));
});

test('el historial filtra por texto, cliente, planta, fechas, área y estado', () => {
  const query = buildListQuery(filtros({
    q: '50%_off', cliente: '0103', planta: '0103-11', desde: '2026-10-01', hasta: '2026-10-19',
    area: 'soporte', origen: 'servicemet', estado: 'anulado', page: '3', pageSize: '10',
  }), tablesFor('servicios_extras'));

  const { text } = query.rows;
  assert.match(text, /FROM \[servicios_extras\]\.\[dbo\]\.\[form_rim\] r LEFT JOIN \[servicios_extras\]\.\[dbo\]\.\[form_rim_anulaciones\] a/);
  assert.match(text, /r\.codigo_rim LIKE @q ESCAPE '\\'/);
  assert.match(text, /r\.cod_cliente = @cliente AND r\.cod_planta = @planta/);
  assert.match(text, /r\.tipo_servicio = @area/);
  assert.match(text, /a\.id IS NOT NULL/);
  assert.match(text, /ORDER BY r\.emitido_en DESC, r\.n DESC\s+OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY/);
  assert.doesNotMatch(text, /UPDATE|DELETE/i);

  const values = params(query.rows);
  // Los comodines escritos por el usuario se buscan literalmente.
  assert.equal(values.q, '%50\\%\\_off%');
  // Las fechas son días completos en hora de La Paz.
  assert.equal(values.desde.toISOString(), '2026-10-01T04:00:00.000Z');
  assert.equal(values.hasta.toISOString(), '2026-10-20T04:00:00.000Z');

  // Los conteos de vigentes y anulados ignoran el filtro de estado.
  assert.doesNotMatch(query.counts.text, /a\.id IS NOT NULL\s*;/);
  assert.match(query.counts.text, /SUM\(CASE WHEN a\.id IS NULL THEN 1 ELSE 0 END\) AS vigentes/);
  assert.equal(params(query.counts).cliente, '0103');
});

test('sin filtros lista todo, del más reciente al más antiguo', () => {
  const query = buildListQuery(filtros(), tablesFor('servicios_extras'));
  assert.doesNotMatch(query.rows.text, /WHERE/);
  assert.match(query.rows.text, /OFFSET 0 ROWS FETCH NEXT 25 ROWS ONLY/);
  assert.deepEqual(query.rows.params, []);
});

test('los filtros inválidos responden 400', () => {
  assert.throws(() => filtros({ area: 'ventas' }), (error) => error.statusCode === 400);
  assert.throws(() => filtros({ desde: '2026-10-19', hasta: '2026-10-01' }), /posterior/);
  assert.throws(() => filtros({ pageSize: '500' }), (error) => error.statusCode === 400);
});

const fila = (overrides = {}) => ({
  n: 15, uuid: '3F2A8C1E-7B4D-4E9A-A1C2-5D6E7F8091AB', codigo_rim: 'RIM-26-0042', gestion: 2026, numero: 42,
  origen: 'servicemet', tipo_servicio: 'soporte', servicio: 'Mantenimiento correctivo', seca_otst: '26-0103-S01',
  cod_cliente: '0103', cliente: 'EMBOL', cod_planta: '0103-11', planta: 'Planta Río Seco',
  cod_metrica: '0103-11-005', instrumento: 'Balanza', marca: 'Mettler', modelo: 'IND570', serie: 'B123',
  contacto_nombre: 'Juan Pérez', representante_metrica: 'Ing. Ana Quispe', reg_usuario: 'aquispe', reg_por: 'Ana Quispe',
  emitido_en: new Date('2026-10-01T18:30:00Z'), anulacion_id: null, ...overrides,
});

test('una fila del historial distingue vigente, anulado y código anterior', () => {
  const vigente = mapFila(fila());
  assert.equal(vigente.estado, 'vigente');
  assert.equal(vigente.formatoAnterior, false);
  assert.equal(vigente.uuid, '3f2a8c1e-7b4d-4e9a-a1c2-5d6e7f8091ab');
  assert.equal(vigente.areaLabel, 'Soporte técnico');
  assert.equal(vigente.emitidoEn, '2026-10-01T18:30:00.000Z');
  assert.equal(vigente.anulacion, null);

  const anulado = mapFila(fila({
    anulacion_id: 3, anulacion_motivo: 'Instrumento equivocado', anulado_en: new Date('2026-10-02T12:00:00Z'),
    anulado_por: 'jefe', anulado_por_nombre: 'Jefe de Soporte', anulacion_origen: 'datametplus',
  }));
  assert.equal(anulado.estado, 'anulado');
  assert.equal(anulado.anulacion.origenLabel, 'DataMET+ (web)');
  assert.equal(anulado.anulacion.anuladoEn, '2026-10-02T12:00:00.000Z');

  const anterior = mapFila(fila({ codigo_rim: 'RIM-0103-11-26', gestion: null, numero: null }));
  assert.equal(anterior.formatoAnterior, true);
  assert.equal(anterior.codigo, 'RIM-0103-11-26');
});

test('el detalle trae las dos firmas, el inventario y la trazabilidad, sin datos de más', () => {
  const detalle = mapDetalle(fila({
    razon_social: 'EMBOL S.A.', nit: '1020304050', dir_planta: 'Av. Juan Pablo II', dep_planta: 'LA PAZ',
    capacidad: '600', division: '0.2', unidad: 'kg', ubicacion: 'Despacho', motivo: 'No enciende',
    inventario: '{"items":{"indicator":"present"},"quantities":{"loadCells":"4"},"others":[{"name":"Cable","status":"missing"}]}',
    obs_inventario: null, estado_general: 'fair', danos: '{"scratches":["platform"]}', nivel_suciedad: 'light',
    pruebas_funcionamiento: true, descripcion_pruebas: 'Otra fuente', contacto_cargo: 'Jefe', contacto_telefono: '700',
    lugar_recepcion: 'Planta', firma_cliente: PNG, firma_representante: null, usuario_app: 'aquispe',
    app_version: '6.4.0+18', fecha_reg_texto: '2026-10-01T15:00:05', talonario_id: 7,
    instalacion: '9B2D7C41-5E3A-4F8B-9C6D-1A2B3C4D5E6F',
  }), { fotos: [{ orden: 1, nombre: null, tipo: 'image/jpeg', contenido: Buffer.from('jpeg') }], user: { acceso_cron: '1' } });

  assert.equal(detalle.firmas.cliente, firma);
  assert.equal(detalle.firmas.representante, null);
  assert.deepEqual(detalle.inventario.items, { indicator: 'present' });
  assert.deepEqual(detalle.inventario.otros, [{ name: 'Cable', status: 'missing' }]);
  assert.deepEqual(detalle.danos, { scratches: ['platform'] });
  assert.equal(detalle.pruebas.realizadas, true);
  assert.equal(detalle.fotos[0].nombre, 'Foto 1');
  assert.match(detalle.fotos[0].url, /^data:image\/jpeg;base64,/);
  assert.equal(detalle.trazabilidad.registradoEn, '2026-10-01T15:00:05-04:00');
  assert.equal(detalle.trazabilidad.instalacion, '9b2d7c41-5e3a-4f8b-9c6d-1a2b3c4d5e6f');
  // Un técnico consulta pero no anula.
  assert.equal(detalle.acciones.anular, false);
  assert.equal(mapDetalle(fila({ inventario: 'no es json', danos: null }), { user: { acceso_cron: '2' } }).acciones.anular, true);
  assert.equal(mapDetalle(fila({ anulacion_id: 1 }), { user: { acceso_cron: '3' } }).acciones.anular, false);
});

test('anulan los jefes de área y los niveles 2 y 3', () => {
  assert.equal(puedeGestionar({ cargo: 'Jefe de Área', acceso_cron: '1' }), true);
  assert.equal(puedeGestionar({ cargo: 'TÉCNICO', acceso_cron: '2' }), true);
  assert.equal(puedeGestionar({ cargo: 'TÉCNICO', acceso_cron: 3 }), true);
  assert.equal(puedeGestionar({ cargo: 'TÉCNICO', acceso_cron: '1' }), false);
  assert.equal(puedeGestionar(null), false);
});

test('la anulación exige un motivo y valida el código que lo reemplaza', () => {
  assert.throws(() => parse('anulacion', { motivo: 'error' }), /al menos 10/);
  assert.throws(() => parse('anulacion', { motivo: 'Instrumento equivocado', reemplazadoPor: 'RIM-0103-11-26' }), /RIM-26-0042/);
  assert.deepEqual(
    parse('anulacion', { motivo: '  Instrumento equivocado  ', reemplazadoPor: 'rim-26-0050' }),
    { motivo: 'Instrumento equivocado', reemplazadoPor: 'RIM-26-0050' },
  );
  assert.equal(parse('anulacion', { motivo: 'Instrumento equivocado', reemplazadoPor: '' }).reemplazadoPor, null);
});

test('el cierre de un talonario exige el motivo y, si es «otro», el detalle', () => {
  assert.deepEqual(parse('cierreTalonario', { motivo: 'telefono_perdido', ultimoUsado: '' }),
    { motivo: 'telefono_perdido', detalle: null, ultimoUsado: null });
  assert.equal(parse('cierreTalonario', { motivo: 'reinstalacion', ultimoUsado: '47' }).ultimoUsado, 47);
  assert.throws(() => parse('cierreTalonario', { motivo: 'otro' }), /Explica/);
  assert.throws(() => parse('cierreTalonario', { motivo: 'fin_gestion' }), /motivo/);
});

test('clasifica los números de un talonario según los RIM registrados', () => {
  const talonario = { desde: 41, hasta: 50, cierre: null };
  // Abierto: 41 y 43 registrados; 42 se emitió y falta subirlo; 44+ siguen en el teléfono.
  const abierto = clasificarNumeros(talonario, [41, 43]);
  assert.deepEqual(abierto.registrados, [41, 43]);
  assert.deepEqual(abierto.pendientes, [42]);
  assert.deepEqual(abierto.disponibles, [44, 45, 46, 47, 48, 49, 50]);
  assert.deepEqual(abierto.noUtilizados, []);
  assert.equal(abierto.estado, 'en_uso');

  // Cerrado a fin de gestión con 45 como último usado: 44 y 45 faltan subir.
  const cerrado = clasificarNumeros({ ...talonario, cierre: { ultimoUsado: 45 } }, [41, 42, 43]);
  assert.deepEqual(cerrado.pendientes, [44, 45]);
  assert.deepEqual(cerrado.noUtilizados, [46, 47, 48, 49, 50]);
  assert.equal(cerrado.estado, 'cerrado');

  // Cerrado sin saber el último (teléfono perdido): lo que falta queda no utilizado.
  const perdido = clasificarNumeros({ ...talonario, cierre: { ultimoUsado: null } }, [41]);
  assert.deepEqual(perdido.noUtilizados, [42, 43, 44, 45, 46, 47, 48, 49, 50]);

  const completo = clasificarNumeros({ desde: 7, hasta: 7, cierre: null }, [7]);
  assert.equal(completo.estado, 'completo');
});

test('el RIM web exige firmas PNG, datos del contacto y a lo sumo 5 fotos', () => {
  const rim = parse('registroWeb', registroWeb());
  assert.equal(rim.uuid, '3f2a8c1e-7b4d-4e9a-a1c2-5d6e7f8091ab');
  assert.equal(rim.cliente.nit, '1020304050');
  assert.deepEqual(rim.firmaCliente, PNG);
  assert.equal(rim.fotos[0].contenido.tipo, 'image/jpeg');
  assert.deepEqual(rim.danos, { scratches: ['platform', 'display'] });
  // Sin pruebas, la descripción no se guarda.
  assert.equal(rim.descripcionPruebas, null);

  const sinPng = `data:image/png;base64,${Buffer.from('no es png').toString('base64')}`;
  assert.throws(() => parse('registroWeb', registroWeb({ firmaCliente: sinPng })), /PNG/);
  assert.throws(() => parse('registroWeb', registroWeb({ firmaRepresentante: undefined })), /representante/);
  assert.throws(() => parse('registroWeb', registroWeb({ contacto: { ...registroWeb().contacto, correo: 'x' } })), /correo/);
  assert.throws(() => parse('registroWeb', registroWeb({ fotos: Array(6).fill({ contenido: foto }) })), /5 fotos/);
  assert.throws(() => parse('registroWeb', registroWeb({ fotos: [{ contenido: 'data:image/gif;base64,R0lG' }] })), /formato/);
  assert.throws(() => parse('registroWeb', registroWeb({ motivo: '' })), /motivo/);
  assert.throws(() => parse('registroWeb', registroWeb({ inventario: { items: { 'x]; DROP': 'present' } } })));
});

test('el RIM web se guarda como registro directo de DataMET+ con su número', () => {
  const rim = parse('registroWeb', registroWeb());
  const columns = webRimColumns(rim, { usuario: 'recepcion', nombre: 'Rosa Mamani', gestion: 2026, numero: 57 });
  const values = Object.fromEntries(columns.map(column => [column.name, column.value]));
  assert.equal(values.codigo_rim, 'RIM-26-0057');
  assert.equal(values.origen, 'datametplus');
  assert.equal(values.gestion, 2026);
  assert.equal(values.numero, 57);
  assert.equal(values.tipo_servicio, 'directo');
  assert.equal(values.reg_usuario, 'recepcion');
  assert.equal(values.reg_por, 'Rosa Mamani');
  assert.equal(values.nit, '1020304050');
  assert.equal(values.contacto_correo, 'juan@embol.com');
  assert.equal(values.division, '0.2');
  assert.equal(values.ubicacion, 'Despacho');
  assert.equal(values.descripcion_pruebas, null);
  assert.deepEqual(JSON.parse(values.inventario), {
    items: { indicator: 'present', loadCells: 'present' },
    quantities: { loadCells: '4' },
    others: [{ name: 'Cable RS232', status: 'present' }],
  });
  // La fecha de emisión y de registro las pone SQL Server.
  assert.equal('emitido_en' in values, false);
  assert.equal('fecha_reg' in values, false);
});
