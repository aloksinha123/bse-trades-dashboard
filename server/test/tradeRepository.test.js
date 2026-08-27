const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { initDatabase, closeDatabase, getDb } = require('../src/db/database');
const tradeRepository = require('../src/db/trade.repository');
const { generateSeededTrades } = require('../src/services/mockBse.service');

async function runRepositoryTests() {
  console.log('--- Running Trade Repository & SQLite Persistence Test Suite ---\n');

  const testDbDir = path.resolve(__dirname, '../data/test');
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }
  const testDbPath = path.join(testDbDir, `test_trades_${Date.now()}.db`);

  try {
    // Test A & B: Database initialization and initial 500-record seed
    console.log('Test A & B: Initializing database and verifying initial 500 seed...');
    initDatabase(testDbPath);

    const initialCount = tradeRepository.countTrades();
    assert.strictEqual(initialCount, 500, 'Initial database should contain exactly 500 seeded trades');
    console.log(`✓ Test A & B Passed: Database initialized with ${initialCount} records.`);

    // Test C & D: Duplicate insertion prevention on single trade
    console.log('\nTest C & D: Verifying duplicate trade insertion handling...');
    const duplicateTrade = {
      tradeId: 'TRD-000001', // Already in initial 500
      client: 'CLIENT-9999',
      symbol: 'TEST_STOCK',
      quantity: 100,
      price: 100.0,
      timestamp: '2026-08-27T10:00:00.000Z'
    };

    const insertResult = tradeRepository.insertTrade(duplicateTrade);
    assert.strictEqual(insertResult.inserted, false, 'Duplicate tradeId insertion should be ignored');
    assert.strictEqual(tradeRepository.countTrades(), 500, 'Total count should remain 500 after duplicate insert');

    // Verify existing record was not overwritten
    const existing = tradeRepository.getTradeById('TRD-000001');
    assert.strictEqual(existing.tradeId, 'TRD-000001');
    assert.notStrictEqual(existing.client, 'CLIENT-9999', 'Existing trade data must not be overwritten');
    console.log('✓ Test C & D Passed: Duplicate insertions safely ignored without overwriting.');

    // Test E: Batch insert of multiple new trades
    console.log('\nTest E: Verifying batch insertion (insertTrades)...');
    const newTrades = [
      {
        tradeId: 'TRD-009001',
        client: 'CLIENT-1001',
        symbol: 'RELIANCE',
        quantity: 50,
        price: 2990.0,
        timestamp: '2026-08-27T16:00:00.000Z'
      },
      {
        tradeId: 'TRD-009002',
        client: 'CLIENT-1002',
        symbol: 'TCS',
        quantity: 100,
        price: 4160.0,
        timestamp: '2026-08-27T16:05:00.000Z'
      },
      {
        tradeId: 'TRD-000002', // Duplicate in batch
        client: 'CLIENT-1003',
        symbol: 'INFY',
        quantity: 25,
        price: 1850.0,
        timestamp: '2026-08-27T16:10:00.000Z'
      }
    ];

    const batchResult = tradeRepository.insertTrades(newTrades);
    assert.strictEqual(batchResult.totalProcessed, 3, 'Processed count should be 3');
    assert.strictEqual(batchResult.insertedCount, 2, 'Should insert exactly 2 new records (1 duplicate ignored)');
    assert.strictEqual(tradeRepository.countTrades(), 502, 'Total count should now be 502');
    console.log('✓ Test E Passed: Batch insert processed correctly with conflict resolution.');

    // Test F: Deterministic ordering (timestamp DESC, id DESC)
    console.log('\nTest F: Verifying newest-first deterministic ordering...');
    const topTrades = tradeRepository.getTrades({ limit: 10, offset: 0 });
    assert.strictEqual(topTrades.length, 10);
    // The newly inserted TRD-009002 with timestamp 16:05:00 should be first
    assert.strictEqual(topTrades[0].tradeId, 'TRD-009002');
    assert.strictEqual(topTrades[1].tradeId, 'TRD-009001');

    for (let i = 0; i < topTrades.length - 1; i++) {
      const current = new Date(topTrades[i].timestamp).getTime();
      const next = new Date(topTrades[i + 1].timestamp).getTime();
      assert.ok(current >= next, 'Records must be ordered newest timestamp first');
    }
    console.log('✓ Test F Passed: Results ordered deterministically by timestamp DESC.');

    // Test G: Pagination (limit & offset)
    console.log('\nTest G: Verifying pagination mechanics...');
    const page1 = tradeRepository.getTrades({ limit: 20, offset: 0 });
    const page2 = tradeRepository.getTrades({ limit: 20, offset: 20 });
    assert.strictEqual(page1.length, 20);
    assert.strictEqual(page2.length, 20);

    const page1Ids = new Set(page1.map((t) => t.tradeId));
    for (const trade of page2) {
      assert.ok(!page1Ids.has(trade.tradeId), 'Page 2 must not overlap with Page 1');
    }
    console.log('✓ Test G Passed: Pagination limit and offset work without overlap.');

    // Test H: Trade lookup by ID
    console.log('\nTest H: Verifying getTradeById...');
    const found = tradeRepository.getTradeById('TRD-009001');
    assert.ok(found);
    assert.strictEqual(found.tradeId, 'TRD-009001');
    assert.strictEqual(found.symbol, 'RELIANCE');

    const notFound = tradeRepository.getTradeById('TRD-NONEXISTENT');
    assert.strictEqual(notFound, null, 'Non-existent tradeId should return null');
    console.log('✓ Test H Passed: Single record lookup works as expected.');

    // Test I: Persistence across restart simulation
    console.log('\nTest I: Verifying persistence across database restart...');
    closeDatabase();

    // Re-initialize with same file
    initDatabase(testDbPath);
    const restartedCount = tradeRepository.countTrades();
    assert.strictEqual(restartedCount, 502, 'Data must persist across restart without duplicate seeding');
    console.log(`✓ Test I Passed: Restart verified with exact count (${restartedCount} records).`);

    closeDatabase();
  } finally {
    // Cleanup temporary test db
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      const walPath = `${testDbPath}-wal`;
      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
      }
      const shmPath = `${testDbPath}-shm`;
      if (fs.existsSync(shmPath)) {
        fs.unlinkSync(shmPath);
      }
      if (fs.existsSync(testDbDir)) {
        fs.rmdirSync(testDbDir);
      }
    } catch (cleanupErr) {
      // Ignore cleanup error in test
    }
  }

  console.log('\n======================================================');
  console.log('🎉 ALL TRADE REPOSITORY & PERSISTENCE TESTS PASSED!');
  console.log('======================================================\n');
}

runRepositoryTests().catch((err) => {
  console.error('\n❌ Repository test failure:', err);
  process.exit(1);
});
