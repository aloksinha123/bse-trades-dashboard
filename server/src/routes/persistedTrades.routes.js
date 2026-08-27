const express = require('express');
const router = express.Router();
const persistedTradesController = require('../controllers/persistedTrades.controller');

/**
 * @route   GET /trades
 * @desc    Fetch persisted trades with optional pagination (?limit=50&offset=0)
 * @access  Public
 */
router.get('/', persistedTradesController.getPersistedTrades);

/**
 * @route   GET /trades/:tradeId
 * @desc    Fetch single persisted trade by tradeId
 * @access  Public
 */
router.get('/:tradeId', persistedTradesController.getPersistedTradeById);

module.exports = router;
