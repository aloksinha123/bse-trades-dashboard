/**
 * Trade Repository
 * Data-access layer providing parameterized database operations for trades.
 */
const { getDb } = require('./database');

/**
 * Retrieves a paginated list of persisted trades.
 * @param {Object} options
 * @param {number} [options.limit=50] Maximum number of records to return
 * @param {number} [options.offset=0] Offset for pagination
 * @returns {Array<Object>} List of trade records
 */
function getTrades({ limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 500));
  const safeOffset = Math.max(0, Number(offset) || 0);

  const stmt = db.prepare(`
    SELECT tradeId, client, symbol, quantity, price, timestamp, createdAt
    FROM trades
    ORDER BY timestamp DESC, id DESC
    LIMIT ? OFFSET ?
  `);

  return stmt.all(safeLimit, safeOffset);
}

/**
 * Retrieves a single trade by its unique tradeId.
 * @param {string} tradeId
 * @returns {Object|null}
 */
function getTradeById(tradeId) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT tradeId, client, symbol, quantity, price, timestamp, createdAt
    FROM trades
    WHERE tradeId = ?
  `);

  return stmt.get(tradeId) || null;
}

/**
 * Inserts a single trade record, ignoring duplicates.
 * @param {Object} trade
 * @returns {{ inserted: boolean, tradeId: string }}
 */
function insertTrade(trade) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO trades (tradeId, client, symbol, quantity, price, timestamp)
    VALUES (@tradeId, @client, @symbol, @quantity, @price, @timestamp)
  `);

  const info = stmt.run(trade);
  return {
    inserted: info.changes > 0,
    tradeId: trade.tradeId
  };
}

/**
 * Inserts an array of trade records in a single atomic transaction.
 * Duplicates are safely ignored.
 * @param {Array<Object>} trades
 * @returns {{ insertedCount: number, totalProcessed: number }}
 */
function insertTrades(trades) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return { insertedCount: 0, totalProcessed: 0 };
  }

  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO trades (tradeId, client, symbol, quantity, price, timestamp)
    VALUES (@tradeId, @client, @symbol, @quantity, @price, @timestamp)
  `);

  let insertedCount = 0;

  const insertMany = db.transaction((records) => {
    for (const record of records) {
      const info = stmt.run(record);
      if (info.changes > 0) {
        insertedCount++;
      }
    }
  });

  insertMany(trades);

  return {
    insertedCount,
    totalProcessed: trades.length
  };
}

/**
 * Returns the total count of persisted trades.
 * @returns {number}
 */
function countTrades() {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as total FROM trades').get();
  return row ? row.total : 0;
}

module.exports = {
  getTrades,
  getTradeById,
  insertTrade,
  insertTrades,
  countTrades
};
