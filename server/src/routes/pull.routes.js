const express = require('express');
const router = express.Router();
const pullController = require('../controllers/pull.controller');

/**
 * @route   POST /pull
 * @desc    Start background BSE pull
 */
router.post('/', pullController.triggerPull);

/**
 * @route   GET /pull
 * @desc    Get in-memory history of recent background pulls
 */
router.get('/', pullController.getPullHistory);

/**
 * @route   GET /pull/:jobId
 * @desc    Get status of a specific background pull
 */
router.get('/:jobId', pullController.getPullStatus);

module.exports = router;
