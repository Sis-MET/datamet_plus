const test = require('node:test');
const assert = require('node:assert/strict');
const dom = require('../src/services/comercial.comisiones.domain');
const { parse } = require('../src/services/comercial.validation');
const { CLAVES, permisoDe } = require('../src/services/permisos.catalogo');

const CAT = {
  mpr: { id: 3, nombre: 'Mantenimiento preventivo (STIL)', area: 'ST', regla: 'NETO' },
  log: { id: 14, nombre: 'Logística (ST)', area: 'ST', regla: 'LOGISTICA' },
  blz: { id: 19, nombre: 'Calibración de balanzas', area: 'CAL', regla: 'NETO' },
  pesas: { id: 25, nombre: 'Pesas clase M', area: 'VENT', regla: 'PRODUCTO' },
};

// Las reglas del Excel: comisionan el mantenimiento y las pesas (no Calibración ni la logística).
const EXCEL = { id: 1, vigenteDesde: '2020-01-01', base: 'MONTO', tramos: dom.TRAMOS_EXCEL, categorias: [3, 25], ventaSinCosto: false };

const factura = (id, numero, fecha = '2026-03-10') => ({ id, gestion: 2026, numero, fecha, razonSocial: `Cliente ficticio ${numero}` });

test('tramos del Excel: menos de 20 % no comisiona, de 20 % a 30 % el 0,6 %, más de 30 % el 1 %', () => {
  assert.equal(dom.tasaDe(dom.TRAMOS_EXCEL, 19.99), 0);
  assert.equal(dom.tasaDe(dom.TRAMOS_EXCEL, 20), 0.6);
  assert.equal(dom.tasaDe(dom.TRAMOS_EXCEL, 30), 0.6);
  assert.equal(dom.tasaDe(dom.TRAMOS_EXCEL, 30.01), 1);
  assert.equal(dom.tasaDe(dom.TRAMOS_EXCEL, 84), 1);
});

test('comisiones de un mes: por línea, por responsable y lo que no comisiona', () => {
  const r = dom.calcularComisiones({
    facturas: [factura(1, 594), factura(2, 595), factura(3, 596)],
    lineas: [
      { facturaId: 1, monto: 10000, costo: null, categoria: CAT.mpr }, // servicio: 84 % → 1 % = 100
      { facturaId: 1, monto: 2000, costo: null, categoria: CAT.blz }, // Calibración no comisiona
      { facturaId: 1, monto: 500, costo: null, categoria: CAT.log }, // logística no comisiona
      { facturaId: 2, monto: 5000, costo: 3000, categoria: CAT.pesas }, // (4200 − 3000) / 5000 = 24 % → 0,6 % = 30
      { facturaId: 2, monto: 1000, costo: 900, categoria: CAT.pesas }, // −6 % → 0
      { facturaId: 3, monto: 7000, costo: null, categoria: CAT.pesas }, // sin costo: por costear
    ],
    responsables: [
      { facturaId: 1, usuarioId: 7, nombre: 'Ana Comercial', porcentaje: 50 },
      { facturaId: 1, usuarioId: 8, nombre: 'Luis Rojas', porcentaje: 50 },
      { facturaId: 3, usuarioId: 8, nombre: 'Luis Rojas', porcentaje: null },
    ],
    reglas: [EXCEL],
  });
  assert.deepEqual(r.lineas.map(l => [l.numero, l.estado, l.tasa, l.comision]), [
    [594, 'comisiona', 1, 100], [594, 'categoria', 0, 0], [594, 'categoria', 0, 0],
    [595, 'sin_responsable', 0.6, 30], [595, 'bajo_tramo', 0, 0], [596, 'por_costear', 0, 0],
  ]);
  assert.deepEqual(r.personas.map(p => [p.nombre, p.comision, p.base, p.facturas]), [['Ana Comercial', 50, 5000, 1], ['Luis Rojas', 50, 5000, 1]]);
  assert.deepEqual(r.totales, { base: 16000, comision: 130, sinResponsable: 30, porCostear: 7000, lineasPorCostear: 1 });
  assert.equal(r.lineas[3].margen, 24);
  assert.deepEqual(r.reglas, [1]);
});

