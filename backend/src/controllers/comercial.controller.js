const comercial = require('../services/comercial.service');
const bitrix = require('../services/comercial.bitrix');
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

/** Responde { success, data }; los errores conocidos salen con su código. */
const handle = (action, status = 200) => async (req, res, next) => {
  try {
    const data = await action(req);
    res.status(status).json({ success: true, data });
  } catch (error) {
    if ([400, 403, 404, 409, 503].includes(error.statusCode)) {
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
  crearPago: handle(req => comercial.crearPago(parse('pago', req.body), req.user), 201),
  anularPago: handle(req => comercial.anularPago(readId(req.params.id), parse('anulacion', req.body), req.user)),

  cobranza: handle(req => comercial.cobranza(parse('filtrosFacturas', req.query))),

  bitrixEstado: handle(() => bitrix.estado()),
  bitrixNegociaciones: handle(req => bitrix.listNegociaciones(parse('filtrosBitrix', req.query))),
  bitrixNegociacion: handle(req => bitrix.getNegociacion(readId(req.params.id))),
  bitrixSincronizar: handle(req => bitrix.sincronizarEnSegundoPlano({
    por: String(req.user?.usuario || 'usuario'), completa: parse('sincronizacion', req.body).completa,
  }), 202),
  bitrixUsuarios: handle(() => bitrix.listUsuarios()),
  bitrixConfirmarUsuario: handle(req => bitrix.confirmarUsuario(readId(req.params.id), parse('equivalencia', req.body), req.user)),
};
