const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar.controller');
const { protect, isAdmin } = require('../middleware/auth.middleware');

// Rutas de lectura (Cualquier usuario logueado)
router.get('/schedule', protect, calendarController.getSchedule);
router.get('/tecnicos', protect, calendarController.getTecnicos);

// Rutas de escritura (Solo Administradores)
router.post('/schedule', protect, isAdmin, calendarController.createEvent);
router.put('/schedule/:id', protect, isAdmin, calendarController.updateEvent);
router.delete('/schedule/:id', protect, isAdmin, calendarController.deleteEvent);

module.exports = router;
