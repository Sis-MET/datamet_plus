const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientes.controller');

// GET /api/clientes - Obtener todos los clientes
router.get('/', clientesController.getAllClientes);

// GET /api/clientes/search?q=texto - Buscar clientes por nombre
// ⚠️ Esta ruta DEBE ir antes de /:codigoCliente/plantas para evitar conflicto de parámetros
router.get('/search', clientesController.searchClientes);

// GET /api/clientes/:codigoCliente/plantas - Obtener plantas de un cliente
router.get('/:codigoCliente/plantas', clientesController.getPlantasByCliente);

module.exports = router;
