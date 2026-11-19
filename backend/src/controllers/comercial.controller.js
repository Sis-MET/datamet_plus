const comercial = require('../services/comercial.service');
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
  getFactura: handle(req => comercial.getFactura(readId(req.params.id))),
  crearFactura: handle(req => comercial.crearFactura(parse('factura', req.body), req.user), 201),
  anularFactura: handle(req => comercial.anularFactura(readId(req.params.id), parse('anulacion', req.body), req.user)),

  listPagos: handle(req => comercial.listPagos(parse('filtrosPagos', req.query))),
  getPago: handle(req => comercial.getPago(readId(req.params.id))),
  crearPago: handle(req => comercial.crearPago(parse('pago', req.body), req.user), 201),
  anularPago: handle(req => comercial.anularPago(readId(req.params.id), parse('anulacion', req.body), req.user)),

  cobranza: handle(req => comercial.cobranza(parse('filtrosFacturas', req.query))),
};
