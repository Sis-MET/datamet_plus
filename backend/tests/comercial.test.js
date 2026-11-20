const test = require('node:test');
const assert = require('node:assert/strict');
const domain = require('../src/services/comercial.domain');
const { parse } = require('../src/services/comercial.validation');
const { buildFacturasWhere, buildPagosWhere, mapFacturaFila, notReady } = require('../src/services/comercial.service');
const { nivelDeArea } = require('../src/services/access.areas');

const CATEGORIAS = [
  { id: 1, codigo: 'ST-STIL-MPR', nombre: 'Mantenimiento preventivo (STIL)', area: 'ST', regla: 'NETO', vigente: true },
  { id: 14, codigo: 'ST-LOG', nombre: 'Logística (ST)', area: 'ST', regla: 'LOGISTICA', vigente: true },
  { id: 25, codigo: 'VENT-PESAS-M', nombre: 'Pesas clase M', area: 'VENT', regla: 'PRODUCTO', vigente: true },
  { id: 99, codigo: 'VIEJA', nombre: 'Categoría vieja', area: 'CAL', regla: 'NETO', vigente: false },
];

const factura = (overrides = {}) => parse('factura', {
  numero: 595,
  fechaEmision: '2026-11-18',
  razonSocial: 'Cliente de Ejemplo S.R.L.',
  monto: '2.750,00',
  lineas: [{ categoriaId: 1, monto: 2400 }, { categoriaId: 14, monto: '350' }],
  ...overrides,
});

test('montos en centavos: la suma no se descuadra por la coma flotante', () => {
  assert.equal(domain.centavos(0.1) + domain.centavos(0.2), domain.centavos(0.3));
  assert.equal(domain.bolivianos(domain.centavos(1129402.1)), 1129402.1);
});

test('estado de una factura según lo pagado', () => {
  assert.equal(domain.estadoFactura({ estado: 'VIGENTE', monto: 100, pagado: 0 }), 'pendiente');
  assert.equal(domain.estadoFactura({ estado: 'VIGENTE', monto: 100, pagado: 40 }), 'parcial');
  assert.equal(domain.estadoFactura({ estado: 'VIGENTE', monto: 100, pagado: 100 }), 'pagada');
  assert.equal(domain.estadoFactura({ estado: 'ANULADA', monto: 100, pagado: 0 }), 'anulada');
});

test('la mora cuenta desde el vencimiento; sin plazo vence el día de emisión', () => {
  const hoy = '2026-11-18';
  const sinPlazo = domain.cobroDe({ estado: 'VIGENTE', monto: 500, pagado: 100, fechaEmision: '2026-08-03', plazoDias: null }, hoy);
  assert.deepEqual(sinPlazo, { estado: 'parcial', saldo: 400, vence: '2026-08-03', diasEmision: 107, diasMora: 107, tramo: 'mas90' });
  const conPlazo = domain.cobroDe({ estado: 'VIGENTE', monto: 500, pagado: 0, fechaEmision: '2026-11-01', plazoDias: 30 }, hoy);
  assert.equal(conPlazo.vence, '2026-12-01');
  assert.equal(conPlazo.diasMora, 0);
  assert.equal(conPlazo.tramo, 'al_dia');
  const pagada = domain.cobroDe({ estado: 'VIGENTE', monto: 500, pagado: 500, fechaEmision: '2026-01-01', plazoDias: 0 }, hoy);
  assert.equal(pagada.saldo, 0);
  assert.equal(pagada.tramo, null);
});

test('tramos de antigüedad', () => {
  assert.equal(domain.tramoDe(0), 'al_dia');
  assert.equal(domain.tramoDe(30), 'd30');
  assert.equal(domain.tramoDe(31), 'd60');
  assert.equal(domain.tramoDe(90), 'd90');
  assert.equal(domain.tramoDe(91), 'mas90');
});

