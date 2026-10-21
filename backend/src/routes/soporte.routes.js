const express = require('express');
const controller = require('../controllers/soporte.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Consultan todos los usuarios con sesión. Editar, emitir y corregir lo
// verifica el servicio: área Soporte Técnico y nivel 3.
router.use(protect);

router.get('/informes', controller.listInformes);
router.get('/informes/filtros', controller.getFiltros);
router.get('/informes/grupos', controller.listGrupos);
// Sugerencia de redacción con Google Gemini (editores).
router.post('/redaccion', controller.redaccion);
router.get('/informes/:tipo/:codigo', controller.getInforme);
router.post('/informes/:tipo/:codigo/cambios', controller.guardarCambios);
router.post('/informes/:tipo/:codigo/emision', controller.emitir);
router.post('/informes/:tipo/:codigo/fotos', controller.agregarFoto);
router.post('/informes/:tipo/:codigo/fotos/orden', controller.ordenarFotos);
router.put('/informes/:tipo/:codigo/fotos/:fotoId', controller.editarFoto);
router.post('/informes/:tipo/:codigo/fotos/:fotoId/quitar', controller.quitarFoto);

module.exports = router;
