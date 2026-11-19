const test = require('node:test');
const assert = require('node:assert/strict');
const dom = require('../src/services/comercial.bitrix.domain');
const { leerConfigBitrix } = require('../src/services/comercial.bitrix.config');
const { buildNegociacionesWhere } = require('../src/services/comercial.bitrix');
const { parse } = require('../src/services/comercial.validation');

// Campos como los devuelve crm.deal.fields (solo los que se usan aquí).
const CAMPOS = {
  ID: { title: 'ID' },
  UF_CRM_1681094866257: { type: 'string', listLabel: 'COTIZACIÓN' },
  UF_CRM_1751396548628: { type: 'string', listLabel: 'COTIZACIÓN SERVICIO INTERNO CALIBRACIÓN' },
  UF_CRM_1728315917014: { type: 'enumeration', listLabel: 'Regional', items: [{ ID: '253', VALUE: 'La Paz' }, { ID: '255', VALUE: 'Santa Cruz' }] },
  UF_CRM_1727813705855: { type: 'enumeration', listLabel: 'SUB ÁREA', items: [{ ID: '147', VALUE: 'STIL' }, { ID: '149', VALUE: 'STAC' }] },
  UF_CRM_1751393545: {
    type: 'enumeration', listLabel: 'TIPO DE SERVICIO ST',
    items: [{ ID: '591', VALUE: 'Diagnostico' }, { ID: '595', VALUE: 'Mant. Preventivo Regular' }, { ID: '597', VALUE: 'Mant. Preventivo Avanzado' }],
  },
  UF_CRM_1769526208280: { type: 'enumeration', listLabel: 'TECNICO RESPONSABLE', items: [{ ID: '1', VALUE: 'Mario Peña' }] },
  UF_CRM_1727813124836: { type: 'enumeration', listLabel: 'TÉCNICOS DE APOYO', items: [{ ID: '2', VALUE: 'Luisa Roca' }, { ID: '3', VALUE: 'No Aplica' }] },
  UF_CRM_1727888565077: { type: 'double', listLabel: 'Num Balanzas' },
  UF_CRM_1742335643559: { type: 'string', listLabel: 'NOTA DE SALIDA' },
  // Un campo que cambió de código: se encuentra por su nombre.
  UF_CRM_9999: { type: 'string', listLabel: 'MES A FACTURAR' },
};

const meta = () => ({
  embudos: new Map([[0, 'Ventas'], [1, 'Soporte Tecnico'], [21, 'Calibración']]),
  etapas: new Map([
    ['C21:FINAL_INVOICE', { nombre: 'Para Facturar', semantica: 'process' }],
    ['C21:UC_UAOYL5', { nombre: 'Pendiente de pago', semantica: 'process' }],
    ['C1:WON', { nombre: 'Cerrado Ganado', semantica: 'success' }],
    ['C1:LOSE', { nombre: 'Cerrado Perdido', semantica: 'failure' }],
  ]),
  campos: dom.resolverCampos(CAMPOS),
});

const CATEGORIAS = new Map([
  ['CAL-BLZ', { id: 19, codigo: 'CAL-BLZ', nombre: 'Calibración de balanzas' }],
  ['CAL-PSP', { id: 20, codigo: 'CAL-PSP', nombre: 'Calibración de pesas' }],
  ['ST-STAC-MPR', { id: 9, codigo: 'ST-STAC-MPR', nombre: 'Mantenimiento preventivo regular (STAC)' }],
  ['ST-STAC-DIAG', { id: 7, codigo: 'ST-STAC-DIAG', nombre: 'Diagnóstico (STAC)' }],
  ['ST-STIL-MPR', { id: 3, codigo: 'ST-STIL-MPR', nombre: 'Mantenimiento preventivo (STIL)' }],
]);

