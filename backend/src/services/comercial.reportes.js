/**
 * Reportes de Comercial (fase 4): lee facturas, líneas, responsables,
 * referencias y pagos del período y arma el reporte
 * (comercial.reportes.domain) y el libro de Excel para Contabilidad, que
 * pasa a ser una salida de DataMET+ y no la fuente.
 */
const { sql } = require('../config/db');
const comercial = require('./comercial.service');
const { armarReporte } = require('./comercial.reportes.domain');
const { centavos, margenLinea } = require('./comercial.domain');
const { crearLibro } = require('../utils/xlsx-escribir');

const PAGADO = `(SELECT a.factura_id, SUM(a.monto) AS pagado FROM dbo.COM_PAGO_APLICACIONES a
  JOIN dbo.COM_PAGOS p ON p.id = a.pago_id AND p.estado = 'VIGENTE' GROUP BY a.factura_id)`;

const condiciones = (filtros, alias = 'f') => {
  const where = [`${alias}.fecha_emision >= @desde`, `${alias}.fecha_emision <= @hasta`];
  const params = [
    { name: 'desde', type: sql.Date, value: filtros.desde },
    { name: 'hasta', type: sql.Date, value: filtros.hasta },
  ];
  if (filtros.tipo) {
    where.push(`${alias}.tipo = @tipo`);
    params.push({ name: 'tipo', type: sql.VarChar(10), value: filtros.tipo });
  }
  return { where: where.join(' AND '), params };
};

const datos = async (filtros) => {
  const { where, params } = condiciones(filtros);
  const [facturas, lineas, responsables] = await Promise.all([
    comercial.run(`
      SELECT f.id, f.gestion, f.numero, CONVERT(varchar(10), f.fecha_emision, 23) AS fecha, f.tipo, f.cliente_codigo, f.razon_social, f.nit,
        f.monto, f.estado, f.anulada_motivo, f.origen, ISNULL(pg.pagado, 0) AS pagado, cc.plazo_dias,
        c.razonsocial AS cliente_nombre, c.rubro, CONVERT(varchar(10), c.fechareg, 23) AS fechareg, pr.primera
      FROM dbo.COM_FACTURAS f
      LEFT JOIN ${PAGADO} pg ON pg.factura_id = f.id
      LEFT JOIN dbo.COM_CLIENTES cc ON cc.cliente_codigo = f.cliente_codigo
      OUTER APPLY (SELECT TOP (1) dc.razonsocial, dc.rubro, dc.fechareg FROM DATA_CLIENTES dc WHERE LTRIM(RTRIM(dc.codigo_cliente)) = f.cliente_codigo) c
      OUTER APPLY (SELECT MIN(f2.gestion) AS primera FROM dbo.COM_FACTURAS f2 WHERE f2.cliente_codigo = f.cliente_codigo AND f2.estado = 'VIGENTE') pr
      WHERE ${where}
      ORDER BY f.fecha_emision, f.numero`, params),
    comercial.run(`
      SELECT l.factura_id, l.orden, l.monto, l.cantidad, l.regional, l.costo, l.nota_salida,
        cat.id AS categoria_id, cat.codigo, cat.nombre, cat.area, cat.subarea, cat.regla_margen
      FROM dbo.COM_FACTURA_LINEAS l
      JOIN dbo.COM_CATEGORIAS cat ON cat.id = l.categoria_id
      JOIN dbo.COM_FACTURAS f ON f.id = l.factura_id
      WHERE ${where}
      ORDER BY l.factura_id, l.orden`, params),
    comercial.run(`
      SELECT p.factura_id, p.usuario_id, p.nombre, p.porcentaje
      FROM dbo.COM_FACTURA_PERSONAS p JOIN dbo.COM_FACTURAS f ON f.id = p.factura_id
      WHERE p.rol = 'RESPONSABLE' AND ${where}`, params),
  ]);
  return {
    facturas: facturas.map(f => ({
      id: f.id, gestion: f.gestion, numero: f.numero, fecha: f.fecha, tipo: f.tipo, estado: f.estado, monto: Number(f.monto), pagado: Number(f.pagado),
      clienteCodigo: f.cliente_codigo || null, nit: f.nit || null, razonSocial: f.razon_social, clienteNombre: f.cliente_nombre || null,
      rubro: f.rubro || null, fechaRegistro: f.fechareg || null, primeraGestion: f.primera ?? null, plazoDias: f.plazo_dias,
      anuladaMotivo: f.anulada_motivo, origen: f.origen,
    })),
    lineas: lineas.map(l => ({
      facturaId: l.factura_id, orden: l.orden, monto: Number(l.monto), cantidad: l.cantidad, regional: l.regional, costo: l.costo === null ? null : Number(l.costo),
      notaSalida: l.nota_salida,
      categoria: { id: l.categoria_id, codigo: l.codigo, nombre: l.nombre, area: l.area, subarea: l.subarea, regla: l.regla_margen },
    })),
    responsables: responsables.map(r => ({ facturaId: r.factura_id, usuarioId: r.usuario_id, nombre: r.nombre, porcentaje: r.porcentaje === null ? null : Number(r.porcentaje) })),
  };
};

