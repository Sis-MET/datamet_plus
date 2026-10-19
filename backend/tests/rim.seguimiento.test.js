const test = require('node:test');
const assert = require('node:assert/strict');
const {
  etapaDe,
  hoyLaPaz,
  mapEjecucion,
  mapEntrega,
  mapSeguimiento,
  planEjecucion,
  planEntrega,
  seguimientoNoDisponible,
  tipoEjecucion,
} = require('../src/services/rim.seguimiento');
const {
  buildEjecucionInsert,
  buildEntregaInsert,
  buildListQuery,
  mapDetalle,
  mapFila,
  notReady,
  tablesFor,
} = require('../src/services/rim.registros');
const { parse } = require('../src/services/rim.validation');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('firma')]);
const firma = `data:image/png;base64,${PNG.toString('base64')}`;
const UUID = '3f2a8c1e-7b4d-4e9a-a1c2-5d6e7f8091ab';
const tables = tablesFor('DataMET');

const contexto = { emitido: '2026-10-01', hoy: '2026-10-19' };
const params = (query) => Object.fromEntries(query.params.map(param => [param.name, param.value]));

/** Fila de form_rim_ejecucion tal como la devuelve filasEjecucion. */
const filaEjecucion = (overrides = {}) => ({
  id: 1, anterior_id: null, tipo: 'registro', motivo: null,
  recepcion_st: 'Rosa Mamani', fecha_ingreso: '2026-10-02', tecnico_asignado: 'Luis Choque',
  fecha_inicio: null, fecha_informe: null, fecha_conclusion: null,
  nro_cotizacion: 'COT-26-118', nro_informe: null, nro_factura: null,
  usuario: 'rmamani', usuario_nombre: 'Rosa Mamani', fecha_reg_texto: '2026-10-02T09:15:00',
  ...overrides,
});

/** Fila de form_rim_entregas tal como la devuelve filasEntrega. */
const filaEntrega = (overrides = {}) => ({
  id: 1, anterior_id: null, tipo: 'registro', motivo: null,
  recibe_nombre: 'Juan Pérez', entrega_por: 'Ing. Ana Quispe', fecha_entrega: '2026-10-15',
  lugar_entrega: 'Laboratorio Métrica', observaciones: null,
  firma_cliente: PNG, firma_representante: PNG,
  usuario: 'aquispe', usuario_nombre: 'Ana Quispe', fecha_reg_texto: '2026-10-15T16:40:00',
  ...overrides,
});

const ejecucion = (overrides = {}) => parse('ejecucion', {
  anteriorId: 1,
  recepcionSt: 'Rosa Mamani', fechaIngreso: '2026-10-02', tecnicoAsignado: 'Luis Choque',
  nroCotizacion: 'COT-26-118',
  ...overrides,
});

const entrega = (overrides = {}) => parse('entrega', {
  accion: 'registro', anteriorId: null,
  recibeNombre: 'Juan Pérez', entregaPor: 'Ing. Ana Quispe', fechaEntrega: '2026-10-15',
  lugarEntrega: 'Laboratorio Métrica', firmaCliente: firma, firmaRepresentante: firma,
  ...overrides,
});

const falla = (fn, statusCode, mensaje) => assert.throws(fn, (error) => {
  assert.equal(error.statusCode, statusCode);
  if (mensaje) assert.match(error.message, mensaje);
  return true;
});

test('la fecha de hoy es la de La Paz', () => {
  // 19/10/2026 22:30 en La Paz = 20/10/2026 02:30 UTC.
  assert.equal(hoyLaPaz(new Date('2026-10-20T02:30:00Z')), '2026-10-19');
});

