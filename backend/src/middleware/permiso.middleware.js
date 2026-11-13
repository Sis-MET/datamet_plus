const permisos = require('../services/permisos');

/**
 * Deja pasar solo a quien tiene el permiso con nombre (Gestión de permisos;
 * Sistemas, nivel 3, los tiene todos). Va después de `protect`. Responde 403
 * con `code: 'PERMISO_DENEGADO'`.
 */
const requirePermiso = (clave, mensaje) => async (req, res, next) => {
  try {
    if (await permisos.tienePermiso(req.user, clave)) return next();
    return res.status(403).json({
      success: false,
      code: 'PERMISO_DENEGADO',
      message: mensaje || 'No tienes permiso para ver este apartado. Lo concede Sistemas en Gestión de permisos.',
    });
  } catch (error) {
    return next(error);
  }
};

/** Gestión de permisos: Sistemas (nivel 3) y el jefe de Sistemas. El servicio lo vuelve a comprobar. */
const requireGestionPermisos = async (req, res, next) => {
  try {
    if (await permisos.puedeGestionar(req.user)) return next();
    return res.status(403).json({
      success: false,
      code: 'PERMISO_DENEGADO',
      message: 'Gestión de permisos es de Sistemas y del jefe de Sistemas.',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { requirePermiso, requireGestionPermisos };
