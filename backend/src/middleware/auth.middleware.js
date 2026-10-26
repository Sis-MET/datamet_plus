const { verifyToken } = require('../utils/jwt.utils');
const { usuarioVigente: usuarioVigenteBase } = require('../services/auth.session');

// `code` le indica al frontend que debe volver al inicio de sesión (otras
// respuestas 401, como el código de acceso de IvMET, no cierran la sesión).
const sesionInvalida = (res, message) => res.status(401).json({ success: false, code: 'SESSION_INVALID', message });

/**
 * Exige un token válido de un usuario que sigue activo. En `req.user` quedan
 * el nivel, el cargo y el área vigentes de DATA_USERS, no los del token.
 */
const crearProtect = ({ usuarioVigente = usuarioVigenteBase } = {}) => async (req, res, next) => {
  const [esquema, token] = String(req.headers.authorization || '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    return sesionInvalida(res, 'No autorizado, no se proveyó token');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    console.error('Error de autenticación JWT:', error.message);
    return sesionInvalida(res, 'No autorizado, token inválido o expirado');
  }

  let vigente;
  try {
    vigente = await usuarioVigente(payload);
  } catch (error) {
    return next(error);
  }
  if (!vigente) {
    return sesionInvalida(res, 'Tu usuario ya no está activo o perdió el acceso. Inicia sesión de nuevo.');
  }
  req.user = { ...payload, ...vigente };
  return next();
};

const protect = crearProtect();

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

module.exports = { protect, crearProtect, isAdmin, jefeAreaOrAdmin };