const reporte = async (filtros) => {
  const d = await datos(filtros);
  const [gestiones] = await Promise.all([
    comercial.run('SELECT DISTINCT gestion FROM dbo.COM_FACTURAS ORDER BY gestion DESC'),
  ]);
  return { ...armarReporte({ ...d, filtros }), gestiones: gestiones.map(g => g.gestion), filtros };
};

// ─── Excel para Contabilidad ───────────────────────────────────────────────

const AREAS_NOMBRE = { ST: 'Soporte técnico', CAL: 'Calibración', VENT: 'Ventas' };
const REGLAS_NOMBRE = {
  NETO: 'Neto de impuestos (× 0,84)',
  LOGISTICA: 'Logística (× 0,80)',
  PRODUCTO: 'Neto menos costo de almacén',
  TERCERO: 'Neto menos costo del tercero',
};
const REGIONALES = { LPZ: 'La Paz', SCZ: 'Santa Cruz' };
const ESTADO = { VIGENTE: 'Vigente', ANULADA: 'Anulada' };
const situacion = (f) => {
  if (f.estado === 'ANULADA') return 'Anulada';
  if (f.pagado >= f.monto) return 'Pagada';
  return f.pagado > 0 ? 'Pago parcial' : 'Pendiente';
};
const sumarDias = (iso, dias) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (Number(dias) || 0));
  return d.toISOString().slice(0, 10);
};

