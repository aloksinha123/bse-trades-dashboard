/**
 * Mock BSE Service
 * Generates deterministic seeded trade records simulating an external BSE trade feed.
 * Supports configurable artificial delay (BSE_DELAY_MS) up to 15 minutes (900,000 ms).
 */

const DEFAULT_TRADE_COUNT = 4000;
const DEFAULT_DELAY_MS = 5000;
const MAX_DELAY_MS = 15 * 60 * 1000; // 15 minutes (900,000 ms)

// Finite set of realistic Indian Market Symbols with realistic base prices
const SYMBOLS = [
  { symbol: 'RELIANCE', basePrice: 2980.50 },
  { symbol: 'TCS', basePrice: 4150.25 },
  { symbol: 'INFY', basePrice: 1845.80 },
  { symbol: 'HDFCBANK', basePrice: 1650.00 },
  { symbol: 'ICICIBANK', basePrice: 1180.75 },
  { symbol: 'SBIN', basePrice: 820.40 },
  { symbol: 'BHARTIARTL', basePrice: 1540.30 },
  { symbol: 'ITC', basePrice: 495.60 },
  { symbol: 'TATAMOTORS', basePrice: 960.20 },
  { symbol: 'KOTAKBANK', basePrice: 1780.00 },
  { symbol: 'LT', basePrice: 3560.10 },
  { symbol: 'BAJFINANCE', basePrice: 7120.00 },
  { symbol: 'HINDUNILVR', basePrice: 2680.45 },
  { symbol: 'ASIANPAINT', basePrice: 2950.00 },
  { symbol: 'MARUTI', basePrice: 12450.00 },
  { symbol: 'AXISBANK', basePrice: 1190.15 },
  { symbol: 'TITAN', basePrice: 3620.80 },
  { symbol: 'SUNPHARMA', basePrice: 1750.35 },
  { symbol: 'WIPRO', basePrice: 530.20 },
  { symbol: 'ULTRACEMCO', basePrice: 11200.00 }
];

// Realistic finite set of client IDs
const CLIENT_IDS = Array.from({ length: 50 }, (_, i) => `CLIENT-${1001 + i}`);

// Realistic lot sizes
const LOT_SIZES = [10, 25, 50, 75, 100, 150, 200, 250, 500, 1000];

/**
 * Deterministic Pseudo-Random Number Generator (Mulberry32)
 * Ensures consistent output across server restarts.
 */
function createPrng(seed = 123456789) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Validates and retrieves the configured delay in milliseconds.
 * Returns a safe integer between 0 and MAX_DELAY_MS.
 */
function getConfiguredDelayMs() {
  const rawValue = process.env.BSE_DELAY_MS;

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return DEFAULT_DELAY_MS;
  }

  const parsed = Number(rawValue);

  if (isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
    console.warn(
      `[Mock BSE Service] Invalid BSE_DELAY_MS value ("${rawValue}"). Falling back to default (${DEFAULT_DELAY_MS} ms).`
    );
    return DEFAULT_DELAY_MS;
  }

  if (parsed > MAX_DELAY_MS) {
    console.warn(
      `[Mock BSE Service] Configured BSE_DELAY_MS (${parsed} ms) exceeds maximum allowed (${MAX_DELAY_MS} ms / 15 mins). Clamping to maximum.`
    );
    return MAX_DELAY_MS;
  }

  return Math.floor(parsed);
}

/**
 * Generates a deterministic dataset of trade records.
 * @param {number} count Number of trade records to generate
 * @returns {Array<Object>} Array of trade records
 */
function generateSeededTrades(count = DEFAULT_TRADE_COUNT) {
  const random = createPrng(42);
  const trades = [];
  const baseTime = new Date('2026-08-27T09:15:00.000Z').getTime();

  for (let i = 1; i <= count; i++) {
    const tradeId = `TRD-${String(i).padStart(6, '0')}`;
    const client = CLIENT_IDS[Math.floor(random() * CLIENT_IDS.length)];
    const stock = SYMBOLS[Math.floor(random() * SYMBOLS.length)];
    const quantity = LOT_SIZES[Math.floor(random() * LOT_SIZES.length)];

    // Price variation within +/- 3% of base price, rounded to 2 decimals
    const variation = (random() * 0.06) - 0.03;
    const price = Number((stock.basePrice * (1 + variation)).toFixed(2));

    // Incremental timestamp within standard trading session (09:15 to 15:30 UTC)
    // Distributed over 22,500 seconds (6.25 hours)
    const timeOffsetSec = Math.floor((i / count) * 22500) + Math.floor(random() * 5);
    const timestamp = new Date(baseTime + timeOffsetSec * 1000).toISOString();

    trades.push({
      tradeId,
      client,
      symbol: stock.symbol,
      quantity,
      price,
      timestamp
    });
  }

  return trades;
}

// Pre-generate deterministic dataset in memory
const SEEDED_TRADES = Object.freeze(generateSeededTrades(DEFAULT_TRADE_COUNT));

/**
 * Fetches seeded trade records after applying the configured artificial delay.
 * @param {Object} options Options override for testing
 * @returns {Promise<{ trades: Array<Object>, delayMs: number }>}
 */
async function fetchTrades(options = {}) {
  const delayMs = options.delayMs !== undefined ? options.delayMs : getConfiguredDelayMs();

  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return {
    trades: SEEDED_TRADES,
    delayMs
  };
}

module.exports = {
  fetchTrades,
  generateSeededTrades,
  getConfiguredDelayMs,
  DEFAULT_TRADE_COUNT,
  DEFAULT_DELAY_MS,
  MAX_DELAY_MS,
  SYMBOLS,
  CLIENT_IDS
};
