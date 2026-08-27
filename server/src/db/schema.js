/**
 * Database Schema Definitions
 * Defines tables, indexes, and constraints for persistent trade storage.
 */

const CREATE_TRADES_TABLE = `
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tradeId TEXT UNIQUE NOT NULL,
    client TEXT NOT NULL,
    symbol TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    price REAL NOT NULL CHECK(price > 0),
    timestamp TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const CREATE_INDEX_TIMESTAMP = `
  CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades (timestamp DESC, id DESC);
`;

const CREATE_INDEX_TRADE_ID = `
  CREATE INDEX IF NOT EXISTS idx_trades_trade_id ON trades (tradeId);
`;

module.exports = {
  CREATE_TRADES_TABLE,
  CREATE_INDEX_TIMESTAMP,
  CREATE_INDEX_TRADE_ID
};