test('configuración: sin webhook no se sincroniza y el secreto no sale del portal', () => {
  assert.equal(leerConfigBitrix({}).configurado, false);
  const c = leerConfigBitrix({ BITRIX_WEBHOOK_URL: 'https://b24-prueba.bitrix24.es/rest/7/abc123XYZ/', BITRIX_SYNC_MINUTOS: '2' });
  assert.equal(c.configurado, true);
  assert.equal(c.portal, 'https://b24-prueba.bitrix24.es');
  assert.equal(c.minutos, 5);
  assert.equal(c.desde, '2025-01-01');
  assert.match(leerConfigBitrix({ BITRIX_WEBHOOK_URL: 'http://b24.bitrix24.es/rest/7/abc/' }).error, /HTTPS/);
  assert.match(leerConfigBitrix({ BITRIX_WEBHOOK_URL: 'https://b24.bitrix24.es/crm/deal/' }).error, /forma/);
  assert.equal(leerConfigBitrix({ BITRIX_WEBHOOK_URL: 'https://b24.bitrix24.es/rest/7/abc/', BITRIX_SYNC_ENABLED: 'false' }).sincronizar, false);
  // Escribir en Bitrix24 se habilita solo a propósito: por omisión, desactivada.
  assert.equal(c.escritura, 'desactivada');
  assert.equal(leerConfigBitrix({ BITRIX_ESCRITURA: 'prueba' }).escritura, 'prueba');
  assert.equal(leerConfigBitrix({ BITRIX_ESCRITURA: ' Real ' }).escritura, 'real');
  assert.equal(leerConfigBitrix({ BITRIX_ESCRITURA: 'si' }).escritura, 'desactivada');
});

test('campos: por su código conocido o por su nombre si cambió', () => {
  const { mapa, opciones } = dom.resolverCampos(CAMPOS);
  assert.equal(mapa.cotizacion, 'UF_CRM_1681094866257');
  assert.equal(mapa.mesFacturar, 'UF_CRM_9999');
  assert.equal(mapa.ordenCompra, null);
  assert.equal(opciones.regional['255'], 'Santa Cruz');
});

test('fases de las etapas por su semántica y su nombre', () => {
  assert.equal(dom.faseDe({ nombre: 'Para Facturar', semantica: 'process' }), 'FACTURAR');
  assert.equal(dom.faseDe({ nombre: 'Pre-Factura', semantica: 'process' }), 'FACTURAR');
  assert.equal(dom.faseDe({ nombre: 'Entrega y/o Facturación', semantica: 'process' }), 'FACTURAR');
  assert.equal(dom.faseDe({ nombre: 'Facturado', semantica: 'process' }), 'COBRO');
  assert.equal(dom.faseDe({ nombre: 'Saldo pendiente de pago', semantica: 'process' }), 'COBRO');
  assert.equal(dom.faseDe({ nombre: 'Cerrado Ganado', semantica: 'success' }), 'GANADA');
  assert.equal(dom.faseDe({ nombre: 'Analizar la falla', semantica: 'apology' }), 'PERDIDA');
  assert.equal(dom.faseDe({ nombre: 'Cotizados', semantica: 'process' }), 'PROCESO');
  assert.equal(dom.semanticaDe({ SEMANTICS: 'S' }), 'success');
  assert.equal(dom.semanticaDe({ EXTRA: { SEMANTICS: 'failure' } }), 'failure');
});

test('clave de cotización y código de cliente', () => {
  assert.equal(dom.claveCotizacion('0114-C04-25 1'), '114-C04-25');
  assert.equal(dom.claveCotizacion('114-c04-25'), '114-C04-25');
  assert.equal(dom.claveCotizacion('005-0199-1-26'), '5-0199-1-26');
  assert.equal(dom.clienteDeCotizacion('0114-C04-25 1'), '0114');
  assert.equal(dom.clienteDeCotizacion('195-S01-1-26'), '0195');
  assert.equal(dom.clienteDeCotizacion('005-0199-1-26'), '0199');
  assert.equal(dom.clienteDeEmpresa('0458-11'), '0458');
  assert.equal(dom.clienteDeEmpresa('458'), '0458');
  assert.equal(dom.clienteDeEmpresa('sin código'), null);
});

