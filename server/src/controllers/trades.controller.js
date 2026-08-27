/**
 * Trades Controller
 * Handles requests to the Mock BSE Trade endpoint.
 */
const mockBseService = require('../services/mockBse.service');

/**
 * @route   GET /getTrades
 * @desc    Fetch seeded trades from Mock BSE API with simulated delay
 * @access  Public
 */
const getTrades = async (req, res, next) => {
  try {
    const startTime = Date.now();
    const { trades, delayMs } = await mockBseService.fetchTrades();
    const elapsedTimeMs = Date.now() - startTime;

    res.status(200).json({
      success: true,
      count: trades.length,
      simulatedDelayMs: delayMs,
      elapsedTimeMs,
      data: trades
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTrades
};
