const env = require('../config/env');
const {
  createAccessService,
  ACCESS_HEADER,
} = require('../services/ivmet.access-service');

function createAccessMiddleware(
  service = createAccessService({
    codeHash: env.ivmet.accessCodeHash,
    secret: env.jwt.secret,
  }),
) {
  const context = (req) => ({
    user: req.user,
    authorization: req.headers.authorization,
    ticket: req.headers[ACCESS_HEADER],
  });
  const noStore = (res) => res.set('Cache-Control', 'no-store');
  return {
    status(req, res) {
      noStore(res);
      return res.json({ success: true, data: service.status(context(req)) });
    },
    async unlock(req, res) {
      noStore(res);
      try {
        const data = await service.unlock({ ...context(req), body: req.body });
        return res.json({ success: true, data });
      } catch (error) {
        // Nunca imprimir el body, el código, el hash ni los tokens.
        if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
        return res
          .status(error.statusCode || 503)
          .json({
            success: false,
            code: error.code || 'IVMET_ACCESS_UNAVAILABLE',
            message: error.statusCode
              ? error.message
              : 'No se pudo validar el acceso. Inténtalo nuevamente.',
            ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
          });
      }
    },
    requireAccess(req, res, next) {
      noStore(res);
      if (service.status(context(req)).unlocked) return next();
      return res
        .status(403)
        .json({
          success: false,
          code: 'IVMET_ACCESS_CODE_REQUIRED',
          message:
            'Gestión IvMET se encuentra en desarrollo. Introduce el código de acceso autorizado.',
        });
    },
  };
}

module.exports = { createAccessMiddleware };