test('margen por regla: una venta sin costo queda por costear, no en 84 %', () => {
  assert.equal(domain.margenLinea({ regla: 'NETO', monto: 1000 }).porcentaje, 84);
  assert.equal(domain.margenLinea({ regla: 'LOGISTICA', monto: 1000 }).porcentaje, 80);
  assert.equal(domain.margenLinea({ regla: 'PRODUCTO', monto: 1000, costo: null }).margen, null);
  const producto = domain.margenLinea({ regla: 'PRODUCTO', monto: 1000, costo: 500 });
  assert.equal(Math.round(producto.porcentaje * 10) / 10, 34);
  const tercero = domain.margenLinea({ regla: 'TERCERO', monto: 1000, costo: 500 });
  assert.equal(Math.round(tercero.margen * 100) / 100, 405);
});

test('validación de la factura: montos con coma, líneas y referencias', () => {
  const datos = factura({ referencias: [{ tipo: 'COTIZACION', valor: '0999-S03-1-26' }] });
  assert.equal(datos.monto, 2750);
  assert.equal(datos.lineas[1].monto, 350);
  assert.equal(datos.lineas[0].cantidad, null);
  assert.deepEqual(datos.personas, []);
  assert.throws(() => factura({ monto: '12,345' }), /dos decimales/);
  assert.throws(() => factura({ lineas: [] }), /al menos una línea/);
  assert.throws(() => factura({ numero: 0 }), /Número de factura/);
  assert.throws(() => factura({ fechaEmision: '18/11/2026' }), /Fecha inválida/);
});

test('plan de factura: las líneas suman el monto y el número no se repite en la gestión', () => {
  const plan = domain.planFactura(factura(), { categorias: CATEGORIAS });
  assert.equal(plan.gestion, 2026);
  assert.equal(plan.tipo, 'SERVICIO');
  assert.deepEqual(plan.lineas.map(l => l.orden), [1, 2]);
  assert.throws(() => domain.planFactura(factura({ monto: 2700 }), { categorias: CATEGORIAS }), /deben coincidir/);
  assert.throws(
    () => domain.planFactura(factura(), { categorias: CATEGORIAS, existentes: [{ gestion: 2026, numero: 595 }] }),
    error => error.statusCode === 409 && /ya está registrada/.test(error.message),
  );
  assert.throws(() => domain.planFactura(factura({ lineas: [{ categoriaId: 99, monto: 2750 }] }), { categorias: CATEGORIAS }), /ya no está vigente/);
  const venta = domain.planFactura(factura({ lineas: [{ categoriaId: 25, monto: 2750 }] }), { categorias: CATEGORIAS });
  assert.equal(venta.tipo, 'VENTA');
});

test('plan de factura: dos responsables reparten el 100 %', () => {
  const personas = [
    { rol: 'RESPONSABLE', nombre: 'Persona A', porcentaje: 50 },
    { rol: 'RESPONSABLE', nombre: 'Persona B', porcentaje: 40 },
  ];
  assert.throws(() => domain.planFactura(factura({ personas }), { categorias: CATEGORIAS }), /sumar 100/);
});

test('plan de pago: no supera el saldo ni el pago; lo que sobra queda sin aplicar', () => {
  const facturas = [
    { id: 1, numero: 10, monto: 1000, pagado: 0, estado: 'VIGENTE' },
    { id: 2, numero: 11, monto: 500, pagado: 400, estado: 'VIGENTE' },
    { id: 3, numero: 12, monto: 300, pagado: 0, estado: 'ANULADA' },
  ];
  const pago = (aplicaciones, monto = 1500) => parse('pago', { fecha: '2026-11-18', monto, medio: 'DEPOSITO', aplicaciones });
  const plan = domain.planPago(pago([{ facturaId: 1, monto: 1000 }, { facturaId: 2, monto: 100 }]), { facturas });
  assert.equal(plan.sinAplicar, 400);
  assert.throws(() => domain.planPago(pago([{ facturaId: 2, monto: 200 }]), { facturas }), /le quedan Bs 100,00/);
  assert.throws(() => domain.planPago(pago([{ facturaId: 3, monto: 100 }]), { facturas }), /anulada/);
  assert.throws(() => domain.planPago(pago([{ facturaId: 1, monto: 900 }], 800), { facturas }), /el pago es de/);
  assert.throws(() => domain.planPago(pago([{ facturaId: 1, monto: 1 }, { facturaId: 1, monto: 2 }]), { facturas }), /dos veces/);
  assert.equal(domain.planPago(pago([], 300), { facturas }).sinAplicar, 300);
});