test('la ejecución distingue registro, avance y corrección', () => {
  const vigente = { recepcionSt: 'Rosa', fechaIngreso: '2026-10-02', fechaInicio: null };
  assert.equal(tipoEjecucion(null, { recepcionSt: 'Rosa' }).tipo, 'registro');
  // Completar un campo vacío es un avance.
  assert.equal(tipoEjecucion(vigente, { ...vigente, fechaInicio: '2026-10-03' }).tipo, 'avance');
  // Cambiar o borrar un dato ya registrado es una corrección.
  const cambio = tipoEjecucion(vigente, { ...vigente, recepcionSt: 'Rosa Mamani' });
  assert.equal(cambio.tipo, 'correccion');
  assert.deepEqual(cambio.cambios, [{ campo: 'recepcionSt', antes: 'Rosa', despues: 'Rosa Mamani' }]);
  assert.equal(tipoEjecucion(vigente, { ...vigente, fechaIngreso: null }).tipo, 'correccion');
  assert.equal(tipoEjecucion(vigente, vigente).tipo, null);
});

test('la ejecución se valida y normaliza: vacíos en null y fechas del calendario', () => {
  const datos = parse('ejecucion', { anteriorId: '', recepcionSt: '  Rosa  ', fechaIngreso: '', nroFactura: 12 });
  assert.equal(datos.anteriorId, null);
  assert.equal(datos.recepcionSt, 'Rosa');
  assert.equal(datos.fechaIngreso, null);
  assert.equal(datos.nroFactura, '12');
  falla(() => parse('ejecucion', { fechaInicio: '19/10/2026' }), 400, /Fecha/);
  falla(() => parse('ejecucion', { nroInforme: 'x'.repeat(61) }), 400, /60/);
});

test('cualquiera registra y completa la ejecución; corregir es de jefes y exige motivo', () => {
  const filas = [filaEjecucion()];

  // Primera versión: sin filas, anteriorId null.
  const primera = planEjecucion({ filas: [], nueva: ejecucion({ anteriorId: null }), ...contexto, puedeCorregir: false });
  assert.equal(primera.tipo, 'registro');
  assert.equal(primera.anteriorId, null);
  assert.equal(primera.motivo, null);

  // Un técnico completa la fecha de inicio: avance, sin motivo.
  const avance = planEjecucion({ filas, nueva: ejecucion({ fechaInicio: '2026-10-03' }), ...contexto, puedeCorregir: false });
  assert.equal(avance.tipo, 'avance');
  assert.equal(avance.anteriorId, 1);
  assert.equal(avance.datos.fechaInicio, '2026-10-03');

  // Cambiar el técnico asignado es una corrección: solo jefes y con motivo.
  const cambio = ejecucion({ tecnicoAsignado: 'Mario Flores' });
  falla(() => planEjecucion({ filas, nueva: cambio, ...contexto, puedeCorregir: false }), 403, /completar los campos vacíos/);
  falla(() => planEjecucion({ filas, nueva: cambio, ...contexto, puedeCorregir: true }), 400, /motivo/);
  const correccion = planEjecucion({
    filas, nueva: { ...cambio, motivo: 'Se reasignó por vacaciones del técnico' }, ...contexto, puedeCorregir: true,
  });
  assert.equal(correccion.tipo, 'correccion');
  assert.equal(correccion.motivo, 'Se reasignó por vacaciones del técnico');
  assert.deepEqual(correccion.cambios, [{ campo: 'tecnicoAsignado', antes: 'Luis Choque', despues: 'Mario Flores' }]);

  // Una corrección puede dejar la sección vacía (se cargó en otro RIM).
  const vacia = planEjecucion({
    filas,
    nueva: parse('ejecucion', { anteriorId: 1, motivo: 'Se registró en el RIM equivocado' }),
    ...contexto,
    puedeCorregir: true,
  });
  assert.equal(vacia.tipo, 'correccion');

  falla(() => planEjecucion({ filas, nueva: ejecucion(), ...contexto, puedeCorregir: true }), 400, /No hay cambios/);
  falla(() => planEjecucion({ filas: [], nueva: parse('ejecucion', {}), ...contexto, puedeCorregir: true }), 400, /al menos un dato/);
});

