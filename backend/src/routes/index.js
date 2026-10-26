const express = require('express');
const router = express.Router();

const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const clientesRoutes = require('./clientes.routes');
const equiposRoutes = require('./equipos.routes');
const calendarRoutes = require('./calendar.routes');
const cotizacionesRoutes = require('./cotizaciones.routes');
const ivmetRoutes = require('./ivmet.routes');
const calibrationRoutes = require('./calibration.routes');
const systemRoutes = require('./system.routes');
const rimRoutes = require('./rim.routes');
const soporteRoutes = require('./soporte.routes');

// Define rutas base (prefijos)
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/clientes', clientesRoutes);
router.use('/equipos', equiposRoutes);
router.use('/calendar', calendarRoutes);
router.use('/cotizaciones', cotizacionesRoutes);
router.use('/ivmet', ivmetRoutes);
router.use('/calibracion', calibrationRoutes);
router.use('/sistema', systemRoutes);
router.use('/rim', rimRoutes);
router.use('/soporte', soporteRoutes);

module.exports = router;