test('negociación → fila de la copia, con opciones, cotizaciones y fase', () => {
  const { fila, cotizaciones } = dom.mapNegociacion({
    ID: '5120', CATEGORY_ID: '21', STAGE_ID: 'C21:FINAL_INVOICE', TITLE: 'Calibración 6 balanzas', OPPORTUNITY: '3900.50', CURRENCY_ID: 'BOB',
    ASSIGNED_BY_ID: '41', COMPANY_ID: '880', DATE_CREATE: '2026-10-01T09:00:00-04:00', DATE_MODIFY: '2026-11-18T15:30:00-04:00',
    UF_CRM_1681094866257: 'COT 0999-C02-26 1', UF_CRM_1751396548628: '0999-C02-26 1 y 0999-C03-26 1',
    UF_CRM_1728315917014: '255', UF_CRM_1727888565077: '6', UF_CRM_1742335643559: 'NO APLICA',
  }, meta());
  assert.equal(fila.deal_id, 5120);
  assert.equal(fila.embudo, 'Calibración');
  assert.equal(fila.etapa, 'Para Facturar');
  assert.equal(fila.etapa_fase, 'FACTURAR');
  assert.equal(fila.monto, 3900.5);
  assert.equal(fila.regional, 'SCZ');
  assert.equal(fila.num_balanzas, 6);
  assert.equal(fila.empresa_id, 880);
  assert.equal(fila.modificada.toISOString(), '2026-11-18T19:30:00.000Z');
  assert.deepEqual(cotizaciones.map(c => [c.codigo, c.clave, c.campo]), [
    ['0999-C02-26 1', '999-C02-26', 'cotizacion'],
    ['0999-C03-26 1', '999-C03-26', 'cotizacionCalibracion'],
  ]);
});

test('cotización en el título cuando los campos no traen ninguna', () => {
  const base = { ID: '7', CATEGORY_ID: '21', STAGE_ID: 'C21:FINAL_INVOICE', TITLE: 'Calibración 0999-C04-26 1 planta norte' };
  assert.deepEqual(dom.mapNegociacion(base, meta()).cotizaciones, [{ codigo: '0999-C04-26 1', clave: '999-C04-26', campo: 'titulo' }]);
  const conCampo = dom.mapNegociacion({ ...base, UF_CRM_1681094866257: '0999-C05-26' }, meta()).cotizaciones;
  assert.deepEqual(conCampo.map(c => [c.clave, c.campo]), [['999-C05-26', 'cotizacion']]);
});

test('enlaces: la referencia manda; entre duplicadas se descartan las perdidas', () => {
  const enlaces = dom.enlazar({
    cotizaciones: [
      { dealId: 1, clave: '999-C02-26' }, { dealId: 2, clave: '999-C02-26' }, { dealId: 3, clave: '777-S01-1-26' },
    ],
    fases: new Map([[1, 'GANADA'], [2, 'PERDIDA'], [3, 'PERDIDA']]),
    referencias: [
      { facturaId: 10, tipo: 'COTIZACION', valor: '0999-C02-26 1' },
      { facturaId: 11, tipo: 'COTIZACION_CAL', valor: '777-S01-1-26' },
      { facturaId: 12, tipo: 'BITRIX', valor: '1' },
      { facturaId: 12, tipo: 'COTIZACION', valor: '0999-C02-26' },
      { facturaId: 13, tipo: 'NOTA_SALIDA', valor: 'NS-4401-2026' },
    ],
  });
  const ver = enlaces.map(e => `${e.dealId}:${e.facturaId}:${e.por}`).sort();
  assert.deepEqual(ver, ['1:10:COTIZACION', '1:12:REFERENCIA', '3:11:COTIZACION']);
});

