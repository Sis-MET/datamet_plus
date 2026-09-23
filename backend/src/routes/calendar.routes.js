const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar.controller');
const { protect, jefeAreaOrAdmin } = require('../middleware/auth.middleware');

// Rutas de lectura (Cualquier usuario logueado)
router.get('/cronograma', protect, calendarController.getSchedule);
router.get('/cronograma/version', protect, calendarController.getScheduleVersion);
router.get('/tecnicos', protect, calendarController.getTecnicos);

// Rutas de escritura (Administradores + Jefes de Área)
router.post('/cronograma', protect, jefeAreaOrAdmin, calendarController.upsertScheduleCell);
router.post('/cronograma/asignaciones', protect, jefeAreaOrAdmin, calendarController.upsertScheduleAssignments);

module.exports = router;
