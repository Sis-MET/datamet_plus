const { verifyToken } = require('../utils/jwt.utils');

const protect = (req, res, next) => {
  let token;

  // 1. Verificar si el header de autorización existe y empieza con 'Bearer'
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 2. Extraer el token del string "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];

      // 3. Verificar y decodificar el token usando nuestra utilidad
      const decodedInfo = verifyToken(token);

      // 4. Se agrega el usuario al "request" para que los controladores puedan usar su info
      req.user = decodedInfo;

      // 5. Otorgar acceso para continuar
      return next();
    } catch (error) {
      console.error('Error de autenticación JWT:', error.message);
      return res.status(401).json({ success: false, message: 'No autorizado, token inválido o expirado' });
    }
  }

  // 6. Si no hay token en el header
  if (!token) {
    return res.status(401).json({ success: false, message: 'No autorizado, no se proveyó token' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && ['2', '3'].includes(String(req.user.acceso_cron))) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Se requieren permisos completos para esta acción. (Modo Lectura)' });
  }
};

const jefeAreaOrAdmin = (req, res, next) => {
  const cargoNormalized = (req.user?.cargo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (cargoNormalized === 'jefe de area') {
    return next();
  }

  if (req.user && ['2', '3'].includes(String(req.user.acceso_cron))) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'Permiso denegado' });
};

module.exports = { protect, isAdmin, jefeAreaOrAdmin };
