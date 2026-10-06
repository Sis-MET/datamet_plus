const express = require('express');
const controller = require('../controllers/system.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

/** Control de cambios y registro de fallas: solo el nivel 3 (administración del sistema). */
const requireSystemAdmin = (req, res, next) => {
  if (String(req.user?.acceso_cron) === '3') return next();
  return res.status(403).json({ success: false, message: 'Solo la administración del sistema (nivel 3) accede a este apartado.' });
};

router.use(protect, requireSystemAdmin);

router.get('/cambios', controller.listCambios);
router.post('/cambios', controller.createCambio);
router.get('/cambios/:id', controller.getCambio);
router.put('/cambios/:id', controller.updateCambio);
router.post('/cambios/:id/validacion', controller.validarCambio);
router.post('/cambios/:id/aprobacion', controller.aprobarCambio);
router.post('/cambios/:id/implementacion', controller.implementarCambio);

router.get('/fallas', controller.listFallas);
router.get('/fallas/resumen', controller.getResumenFallas);
router.post('/fallas', controller.createFalla);
router.get('/fallas/:id', controller.getFalla);
router.put('/fallas/:id', controller.atenderFalla);

module.exports = router;
