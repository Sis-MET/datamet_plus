const express = require('express');
const controller = require('../controllers/rim.controller');
const { protect, jefeAreaOrAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// Consultan todos los usuarios con sesión; anular un RIM y cerrar un
// talonario queda para jefes de área y niveles 2 y 3.
router.use(protect);

router.get('/registros', controller.listRegistros);
router.get('/registros/filtros', controller.getFiltros);
router.post('/registros', controller.createRegistro);
router.get('/registros/:n', controller.getRegistro);
router.post('/registros/:n/anulacion', jefeAreaOrAdmin, controller.anularRegistro);

router.get('/talonarios', controller.listTalonarios);
router.post('/talonarios/:id/cierre', jefeAreaOrAdmin, controller.cerrarTalonario);

module.exports = router;