/** Libro con Resumen, Facturas, Líneas y Pagos del período (los mismos filtros que el reporte). */
const excel = async (filtros) => {
  const { where, params } = condiciones(filtros);
  const [d, referencias, pagos] = await Promise.all([
    datos(filtros),
    comercial.run(`SELECT r.factura_id, r.tipo, r.valor FROM dbo.COM_FACTURA_REFERENCIAS r JOIN dbo.COM_FACTURAS f ON f.id = r.factura_id
      WHERE ${where} ORDER BY r.id`, params),
    comercial.run(`
      SELECT p.id, CONVERT(varchar(10), p.fecha, 23) AS fecha, p.monto, p.medio, p.cliente_codigo, p.referencia, p.verificacion, p.observacion, p.estado,
        p.anulado_motivo, a.monto AS aplicado, af.numero, af.gestion, af.razon_social
      FROM dbo.COM_PAGOS p
      LEFT JOIN dbo.COM_PAGO_APLICACIONES a ON a.pago_id = p.id
      LEFT JOIN dbo.COM_FACTURAS af ON af.id = a.factura_id
      WHERE p.fecha >= @desde AND p.fecha <= @hasta
      ORDER BY p.fecha, p.id, af.numero`, params.filter(p => p.name !== 'tipo')),
  ]);
  const area = filtros.area || null;
  const rep = armarReporte({ ...d, filtros });
  const lineasDe = new Map();
  for (const l of d.lineas) lineasDe.set(l.facturaId, [...(lineasDe.get(l.facturaId) || []), l]);
  const refsDe = new Map();
  for (const r of referencias) refsDe.set(r.factura_id, [...(refsDe.get(r.factura_id) || []), r]);
  const respDe = new Map();
  for (const r of d.responsables) respDe.set(r.facturaId, [...(respDe.get(r.facturaId) || []), r]);
  const conArea = (f) => !area || (lineasDe.get(f.id) || []).some(l => l.categoria.area === area);
  const facturas = d.facturas.filter(conArea);

  const hojaResumen = {
    nombre: 'Resumen',
    columnas: [{ titulo: 'Mes', ancho: 12 }, ...rep.areas.map(a => ({ titulo: AREAS_NOMBRE[a] || a, tipo: 'bs', ancho: 16 })),
      { titulo: 'Total', tipo: 'bs', ancho: 16 }, { titulo: 'Facturas', tipo: 'entero', ancho: 10 }],
    filas: [
      ...rep.porMes.map(m => [m.mes, ...rep.areas.map(a => m.areas[a] || 0), m.total, m.facturas]),
      ['Total', ...rep.areas.map(a => rep.porArea.find(x => x.area === a)?.monto || 0), rep.resumen.facturado, rep.resumen.facturas],
    ],
  };

  const hojaFacturas = {
    nombre: 'Facturas',
    columnas: [
      { titulo: 'Gestión', tipo: 'entero', ancho: 9 }, { titulo: 'N.º', tipo: 'entero', ancho: 8 }, { titulo: 'Emisión', tipo: 'fecha', ancho: 11 },
      { titulo: 'Estado', ancho: 12 }, { titulo: 'Tipo', ancho: 10 }, { titulo: 'Código cliente', ancho: 13 }, { titulo: 'Razón social', ancho: 40 },
      { titulo: 'NIT', ancho: 14 }, { titulo: 'Monto', tipo: 'bs', ancho: 14 }, { titulo: 'Neto', tipo: 'bs', ancho: 14 },
      { titulo: 'Cobrado', tipo: 'bs', ancho: 14 }, { titulo: 'Saldo', tipo: 'bs', ancho: 14 }, { titulo: 'Vence', tipo: 'fecha', ancho: 11 },
      { titulo: 'Áreas', ancho: 12 }, { titulo: 'Cotizaciones', ancho: 22 }, { titulo: 'Nota de salida', ancho: 16 },
      { titulo: 'Responsables', ancho: 28 }, { titulo: 'Origen', ancho: 10 }, { titulo: 'Motivo de anulación', ancho: 30 },
    ],
    filas: facturas.map((f) => {
      const ls = lineasDe.get(f.id) || [];
      const neto = ls.reduce((s, l) => s + centavos(margenLinea({ regla: l.categoria.regla, monto: l.monto, costo: l.costo }).neto), 0) / 100;
      const vigente = f.estado === 'VIGENTE';
      const refs = refsDe.get(f.id) || [];
      return [
        f.gestion, f.numero, f.fecha, situacion(f), f.tipo === 'VENTA' ? 'Venta' : f.tipo === 'SERVICIO' ? 'Servicio' : '', f.clienteCodigo, f.razonSocial, f.nit,
        f.monto, vigente ? neto : null, vigente ? Math.min(f.pagado, f.monto) : null, vigente ? Math.max(0, (centavos(f.monto) - centavos(f.pagado)) / 100) : null,
        vigente ? sumarDias(f.fecha, f.plazoDias) : null,
        [...new Set(ls.map(l => l.categoria.area))].join(' + '),
        refs.filter(r => String(r.tipo).startsWith('COTIZACION')).map(r => r.valor).join(', '),
        refs.filter(r => r.tipo === 'NOTA_SALIDA').map(r => r.valor).join(', '),
        (respDe.get(f.id) || []).map(r => (r.porcentaje ? `${r.nombre} (${r.porcentaje} %)` : r.nombre)).join(', '),
        f.origen === 'EXCEL' ? 'Excel' : f.origen === 'SIN' ? 'Facturación' : 'DataMET+', f.anuladaMotivo,
      ];
    }),
  };

  const numeroDe = new Map(d.facturas.map(f => [f.id, f]));
  const hojaLineas = {
    nombre: 'Líneas',
    columnas: [
      { titulo: 'Gestión', tipo: 'entero', ancho: 9 }, { titulo: 'N.º', tipo: 'entero', ancho: 8 }, { titulo: 'Emisión', tipo: 'fecha', ancho: 11 },
      { titulo: 'Razón social', ancho: 36 }, { titulo: 'Área', ancho: 16 }, { titulo: 'Categoría', ancho: 40 }, { titulo: 'Código', ancho: 14 },
      { titulo: 'Regional', ancho: 11 }, { titulo: 'Cantidad', tipo: 'entero', ancho: 9 }, { titulo: 'Monto', tipo: 'bs', ancho: 14 },
      { titulo: 'Neto', tipo: 'bs', ancho: 14 }, { titulo: 'Costo', tipo: 'bs', ancho: 14 }, { titulo: 'Margen', tipo: 'bs', ancho: 14 },
      { titulo: 'Margen %', tipo: 'porcentaje', ancho: 10 }, { titulo: 'Regla del margen', ancho: 26 },
    ],
    filas: d.lineas
      .filter(l => numeroDe.get(l.facturaId)?.estado === 'VIGENTE' && (!area || l.categoria.area === area))
      .map((l) => {
        const f = numeroDe.get(l.facturaId);
        const m = margenLinea({ regla: l.categoria.regla, monto: l.monto, costo: l.costo });
        return [
          f.gestion, f.numero, f.fecha, f.razonSocial, AREAS_NOMBRE[l.categoria.area] || l.categoria.area, l.categoria.nombre, l.categoria.codigo,
          REGIONALES[l.regional] || '', l.cantidad, l.monto, m.neto, l.costo, m.margen, m.porcentaje === null ? null : m.porcentaje / 100,
          m.margen === null ? 'Por costear' : REGLAS_NOMBRE[l.categoria.regla] || l.categoria.regla,
        ];
      }),
  };

  const hojaPagos = {
    nombre: 'Pagos',
    columnas: [
      { titulo: 'Pago', tipo: 'entero', ancho: 8 }, { titulo: 'Fecha', tipo: 'fecha', ancho: 11 }, { titulo: 'Monto del pago', tipo: 'bs', ancho: 15 },
      { titulo: 'Medio', ancho: 14 }, { titulo: 'Estado', ancho: 10 }, { titulo: 'Código cliente', ancho: 13 }, { titulo: 'Referencia', ancho: 20 },
      { titulo: 'Verificación', ancho: 22 }, { titulo: 'Factura', ancho: 12 }, { titulo: 'Razón social', ancho: 36 }, { titulo: 'Aplicado', tipo: 'bs', ancho: 14 },
      { titulo: 'Observación', ancho: 30 },
    ],
    filas: pagos.map(p => [
      p.id, p.fecha, Number(p.monto), p.medio, ESTADO[p.estado] || (p.estado === 'ANULADO' ? 'Anulado' : p.estado), p.cliente_codigo, p.referencia, p.verificacion,
      p.numero ? `${p.numero}/${p.gestion}` : 'Sin aplicar', p.razon_social, p.aplicado === null ? null : Number(p.aplicado),
      p.estado === 'ANULADO' ? `Anulado: ${p.anulado_motivo || ''}` : p.observacion,
    ]),
  };

  const nombre = `comercial-${filtros.desde}-a-${filtros.hasta}${area ? `-${area.toLowerCase()}` : ''}.xlsx`;
  return { buffer: crearLibro([hojaResumen, hojaFacturas, hojaLineas, hojaPagos]), nombre };
};

module.exports = { datos, excel, reporte };
