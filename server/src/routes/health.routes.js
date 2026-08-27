const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

/**
 * @route   GET /health
 * @desc    Get service health status
 * @access  Public
 */
router.get('/', healthController.getHealthStatus);

module.exports = router;
