const authService = require('../services/auth.service');

/**
 * @route POST /api/auth/login
 * Body: { usuario, pass }
 */
const login = async (req, res, next) => {
  try {
    const { usuario, pass } = req.body;

    if (!usuario || !pass) {
      return res.status(400).json({ success: false, message: 'Por favor provea usuario y contraseña' });
    }

    const authData = await authService.loginUser(usuario, pass);

    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      data: authData
    });

  } catch (error) {
    if (error.isLocked) {
      return res.status(429).json({ 
        success: false, 
        message: error.message,
        remainingSecs: error.remainingSecs
      });
    }
    if (error.message.includes('Credenciales') || error.message.includes('Tu perfil no tiene')) {
      return res.status(401).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  login
};
