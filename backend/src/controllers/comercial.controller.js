const comercial = require('../services/comercial.service');
const bitrix = require('../services/comercial.bitrix');
const reportes = require('../services/comercial.reportes');
const comisiones = require('../services/comercial.comisiones');
const permisos = require('../services/permisos');
const { hoyLaPaz } = require('../services/comercial.domain');

/** Quién ve qué en Comisiones: las de todos con el permiso; si no, solo las suyas. */
const contextoComisiones = async (req) => {
  const [ver, gestionar] = await Promise.all([
    permisos.tienePermiso(req.user, 'comisiones.comercial.ver'),
    permisos.tienePermiso(req.user, 'comisiones.comercial.gestionar'),
  ]);
  return { todos: ver || gestionar, gestionar, usuarioId: Number(req.user?.id) || null };
};

const enviarExcel = (res, { buffer, nombre }) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.send(buffer);
};
const { parse } = require('../services/comercial.validation');

const readId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error('Identificador inválido.'), { statusCode: 400 });
  }
  return id;
};

const readCodigo = (value) => {
  const codigo = String(value || '').trim();
  if (!/^[0-9A-Za-z-]{1,20}$/.test(codigo)) {
    throw Object.assign(new Error('Código de cliente inválido.'), { statusCode: 400 });
  }
  return codigo;
};

/**
 * Tras registrar o anular una factura se recalculan sus enlaces con las
 * negociaciones de Bitrix24. Sin la migración 035 o sin copia, no pasa nada.
 */
const enlazarDespues = async (factura) => {
  try {
    await bitrix.reconstruirEnlaces();
  } catch (error) {
    if (error.statusCode !== 503) console.warn(`Enlaces con Bitrix24: ${error.message}`);
  }
  return factura;
};

/** Tras registrar o anular un pago cambia lo que le falta a Bitrix24 (Cerrado Ganado). */
const recalcularDespues = async (pago) => {
  try {
    await bitrix.recalcularPendientes();
  } catch (error) {
    if (error.statusCode !== 503) console.warn(`Pendientes de Bitrix24: ${error.message}`);
  }
  return pago;
};

/** Responde { success, data }; los errores conocidos salen con su código. */
const handle = (action, status = 200) => async (req, res, next) => {
  try {
    const data = await action(req);
    res.status(status).json({ success: true, data });
  } catch (error) {
    if ([400, 403, 404, 409, 502, 503, 504].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
};

module.exports = {
  // El nivel con que entra el usuario: 'area' (registra) o 'consulta'.
  acceso: handle(req => ({ nivel: req.accesoArea })),
  categorias: handle(() => comercial.listCategorias()),
  personal: handle(() => comercial.listPersonal()),
  buscarClientes: handle(req => comercial.buscarClientes(parse('busqueda', req.query))),
  getCliente: handle(req => comercial.getCliente(readCodigo(req.params.codigo))),
  guardarCliente: handle(req => comercial.guardarCliente(readCodigo(req.params.codigo), parse('cliente', req.body), req.user)),

  listFacturas: handle(req => comercial.listFacturas(parse('filtrosFacturas', req.query))),
  siguienteNumero: handle(req => comercial.siguienteNumero(parse('gestion', req.query).gestion)),
  getFactura: handle(async (req) => {
    const id = readId(req.params.id);
    const factura = await comercial.getFactura(id);
    return { ...factura, negociaciones: await bitrix.negociacionesDeFactura(id) };
  }),
  crearFactura: handle(async (req) => enlazarDespues(await comercial.crearFactura(parse('factura', req.body), req.user)), 201),
  anularFactura: handle(async (req) => enlazarDespues(await comercial.anularFactura(readId(req.params.id), parse('anulacion', req.body), req.user))),

  listPagos: handle(req => comercial.listPagos(parse('filtrosPagos', req.query))),
  getPago: handle(req => comercial.getPago(readId(req.params.id))),
  crearPago: handle(async (req) => recalcularDespues(await comercial.crearPago(parse('pago', req.body), req.user)), 201),
  anularPago: handle(async (req) => recalcularDespues(await comercial.anularPago(readId(req.params.id), parse('anulacion', req.body), req.user))),

  cobranza: handle(req => comercial.cobranza(parse('filtrosFacturas', req.query))),

  bitrixEstado: handle(() => bitrix.estado()),
  bitrixNegociaciones: handle(req => bitrix.listNegociaciones(parse('filtrosBitrix', req.query))),
  bitrixNegociacion: handle(req => bitrix.getNegociacion(readId(req.params.id))),
  bitrixSincronizar: handle(req => bitrix.sincronizarEnSegundoPlano({
    por: String(req.user?.usuario || 'usuario'), completa: parse('sincronizacion', req.body).completa,
  }), 202),
  bitrixUsuarios: handle(() => bitrix.listUsuarios()),
  bitrixConfirmarUsuario: handle(req => bitrix.confirmarUsuario(readId(req.params.id), parse('equivalencia', req.body), req.user)),
  bitrixActualizar: handle(req => bitrix.actualizarNegociacion(readId(req.params.id), parse('actualizacionBitrix', req.body), req.user)),
  bitrixPendientes: handle(() => bitrix.resumenPendientes()),
  bitrixActualizarPendientes: handle(req => bitrix.actualizarPendientesEnSegundoPlano(parse('actualizacionMasiva', req.body), req.user), 202),

  reportes: handle(req => reportes.reporte(parse('filtrosReportes', req.query))),
  // El libro de Excel para Contabilidad, con los mismos filtros del reporte.
  reportesExcel: async (req, res, next) => {
    try {
      return enviarExcel(res, await reportes.excel(parse('filtrosReportes', req.query)));
    } catch (error) {
      if ([400, 503].includes(error.statusCode)) return res.status(error.statusCode).json({ success: false, message: error.message });
      return next(error);
    }
  },

  comisiones: handle(async (req) => {
    const ctx = await contextoComisiones(req);
    const { gestion } = parse('gestionComision', req.query);
    return { ...(await comisiones.resumenGestion(gestion || Number(hoyLaPaz().slice(0, 4)), ctx)), puede: { todos: ctx.todos, gestionar: ctx.gestionar } };
  }),
  comisionesMes: handle(async (req) => {
    const ctx = await contextoComisiones(req);
    const { gestion, mes } = parse('mesComision', req.params);
    return { ...(await comisiones.detalleMes(gestion, mes, ctx)), puede: { todos: ctx.todos, gestionar: ctx.gestionar } };
  }),
  comisionesExcel: async (req, res, next) => {
    try {
      const ctx = await contextoComisiones(req);
      const { gestion, mes } = parse('mesComision', req.params);
      return enviarExcel(res, await comisiones.excelMes(gestion, mes, ctx));
    } catch (error) {
      if ([400, 503].includes(error.statusCode)) return res.status(error.statusCode).json({ success: false, message: error.message });
      return next(error);
    }
  },
  comisionesReglas: handle(async (req) => ({ ...(await comisiones.listReglas()), puede: { gestionar: (await contextoComisiones(req)).gestionar } })),
  comisionesCrearRegla: handle(req => comisiones.crearRegla(parse('reglaComision', req.body), req.user), 201),
  comisionesCerrar: handle(req => {
    const { gestion, mes } = parse('mesComision', req.params);
    return comisiones.cerrarMes(gestion, mes, req.user);
  }, 201),
  comisionesAnularCierre: handle(req => comisiones.anularCierre(readId(req.params.id), parse('anulacion', req.body), req.user)),
};
