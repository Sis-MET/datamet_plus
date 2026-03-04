const express = require('express');
const router = express.Router();

const healthRoutes = require('./health.routes');
const testRoutes = require('./test.routes');
const authRoutes = require('./auth.routes');
const clientesRoutes = require('./clientes.routes');
const equiposRoutes = require('./equipos.routes');

// Define rutas base (prefijos)
router.use('/health', healthRoutes);
router.use('/test', testRoutes);
router.use('/auth', authRoutes);
router.use('/clientes', clientesRoutes);
router.use('/equipos', equiposRoutes);

module.exports = router;