test('responsables: se sugiere la persona de sus facturas si es clara', () => {
  const sugerencias = dom.sugerirUsuarios({
    enlaces: [{ dealId: 1, facturaId: 10 }, { dealId: 2, facturaId: 11 }, { dealId: 3, facturaId: 12 }, { dealId: 4, facturaId: 13 }],
    responsables: new Map([[1, 41], [2, 41], [3, 41], [4, 52]]),
    personas: new Map([
      [10, [{ rol: 'RESPONSABLE', usuarioId: 7 }]],
      [11, [{ rol: 'RESPONSABLE', usuarioId: 7 }]],
      [12, [{ rol: 'RESPONSABLE', usuarioId: 8 }]],
      [13, [{ rol: 'RESPONSABLE', usuarioId: 9 }]],
    ]),
  });
  assert.deepEqual(sugerencias.get(41), { usuarioId: 7, motivo: 'Responsable en 2 de 3 facturas de sus negociaciones' });
  assert.equal(sugerencias.has(52), false);
});

test('propuesta de factura desde una negociación de Calibración', () => {
  const neg = {
    deal_id: 5120, embudo: 'Calibración', monto: 3900.5, regional: 'SCZ', num_balanzas: 6, num_pesas: null, empresa: 'EJEMPLO SRL',
    empresa_nit: '1234567', nota_salida: null, cotizaciones: [{ codigo: '0999-C02-26 1', campo: 'cotizacion' }],
  };
  const propuesta = dom.propuestaFactura(neg, {
    cliente: { codigo: '0999', razonSocial: 'Cliente de Ejemplo S.R.L.', nit: '7654321' },
    categoriasPorCodigo: CATEGORIAS,
    responsable: { usuarioId: 7, nombre: 'Ana Comercial' },
    buscarPersona: () => null,
  });
  assert.equal(propuesta.razonSocial, 'Cliente de Ejemplo S.R.L.');
  assert.equal(propuesta.nit, '7654321');
  assert.deepEqual(propuesta.lineas, [{ categoriaId: 19, categoria: 'Calibración de balanzas', monto: 3900.5, cantidad: 6, regional: 'SCZ' }]);
  assert.deepEqual(propuesta.referencias, [{ tipo: 'COTIZACION', valor: '0999-C02-26 1' }, { tipo: 'BITRIX', valor: '5120' }]);
  assert.deepEqual(propuesta.personas, [{ rol: 'RESPONSABLE', usuarioId: 7, nombre: 'Ana Comercial', porcentaje: null }]);
  assert.deepEqual(propuesta.avisos, []);
});

test('propuesta de Soporte técnico: líneas por tipo de servicio y técnicos; avisos de lo que falta', () => {
  const neg = {
    deal_id: 77, embudo: 'Soporte Tecnico', monto: 2750, regional: 'LPZ', num_balanzas: 4, sub_area: 'STAC',
    tipos_servicio: 'Diagnostico · Mant. Preventivo Regular', tecnico: 'Mario Peña', apoyo: 'Luisa Roca',
    nota_salida: 'NS-4401-2026', cotizaciones: [], empresa: 'EMPRESA EN BITRIX', empresa_nit: '999',
  };
  const propuesta = dom.propuestaFactura(neg, {
    cliente: null,
    categoriasPorCodigo: CATEGORIAS,
    responsable: null,
    buscarPersona: (nombre) => (nombre === 'Mario Peña' ? { id: 30, nombre: 'Mario Peña' } : null),
    facturas: [{ numero: 120, gestion: 2026 }],
  });
  assert.deepEqual(propuesta.lineas.map(l => [l.categoriaId, l.monto, l.cantidad, l.regional]), [[7, null, 4, 'LPZ'], [9, null, null, 'LPZ']]);
  assert.deepEqual(propuesta.personas.map(p => [p.rol, p.usuarioId, p.nombre]), [['EJECUTO_ST', 30, 'Mario Peña'], ['APOYO_ST', null, 'Luisa Roca']]);
  assert.equal(propuesta.razonSocial, 'EMPRESA EN BITRIX');
  assert.ok(propuesta.referencias.some(r => r.tipo === 'NOTA_SALIDA' && r.valor === 'NS-4401-2026'));
  assert.deepEqual(propuesta.avisos.map(a => a.codigo), ['facturada', 'cliente', 'responsable', 'repartir']);
  assert.match(propuesta.avisos[0].texto, /N\.º 120/);
});

