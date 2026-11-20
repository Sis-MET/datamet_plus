const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { armarReporte, mesesEntre, tipoCliente } = require('../src/services/comercial.reportes.domain');
const { crearLibro, crc32, serieFecha, columna } = require('../src/utils/xlsx-escribir');
const { leerLibro } = require('../src/utils/xlsx');
const { parse } = require('../src/services/comercial.validation');

const CAT = {
  mpr: { id: 3, codigo: 'ST-STIL-MPR', nombre: 'Mantenimiento preventivo (STIL)', area: 'ST', regla: 'NETO' },
  log: { id: 14, codigo: 'ST-LOG', nombre: 'Logística (ST)', area: 'ST', regla: 'LOGISTICA' },
  blz: { id: 19, codigo: 'CAL-BLZ', nombre: 'Calibración de balanzas', area: 'CAL', regla: 'NETO' },
  pesas: { id: 25, codigo: 'VENT-PESAS-M', nombre: 'Pesas clase M', area: 'VENT', regla: 'PRODUCTO' },
};

const factura = (o) => ({
  gestion: 2026, estado: 'VIGENTE', pagado: 0, clienteCodigo: '0999', nit: '1234567', razonSocial: 'Cliente de Ejemplo S.R.L.',
  clienteNombre: 'CLIENTE DE EJEMPLO S.R.L.', rubro: null, fechaRegistro: '2023-05-02', primeraGestion: 2026, ...o,
});

const DATOS = {
  facturas: [
    factura({ id: 1, numero: 10, fecha: '2026-01-15', monto: 1000, pagado: 1000 }),
    factura({ id: 2, numero: 11, fecha: '2026-03-02', monto: 3000, pagado: 1000, clienteCodigo: '0888', razonSocial: 'Otra Empresa S.A.',
      clienteNombre: 'OTRA EMPRESA S.A.', fechaRegistro: '2026-02-20', rubro: 'ALIMENTOS' }),
    factura({ id: 3, numero: 12, fecha: '2026-03-20', monto: 500, clienteCodigo: null, nit: null, razonSocial: 'Persona Natural', clienteNombre: null }),
    factura({ id: 4, numero: 13, fecha: '2026-03-21', monto: 0, estado: 'ANULADA' }),
  ],
  lineas: [
    { facturaId: 1, monto: 1000, cantidad: 2, regional: 'LPZ', costo: null, categoria: CAT.mpr },
    { facturaId: 2, monto: 1800, cantidad: 6, regional: 'SCZ', costo: null, categoria: CAT.blz },
    { facturaId: 2, monto: 1000, cantidad: null, regional: 'SCZ', costo: 600, categoria: CAT.pesas },
    { facturaId: 2, monto: 200, cantidad: null, regional: 'SCZ', costo: null, categoria: CAT.log },
    { facturaId: 3, monto: 500, cantidad: 1, regional: 'LPZ', costo: null, categoria: CAT.pesas },
  ],
  responsables: [
    { facturaId: 1, usuarioId: 7, nombre: 'Ana Comercial', porcentaje: null },
    { facturaId: 2, usuarioId: 7, nombre: 'Ana Comercial', porcentaje: 50 },
    { facturaId: 2, usuarioId: 8, nombre: 'Luis Rojas', porcentaje: 50 },
  ],
};
const FILTROS = { desde: '2026-01-01', hasta: '2026-04-30', area: null };

test('reporte: totales, meses en cero, áreas y margen como la ficha', () => {
  const r = armarReporte({ ...DATOS, filtros: FILTROS });
  assert.deepEqual(r.resumen, {
    facturado: 4500, cobrado: 2000, saldo: 2500, neto: 3780, margen: 2752, margenPorcentaje: 68.8, porCostear: 500,
    facturas: 3, anuladas: 1, clientes: 3, clientesNuevos: 1, ticketPromedio: 1500,
  });
  assert.deepEqual(r.porMes.map(m => [m.mes, m.total, m.facturas]), [['2026-01', 1000, 1], ['2026-02', 0, 0], ['2026-03', 3500, 2], ['2026-04', 0, 0]]);
  assert.deepEqual(r.porMes[2].areas, { CAL: 1800, VENT: 1500, ST: 200 });
  assert.deepEqual(r.areas, ['ST', 'CAL', 'VENT']);
  // Pesas: neto 840 − costo 600 = 240 (24 %); la venta sin costo queda por costear.
  const vent = r.porArea.find(a => a.area === 'VENT');
  assert.deepEqual([vent.monto, vent.margen, vent.margenPorcentaje, vent.porCostear, vent.facturas], [1500, 240, 24, 500, 2]);
  assert.deepEqual(r.porCategoria.map(c => [c.codigo, c.monto, c.cantidad]), [
    ['CAL-BLZ', 1800, 6], ['VENT-PESAS-M', 1500, 1], ['ST-STIL-MPR', 1000, 2], ['ST-LOG', 200, 0],
  ]);
  assert.deepEqual(r.porRegional, [{ regional: 'SCZ', monto: 3000 }, { regional: 'LPZ', monto: 1500 }]);
  assert.deepEqual(r.variasAreas, [{ areas: 'ST + CAL + VENT', facturas: 1, monto: 3000 }]);
});

