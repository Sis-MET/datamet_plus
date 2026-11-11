const express = require('express');
const controller = require('../controllers/soporte.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireArea, soloArea } = require('../middleware/area.middleware');

// Lo que también consulta Comercial: los informes emitidos (con sus PDF y
// revisiones) y los próximos servicios, sin modificar nada. Los servicios
// filtran lo que ve quien solo consulta (solo informes emitidos).
const consulta = express.Router();
consulta.get('/permisos', controller.permisos);
consulta.get('/documentos/:id/pdf', controller.abrirDocumento);
consulta.get('/informes', controller.listInformes);
consulta.get('/informes/filtros', controller.getFiltros);
consulta.get('/informes/grupos', controller.listGrupos);
consulta.get('/informes/:tipo/:codigo', controller.getInforme);
consulta.get('/informes/:tipo/:codigo/documentos', controller.documentos);
consulta.get('/informes/:tipo/:codigo/revisiones/:revision', controller.getRevision);
consulta.get('/proximos', controller.proximosPlan);
consulta.get('/proximos/resumen', controller.proximosResumen);
consulta.get('/proximos/equipos/:codMetrica', controller.proximosEquipo);

const router = express.Router();

// Área Soporte Técnico y Sistemas (nivel 3); Comercial solo las rutas de
// `consulta`. Todo lo que no está ahí es solo del área. El resto del personal
// ve el apartado bloqueado en la aplicación.
router.use(protect, requireArea('soporte', { consulta: true }));
router.use(consulta);
router.use(soloArea('soporte'));

router.get('/configuracion/aprobadores', controller.aprobadores);
router.put('/configuracion/aprobadores', controller.guardarAprobadores);

router.get('/documentos/carpetas', controller.carpetas);
router.post('/informes/:tipo/:codigo/documentos', express.raw({ type: 'application/pdf', limit: '30mb' }), controller.guardarDocumento);

// Sugerencia de redacción con Google Gemini.
router.post('/redaccion', controller.redaccion);
router.post('/informes/:tipo/:codigo/cambios', controller.guardarCambios);
// Cambio de OTST con su motivo (cambia el número del informe).
router.post('/informes/:tipo/:codigo/otst', controller.cambiarOtst);
router.post('/informes/:tipo/:codigo/emision', controller.emitir);
router.post('/informes/:tipo/:codigo/validacion', controller.enviarValidacion);
router.post('/informes/:tipo/:codigo/validacion/resolver', controller.resolverValidacion);
router.post('/informes/:tipo/:codigo/validacion/retirar', controller.retirarValidacion);
// Reemisión de un informe emitido.
router.post('/informes/:tipo/:codigo/revision', controller.abrirRevision);
router.post('/informes/:tipo/:codigo/revision/cancelar', controller.cancelarRevision);
router.post('/informes/:tipo/:codigo/reemision', controller.reemitir);
router.post('/informes/:tipo/:codigo/fotos', controller.agregarFoto);
router.post('/informes/:tipo/:codigo/fotos/orden', controller.ordenarFotos);
router.put('/informes/:tipo/:codigo/fotos/:fotoId', controller.editarFoto);
router.post('/informes/:tipo/:codigo/fotos/:fotoId/quitar', controller.quitarFoto);

// Seguimiento de los próximos servicios sugeridos por los técnicos.
router.post('/proximos/seguimiento', controller.registrarSeguimiento);

// Avisos por correo de los próximos servicios.
router.get('/avisos', controller.avisos);
router.get('/avisos/personal', controller.avisosPersonal);
router.put('/avisos/ajustes', controller.avisosAjustes);
router.post('/avisos/contactos', controller.crearContacto);
router.put('/avisos/contactos/:id', controller.editarContacto);
router.delete('/avisos/contactos/:id', controller.quitarContacto);
router.post('/avisos/prueba', controller.avisosPrueba);
router.post('/avisos/ejecutar', controller.avisosEjecutar);

module.exports = router;