test('si otro usuario guardó antes, la ejecución responde 409', () => {
  const filas = [filaEjecucion(), filaEjecucion({ id: 2, anterior_id: 1, tipo: 'avance', fecha_inicio: '2026-10-03' })];
  // Se editaba la versión 1, pero la vigente ya es la 2.
  falla(() => planEjecucion({ filas, nueva: ejecucion({ anteriorId: 1, fechaInforme: '2026-10-10' }), ...contexto, puedeCorregir: true }), 409, /Recarga/);
  falla(() => planEjecucion({ filas: [], nueva: ejecucion({ anteriorId: 4 }), ...contexto, puedeCorregir: true }), 409);
});

test('las fechas de la ejecución son coherentes con el RIM', () => {
  const plan = (overrides) => () => planEjecucion({
    filas: [], nueva: ejecucion({ anteriorId: null, ...overrides }), ...contexto, puedeCorregir: true,
  });
  falla(plan({ fechaIngreso: '2026-10-20' }), 400, /ingreso a S\.T\. no puede ser futura/);
  falla(plan({ fechaIngreso: '2026-09-30' }), 400, /anterior a la emisión del RIM \(01\/10\/2026\)/);
  falla(plan({ fechaInicio: '2026-10-01' }), 400, /inicio no puede ser anterior al ingreso/);
  falla(plan({ fechaInicio: '2026-10-05', fechaInforme: '2026-10-04' }), 400, /informe no puede ser anterior/);
  falla(plan({ fechaInicio: '2026-10-05', fechaConclusion: '2026-10-04' }), 400, /conclusión no puede ser anterior/);
  assert.equal(plan({ fechaInicio: '2026-10-02', fechaInforme: '2026-10-19', fechaConclusion: '2026-10-19' })().tipo, 'registro');
});

test('la entrega exige las dos firmas PNG; corregir y anular, el motivo', () => {
  const registro = entrega();
  assert.deepEqual(registro.firmaCliente, PNG);
  assert.equal(registro.observaciones, null);
  falla(() => entrega({ firmaCliente: undefined }), 400, /quien recibe/);
  falla(() => entrega({ firmaRepresentante: `data:image/png;base64,${Buffer.from('no').toString('base64')}` }), 400, /PNG/);
  falla(() => entrega({ recibeNombre: 'J' }), 400, /quien recibe/);
  falla(() => entrega({ fechaEntrega: '' }), 400, /Fecha/);
  falla(() => parse('entrega', { accion: 'correccion', anteriorId: 1, recibeNombre: 'Juan Pérez', entregaPor: 'Ana Quispe', fechaEntrega: '2026-10-15', lugarEntrega: 'Lab' }), 400, /motivo de la corrección/);
  falla(() => parse('entrega', { accion: 'anulacion', anteriorId: 1, motivo: 'error' }), 400, /al menos 10/);
  falla(() => parse('entrega', { accion: 'borrar' }), 400, /registra, corrige o anula/);
  // La corrección no recibe firmas: se conservan las registradas.
  const correccion = parse('entrega', {
    accion: 'correccion', anteriorId: 1, recibeNombre: 'Juan Pérez', entregaPor: 'Ana Quispe',
    fechaEntrega: '2026-10-15', lugarEntrega: 'Lab', motivo: 'El lugar estaba mal escrito', firmaCliente: firma,
  });
  assert.equal('firmaCliente' in correccion, false);
});

