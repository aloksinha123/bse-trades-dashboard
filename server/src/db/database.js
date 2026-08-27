/**
 * Database Connection & Lifecycle Manager
 * Handles SQLite initialization, schema migration, and initial seeding.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const {
  CREATE_TRADES_TABLE,
  CREATE_INDEX_TIMESTAMP,
  CREATE_INDEX_TRADE_ID
} = require('./schema');
const { generateSeededTrades } = require('../services/mockBse.service');

const INITIAL_PULLED_COUNT = 500;
let dbInstance = null;

/**
 * Returns default database file path.
 */
function getDefaultDbPath() {
  const dataDir = path.resolve(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'trades.db');
}

/**
 * Initializes the SQLite database, creates schema, and seeds initial 500 records on first run.
 * @param {string} [customPath] Optional path (e.g., ':memory:' for isolated testing)
 * @returns {Database} The active SQLite database instance
 */
function initDatabase(customPath) {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = customPath || process.env.DATABASE_PATH || getDefaultDbPath();
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrency and foreign keys
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');

  // Execute schema creation
  db.exec(CREATE_TRADES_TABLE);
  db.exec(CREATE_INDEX_TIMESTAMP);
  db.exec(CREATE_INDEX_TRADE_ID);

  // Check if initial seeding is needed
  const countRow = db.prepare('SELECT COUNT(*) as total FROM trades').get();
  if (countRow.total === 0) {
    const initialTrades = generateSeededTrades(INITIAL_PULLED_COUNT);
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO trades (tradeId, client, symbol, quantity, price, timestamp)
      VALUES (@tradeId, @client, @symbol, @quantity, @price, @timestamp)
    `);

    const insertMany = db.transaction((trades) => {
      for (const trade of trades) {
        insertStmt.run(trade);
      }
    });

    insertMany(initialTrades);
    console.log(`[Database] Initialized and seeded ${initialTrades.length} initial trades.`);
  } else {
    console.log(`[Database] Loaded existing database with ${countRow.total} trades.`);
  }

  dbInstance = db;
  return dbInstance;
}

/**
 * Gets the current active database instance.
 * @returns {Database}
 */
function getDb() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

/**
 * Closes the database connection (used for testing or graceful shutdown).
 */
function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  initDatabase,
  getDb,
  closeDatabase,
  INITIAL_PULLED_COUNT
};
