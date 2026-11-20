/**
 * Comisiones de Comercial (fase 4) sin base de datos.
 *
 * Decisiones de Comercial (2026-11-20): la comisión se gana al facturar (por
 * el mes de emisión); cada responsable comercial comisiona según su
 * porcentaje en la factura (si no tiene, partes iguales); las reglas son
 * configurables por versiones con fecha de vigencia, con las del Excel por
 * omisión:
 *
 *   margen de la línea  < 20 %  → 0 %
 *                  20 % a 30 %  → 0,6 %
 *                     > 30 %    → 1 %   (los servicios, con margen 84 %)
 *
 * sobre el monto de la línea, solo en las categorías que comisionan; una
 * venta sin costo no comisiona hasta que tenga costo. El margen es el de la
 * ficha de la factura (comercial.domain.margenLinea).
 */
const { centavos, margenLinea } = require('./comercial.domain');

/** Reglas del Excel (la versión que siembra la migración 037). */
const TRAMOS_EXCEL = Object.freeze([{ desde: 0, tasa: 0 }, { desde: 20, tasa: 0.6 }, { desde: 30.01, tasa: 1 }]);

/** La versión de las reglas que rige en una fecha: la última con vigencia hasta ese día. */
const reglaVigente = (reglas, fecha) => [...reglas]
  .filter(r => r.vigenteDesde <= fecha)
  .sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? 1 : -1))[0] || null;

/** Tasa % del tramo que corresponde a un margen %: el de mayor «desde» que no lo pasa. */
const tasaDe = (tramos, margen) => {
  let tasa = 0;
  for (const t of [...tramos].sort((a, b) => a.desde - b.desde)) if (margen >= t.desde) tasa = t.tasa;
  return tasa;
};

/**
 * Problemas de una versión nueva de las reglas (el servidor la rechaza si hay
 * alguno): los tramos empiezan en 0 %, suben sin repetirse y cada tasa va de
 * 0 % a 10 %; al menos una categoría comisiona.
 */
const problemasReglas = ({ tramos, categorias }) => {
  const problemas = [];
  if (!tramos.length) problemas.push('Agrega al menos un tramo.');
  const orden = [...tramos].sort((a, b) => a.desde - b.desde);
  if (orden.length && orden[0].desde !== 0) problemas.push('El primer tramo empieza en 0 % de margen.');
  if (new Set(orden.map(t => t.desde)).size !== orden.length) problemas.push('Dos tramos empiezan en el mismo margen.');
  if (orden.some(t => t.desde < 0 || t.desde > 100)) problemas.push('El margen de un tramo va de 0 % a 100 %.');
  if (orden.some(t => t.tasa < 0 || t.tasa > 10)) problemas.push('La tasa de un tramo va de 0 % a 10 %.');
  if (!categorias.length) problemas.push('Elige al menos una categoría que comisiona.');
  return problemas;
};

const repartir = (monto, partes) => {
  const montos = partes.map(p => Math.round(monto * p));
  if (Math.abs(partes.reduce((s, p) => s + p, 0) - 1) < 1e-9) montos[0] += monto - montos.reduce((s, m) => s + m, 0);
  return montos;
};

/**
 * Comisiones de un período.
 *
 * facturas      vigentes: [{ id, gestion, numero, fecha, razonSocial }]
 * lineas        [{ facturaId, monto, costo, categoria: { id, nombre, area, regla } }]
 * responsables  [{ facturaId, usuarioId, nombre, porcentaje }]
 * reglas        [{ id, vigenteDesde, base, tramos, categorias, ventaSinCosto }]
 *
 * Devuelve las líneas con lo que comisionan (o por qué no), el total por
 * responsable, lo que queda sin responsable y lo que espera su costo.
 * Montos en bolivianos; las cuentas, en centavos.
 */