test('reporte: responsables por su porcentaje, sin responsable aparte y el total cuadra', () => {
  const r = armarReporte({ ...DATOS, filtros: FILTROS });
  assert.deepEqual(r.porResponsable.map(x => [x.nombre, x.monto, x.facturas]), [
    ['Ana Comercial', 2500, 2], ['Luis Rojas', 1500, 1], ['Sin responsable', 500, 1],
  ]);
  // 50 / 50 de un monto impar: el centavo va al primero y la suma es exacta.
  const impar = armarReporte({
    facturas: [factura({ id: 9, numero: 1, fecha: '2026-01-02', monto: 100.01 })],
    lineas: [{ facturaId: 9, monto: 100.01, cantidad: null, regional: null, costo: null, categoria: CAT.mpr }],
    responsables: [{ facturaId: 9, usuarioId: 7, nombre: 'A', porcentaje: 50 }, { facturaId: 9, usuarioId: 8, nombre: 'B', porcentaje: 50 }],
    filtros: FILTROS,
  });
  assert.deepEqual(impar.porResponsable.map(x => x.monto), [50.01, 50]);
});

test('reporte: el filtro de área toma solo sus líneas y reparte lo cobrado en proporción', () => {
  const r = armarReporte({ ...DATOS, filtros: { ...FILTROS, area: 'CAL' } });
  assert.equal(r.resumen.facturado, 1800);
  assert.equal(r.resumen.facturas, 1);
  // Factura de 3000 con 1000 cobrado: a Calibración le toca 1800 / 3000 = 60 %.
  assert.equal(r.resumen.cobrado, 600);
  assert.deepEqual(r.areas, ['CAL']);
});

test('reporte: clientes nuevos, regulares y sin cliente; rubro con su cobertura', () => {
  const r = armarReporte({ ...DATOS, filtros: FILTROS });
  assert.deepEqual(r.tiposCliente, {
    nuevo: { clientes: 1, monto: 3000 }, regular: { clientes: 1, monto: 1000 }, sin_cliente: { clientes: 1, monto: 500 },
  });
  assert.deepEqual(r.porCliente.map(c => [c.razonSocial, c.tipo]), [['OTRA EMPRESA S.A.', 'nuevo'], ['CLIENTE DE EJEMPLO S.R.L.', 'regular'], ['Persona Natural', 'sin_cliente']]);
  assert.deepEqual(r.rubroCobertura, { conRubro: 1, facturas: 3 });
  assert.equal(r.porRubro[0].rubro, 'ALIMENTOS');
  assert.equal(tipoCliente(factura({ fechaRegistro: '2026-01-10', primeraGestion: 2025 })), 'regular');
  assert.equal(tipoCliente(factura({ fechaRegistro: null })), 'regular');
  assert.deepEqual(mesesEntre('2025-11-15', '2026-02-01'), ['2025-11', '2025-12', '2026-01', '2026-02']);
});

test('filtros del reporte: la gestión en curso por omisión y hasta tres años', () => {
  const f = parse('filtrosReportes', { hasta: '2026-11-20' });
  assert.deepEqual(f, { desde: '2026-01-01', hasta: '2026-11-20', area: null, tipo: null });
  assert.throws(() => parse('filtrosReportes', { desde: '2026-05-01', hasta: '2026-04-01' }), /posterior/);
  assert.throws(() => parse('filtrosReportes', { desde: '2020-01-01', hasta: '2026-01-01' }), /tres años/);
  assert.throws(() => parse('filtrosReportes', { area: 'OTRA' }), /Área inválida/);
});

test('Excel: el libro se vuelve a leer con sus hojas, textos, números y fechas', () => {
  const buffer = crearLibro([
    { nombre: 'Resumen', columnas: [{ titulo: 'Mes' }, { titulo: 'Monto', tipo: 'bs' }], filas: [['2026-01', 1234.5], ['2026-02', 0]] },
    {
      nombre: 'Facturas: [prueba]',
      columnas: [{ titulo: 'N.º', tipo: 'entero' }, { titulo: 'Emisión', tipo: 'fecha' }, { titulo: 'Razón social' }, { titulo: 'Margen %', tipo: 'porcentaje' }],
      filas: [[594, '2026-11-20', 'Cliente & Hijos <S.R.L.> «Ñandú»', 0.25], [595, null, '', null]],
    },
  ]);
  const archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-')), 'libro.xlsx');
  fs.writeFileSync(archivo, buffer);
  const libro = leerLibro(archivo);
  // «[]:» no valen en un nombre de hoja de Excel.
  assert.deepEqual(libro.nombres(), ['Resumen', 'Facturas   prueba']);
  assert.deepEqual(libro('Resumen').get(2), { A: '2026-01', B: '1234.5' });
  const fila = libro('Facturas   prueba').get(2);
  assert.deepEqual(fila, { A: '594', B: String(serieFecha('2026-11-20')), C: 'Cliente & Hijos <S.R.L.> «Ñandú»', D: '0.25' });
  assert.deepEqual(libro('Facturas   prueba').get(3), { A: '595' });
  assert.equal(serieFecha('1900-01-01'), 2);
  assert.equal(serieFecha('2026-11-20'), 46346);
  assert.deepEqual([columna(0), columna(25), columna(26), columna(701)], ['A', 'Z', 'AA', 'ZZ']);
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});
