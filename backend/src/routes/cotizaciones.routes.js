const express = require('express');
const router = express.Router();
const cotizacionesController = require('../controllers/cotizaciones.controller');
const { protect } = require('../middleware/auth.middleware');

// GET /api/cotizaciones/search?q=termino
router.get('/search', protect, cotizacionesController.searchCotizaciones);

module.exports = router;
