const env = require('../config/env');

const requireIvmetEnabled = (_req, res, next) => {
  if (!env.ivmet.enabled) {
    return res.status(503).json({
      success: false,
      code: 'IVMET_DISABLED',
      message: 'Gestion IvMET aun no esta habilitada en este servidor'
    });
  }

  return next();
};

const requireIvmetAdmin = (req, res, next) => {
  if (req.user && String(req.user.acceso_cron) === '3') {
    return next();
  }

  return res.status(403).json({
    success: false,
    code: 'IVMET_ACCESS_DENIED',
    message: 'Se requiere acceso administrativo de nivel 3 para Gestion IvMET'
  });
};

module.exports = { requireIvmetEnabled, requireIvmetAdmin };
