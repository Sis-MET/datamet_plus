const express = require('express');
const router = express.Router();
const equiposController = require('../controllers/equipos.controller');
const { protect } = require('../middleware/auth.middleware');

// Equipos de los clientes: solo con sesión.
router.use(protect);

// GET /api/equipos/search?q=texto&planta=0121-41
router.get('/search', equiposController.searchEquipos);

// GET /api/equipos/:codMetrica - obtener equipo por código exacto
router.get('/:codMetrica', equiposController.getEquipoByCode);

module.exports = router;
