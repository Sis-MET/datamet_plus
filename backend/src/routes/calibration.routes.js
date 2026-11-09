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
router.get('/servicios/:codigo/calculo', controller.getCalculoServicio);
router.get('/registros/:codigo', controller.getRegistro);
// Certificado de calibración del registro (fase 5): vista previa.
router.get('/registros/:codigo/certificado', controller.getCertificado);
router.get('/registros/:codigo/emisiones/:emision/pdf', controller.abrirCertificadoPdf);
// Certificados emitidos: cada n.º con sus emisiones (libro de certificados).
router.get('/emitidos', controller.listEmitidos);
// Estado de los patrones para los certificados y su uso en los servicios del año.
router.get('/patrones/estado', controller.getEstadoPatrones);
// Validación del motor con los ejemplos publicados y sus evidencias registradas.
router.get('/validacion', controller.getValidacion);
router.get('/validacion/evidencias/:id', controller.getEvidenciaValidacion);
// Aprobadores de los registros: los designa el jefe de Calibración (migración 019).
router.get('/configuracion/aprobadores', controller.getAprobadores);
// Configuración del método por versiones (fase 6, migración 021).
router.get('/metodo', controller.getMetodo);
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
// Registro de calibración: lo elabora el personal del área y lo revisa el jefe de Calibración o un aprobador.
router.put('/registros/:codigo', controller.guardarRegistro);
router.post('/registros/:codigo/envio', controller.enviarRegistro);
router.post('/registros/:codigo/retiro', controller.retirarRegistro);
router.post('/registros/:codigo/revision', controller.revisarRegistro);
router.post('/registros/:codigo/reapertura', controller.reabrirRegistro);
router.put('/configuracion/aprobadores', controller.saveAprobadores);
router.post('/metodo/borrador', controller.crearBorradorMetodo);
router.put('/metodo/borrador', controller.guardarBorradorMetodo);
router.post('/metodo/borrador/descarte', controller.descartarBorradorMetodo);
router.post('/metodo/aprobacion', controller.aprobarMetodo);
router.post('/validacion/evidencias', controller.registrarValidacion);
// Emisión del certificado (fase 5): autoriza, firma y reemite el jefe de Calibración.
router.post('/registros/:codigo/vista-previa', controller.vistaPreviaCertificado);
router.post('/registros/:codigo/autorizacion', controller.autorizarCertificado);
router.post('/registros/:codigo/autorizacion/anulacion', controller.anularAutorizacion);
router.post('/registros/:codigo/firmado', express.raw({ type: 'application/pdf', limit: '30mb' }), controller.subirFirmado);
router.post('/registros/:codigo/revision-certificado', controller.abrirRevisionCertificado);
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
