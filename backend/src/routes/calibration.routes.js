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
router.get('/equipos/:id/patron', controller.getPatron);
router.get('/actividades/:id/historial', controller.getActividadHistorial);
router.get('/eventos/historial', controller.getEventoHistorial);
// Servicios de calibración que subió ServiceMET, con su modelo y avisos.
router.get('/servicios', controller.listServicios);
router.get('/servicios/:codigo', controller.getServicio);
// Puntos de ensayo acordados de cada instrumento de cliente (los mantiene Calibración).
router.get('/puntos-acordados/:codMetrica', controller.getPuntosAcordados);

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
// Tipo, clase, piezas y valores del certificado vigente de un patrón.
router.put('/equipos/:id/patron', controller.savePatron);
router.put('/puntos-acordados/:codMetrica', controller.savePuntosAcordados);
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

// Versiones de ServiceMET (NB/ISO/IEC 17025, 7.11.2). Cada acción comprueba
// además quién la hace: Sistemas registra y valida; el jefe de Calibración
// aprueba o rechaza.
router.get('/servicemet', controller.listServicemet);
router.post('/servicemet', controller.createServicemet);
router.get('/servicemet/:id', controller.getServicemet);
router.put('/servicemet/:id', controller.updateServicemet);
router.post('/servicemet/:id/validacion', controller.validarServicemet);
router.post('/servicemet/:id/decision', controller.decidirServicemet);
router.post('/servicemet/:id/puesta-en-uso', controller.ponerServicemetEnUso);

module.exports = router;
