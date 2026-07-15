const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar.controller');
const { protect, isAdmin, jefeAreaOrAdmin } = require('../middleware/auth.middleware');

// Rutas de lectura (Cualquier usuario logueado)
router.get('/cronograma', protect, calendarController.getSchedule);
router.get('/tecnicos', protect, calendarController.getTecnicos);

// Rutas de escritura (Administradores + Jefes de Área)
router.post('/cronograma', protect, jefeAreaOrAdmin, calendarController.upsertScheduleCell);

module.exports = router;
