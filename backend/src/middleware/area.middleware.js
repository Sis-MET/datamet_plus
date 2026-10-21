const { mensajeSinAcceso, tieneAcceso } = require('../services/access.areas');

/**
 * Deja pasar solo al personal del área del apartado y a Sistemas (nivel 3).
 * Va después de `protect`.
 */
const requireArea = (modulo) => async (req, res, next) => {
  try {
    if (await tieneAcceso(req.user, modulo)) return next();
    return res.status(403).json({
      success: false,
      code: 'AREA_ACCESS_DENIED',
      message: mensajeSinAcceso(modulo),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { requireArea };