test('la entrega se registra una vez; la corrigen o anulan los jefes', () => {
  const primera = planEntrega({ filas: [], entrada: entrega(), ...contexto, puedeCorregir: false });
  assert.equal(primera.tipo, 'registro');
  assert.equal(primera.anteriorId, null);
  assert.deepEqual(primera.firmas, { cliente: PNG, representante: PNG });

  const filas = [filaEntrega()];
  falla(() => planEntrega({ filas, entrada: entrega({ anteriorId: 1 }), ...contexto, puedeCorregir: true }), 409, /ya está registrada/);

  const corregir = (overrides = {}) => parse('entrega', {
    accion: 'correccion', anteriorId: 1, recibeNombre: 'Juan Pérez', entregaPor: 'Ing. Ana Quispe',
    fechaEntrega: '2026-10-15', lugarEntrega: 'Planta Río Seco', motivo: 'Se entregó en planta, no en el laboratorio',
    ...overrides,
  });
  falla(() => planEntrega({ filas, entrada: corregir(), ...contexto, puedeCorregir: false }), 403, /jefes de área/);
  const correccion = planEntrega({ filas, entrada: corregir(), ...contexto, puedeCorregir: true });
  assert.equal(correccion.tipo, 'correccion');
  assert.equal(correccion.anteriorId, 1);
  assert.deepEqual(correccion.cambios, [{ campo: 'lugarEntrega', antes: 'Laboratorio Métrica', despues: 'Planta Río Seco' }]);
  falla(() => planEntrega({ filas, entrada: corregir({ lugarEntrega: 'Laboratorio Métrica' }), ...contexto, puedeCorregir: true }), 400, /No hay cambios/);
  falla(() => planEntrega({ filas, entrada: corregir({ fechaEntrega: '2026-10-20' }), ...contexto, puedeCorregir: true }), 400, /futura/);

  const anular = parse('entrega', { accion: 'anulacion', anteriorId: 1, motivo: 'Se registró en el RIM equivocado' });
  falla(() => planEntrega({ filas, entrada: anular, ...contexto, puedeCorregir: false }), 403);
  const anulacion = planEntrega({ filas, entrada: anular, ...contexto, puedeCorregir: true });
  assert.equal(anulacion.tipo, 'anulacion');
  assert.equal(anulacion.datos, null);

  // Después de anularla, cualquiera registra la correcta, apuntando a la anulación.
  const anulada = [...filas, filaEntrega({ id: 2, anterior_id: 1, tipo: 'anulacion', motivo: 'RIM equivocado', recibe_nombre: null })];
  falla(() => planEntrega({ filas: anulada, entrada: corregir({ anteriorId: 2 }), ...contexto, puedeCorregir: true }), 409, /No hay una entrega vigente/);
  const nueva = planEntrega({ filas: anulada, entrada: entrega({ anteriorId: 2 }), ...contexto, puedeCorregir: false });
  assert.equal(nueva.tipo, 'registro');
  assert.equal(nueva.anteriorId, 2);

  // La fecha no puede ser anterior a la emisión del RIM.
  falla(() => planEntrega({ filas: [], entrada: entrega({ fechaEntrega: '2026-09-30' }), ...contexto, puedeCorregir: true }), 400, /emisión/);
  // Otro usuario la registró mientras tanto.
  falla(() => planEntrega({ filas, entrada: entrega(), ...contexto, puedeCorregir: true }), 409, /Recarga/);
});

test('el historial de la ejecución muestra qué cambió en cada versión', () => {
  const resultado = mapEjecucion([
    filaEjecucion({ id: 7, anterior_id: 3, tipo: 'correccion', motivo: 'Técnico reasignado', tecnico_asignado: 'Mario Flores', fecha_inicio: '2026-10-03', usuario: 'jefe', usuario_nombre: null, fecha_reg_texto: '2026-10-04T08:00:00' }),
    filaEjecucion({ id: 1 }),
    filaEjecucion({ id: 3, anterior_id: 1, tipo: 'avance', fecha_inicio: '2026-10-03', fecha_reg_texto: '2026-10-03T10:00:00' }),
  ]);
  assert.equal(resultado.vigente.id, 7);
  assert.equal(resultado.vigente.datos.tecnicoAsignado, 'Mario Flores');
  assert.equal(resultado.vigente.registradoEn, '2026-10-04T08:00:00-04:00');
  assert.deepEqual(resultado.historial.map(version => version.id), [7, 3, 1]);
  assert.equal(resultado.historial[0].tipoLabel, 'Corrección');
  assert.equal(resultado.historial[0].motivo, 'Técnico reasignado');
  assert.deepEqual(resultado.historial[0].cambios, [{ campo: 'tecnicoAsignado', antes: 'Luis Choque', despues: 'Mario Flores' }]);
  assert.deepEqual(resultado.historial[1].cambios, [{ campo: 'fechaInicio', antes: null, despues: '2026-10-03' }]);
  // La primera versión muestra todo lo que se registró.
  assert.equal(resultado.historial[2].cambios.length, 4);
  assert.deepEqual(mapEjecucion([]), { vigente: null, historial: [] });
});

