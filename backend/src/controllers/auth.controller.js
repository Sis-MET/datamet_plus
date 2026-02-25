const authService = require('../services/auth.service');

/**
 * @route POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Por favor provea email y password' });
    }

    const authData = await authService.loginUser(email, password);

    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      data: authData
    });

  } catch (error) {
    if (error.message.includes('Credenciales')) {
      return res.status(401).json({ success: false, message: error.message });
    }
    // Si es un error no controlado, va al middleware global
    next(error); 
  }
};

module.exports = {
  login
};