test('resumen de cobranza por tramo y por cliente', () => {
  const resumen = domain.resumenCobranza([
    { clienteCodigo: '0001', razonSocial: 'A', saldo: 100, tramo: 'd30', diasMora: 10 },
    { clienteCodigo: '0001', razonSocial: 'A', saldo: 50.5, tramo: 'mas90', diasMora: 120 },
    { clienteCodigo: null, razonSocial: 'B', saldo: 200, tramo: 'al_dia', diasMora: 0 },
  ]);
  assert.equal(resumen.total, 350.5);
  assert.equal(resumen.tramos.find(t => t.id === 'mas90').saldo, 50.5);
  assert.deepEqual(resumen.clientes.map(c => [c.razonSocial, c.saldo, c.diasMoraMax]), [['B', 200, 0], ['A', 150.5, 120]]);
});

test('filtros de la lista de facturas: sin el estado sirven para los conteos', () => {
  const filtros = parse('filtrosFacturas', { q: '0114-C04', estado: 'pendiente', area: 'CAL', desde: '2026-01-01', hasta: '2026-03-31' });
  const con = buildFacturasWhere(filtros);
  const sin = buildFacturasWhere(filtros, { conEstado: false });
  assert.match(con.where, /b\.situacion = @estado/);
  assert.doesNotMatch(sin.where, /situacion/);
  assert.match(con.where, /c\.area = @area/);
  assert.deepEqual(con.params.map(p => p.name), ['like', 'q', 'desde', 'hasta', 'area', 'estado']);
  assert.throws(() => parse('filtrosFacturas', { desde: '2026-02-01', hasta: '2026-01-01' }), /Desde/);
  assert.throws(() => parse('filtrosFacturas', { estado: 'vencida' }));
  assert.equal(buildFacturasWhere(parse('filtrosFacturas', {})).where, '');
});

test('filtros de pagos: sin aplicar = vigente con saldo', () => {
  const { where } = buildPagosWhere(parse('filtrosPagos', { estado: 'sin_aplicar' }));
  assert.match(where, /b\.aplicado < b\.monto/);
});

test('fila de la lista: estado de cobro y áreas', () => {
  const fila = mapFacturaFila({
    id: 7, gestion: 2026, numero: 348, fecha_texto: '2026-08-03', tipo: 'VENTA', cliente_codigo: '0114', razon_social: 'X',
    nit: null, monto: 207120, pagado: 0, estado: 'VIGENTE', origen: 'EXCEL', plazo_dias: null, area_st: 1, area_cal: 0, area_vent: 1,
  }, '2026-11-18');
  assert.equal(fila.estado, 'pendiente');
  assert.equal(fila.diasMora, 107);
  assert.deepEqual(fila.areas, ['ST', 'VENT']);
});

test('sin la migración 034 responde 503', () => {
  const error = notReady({ number: 208, message: "Invalid object name 'dbo.COM_FACTURAS'." });
  assert.equal(error.statusCode, 503);
  assert.equal(notReady({ number: 208, message: "Invalid object name 'dbo.OTRA'." }), null);
});

test('ficha del cliente: correos válidos y plazo entre 0 y 365', () => {
  assert.deepEqual(parse('cliente', { plazoDias: '30', correos: ['facturas@ejemplo.com'] }).correos, ['facturas@ejemplo.com']);
  assert.throws(() => parse('cliente', { correos: ['facturas@ejemplo,com'] }), /correo/);
  assert.throws(() => parse('cliente', { plazoDias: 400 }));
});

