const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar.controller');
const { protect, isAdmin } = require('../middleware/auth.middleware');

// Rutas de lectura (Cualquier usuario logueado)
router.get('/cronograma', protect, calendarController.getSchedule);
router.get('/tecnicos', protect, calendarController.getTecnicos);

// Rutas de escritura (Solo Administradores)
router.post('/cronograma', protect, isAdmin, calendarController.upsertScheduleCell);

module.exports = router;
