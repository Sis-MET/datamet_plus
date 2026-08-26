const express = require('express');
const controller = require('../controllers/ivmet.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireIvmetEnabled, requireIvmetAdmin } = require('../middleware/ivmet.middleware');

const router = express.Router();

router.use(protect, requireIvmetEnabled, requireIvmetAdmin);
router.get('/overview', controller.getOverview);
router.get('/clients', controller.getClients);
router.get('/plans', controller.getPlans);
router.get('/equipment-review', controller.getEquipmentReview);

module.exports = router;