test('filtros de la lista de negociaciones', () => {
  const filtros = parse('filtrosBitrix', { q: '0999-C02', situacion: 'por_facturar', embudo: '21' });
  const con = buildNegociacionesWhere(filtros);
  assert.match(con.where, /s\.situacion = @situacion/);
  assert.match(con.where, /s\.embudo_id = @embudo/);
  assert.doesNotMatch(buildNegociacionesWhere(filtros, { conSituacion: false }).where, /situacion/);
  assert.throws(() => parse('filtrosBitrix', { situacion: 'otra' }), /Situación inválida/);
  assert.equal(parse('equivalencia', {}).usuarioId, null);
});

// ─── Fase 3: escribir de vuelta en Bitrix24 ────────────────────────────────

const etapa = (id, nombre, fase, orden, semantica = 'process') => ({ id, nombre, fase, orden, semantica });
const CAL = [
  etapa('C21:EXECUTING', 'Aprobados', 'PROCESO', 40), etapa('C21:FINAL_INVOICE', 'Para Facturar', 'FACTURAR', 50),
  etapa('C21:UC_UAOYL5', 'Pendiente de pago', 'COBRO', 51), etapa('C21:WON', 'Cerrado Ganado', 'GANADA', 60, 'success'),
  etapa('C21:LOSE', 'Cerrado Perdido', 'PERDIDA', 70, 'failure'),
];
const GOA = [
  etapa('C45:FINAL_INVOICE', 'Factura y cierre', 'FACTURAR', 100), etapa('C45:UC_77X8DO', 'Pendiente de pago', 'COBRO', 110),
  etapa('C45:UC_E4BTJF', 'Saldo pendiente de pago', 'COBRO', 120), etapa('C45:WON', 'Cerrado Ganado', 'GANADA', 130, 'success'),
];
const EJECUCION = [etapa('C9:NEW', 'Aprobado/confirmado/programado', 'PROCESO', 10), etapa('C9:WON', 'Cerrado Ganado', 'GANADA', 120, 'success')];
const VENTAS = [
  etapa('FINAL_INVOICE', 'Entrega y/o Facturación', 'FACTURAR', 80), etapa('UC_N3Y89D', 'Con pendiente de cierre', 'FACTURAR', 90),
  etapa('WON', 'Cerrado Ganado', 'GANADA', 100, 'success'),
];
const CAMPOS_PORTAL = { facturado: true, numeroFactura: true };
const plan = (neg, facturas, etapas, campos = CAMPOS_PORTAL) => dom.planBitrix({
  neg: { facturado: false, numeroFactura: null, ...neg }, facturas, etapas, campos,
});
const resumen = (p) => p.cambios.map(c => `${c.campo}:${typeof c.despues === 'object' ? c.despues.nombre : c.despues}`);

test('escritura: con factura pendiente marca facturado, número y la etapa de cobro', () => {
  const p = plan({ etapaId: 'C21:FINAL_INVOICE', fase: 'FACTURAR' }, [{ numero: 601, gestion: 2026, estado: 'pendiente' }, { numero: 594, gestion: 2026, estado: 'pendiente' }], CAL);
  assert.deepEqual(resumen(p), ['facturado:true', 'numeroFactura:594, 601', 'etapa:Pendiente de pago']);
  assert.deepEqual(p.cambios[2].antes, { id: 'C21:FINAL_INVOICE', nombre: 'Para Facturar' });
  assert.deepEqual(p.avisos, []);
});

