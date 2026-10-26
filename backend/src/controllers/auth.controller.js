const authService = require('../services/auth.service');

/**
 * @route POST /api/auth/login
 * Body: { usuario, pass }
 */
const login = async (req, res, next) => {
  try {
    const { usuario, pass } = req.body || {};

    if (typeof usuario !== 'string' || typeof pass !== 'string' || !usuario.trim() || !pass) {
      return res.status(400).json({ success: false, message: 'Por favor provea usuario y contraseña' });
    }

    const authData = await authService.loginUser({ usuario: usuario.trim(), pass, ip: req.ip });

    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      data: authData
    });

  } catch (error) {
    if (error.statusCode === 429) {
      return res.status(429).json({
        success: false,
        message: error.message,
        remainingSecs: error.remainingSecs
      });
    }
    if ([401, 403].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  login
};
