const express = require('express');
const controller = require('../controllers/calibration.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireArea } = require('../middleware/area.middleware');

const router = express.Router();

// Todo el apartado: área Calibración y Sistemas (nivel 3). El resto del
// personal lo ve bloqueado en la aplicación.
router.use(protect, requireArea('calibracion'));

// Lectura.
router.get('/plan', controller.getPlan);
router.get('/alertas/resumen', controller.getAlertSummary);
router.get('/personal', controller.getPersonal);
router.post('/vista-previa', controller.previewDates);
router.get('/equipos/:id/historial', controller.getEquipoHistorial);
router.get('/actividades/:id/historial', controller.getActividadHistorial);
router.get('/eventos/historial', controller.getEventoHistorial);

// Escritura.
router.put('/equipos', controller.updateEquipos);
router.put('/equipos/:id', controller.updateEquipo);
router.post('/equipos', controller.createEquipo);
router.put('/equipos/:id/datos', controller.updateEquipoDatos);
router.put('/equipos/:id/estado', controller.cambiarEstadoEquipo);
router.post('/equipos/:id/certificados', controller.registrarCertificado);
router.put('/equipos/:id/certificados/vigente', controller.corregirCertificado);
router.post('/equipos/:id/certificados/vigente/anular', controller.anularCertificado);
router.post('/equipos/:id/certificados/vigente/revision', controller.revisarCertificado);
router.post('/actividades', controller.createActividad);
router.put('/actividades/:id', controller.updateActividad);
router.delete('/actividades/:id', controller.deleteActividad);
router.put('/eventos', controller.saveEvento);
router.post('/eventos/restablecer', controller.resetEvento);
router.post('/eventos/revision', controller.revisarEvento);
router.get('/alertas/ajustes', controller.getAlertSettings);
router.put('/alertas/ajustes', controller.updateAjustes);
router.post('/alertas/contactos', controller.createContacto);
router.put('/alertas/contactos/:id', controller.updateContacto);
router.delete('/alertas/contactos/:id', controller.deleteContacto);
router.post('/alertas/prueba', controller.sendTestEmail);
router.post('/alertas/ejecutar', controller.runAlerts);
router.get('/cumplimiento', controller.getCompliance);

module.exports = router;
