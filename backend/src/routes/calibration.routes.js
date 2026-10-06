const express = require('express');
const controller = require('../controllers/calibration.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireCalibrationEditor } = require('../middleware/calibration.middleware');

const router = express.Router();
const editor = [protect, requireCalibrationEditor];

// Lectura: cualquier usuario con sesión.
router.get('/plan', protect, controller.getPlan);
router.get('/alertas/resumen', protect, controller.getAlertSummary);
router.get('/personal', protect, controller.getPersonal);
router.post('/vista-previa', protect, controller.previewDates);
router.get('/equipos/:id/historial', protect, controller.getEquipoHistorial);
router.get('/actividades/:id/historial', protect, controller.getActividadHistorial);
router.get('/eventos/historial', protect, controller.getEventoHistorial);

// Escritura: área Calibración y nivel 3.
router.put('/equipos', editor, controller.updateEquipos);
router.put('/equipos/:id', editor, controller.updateEquipo);
router.post('/equipos', editor, controller.createEquipo);
router.put('/equipos/:id/datos', editor, controller.updateEquipoDatos);
router.put('/equipos/:id/estado', editor, controller.cambiarEstadoEquipo);
router.post('/equipos/:id/certificados', editor, controller.registrarCertificado);
router.put('/equipos/:id/certificados/vigente', editor, controller.corregirCertificado);
router.post('/equipos/:id/certificados/vigente/anular', editor, controller.anularCertificado);
router.post('/equipos/:id/certificados/vigente/revision', editor, controller.revisarCertificado);
router.post('/actividades', editor, controller.createActividad);
router.put('/actividades/:id', editor, controller.updateActividad);
router.delete('/actividades/:id', editor, controller.deleteActividad);
router.put('/eventos', editor, controller.saveEvento);
router.post('/eventos/restablecer', editor, controller.resetEvento);
router.post('/eventos/revision', editor, controller.revisarEvento);
router.get('/alertas/ajustes', editor, controller.getAlertSettings);
router.put('/alertas/ajustes', editor, controller.updateAjustes);
router.post('/alertas/contactos', editor, controller.createContacto);
router.put('/alertas/contactos/:id', editor, controller.updateContacto);
router.delete('/alertas/contactos/:id', editor, controller.deleteContacto);
router.post('/alertas/prueba', editor, controller.sendTestEmail);
router.post('/alertas/ejecutar', editor, controller.runAlerts);
router.get('/cumplimiento', editor, controller.getCompliance);

module.exports = router;