test('la entrega vigente trae sus firmas; anulada, no hay entrega vigente', () => {
  const corregida = mapEntrega([
    filaEntrega({ firma_cliente: null, firma_representante: null }),
    filaEntrega({ id: 2, anterior_id: 1, tipo: 'correccion', motivo: 'Lugar mal escrito', lugar_entrega: 'Planta Río Seco' }),
  ]);
  assert.equal(corregida.vigente.id, 2);
  assert.equal(corregida.ultimaId, 2);
  assert.equal(corregida.vigente.firmas.cliente, firma);
  assert.equal(corregida.vigente.datos.lugarEntrega, 'Planta Río Seco');
  assert.deepEqual(corregida.historial[0].cambios, [{ campo: 'lugarEntrega', antes: 'Laboratorio Métrica', despues: 'Planta Río Seco' }]);
  assert.equal(corregida.historial[1].datos.recibeNombre, 'Juan Pérez');

  const anulada = mapEntrega([
    filaEntrega({ firma_cliente: null, firma_representante: null }),
    filaEntrega({ id: 2, anterior_id: 1, tipo: 'anulacion', motivo: 'RIM equivocado', recibe_nombre: null, entrega_por: null, fecha_entrega: null, lugar_entrega: null, firma_cliente: null, firma_representante: null }),
  ]);
  assert.equal(anulada.vigente, null);
  assert.equal(anulada.ultimaId, 2);
  assert.equal(anulada.historial[0].tipoLabel, 'Anulación');
  assert.equal(anulada.historial[0].datos, null);
});

test('la etapa avanza de recibido a entregado', () => {
  const vacia = { ejecucion: { vigente: null }, entrega: { vigente: null } };
  assert.equal(etapaDe(vacia), 'recibido');
  assert.equal(etapaDe({ ...vacia, ejecucion: { vigente: { datos: { recepcionSt: 'Rosa', fechaConclusion: null } } } }), 'en_ejecucion');
  assert.equal(etapaDe({ ...vacia, ejecucion: { vigente: { datos: { fechaConclusion: '2026-10-10' } } } }), 'concluido');
  // Una ejecución vaciada por corrección vuelve a «recibido».
  assert.equal(etapaDe({ ...vacia, ejecucion: { vigente: { datos: { recepcionSt: null } } } }), 'recibido');
  // Se puede entregar sin concluir (se devuelve sin servicio).
  assert.equal(etapaDe({ ...vacia, entrega: { vigente: { id: 1 } } }), 'entregado');
});

test('las acciones de la ficha dependen del permiso y de si el RIM está anulado', () => {
  const filas = { ejecucion: [filaEjecucion()], entregas: [] };
  const tecnico = mapSeguimiento(filas, { anulado: false, puedeCorregir: false });
  assert.equal(tecnico.etapa, 'en_ejecucion');
  assert.equal(tecnico.etapaLabel, 'En ejecución');
  assert.deepEqual(tecnico.acciones, {
    registrarEjecucion: false, completarEjecucion: true, corregirEjecucion: false,
    registrarEntrega: true, corregirEntrega: false, anularEntrega: false,
  });

  // Con la ejecución completa, un técnico ya no tiene nada que completar.
  const completa = filaEjecucion({ fecha_inicio: '2026-10-03', fecha_informe: '2026-10-05', fecha_conclusion: '2026-10-05', nro_informe: 'INF-1', nro_factura: 'F-9' });
  assert.equal(mapSeguimiento({ ejecucion: [completa], entregas: [] }, { anulado: false, puedeCorregir: false }).acciones.completarEjecucion, false);
  assert.equal(mapSeguimiento({ ejecucion: [completa], entregas: [] }, { anulado: false, puedeCorregir: true }).acciones.completarEjecucion, true);

  const jefe = mapSeguimiento({ ejecucion: [], entregas: [filaEntrega()] }, { anulado: false, puedeCorregir: true });
  assert.equal(jefe.etapa, 'entregado');
  assert.equal(jefe.acciones.registrarEjecucion, true);
  assert.equal(jefe.acciones.registrarEntrega, false);
  assert.equal(jefe.acciones.corregirEntrega, true);
  assert.equal(jefe.acciones.anularEntrega, true);

  // En un RIM anulado se ve todo, pero no se registra nada.
  const anulado = mapSeguimiento({ ejecucion: [filaEjecucion()], entregas: [filaEntrega()] }, { anulado: true, puedeCorregir: true });
  assert.equal(Object.values(anulado.acciones).some(Boolean), false);
  assert.equal(anulado.entrega.vigente.datos.recibeNombre, 'Juan Pérez');
});

