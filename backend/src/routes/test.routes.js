const express = require('express');
const router = express.Router();
const testController = require('../controllers/test.controller');
const { protect } = require('../middleware/auth.middleware');

// GET /api/test
router.get('/', testController.getTests);

// POST /api/test (Ruta protegida por JWT de ejemplo)
router.post('/', protect, testController.createTest);

module.exports = router;
