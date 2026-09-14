const express = require('express');
const controller = require('../controllers/ivmet.controller');
const { protect } = require('../middleware/auth.middleware');
const {
  createAccessMiddleware,
} = require('../middleware/ivmet.access.middleware');
const {
  requireIvmetEnabled,
  requireIvmetAdmin,
  requireCurrentIvmetAdmin,
} = require('../middleware/ivmet.middleware');

const router = express.Router();
const access = createAccessMiddleware();
const staff = require('../middleware/ivmet.staff.middleware').createStaffMiddleware();

router.use(protect, requireIvmetAdmin, requireIvmetEnabled);
router.get('/access', requireCurrentIvmetAdmin, access.status);
router.post('/access/unlock', requireCurrentIvmetAdmin, access.unlock);
// Todas las lecturas, el catálogo legado y las mutaciones exigen ambas barreras.
router.use(access.requireAccess, requireCurrentIvmetAdmin, staff);
router.get('/ops/:section', controller.getOperations);
router.post('/ops/actions/:action', controller.mutateOperations);
router.get('/overview', controller.getOverview);
router.get('/clients', controller.getClients);
router.get('/plans', controller.getPlans);
router.get('/integration', controller.getIntegration);
router.get('/onboarding', controller.getOnboarding);
router.get('/clients/:clientId', controller.getClient);
router.get('/clients/:clientId/equipment', controller.getEquipment);
router.get('/clients/:clientId/users', controller.getUsers);
router.get('/clients/:clientId/activity', controller.getActivity);
router.get('/legacy/clients', controller.searchLegacy);
router.get('/legacy/clients/:clientId/catalog', controller.legacyCatalog);
router.post('/actions/:action', controller.mutate);

module.exports = router;
