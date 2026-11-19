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

module.exports = router;
