const express = require('express');
const router = express.Router();
const tradesController = require('../controllers/trades.controller');

/**
 * @route   GET /getTrades
 * @desc    Simulated BSE trades feed endpoint
 * @access  Public
 */
router.get('/', tradesController.getTrades);

module.exports = router;