const calcularComisiones = ({ facturas, lineas, responsables, reglas }) => {
  const facturaDe = new Map(facturas.map(f => [f.id, f]));
  const responsablesDe = new Map();
  for (const r of responsables) responsablesDe.set(r.facturaId, [...(responsablesDe.get(r.facturaId) || []), r]);

  const detalle = [];
  const personas = new Map();
  const totales = { base: 0, comision: 0, sinResponsable: 0, porCostear: 0, lineasPorCostear: 0 };
  const reglasUsadas = new Set();

  for (const l of lineas) {
    const f = facturaDe.get(l.facturaId);
    if (!f) continue;
    const regla = reglaVigente(reglas, f.fecha);
    const monto = centavos(l.monto);
    const fila = {
      facturaId: f.id, gestion: f.gestion, numero: f.numero, fecha: f.fecha, razonSocial: f.razonSocial,
      categoriaId: l.categoria.id, categoria: l.categoria.nombre, area: l.categoria.area, montoLinea: monto / 100,
      base: 0, margen: null, tasa: 0, comision: 0, reglaId: regla?.id ?? null, estado: 'comisiona', personas: [],
    };
    if (!regla) {
      detalle.push({ ...fila, estado: 'sin_regla' });
      continue;
    }
    if (!regla.categorias.includes(l.categoria.id)) {
      detalle.push({ ...fila, estado: 'categoria' });
      continue;
    }
    const { neto, margen, porcentaje } = margenLinea({ regla: l.categoria.regla, monto: l.monto, costo: l.costo });
    let margenPct = porcentaje;
    if (margen === null) {
      if (!regla.ventaSinCosto) {
        totales.porCostear += monto;
        totales.lineasPorCostear += 1;
        detalle.push({ ...fila, estado: 'por_costear' });
        continue;
      }
      margenPct = monto > 0 ? (neto / l.monto) * 100 : 0;
    }
    const base = regla.base === 'NETO' ? centavos(neto) : monto;
    const tasa = tasaDe(regla.tramos, margenPct);
    const comision = Math.round((base * tasa) / 100);
    reglasUsadas.add(regla.id);
    fila.base = base / 100;
    fila.margen = Math.round(margenPct * 100) / 100;
    fila.tasa = tasa;
    fila.comision = comision / 100;
    if (!comision) fila.estado = 'bajo_tramo';
    totales.base += base;
    totales.comision += comision;

    const resp = responsablesDe.get(f.id) || [];
    if (!resp.length) {
      totales.sinResponsable += comision;
      fila.estado = comision ? 'sin_responsable' : fila.estado;
      detalle.push(fila);
      continue;
    }
    const partes = resp.map(p => (p.porcentaje ? Number(p.porcentaje) / 100 : 1 / resp.length));
    const comisiones = repartir(comision, partes);
    const bases = repartir(base, partes);
    resp.forEach((p, i) => {
      const clave = p.usuarioId ? `U:${p.usuarioId}` : `N:${String(p.nombre).trim().toUpperCase()}`;
      if (!personas.has(clave)) personas.set(clave, { usuarioId: p.usuarioId ?? null, nombre: p.nombre, base: 0, comision: 0, facturas: new Set(), lineas: 0 });
      const per = personas.get(clave);
      per.base += bases[i];
      per.comision += comisiones[i];
      per.facturas.add(f.id);
      per.lineas += 1;
      fila.personas.push({ usuarioId: p.usuarioId ?? null, nombre: p.nombre, porcentaje: Math.round(partes[i] * 10000) / 100, comision: comisiones[i] / 100 });
    });
    detalle.push(fila);
  }

  return {
    lineas: detalle,
    personas: [...personas.values()]
      .map(p => ({ usuarioId: p.usuarioId, nombre: p.nombre, base: p.base / 100, comision: p.comision / 100, facturas: p.facturas.size, lineas: p.lineas }))
      .sort((a, b) => b.comision - a.comision || a.nombre.localeCompare(b.nombre)),
    totales: {
      base: totales.base / 100,
      comision: totales.comision / 100,
      sinResponsable: totales.sinResponsable / 100,
      porCostear: totales.porCostear / 100,
      lineasPorCostear: totales.lineasPorCostear,
    },
    reglas: [...reglasUsadas].sort((a, b) => a - b),
  };
};

/** Solo lo de una persona (quien ve las suyas sin el permiso de ver todas). */
const soloDe = (calculo, usuarioId) => {
  const lineas = calculo.lineas
    .filter(l => l.personas.some(p => p.usuarioId === usuarioId))
    .map(l => ({ ...l, personas: l.personas.filter(p => p.usuarioId === usuarioId) }));
  const persona = calculo.personas.find(p => p.usuarioId === usuarioId);
  return {
    lineas,
    personas: persona ? [persona] : [],
    totales: { base: persona?.base || 0, comision: persona?.comision || 0, sinResponsable: 0, porCostear: 0, lineasPorCostear: 0 },
    reglas: calculo.reglas,
  };
};

module.exports = { TRAMOS_EXCEL, calcularComisiones, problemasReglas, reglaVigente, soloDe, tasaDe };
