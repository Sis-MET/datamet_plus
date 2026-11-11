const { NIVEL, mensajeSinAcceso, mensajeSoloConsulta, nivelAcceso } = require('../services/access.areas');

const rechazar = (res, message) => res.status(403).json({ success: false, code: 'AREA_ACCESS_DENIED', message });

/**
 * Deja pasar solo al personal del área del apartado y a Sistemas (nivel 3).
 * Con `{ consulta: true }` también a las áreas que solo consultan el apartado
 * (Comercial en Soporte técnico). Deja el nivel en `req.accesoArea`. Va
 * después de `protect`.
 */
const requireArea = (modulo, { consulta = false } = {}) => async (req, res, next) => {
  try {
    const nivel = await nivelAcceso(req.user, modulo);
    if (nivel === NIVEL.AREA || (consulta && nivel === NIVEL.CONSULTA)) {
      req.accesoArea = nivel;
      return next();
    }
    return rechazar(res, nivel === NIVEL.CONSULTA ? mensajeSoloConsulta(modulo) : mensajeSinAcceso(modulo));
  } catch (error) {
    return next(error);
  }
};

/**
 * Después de `requireArea(modulo, { consulta: true })`: lo que sigue es solo
 * del área. Quien entró a consultar recibe 403.
 */
const soloArea = (modulo) => (req, res, next) => (req.accesoArea === NIVEL.AREA
  ? next()
  : rechazar(res, mensajeSoloConsulta(modulo)));

module.exports = { requireArea, soloArea };
