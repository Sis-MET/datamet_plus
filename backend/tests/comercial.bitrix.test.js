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
