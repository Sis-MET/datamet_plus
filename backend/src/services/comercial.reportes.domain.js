/**
 * Reportes de Comercial (fase 4) sin base de datos: reemplazan las tablas
 * dinámicas del Excel (REP 2026, REPORTE 2026, REPORTE COM) con cuentas que
 * salen de las facturas, sus líneas y sus responsables.
 *
 * - Se cuentan solo las facturas vigentes; los montos van por línea, así que
 *   el filtro de área toma solo las líneas de esa área, y lo cobrado de cada
 *   factura se reparte en proporción.
 * - Neto y margen, como la ficha de la factura (comercial.domain.margenLinea):
 *   una venta sin costo queda «por costear» y no entra en el margen.
 * - Cliente nuevo: registrado en DataMET (DATA_CLIENTES.fechareg) en la misma
 *   gestión de la factura y sin facturas de gestiones anteriores.
 * - Responsables: cada uno con su porcentaje (50 / 50 por omisión si son dos).
 */
const { centavos, margenLinea } = require('./comercial.domain');

const ORDEN_AREAS = ['ST', 'CAL', 'VENT'];
const ordenArea = (a) => (ORDEN_AREAS.includes(a) ? ORDEN_AREAS.indexOf(a) : ORDEN_AREAS.length);
const bs = (c) => c / 100;

