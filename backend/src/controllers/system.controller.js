const changes = require('../services/system.changes');
const failures = require('../services/system.failures');
const { parse } = require('../services/system.validation');

const readId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error('Identificador inválido.'), { statusCode: 400 });
  }
  return id;
};

/** Responde { success, data }; los errores conocidos salen con su código. */
const handle = (action) => async (req, res, next) => {
  try {
    const data = await action(req);
    res.status(200).json({ success: true, data });
  } catch (error) {
    if ([400, 403, 404, 409].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (/Invalid object name 'dbo\.APP_/i.test(error.message || '')) {
      return res.status(503).json({
        success: false,
        message: 'Falta la migración 007 (control de cambios y fallas) en la base de datos. Ejecuta "pnpm migrate" en backend.',
      });
    }
    return next(error);
  }
};

module.exports = {
  listCambios: handle(req => changes.listCambios(req.user)),
  getCambio: handle(req => changes.getCambio(readId(req.params.id), req.user)),
  createCambio: handle(req => changes.createCambio(parse('cambio', req.body), req.user)),
  updateCambio: handle(req => changes.updateCambio(readId(req.params.id), parse('cambio', req.body), req.user)),
  validarCambio: handle(req => changes.validarCambio(readId(req.params.id), parse('validacionCambio', req.body), req.user)),
  aprobarCambio: handle(req => changes.aprobarCambio(readId(req.params.id), parse('aprobacionCambio', req.body), req.user)),
  implementarCambio: handle(req => changes.implementarCambio(readId(req.params.id), parse('implementacionCambio', req.body), req.user)),

  listFallas: handle(() => failures.listFallas()),
  getResumenFallas: handle(() => failures.getResumenFallas()),
  getFalla: handle(req => failures.getFalla(readId(req.params.id))),
  createFalla: handle(req => failures.createFalla(parse('fallaManual', req.body), req.user)),
  atenderFalla: handle(req => failures.atenderFalla(readId(req.params.id), parse('atencionFalla', req.body), req.user)),
};
