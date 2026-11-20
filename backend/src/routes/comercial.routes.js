const express = require('express');
const controller = require('../controllers/comercial.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireArea, soloArea } = require('../middleware/area.middleware');

// Lo que también ven las áreas que solo consultan Comercial (Administración y
// Gerencia): facturas, pagos, cuentas por cobrar y fichas de clientes.
const consulta = express.Router();
consulta.get('/acceso', controller.acceso);
consulta.get('/categorias', controller.categorias);
consulta.get('/personal', controller.personal);
consulta.get('/clientes', controller.buscarClientes);
consulta.get('/clientes/:codigo', controller.getCliente);
consulta.get('/facturas', controller.listFacturas);
consulta.get('/facturas/siguiente', controller.siguienteNumero);
consulta.get('/facturas/:id', controller.getFactura);
consulta.get('/pagos', controller.listPagos);
consulta.get('/pagos/:id', controller.getPago);
consulta.get('/cobranza', controller.cobranza);
consulta.get('/reportes', controller.reportes);
consulta.get('/reportes/excel', controller.reportesExcel);
consulta.get('/bitrix/estado', controller.bitrixEstado);
consulta.get('/bitrix/negociaciones', controller.bitrixNegociaciones);
consulta.get('/bitrix/negociaciones/:id', controller.bitrixNegociacion);
consulta.get('/bitrix/usuarios', controller.bitrixUsuarios);
consulta.get('/bitrix/actualizaciones', controller.bitrixPendientes);

const router = express.Router();

// Área Comercial y Sistemas (nivel 3). Todo lo que no está en `consulta` es
// solo del área: una ruta nueva queda cerrada a quien consulta por omisión.
router.use(protect, requireArea('comercial', { consulta: true }));
router.use(consulta);
router.use(soloArea('comercial'));

router.post('/facturas', controller.crearFactura);
router.post('/facturas/:id/anulacion', controller.anularFactura);
router.post('/pagos', controller.crearPago);
router.post('/pagos/:id/anulacion', controller.anularPago);
router.put('/clientes/:codigo', controller.guardarCliente);
// Bitrix24: la copia, las equivalencias y, con confirmación, el estado de
// facturación y cobro de las negociaciones en el CRM.
router.post('/bitrix/sincronizar', controller.bitrixSincronizar);
router.put('/bitrix/usuarios/:id', controller.bitrixConfirmarUsuario);
router.post('/bitrix/negociaciones/:id/actualizacion', controller.bitrixActualizar);
router.post('/bitrix/actualizaciones', controller.bitrixActualizarPendientes);

module.exports = router;
