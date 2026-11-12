const express = require('express');
const controller = require('../controllers/system.controller');
const { protect } = require('../middleware/auth.middleware');
const { permisosCambios } = require('../services/system.changes');

const router = express.Router();

/** Registro de fallas y los pasos de Sistemas en Control de cambios: solo el nivel 3. */
const requireSystemAdmin = (req, res, next) => {
  if (String(req.user?.acceso_cron) === '3') return next();
  return res.status(403).json({ success: false, message: 'Solo la administración del sistema (nivel 3) accede a este apartado.' });
};

/**
 * Control de cambios: lo consultan Sistemas y el jefe de área de Calibración,
 * que aprueba o rechaza. El servicio vuelve a comprobar cada paso.
 */
const requireControlCambios = (req, res, next) => {
  if (permisosCambios(req.user).ver) return next();
  return res.status(403).json({
    success: false,
    message: 'Control de cambios es de Sistemas (nivel 3) y del jefe de área de Calibración.',
  });
};

router.use(protect);

router.get('/cambios', requireControlCambios, controller.listCambios);
router.post('/cambios', requireSystemAdmin, controller.createCambio);
router.get('/cambios/:id', requireControlCambios, controller.getCambio);
router.put('/cambios/:id', requireSystemAdmin, controller.updateCambio);
router.post('/cambios/:id/validacion', requireSystemAdmin, controller.validarCambio);
router.post('/cambios/:id/aprobacion', requireControlCambios, controller.aprobarCambio);
router.post('/cambios/:id/implementacion', requireSystemAdmin, controller.implementarCambio);

router.use('/fallas', requireSystemAdmin);
router.get('/fallas', controller.listFallas);
router.get('/fallas/resumen', controller.getResumenFallas);
router.post('/fallas', controller.createFalla);
router.get('/fallas/:id', controller.getFalla);
router.put('/fallas/:id', controller.atenderFalla);

module.exports = router;
