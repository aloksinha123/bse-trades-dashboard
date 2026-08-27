/**
 * Persisted Trades Controller
 * Handles reading already-pulled trades from SQLite storage with pagination.
 */
const tradeRepository = require('../db/trade.repository');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

/**
 * @route   GET /trades
 * @desc    Get persisted trades with optional pagination
 * @access  Public
 */
const getPersistedTrades = (req, res, next) => {
  try {
    let limit = DEFAULT_LIMIT;
    let offset = 0;

    // Validate and sanitize limit
    if (req.query.limit !== undefined) {
      const parsedLimit = parseInt(req.query.limit, 10);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter "limit" must be a positive integer.'
        });
      }
      limit = Math.min(parsedLimit, MAX_LIMIT);
    }

    // Validate and sanitize offset
    if (req.query.offset !== undefined) {
      const parsedOffset = parseInt(req.query.offset, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter "offset" must be a non-negative integer.'
        });
      }
      offset = parsedOffset;
    }

    const total = tradeRepository.countTrades();
    const trades = tradeRepository.getTrades({ limit, offset });

    res.status(200).json({
      success: true,
      count: trades.length,
      total,
      limit,
      offset,
      data: trades
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /trades/:tradeId
 * @desc    Get a single persisted trade by its tradeId
 * @access  Public
 */
const getPersistedTradeById = (req, res, next) => {
  try {
    const { tradeId } = req.params;
    const trade = tradeRepository.getTradeById(tradeId);

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: `Trade with ID "${tradeId}" not found.`
      });
    }

    res.status(200).json({
      success: true,
      data: trade
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPersistedTrades,
  getPersistedTradeById
};