test('acceso: en pruebas solo entra Sistemas; abierto, Comercial registra y Administración y Gerencia consultan', (t) => {
  const { MODULOS, mensajeSinAcceso, modulosEnPruebas } = require('../src/services/access.areas');
  const original = MODULOS.comercial.enPruebas;
  t.after(() => { MODULOS.comercial.enPruebas = original; });

  MODULOS.comercial.enPruebas = true;
  for (const area of ['Comercial', 'Administración', 'Gerencia', 'Soporte Técnico']) {
    assert.equal(nivelDeArea('comercial', { area, acceso_cron: '2' }), null, area);
  }
  assert.equal(nivelDeArea('comercial', { area: 'Administración', acceso_cron: '3' }), 'area');
  assert.deepEqual(modulosEnPruebas(), ['comercial']);
  assert.match(mensajeSinAcceso('comercial'), /en pruebas: por ahora solo lo usa Sistemas/);

  MODULOS.comercial.enPruebas = false;
  assert.equal(nivelDeArea('comercial', { area: 'Comercial' }), 'area');
  assert.equal(nivelDeArea('comercial', { area: 'Administración' }), 'consulta');
  assert.equal(nivelDeArea('comercial', { area: 'Gerencia' }), 'consulta');
  assert.equal(nivelDeArea('comercial', { area: 'Soporte Técnico' }), null);
  assert.equal(nivelDeArea('comercial', { area: 'Calibración', acceso_cron: '3' }), 'area');
  assert.deepEqual(modulosEnPruebas(), []);
  assert.match(mensajeSinAcceso('comercial'), /área de Comercial/);
});

// ─── Importación del Excel ────────────────────────────────────────────────
const imp = require('../src/services/comercial.importacion');

const CATS_IMPORT = [
  { id: 3, codigo: 'ST-STIL-MPR', nombre: 'Mnt preventivo', area: 'ST', regla: 'NETO', vigente: true, excelEncabezado: 'MNT. PREVENTIVO (STIL)' },
  { id: 14, codigo: 'ST-LOG', nombre: 'Logística (ST)', area: 'ST', regla: 'LOGISTICA', vigente: true, excelEncabezado: 'LOGISTICA (ST)' },
];

/** Hoja de ejemplo: fila 3 de encabezados (con saltos de línea, como el Excel) y filas desde la 4. */
const hojaEjemplo = () => new Map([
  [3, {
    A: '#', B: 'TIPO DE FACTURA ', C: 'Nº FACTURA', D: 'FECHA EMISION', E: 'MONTO BS.-', F: 'RAZON SOCIAL',
    H: 'MNT. \nPREVENTIVO\n(STIL)', U: 'LOGISTICA\n(ST)', BJ: 'TIPO DE PAGO', BK: 'PAGO 1 BS', BL: 'FECHA PAGO  1', BM: 'PAGO2 BS', BN: 'FECHA PAGO 2',
    FJ: 'COTIZACIÓN DE SERVICIO ', FN: 'RESPONSABLE BITRIX', FZ: 'REG ATENDIO MNT', LO: 'NRO BLZ MNT \nPREV\n(STIL)',
  }],
  [4, { A: '1', B: 'SERVICIO', C: '1', D: '46028', E: '1000', F: 'CLIENTE UNO S.A.', H: '900', U: '100', BJ: 'DEPOSITO', BK: '1100', BL: '46029', BM: '-100', BN: '46030', FJ: '0001-S01-1-26', FN: 'ANA PEREZ - LUIS ROJAS', FZ: 'SCZ', LO: '3' }],
  [5, { A: '2', C: '2', D: '46028', E: '0', F: 'ANULADO' }],
  [6, { A: '3 LPZ', C: '3', D: '46030', E: '300', F: 'CLIENTE DOS SRL', H: '300' }],
  [7, { A: '3 SCZ', C: '3', D: '46030', E: '200', F: 'CLIENTE DOS SRL', U: '200' }],
  [8, { A: '5', C: '4', D: '46031', E: '50', F: 'OTRO', H: '50' }],
  [9, { A: '4', C: '4', D: '46031', E: '70', F: 'OTRO MAS', H: '70' }],
]);