test('la ficha lleva el seguimiento y la etapa; sin el script 016, el aviso', () => {
  const fila = {
    n: 15, uuid: UUID.toUpperCase(), codigo_rim: 'RIM-26-0042', gestion: 2026, numero: 42, origen: 'servicemet',
    tipo_servicio: 'soporte', emitido_en: new Date('2026-10-01T18:30:00Z'), anulacion_id: null, inventario: '{}', danos: '{}',
  };
  const seguimiento = mapSeguimiento({ ejecucion: [filaEjecucion()], entregas: [] }, { anulado: false, puedeCorregir: false });
  const detalle = mapDetalle(fila, { user: { acceso_cron: '1' }, seguimiento });
  assert.equal(detalle.etapa, 'en_ejecucion');
  assert.equal(detalle.seguimiento.ejecucion.vigente.datos.recepcionSt, 'Rosa Mamani');

  const sinScript = mapDetalle(fila, { seguimiento: seguimientoNoDisponible('Falta el script 016') });
  assert.equal(sinScript.etapa, null);
  assert.equal(sinScript.seguimiento.disponible, false);
  assert.equal(Object.values(sinScript.seguimiento.acciones).some(Boolean), false);

  assert.equal(mapFila({ ...fila, etapa: 'concluido' }).etapa, 'concluido');
  assert.equal(mapFila(fila).etapa, null);
});

test('los errores de las tablas nuevas se reconocen como falta del script 016', () => {
  const faltaTabla = notReady({ number: 208, message: "Invalid object name 'DataMET.dbo.form_rim_ejecucion'." });
  assert.equal(faltaTabla.statusCode, 503);
  assert.equal(faltaTabla.faltaSeguimiento, true);
  assert.match(faltaTabla.message, /script 016/);
  const sinPermiso = notReady({ number: 229, message: "The SELECT permission was denied on the object 'form_rim_entregas', database 'DataMET', schema 'dbo'." });
  assert.equal(sinPermiso.faltaSeguimiento, true);
  assert.match(sinPermiso.message, /@loginDataMetPlus en el script 016/);
  // Las tablas del script 014 siguen con su propio aviso.
  const falta014 = notReady({ number: 208, message: "Invalid object name 'DataMET.dbo.form_rim_anulaciones'." });
  assert.equal(falta014.faltaSeguimiento, undefined);
  assert.match(falta014.message, /scripts 012 y 014 de ServiceMET en DataMET/);
});

