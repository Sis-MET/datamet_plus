const { createOperations } = require('../services/ivmet.operations');
function createStaffMiddleware(service = createOperations()) {
  return async (req, res, next) => {
    // Las operaciones nuevas comprueban su permiso dentro de cada RPC.
    if (req.path.startsWith('/ops/')) return next();
    const capability =
      /^\/(integration|onboarding|legacy)(\/|$)/.test(req.path) ||
      req.path.startsWith('/actions/scope.')
        ? 'integration'
        : 'commercial';
    try {
      req.ivmetStaff = await service.authorize(
        'RIMMET:' + req.user.usuario.trim().toLowerCase(),
        capability
      );
      next();
    } catch (error) {
      res
        .status(error.statusCode || 503)
        .json({
          success: false,
          code: error.code || 'STAFF_UNAVAILABLE',
          message: error.statusCode
            ? error.message
            : 'No se pudo comprobar tu permiso IvMET.',
        });
    }
  };
}
module.exports = { createStaffMiddleware };