test('escritura: pagada pasa a Cerrado Ganado; al día no cambia nada; nunca retrocede', () => {
  const pagada = [{ numero: 594, gestion: 2026, estado: 'pagada' }];
  assert.deepEqual(resumen(plan({ etapaId: 'C21:UC_UAOYL5', fase: 'COBRO', facturado: true, numeroFactura: '594' }, pagada, CAL)), ['cierre:Cerrado Ganado']);
  assert.deepEqual(plan({ etapaId: 'C21:WON', fase: 'GANADA', facturado: true, numeroFactura: ' 594 ' }, pagada, CAL).cambios, []);
  // Ya en cobro y sin pagar: no vuelve a «Para Facturar» ni se mueve.
  assert.deepEqual(resumen(plan({ etapaId: 'C21:UC_UAOYL5', fase: 'COBRO', facturado: true, numeroFactura: '594' }, [{ numero: 594, gestion: 2026, estado: 'pendiente' }], CAL)), []);
  // Sin factura vigente, nada.
  assert.deepEqual(plan({ etapaId: 'C21:FINAL_INVOICE', fase: 'FACTURAR' }, [], CAL), { cambios: [], avisos: [] });
});

test('escritura: pago parcial va a «Saldo pendiente de pago» si el embudo la tiene', () => {
  const p = plan({ etapaId: 'C45:FINAL_INVOICE', fase: 'FACTURAR', facturado: true, numeroFactura: '12' }, [{ numero: 12, gestion: 2026, estado: 'parcial' }], GOA);
  assert.deepEqual(resumen(p), ['etapa:Saldo pendiente de pago']);
  const sinPagar = plan({ etapaId: 'C45:FINAL_INVOICE', fase: 'FACTURAR', facturado: true, numeroFactura: '12' }, [{ numero: 12, gestion: 2026, estado: 'pendiente' }], GOA);
  assert.deepEqual(resumen(sinPagar), ['etapa:Pendiente de pago']);
});

test('escritura: perdida, embudos sin facturación o sin cobro y sin campo de número', () => {
  const pendiente = [{ numero: 5, gestion: 2026, estado: 'pendiente' }];
  const perdida = plan({ etapaId: 'C21:LOSE', fase: 'PERDIDA' }, pendiente, CAL);
  assert.deepEqual([perdida.cambios, perdida.avisos.map(a => a.codigo)], [[], ['perdida']]);
  const ejecucion = plan({ etapaId: 'C9:NEW', fase: 'PROCESO' }, [{ numero: 5, gestion: 2026, estado: 'pagada' }], EJECUCION);
  assert.deepEqual(resumen(ejecucion), ['facturado:true', 'numeroFactura:5']);
  assert.deepEqual(ejecucion.avisos.map(a => a.codigo), ['embudo_sin_facturacion']);
  const ventas = plan({ etapaId: 'FINAL_INVOICE', fase: 'FACTURAR', facturado: true, numeroFactura: '5' }, pendiente, VENTAS);
  assert.deepEqual([resumen(ventas), ventas.avisos.map(a => a.codigo)], [[], ['sin_etapa_cobro']]);
  const sinCampo = plan({ etapaId: 'C21:FINAL_INVOICE', fase: 'FACTURAR' }, pendiente, CAL, { facturado: true, numeroFactura: false });
  assert.deepEqual([resumen(sinCampo), sinCampo.avisos.map(a => a.codigo)], [['facturado:true', 'etapa:Pendiente de pago'], ['sin_campo_numero']]);
  assert.equal(dom.numerosFactura([{ numero: 3, gestion: 2026 }, { numero: 590, gestion: 2025 }]), '590/2025, 3/2026');
});