test('reglas: la versión vigente por la fecha de la factura; base neto y venta sin costo', () => {
  const nueva = { id: 2, vigenteDesde: '2026-04-01', base: 'NETO', tramos: [{ desde: 0, tasa: 0.5 }], categorias: [25], ventaSinCosto: true };
  assert.equal(dom.reglaVigente([EXCEL, nueva], '2026-03-31').id, 1);
  assert.equal(dom.reglaVigente([EXCEL, nueva], '2026-04-01').id, 2);
  assert.equal(dom.reglaVigente([nueva], '2026-03-31'), null);
  const r = dom.calcularComisiones({
    facturas: [factura(1, 10, '2026-03-30'), factura(2, 11, '2026-04-02')],
    lineas: [{ facturaId: 1, monto: 1000, costo: null, categoria: CAT.pesas }, { facturaId: 2, monto: 1000, costo: null, categoria: CAT.pesas }],
    responsables: [{ facturaId: 1, usuarioId: 7, nombre: 'A', porcentaje: null }, { facturaId: 2, usuarioId: 7, nombre: 'A', porcentaje: null }],
    reglas: [EXCEL, nueva],
  });
  // Marzo con las del Excel: sin costo, por costear. Abril: 0,5 % del neto (840) = 4,20.
  assert.deepEqual(r.lineas.map(l => [l.estado, l.reglaId, l.base, l.comision]), [['por_costear', 1, 0, 0], ['comisiona', 2, 840, 4.2]]);
  assert.deepEqual(r.reglas, [2]);
});

test('reparto: la suma cuadra al centavo y quien no ve todo recibe solo lo suyo', () => {
  const r = dom.calcularComisiones({
    facturas: [factura(1, 1)],
    lineas: [{ facturaId: 1, monto: 1001, costo: null, categoria: CAT.mpr }],
    responsables: [{ facturaId: 1, usuarioId: 7, nombre: 'A', porcentaje: 50 }, { facturaId: 1, usuarioId: 8, nombre: 'B', porcentaje: 50 }],
    reglas: [EXCEL],
  });
  assert.equal(r.totales.comision, 10.01);
  assert.deepEqual(r.personas.map(p => [p.nombre, p.comision]), [['B', 5.01], ['A', 5]]);
  const propio = dom.soloDe(r, 8);
  assert.deepEqual(propio.personas.map(p => p.nombre), ['B']);
  assert.deepEqual(propio.lineas[0].personas.map(p => p.comision), [5.01]);
  assert.equal(propio.totales.comision, 5.01);
  assert.deepEqual(dom.soloDe(r, 99).lineas, []);
});

test('problemas de una versión nueva de las reglas', () => {
  assert.deepEqual(dom.problemasReglas({ tramos: dom.TRAMOS_EXCEL, categorias: [3] }), []);
  assert.match(dom.problemasReglas({ tramos: [{ desde: 5, tasa: 1 }], categorias: [3] })[0], /0 %/);
  assert.match(dom.problemasReglas({ tramos: [{ desde: 0, tasa: 1 }, { desde: 0, tasa: 2 }], categorias: [3] })[0], /mismo margen/);
  assert.match(dom.problemasReglas({ tramos: [{ desde: 0, tasa: 1 }], categorias: [] })[0], /categoría/);
  const ok = parse('reglaComision', {
    vigenteDesde: '2026-12-01', base: 'MONTO', tramos: [{ desde: '0', tasa: '0' }, { desde: '25', tasa: '0,8'.replace(',', '.') }],
    categorias: [3, '25'], nota: 'Comercial sube la tasa del segundo tramo.',
  });
  assert.deepEqual(ok.tramos, [{ desde: 0, tasa: 0 }, { desde: 25, tasa: 0.8 }]);
  assert.deepEqual(ok.categorias, [3, 25]);
  assert.equal(ok.ventaSinCosto, false);
  assert.throws(() => parse('reglaComision', { ...ok, nota: 'corto' }), /al menos 10/);
  assert.throws(() => parse('reglaComision', { ...ok, tramos: [{ desde: 0, tasa: 12 }] }), /10 %/);
  assert.deepEqual(parse('mesComision', { gestion: '2026', mes: '3' }), { gestion: 2026, mes: 3 });
});

test('permisos de comisiones en el catálogo, con su siembra', () => {
  for (const clave of ['comisiones.comercial.ver', 'comisiones.comercial.gestionar']) {
    assert.ok(CLAVES.includes(clave), clave);
    assert.deepEqual(permisoDe(clave).inicial, [{ area: 'comercial', cargo: 'jefe de area' }, { area: 'administracion', cargo: null }]);
  }
});
