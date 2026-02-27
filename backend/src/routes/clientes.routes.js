const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientes.controller');

// GET /api/clientes - Obtener todos los clientes
router.get('/', clientesController.getAllClientes);

// GET /api/clientes/search?q=texto - Buscar clientes por nombre
router.get('/search', clientesController.searchClientes);

module.exports = router;
