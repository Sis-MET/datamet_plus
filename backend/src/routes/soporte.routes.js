const express = require('express');
const controller = require('../controllers/soporte.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireArea } = require('../middleware/area.middleware');

const router = express.Router();

// Todo el apartado: área Soporte Técnico y Sistemas (nivel 3). El resto del
// personal lo ve bloqueado en la aplicación.
router.use(protect, requireArea('soporte'));

router.get('/permisos', controller.permisos);
router.get('/configuracion/aprobadores', controller.aprobadores);
router.put('/configuracion/aprobadores', controller.guardarAprobadores);

router.get('/documentos/carpetas', controller.carpetas);
router.get('/documentos/:id/pdf', controller.abrirDocumento);
router.get('/informes/:tipo/:codigo/documentos', controller.documentos);
router.post('/informes/:tipo/:codigo/documentos', express.raw({ type: 'application/pdf', limit: '30mb' }), controller.guardarDocumento);

router.get('/informes', controller.listInformes);
router.get('/informes/filtros', controller.getFiltros);
router.get('/informes/grupos', controller.listGrupos);
// Sugerencia de redacción con Google Gemini.
router.post('/redaccion', controller.redaccion);
router.get('/informes/:tipo/:codigo', controller.getInforme);
router.post('/informes/:tipo/:codigo/cambios', controller.guardarCambios);
router.post('/informes/:tipo/:codigo/emision', controller.emitir);
router.post('/informes/:tipo/:codigo/validacion', controller.enviarValidacion);
router.post('/informes/:tipo/:codigo/validacion/resolver', controller.resolverValidacion);
router.post('/informes/:tipo/:codigo/validacion/retirar', controller.retirarValidacion);
// Reemisión de un informe emitido.
router.post('/informes/:tipo/:codigo/revision', controller.abrirRevision);
router.post('/informes/:tipo/:codigo/revision/cancelar', controller.cancelarRevision);
router.post('/informes/:tipo/:codigo/reemision', controller.reemitir);
router.get('/informes/:tipo/:codigo/revisiones/:revision', controller.getRevision);
router.post('/informes/:tipo/:codigo/fotos', controller.agregarFoto);
router.post('/informes/:tipo/:codigo/fotos/orden', controller.ordenarFotos);
router.put('/informes/:tipo/:codigo/fotos/:fotoId', controller.editarFoto);
router.post('/informes/:tipo/:codigo/fotos/:fotoId/quitar', controller.quitarFoto);

// Próximos servicios sugeridos por los técnicos y su seguimiento.
router.get('/proximos', controller.proximosPlan);
router.get('/proximos/resumen', controller.proximosResumen);
router.get('/proximos/equipos/:codMetrica', controller.proximosEquipo);
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