test('el historial calcula la etapa y filtra por ella', () => {
  const query = buildListQuery(parse('filtros', { etapa: 'concluido' }), tables);
  assert.match(query.rows.text, /OUTER APPLY \(\s+SELECT TOP \(1\) e\.fecha_conclusion/);
  assert.match(query.rows.text, /FROM \[DataMET\]\.\[dbo\]\.\[form_rim_entregas\] en/);
  assert.match(query.rows.text, /s\.etapa,/);
  assert.match(query.rows.text, /WHERE s\.etapa = @etapa/);
  assert.match(query.counts.text, /WHERE s\.etapa = @etapa/);
  assert.equal(params(query.rows).etapa, 'concluido');

  // Sin el script 016 se lista sin etapa.
  const sinSeguimiento = buildListQuery(parse('filtros', {}), tables, { seguimiento: false });
  assert.doesNotMatch(sinSeguimiento.rows.text, /form_rim_ejecucion|s\.etapa/);
  assert.throws(() => buildListQuery(parse('filtros', { etapa: 'entregado' }), tables, { seguimiento: false }));
  falla(() => parse('filtros', { etapa: 'perdido' }), 400);
});

test('la ejecución solo se agrega: INSERT con el usuario de la sesión, nunca UPDATE ni DELETE', () => {
  const plan = planEjecucion({ filas: [filaEjecucion()], nueva: ejecucion({ fechaInicio: '2026-10-03' }), ...contexto, puedeCorregir: false });
  const query = buildEjecucionInsert({ uuid: UUID, plan, usuario: 'lchoque', nombre: 'Luis Choque' }, tables);
  assert.match(query.text, /INSERT INTO \[DataMET\]\.\[dbo\]\.\[form_rim_ejecucion\]/);
  assert.match(query.text, /IF EXISTS \(SELECT 1 FROM \[DataMET\]\.\[dbo\]\.\[form_rim_anulaciones\] WHERE rim_uuid = @uuid\)\s+THROW 51050/);
  assert.match(query.text, /CONVERT\(date, @fecha_inicio, 23\)/);
  assert.doesNotMatch(query.text, /UPDATE|DELETE|fecha_reg/i);
  const values = params(query);
  assert.equal(values.tipo, 'avance');
  assert.equal(values.anterior_id, 1);
  assert.equal(values.usuario, 'lchoque');
  assert.equal(values.nombre, 'Luis Choque');
  assert.equal(values.fecha_inicio, '2026-10-03');
  assert.equal(values.recepcion_st, 'Rosa Mamani');
});

test('la entrega solo se agrega; la corrección copia las firmas de la fila anterior', () => {
  const registro = buildEntregaInsert({
    uuid: UUID, plan: planEntrega({ filas: [], entrada: entrega(), ...contexto, puedeCorregir: false }), usuario: 'aquispe', nombre: null,
  }, tables);
  assert.match(registro.text, /VALUES \(@uuid, @anterior_id, @tipo, NULL, .*@firma_cliente, @firma_representante/s);
  assert.deepEqual(params(registro).firma_cliente, PNG);

  const correccion = buildEntregaInsert({
    uuid: UUID,
    plan: planEntrega({
      filas: [filaEntrega()],
      entrada: parse('entrega', {
        accion: 'correccion', anteriorId: 1, recibeNombre: 'Juan Pérez', entregaPor: 'Ing. Ana Quispe',
        fechaEntrega: '2026-10-14', lugarEntrega: 'Laboratorio Métrica', motivo: 'La fecha era el 14, no el 15',
      }),
      ...contexto,
      puedeCorregir: true,
    }),
    usuario: 'jefe',
    nombre: 'Jefe de Soporte',
  }, tables);
  assert.match(correccion.text, /SELECT @uuid, @anterior_id, @tipo, @motivo, .*p\.firma_cliente, p\.firma_representante/s);
  assert.match(correccion.text, /WHERE p\.id = @anterior_id AND p\.rim_uuid = @uuid/);
  assert.equal('firma_cliente' in params(correccion), false);
  assert.equal(params(correccion).fecha_entrega, '2026-10-14');

  const anulacion = buildEntregaInsert({
    uuid: UUID,
    plan: planEntrega({
      filas: [filaEntrega()],
      entrada: parse('entrega', { accion: 'anulacion', anteriorId: 1, motivo: 'Se registró en el RIM equivocado' }),
      ...contexto,
      puedeCorregir: true,
    }),
    usuario: 'jefe',
    nombre: null,
  }, tables);
  assert.match(anulacion.text, /VALUES \(@uuid, @anterior_id, @tipo, @motivo, NULL, NULL, NULL, NULL, NULL, NULL, NULL,/);
  assert.equal(params(anulacion).recibe_nombre, null);

  for (const query of [registro, correccion, anulacion]) {
    assert.doesNotMatch(query.text, /UPDATE|DELETE/i);
    assert.match(query.text, /THROW 51050/);
  }
});