/** Meses «2026-01» … del rango, para que un mes sin ventas aparezca en cero. */
const mesesEntre = (desde, hasta) => {
  const meses = [];
  let [a, m] = String(desde).slice(0, 7).split('-').map(Number);
  const [fa, fm] = String(hasta).slice(0, 7).split('-').map(Number);
  while (a < fa || (a === fa && m <= fm)) {
    meses.push(`${a}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; a += 1; }
    if (meses.length > 120) break;
  }
  return meses;
};

const claveCliente = (f) => (f.clienteCodigo ? `C:${f.clienteCodigo}` : f.nit ? `N:${f.nit}` : `R:${String(f.razonSocial || '').trim().toUpperCase()}`);

/** nuevo | regular | sin_cliente para la gestión de la factura. */
const tipoCliente = (f) => {
  if (!f.clienteCodigo) return 'sin_cliente';
  const anioAlta = f.fechaRegistro ? Number(String(f.fechaRegistro).slice(0, 4)) : null;
  const primera = f.primeraGestion ?? f.gestion;
  return anioAlta === f.gestion && primera >= f.gestion ? 'nuevo' : 'regular';
};

const sumar = (mapa, clave, inicial) => {
  if (!mapa.has(clave)) mapa.set(clave, inicial());
  return mapa.get(clave);
};

/**
 * facturas      [{ id, gestion, numero, fecha, estado, monto, pagado, clienteCodigo, nit, razonSocial,
 *                  clienteNombre, rubro, fechaRegistro, primeraGestion }]
 * lineas        [{ facturaId, monto, cantidad, regional, costo, categoria: { id, codigo, nombre, area, regla } }]
 * responsables  [{ facturaId, usuarioId, nombre, porcentaje }]
 * filtros       { desde, hasta, area }
 */
const armarReporte = ({ facturas, lineas, responsables, filtros }) => {
  const area = filtros.area || null;
  const lineasDe = new Map();
  for (const l of lineas) sumar(lineasDe, l.facturaId, () => []).push(l);
  const responsablesDe = new Map();
  for (const r of responsables) sumar(responsablesDe, r.facturaId, () => []).push(r);

  const meses = mesesEntre(filtros.desde, filtros.hasta);
  const porMes = new Map(meses.map(m => [m, { mes: m, areas: {}, total: 0, facturas: 0 }]));
  const porArea = new Map();
  const porCategoria = new Map();
  const porResponsable = new Map();
  const porCliente = new Map();
  const porRubro = new Map();
  const porRegional = new Map();
  const combinaciones = new Map();
  const tipos = { nuevo: { clientes: new Set(), monto: 0 }, regular: { clientes: new Set(), monto: 0 }, sin_cliente: { clientes: new Set(), monto: 0 } };
  const resumen = { facturado: 0, cobrado: 0, neto: 0, margen: 0, conMargen: 0, porCostear: 0, facturas: 0, anuladas: 0, conRubro: 0 };

  for (const f of facturas) {
    if (f.estado !== 'VIGENTE') {
      resumen.anuladas += 1;
      continue;
    }
    const todas = lineasDe.get(f.id) || [];
    const incluidas = area ? todas.filter(l => l.categoria.area === area) : todas;
    const montoFactura = centavos(f.monto);
    const monto = area ? incluidas.reduce((s, l) => s + centavos(l.monto), 0) : montoFactura;
    if (!(monto > 0)) continue;
    const proporcion = montoFactura > 0 ? monto / montoFactura : 0;
    const cobrado = Math.round(Math.min(centavos(f.pagado), montoFactura) * proporcion);
    const mes = String(f.fecha).slice(0, 7);

    resumen.facturado += monto;
    resumen.cobrado += cobrado;
    resumen.facturas += 1;
    const filaMes = porMes.get(mes);
    if (filaMes) {
      filaMes.total += monto;
      filaMes.facturas += 1;
    }

    const areasFactura = new Set();
    for (const l of incluidas) {
      const m = centavos(l.monto);
      const { neto, margen } = margenLinea({ regla: l.categoria.regla, monto: l.monto, costo: l.costo });
      const a = l.categoria.area;
      areasFactura.add(a);
      resumen.neto += centavos(neto);
      if (margen === null) resumen.porCostear += m;
      else {
        resumen.margen += centavos(margen);
        resumen.conMargen += m;
      }
      if (filaMes) filaMes.areas[a] = (filaMes.areas[a] || 0) + m;
      const fa = sumar(porArea, a, () => ({ area: a, monto: 0, neto: 0, margen: 0, conMargen: 0, porCostear: 0, facturas: new Set() }));
      fa.monto += m;
      fa.neto += centavos(neto);
      fa.facturas.add(f.id);
      if (margen === null) fa.porCostear += m;
      else {
        fa.margen += centavos(margen);
        fa.conMargen += m;
      }
      const fc = sumar(porCategoria, l.categoria.id, () => ({
        categoriaId: l.categoria.id, codigo: l.categoria.codigo, nombre: l.categoria.nombre, area: a, monto: 0, cantidad: 0, lineas: 0,
      }));
      fc.monto += m;
      fc.cantidad += Number(l.cantidad) || 0;
      fc.lineas += 1;
      const reg = l.regional || 'SIN';
      porRegional.set(reg, (porRegional.get(reg) || 0) + m);
    }
    if (areasFactura.size > 1) {
      const clave = [...areasFactura].sort((x, y) => ordenArea(x) - ordenArea(y)).join(' + ');
      const c = sumar(combinaciones, clave, () => ({ areas: clave, facturas: 0, monto: 0 }));
      c.facturas += 1;
      c.monto += monto;
    }

    // Responsables: su parte del monto incluido.
    const resp = responsablesDe.get(f.id) || [];
    if (!resp.length) {
      const r = sumar(porResponsable, 'sin', () => ({ usuarioId: null, nombre: 'Sin responsable', monto: 0, facturas: 0 }));
      r.monto += monto;
      r.facturas += 1;
    }
    // Si las partes suman el 100 %, el centavo del redondeo va al primero: el total cuadra.
    const partes = resp.map(p => (p.porcentaje ? Number(p.porcentaje) / 100 : 1 / resp.length));
    const montos = partes.map(parte => Math.round(monto * parte));
    if (Math.abs(partes.reduce((s, x) => s + x, 0) - 1) < 1e-9) montos[0] += monto - montos.reduce((s, x) => s + x, 0);
    resp.forEach((p, i) => {
      const clave = p.usuarioId ? `U:${p.usuarioId}` : `N:${String(p.nombre).trim().toUpperCase()}`;
      const r = sumar(porResponsable, clave, () => ({ usuarioId: p.usuarioId ?? null, nombre: p.nombre, monto: 0, facturas: 0 }));
      r.monto += montos[i];
      r.facturas += 1;
    });

    const kc = claveCliente(f);
    const tc = tipoCliente(f);
    const cl = sumar(porCliente, kc, () => ({
      codigo: f.clienteCodigo || null, razonSocial: f.clienteNombre || f.razonSocial, monto: 0, facturas: 0, tipo: tc,
    }));
    cl.monto += monto;
    cl.facturas += 1;
    if (tc === 'nuevo') cl.tipo = 'nuevo';
    tipos[tc].clientes.add(kc);
    tipos[tc].monto += monto;

    const rubro = String(f.rubro || '').trim();
    if (rubro) resumen.conRubro += 1;
    const ru = sumar(porRubro, rubro || '', () => ({ rubro: rubro || null, monto: 0, facturas: 0 }));
    ru.monto += monto;
    ru.facturas += 1;
  }

  const desc = (a, b) => b.monto - a.monto;
  const clientes = [...porCliente.values()].sort(desc);
  const TOP = 15;
  const otros = clientes.slice(TOP);
  const areas = [...porArea.keys()].sort((x, y) => ordenArea(x) - ordenArea(y));

  return {
    periodo: { desde: filtros.desde, hasta: filtros.hasta },
    areas,
    resumen: {
      facturado: bs(resumen.facturado),
      cobrado: bs(resumen.cobrado),
      saldo: bs(resumen.facturado - resumen.cobrado),
      neto: bs(resumen.neto),
      margen: bs(resumen.margen),
      margenPorcentaje: resumen.conMargen ? Math.round((resumen.margen / resumen.conMargen) * 1000) / 10 : null,
      porCostear: bs(resumen.porCostear),
      facturas: resumen.facturas,
      anuladas: resumen.anuladas,
      clientes: porCliente.size,
      clientesNuevos: tipos.nuevo.clientes.size,
      ticketPromedio: resumen.facturas ? bs(Math.round(resumen.facturado / resumen.facturas)) : 0,
    },
    porMes: [...porMes.values()].map(m => ({
      mes: m.mes, total: bs(m.total), facturas: m.facturas, areas: Object.fromEntries(Object.entries(m.areas).map(([a, v]) => [a, bs(v)])),
    })),
    porArea: areas.map(a => {
      const x = porArea.get(a);
      return {
        area: a, monto: bs(x.monto), neto: bs(x.neto), margen: bs(x.margen), porCostear: bs(x.porCostear), facturas: x.facturas.size,
        margenPorcentaje: x.conMargen ? Math.round((x.margen / x.conMargen) * 1000) / 10 : null,
      };
    }),
    porCategoria: [...porCategoria.values()].sort(desc).map(c => ({ ...c, monto: bs(c.monto) })),
    porResponsable: [...porResponsable.values()].sort(desc).map(r => ({ ...r, monto: bs(r.monto) })),
    porCliente: clientes.slice(0, TOP).map(c => ({ ...c, monto: bs(c.monto) })),
    otrosClientes: { clientes: otros.length, monto: bs(otros.reduce((s, c) => s + c.monto, 0)) },
    tiposCliente: Object.fromEntries(Object.entries(tipos).map(([k, v]) => [k, { clientes: v.clientes.size, monto: bs(v.monto) }])),
    porRubro: [...porRubro.values()].sort(desc).map(r => ({ ...r, monto: bs(r.monto) })),
    rubroCobertura: { conRubro: resumen.conRubro, facturas: resumen.facturas },
    porRegional: [...porRegional].map(([regional, m]) => ({ regional: regional === 'SIN' ? null : regional, monto: bs(m) })).sort(desc),
    variasAreas: [...combinaciones.values()].sort(desc).map(c => ({ ...c, monto: bs(c.monto) })),
  };
};

module.exports = { armarReporte, mesesEntre, tipoCliente };