test('escritura: desde una etapa en proceso no se mueve (anticipo), salvo «Servicio Concluido»', () => {
  const pagada = [{ numero: 7, gestion: 2026, estado: 'pagada' }];
  const aprobada = plan({ etapaId: 'C21:EXECUTING', fase: 'PROCESO', facturado: true, numeroFactura: '7' }, pagada, CAL);
  assert.deepEqual([resumen(aprobada), aprobada.avisos.map(a => a.codigo)], [[], ['en_proceso']]);
  const ST = [
    etapa('C1:EXECUTING', 'Para Programar', 'PROCESO', 50), etapa('C1:UC_HPOKTU', 'Servicio Concluido', 'PROCESO', 60),
    etapa('C1:UC_30LU30', 'Pre-Factura', 'FACTURAR', 70), etapa('C1:UC_EH54TW', 'Facturado', 'COBRO', 80), etapa('C1:WON', 'Cerrado Ganado', 'GANADA', 90, 'success'),
  ];
  const concluido = { etapaId: 'C1:UC_HPOKTU', fase: 'PROCESO', facturado: true, numeroFactura: '7' };
  assert.deepEqual(resumen(plan(concluido, pagada, ST)), ['cierre:Cerrado Ganado']);
  assert.deepEqual(resumen(plan(concluido, [{ numero: 7, gestion: 2026, estado: 'pendiente' }], ST)), ['etapa:Facturado']);
  const programar = plan({ ...concluido, etapaId: 'C1:EXECUTING' }, pagada, ST);
  assert.deepEqual([resumen(programar), programar.avisos.map(a => a.codigo)], [[], ['en_proceso']]);
});

test('escritura: campos de crm.deal.update, firma y comando de batch', () => {
  const p = plan({ etapaId: 'C21:FINAL_INVOICE', fase: 'FACTURAR' }, [{ numero: 594, gestion: 2026, estado: 'pagada' }], CAL);
  const mapa = { facturado: 'UF_CRM_1751485900193', numeroFactura: 'UF_CRM_77' };
  assert.deepEqual(dom.camposEscritura(p.cambios, mapa), { UF_CRM_1751485900193: 1, UF_CRM_77: '594', STAGE_ID: 'C21:WON' });
  assert.equal(dom.firmaCambios(p.cambios), 'cierre:C21:WON|facturado:true|numeroFactura:594');
  assert.equal(dom.firmaCambios([...p.cambios].reverse()), dom.firmaCambios(p.cambios));
  assert.equal(dom.consultaBitrix({ id: 5120, fields: { STAGE_ID: 'C21:WON', UF_CRM_77: '594, 601' } }),
    'id=5120&fields%5BSTAGE_ID%5D=C21%3AWON&fields%5BUF_CRM_77%5D=594%2C%20601');
  // El campo que crea Comercial se encuentra por su nombre, con o sin signos.
  for (const nombre of ['N.º de factura', 'Nro. Factura', 'Número de factura']) {
    assert.equal(dom.resolverCampos({ UF_CRM_77: { listLabel: nombre } }).mapa.numeroFactura, 'UF_CRM_77', nombre);
  }
  assert.equal(dom.resolverCampos({ UF_CRM_77: { listLabel: 'Mes a facturar' } }).mapa.numeroFactura, null);
});

test('validación de lo que se confirma para Bitrix24', () => {
  const ok = parse('actualizacionBitrix', { cambios: [{ campo: 'etapa', despues: { id: 'C21:WON', nombre: 'Cerrado Ganado' } }, { campo: 'facturado', despues: true }] });
  assert.equal(ok.cambios.length, 2);
  assert.throws(() => parse('actualizacionBitrix', { cambios: [{ campo: 'TITLE', despues: 'x' }] }), /Cambio inválido/);
  assert.equal(parse('actualizacionMasiva', {}).esperadas, null);
  assert.equal(parse('actualizacionMasiva', { esperadas: '612' }).esperadas, 612);
});