test('importación: normaliza encabezados con saltos de línea y lee códigos y nombres', () => {
  assert.equal(imp.normalizar('MNT. \nPREVENTIVO\n(STIL)'), 'MNT. PREVENTIVO (STIL)');
  assert.equal(imp.normalizar('Nº FACTURA'), 'NO FACTURA');
  assert.deepEqual(imp.cotizacionesDe('0114-C04-25 1 Y 0114-C05-25 1'), ['0114-C04-25 1', '0114-C05-25 1']);
  assert.deepEqual(imp.cotizacionesDe('005-0199-1-26'), ['005-0199-1-26']);
  assert.deepEqual(imp.nombresDe('MARIO PEÑA - LUISA ROCA'), ['MARIO PEÑA', 'LUISA ROCA']);
  assert.deepEqual(imp.nombresDe('SIN TECNCO ASIGNADO'), []);
  assert.equal(imp.titulo('JOSÉ MUÑOZ'), 'José Muñoz');
});

test('importación: plan con devolución, anulada, filas unidas y número corregido', () => {
  const plan = imp.planImportacion(hojaEjemplo(), {
    categorias: CATS_IMPORT,
    clientes: [{ codigo: '0001', razonSocial: 'CLIENTE UNO S.A.', nombre: 'Cliente Uno', nit: '1234567' }],
    personal: [{ id: 7, nombre: 'Ana Pérez', claves: ['ANA PEREZ'] }],
  });
  assert.deepEqual(plan.errores, []);
  assert.deepEqual(plan.facturas.map(f => f.factura.numero), [1, 2, 3, 4, 5]);
  const [uno, dos, tres, cuatro, cinco] = plan.facturas;
  assert.equal(uno.factura.clienteCodigo, '0001');
  assert.equal(uno.factura.nit, '1234567');
  assert.equal(uno.factura.tipo, 'SERVICIO');
  assert.deepEqual(uno.factura.lineas.map(l => [l.categoriaId, l.monto, l.regional, l.cantidad]), [[3, 900, 'SCZ', 3], [14, 100, 'SCZ', null]]);
  assert.equal(uno.pagos.length, 1);
  assert.equal(uno.pagos[0].monto, 1000);
  assert.match(uno.pagos[0].observacion, /devolución de Bs 100,00/);
  assert.deepEqual(uno.factura.personas.map(p => [p.nombre, p.usuarioId, p.porcentaje]), [['Ana Pérez', 7, 50], ['Luis Rojas', null, 50]]);
  assert.deepEqual(uno.factura.referencias, [{ tipo: 'COTIZACION', valor: '0001-S01-1-26' }]);
  assert.equal(dos.anulada, true);
  assert.equal(tres.factura.monto, 500);
  assert.deepEqual(tres.filas, [6, 7]);
  assert.equal(cuatro.factura.razonSocial, 'OTRO MAS');
  assert.equal(cinco.factura.razonSocial, 'OTRO');
  assert.match(cinco.factura.observacion, /decía N\.º 4/);
  assert.equal(plan.resumen.monto, 1620);
  assert.equal(plan.resumen.cobrado, 1000);
});

test('importación: lo ya registrado se salta y una estructura distinta se rechaza', () => {
  const plan = imp.planImportacion(hojaEjemplo(), { categorias: CATS_IMPORT, existentes: [{ gestion: 2026, numero: 1 }] });
  assert.equal(plan.resumen.yaRegistradas, 1);
  assert.throws(() => imp.planImportacion(hojaEjemplo(), {
    categorias: [...CATS_IMPORT, { id: 9, codigo: 'X', excelEncabezado: 'COLUMNA QUE NO ESTA' }],
  }), /COLUMNA QUE NO ESTA/);
});
