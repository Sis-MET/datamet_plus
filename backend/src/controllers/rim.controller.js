const rims = require('../services/rim.registros');
const { parse } = require('../services/rim.validation');
const { withTransaction } = require('../services/calibration.db');

const readId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error('Identificador inválido.'), { statusCode: 400 });
  }
  return id;
};

const readGestion = (value) => {
  if (value === undefined || value === '') return rims.gestionActual();
  const gestion = Number(value);
  if (!Number.isInteger(gestion) || gestion < 2020 || gestion > 2099) {
    throw Object.assign(new Error('Gestión inválida.'), { statusCode: 400 });
  }
  return gestion;
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
  listRegistros: handle(req => rims.listRims(parse('filtros', req.query))),
  getFiltros: handle(() => rims.getFiltros()),
  getRegistro: handle(req => rims.getRim(readId(req.params.n), req.user)),
  anularRegistro: handle(req => rims.anularRim(readId(req.params.n), parse('anulacion', req.body), req.user)),
  registrarEjecucion: handle(req => rims.registrarEjecucion(readId(req.params.n), parse('ejecucion', req.body), req.user), 201),
  registrarEntrega: handle(req => rims.registrarEntrega(readId(req.params.n), parse('entrega', req.body), req.user), 201),
  createRegistro: handle(
    req => rims.createWebRim(parse('registroWeb', req.body), req.user, { withTransaction }),
    201,
  ),
  listTalonarios: handle(req => rims.listTalonarios(readGestion(req.query.gestion), req.user)),
  cerrarTalonario: handle(req => rims.cerrarTalonario(readId(req.params.id), parse('cierreTalonario', req.body), req.user)),
};
