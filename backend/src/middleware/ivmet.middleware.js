const env = require('../config/env');
const { getPool, sql } = require('../config/db');

const requireIvmetEnabled = (_req, res, next) => {
  if (!env.ivmet.enabled) {
    return res.status(503).json({
      success: false,
      code: 'IVMET_DISABLED',
      message: 'Gestion IvMET aun no esta habilitada en este servidor',
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
    message: 'Se requiere acceso administrativo de nivel 3 para Gestion IvMET',
  });
};

const createCurrentAdminMiddleware =
  ({ pool = getPool } = {}) =>
  async (req, res, next) => {
    try {
      if (typeof req.user.usuario !== 'string' || !req.user.usuario.trim())
        return res.status(403).json({
          success: false,
          code: 'IVMET_ACCESS_DENIED',
          message: 'Usuario administrativo inválido.',
        });
      const result = await pool()
        .request()
        .input('usuario', sql.VarChar(100), req.user.usuario)
        .query('SELECT acceso_cron FROM dbo.DATA_USERS WHERE usuario=@usuario');
      if (
        result.recordset.length !== 1 ||
        String(result.recordset[0].acceso_cron) !== '3'
      )
        return res.status(403).json({
          success: false,
          code: 'IVMET_ACCESS_DENIED',
          message:
            'Tu acceso administrativo fue revocado o cambió. Inicia sesión nuevamente.',
        });
      return next();
    } catch {
      return res.status(503).json({
        success: false,
        message: 'No se pudo validar tu permiso administrativo en DataMET.',
      });
    }
  };
const requireCurrentIvmetAdmin = createCurrentAdminMiddleware();
module.exports = {
  requireIvmetEnabled,
  requireIvmetAdmin,
  requireCurrentIvmetAdmin,
  createCurrentAdminMiddleware,
};
