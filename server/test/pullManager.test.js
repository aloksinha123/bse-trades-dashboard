const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { CREATE_TRADES_TABLE, CREATE_INDEX_TIMESTAMP, CREATE_INDEX_TRADE_ID } = require('../src/db/schema');
const { PullManagerService } = require('../src/services/pullManager.service');
const { generateSeededTrades } = require('../src/services/mockBse.service');

// Helper to create an isolated test SQLite repository
function createIsolatedTestRepository(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(CREATE_TRADES_TABLE);
  db.exec(CREATE_INDEX_TIMESTAMP);
  db.exec(CREATE_INDEX_TRADE_ID);

  // Seed initial 500 trades
  const initialTrades = generateSeededTrades(500);
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

  return {
    db,
    countTrades: () => db.prepare('SELECT COUNT(*) as total FROM trades').get().total,
    insertTrades: (trades) => {
      let insertedCount = 0;
      const insertedTrades = [];
      const tx = db.transaction((records) => {
        for (const r of records) {
          const info = insertStmt.run(r);
          if (info.changes > 0) {
            insertedCount++;
            insertedTrades.push(r);
          }
        }
      });
      tx(trades);
      return {
        insertedCount,
        duplicateCount: trades.length - insertedCount,
        insertedTrades,
        totalProcessed: trades.length
      };
    },
    close: () => db.close()
  };
}

async function runPullManagerTests() {
  console.log('--- Running Pull Manager & Background Ingestion Test Suite ---\n');

  const testDbDir = path.resolve(__dirname, '../data/test');
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }
  const testDbPath = path.join(testDbDir, `test_pull_${Date.now()}.db`);
  const testRepo = createIsolatedTestRepository(testDbPath);
  const pullManager = new PullManagerService();

  const devDbPath = path.resolve(__dirname, '../data/trades.db');
  let initialDevCount = 0;
  if (fs.existsSync(devDbPath)) {
    const devDb = new Database(devDbPath, { readonly: true });
    initialDevCount = devDb.prepare('SELECT COUNT(*) as total FROM trades').get().total;
    devDb.close();
  }

  try {
    // Test 1: Immediate response & non-blocking execution (< 50ms)
    console.log('Test 1: Verifying POST /pull returns immediately (< 50ms)...');
    const startTime = Date.now();
    const { job } = pullManager.startPull({
      repository: testRepo,
      delayMs: 150 // 150ms artificial delay for test
    });
    const dispatchDuration = Date.now() - startTime;

    assert.ok(job.jobId, 'Job must have a unique jobId');
    assert.match(job.jobId, /^pull-\d+-[a-z0-9]+$/, 'Job ID must follow pull-<timestamp>-<rand> format');
    assert.strictEqual(job.status, 'running', 'Initial status must be "running"');
    assert.ok(dispatchDuration < 50, `Dispatch should return in <50ms (took ${dispatchDuration}ms)`);
    console.log(`✓ Test 1 Passed: startPull returned immediately in ${dispatchDuration}ms with jobId: ${job.jobId}`);

    // Test 2: Status check during execution
    console.log('\nTest 2: Verifying job state while running...');
    const runningJob = pullManager.getJob(job.jobId);
    assert.strictEqual(runningJob.status, 'running');
    assert.strictEqual(runningJob.totalFetched, 0);
    assert.strictEqual(pullManager.getActiveJobId(), job.jobId, 'Active lock should be held');
    console.log('✓ Test 2 Passed: Job correctly reports "running" and lock is held.');

    // Test 3: Concurrent pull rejection (HTTP 409 Conflict)
    console.log('\nTest 3: Verifying concurrent pull rejection...');
    assert.throws(
      () => {
        pullManager.startPull({ repository: testRepo });
      },
      (err) => {
        return err.status === 409 && err.message.includes('already in progress');
      },
      'Should throw 409 error when starting pull while another is active'
    );
    console.log('✓ Test 3 Passed: Concurrent pull rejected with 409 Conflict.');

    // Test 4: Await completion and verify metric accuracy
    console.log('\nTest 4: Waiting for background pull completion and verifying metrics...');
    // Wait for the 150ms delay to finish
    await new Promise((resolve) => setTimeout(resolve, 250));

    const completedJob = pullManager.getJob(job.jobId);
    assert.strictEqual(completedJob.status, 'completed', 'Job should transition to "completed"');
    assert.strictEqual(completedJob.totalFetched, 4000, 'totalFetched should equal 4000');
    assert.strictEqual(completedJob.insertedCount, 3500, 'insertedCount should equal 3500 (4000 - 500 initial)');
    assert.strictEqual(completedJob.duplicateCount, 500, 'duplicateCount should equal 500 initial');
    assert.ok(completedJob.completedAt, 'completedAt must be populated');
    assert.strictEqual(pullManager.getActiveJobId(), null, 'Active lock must be released');
    console.log('✓ Test 4 Passed: Job completed with exact counts (4000 fetched, 3500 inserted, 500 duplicates).');

    // Test 5: Verify SQLite persistence
    console.log('\nTest 5: Verifying SQLite persistence in isolated test database...');
    const finalCount = testRepo.countTrades();
    assert.strictEqual(finalCount, 4000, 'Database should now contain exactly 4000 trades');
    console.log(`✓ Test 5 Passed: Total persisted trades in test database is now ${finalCount}.`);

    // Test 6: Second pull after completion (all 4000 now exist -> 0 inserted, 4000 duplicates)
    console.log('\nTest 6: Verifying subsequent pull after completion...');
    const { job: secondJob } = pullManager.startPull({
      repository: testRepo,
      delayMs: 50
    });
    await new Promise((resolve) => setTimeout(resolve, 150));

    const secondCompleted = pullManager.getJob(secondJob.jobId);
    assert.strictEqual(secondCompleted.status, 'completed');
    assert.strictEqual(secondCompleted.totalFetched, 4000);
    assert.strictEqual(secondCompleted.insertedCount, 0, 'No new trades inserted on second full run');
    assert.strictEqual(secondCompleted.duplicateCount, 4000, 'All 4000 records recognized as duplicates');
    assert.strictEqual(testRepo.countTrades(), 4000, 'Database count remains 4000 without duplicates');
    console.log('✓ Test 6 Passed: Subsequent pull idempotently handled all duplicates.');

    // Test 7: Error handling and lock release on simulated BSE failure
    console.log('\nTest 7: Verifying error handling when upstream BSE fails...');
    const failingMockService = {
      fetchTrades: async () => {
        throw new Error('Simulated upstream network timeout (504 Gateway Timeout)');
      }
    };

    const { job: failJob } = pullManager.startPull({
      mockService: failingMockService,
      repository: testRepo
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const failedJob = pullManager.getJob(failJob.jobId);
    assert.strictEqual(failedJob.status, 'failed', 'Job status must be "failed"');
    assert.ok(failedJob.error.includes('504 Gateway Timeout'), 'Error message must be captured');
    assert.strictEqual(pullManager.getActiveJobId(), null, 'Lock must be released even after failure');
    console.log('✓ Test 7 Passed: Failure captured cleanly and lock released.');

    // Test 8: Verify getAllJobs returns history
    console.log('\nTest 8: Verifying getAllJobs history...');
    const allJobs = pullManager.getAllJobs();
    assert.strictEqual(allJobs.length, 3, 'Should record all 3 executed jobs');
    assert.strictEqual(allJobs[0].jobId, failJob.jobId, 'Newest job should be first');
    console.log(`✓ Test 8 Passed: In-memory history returned ${allJobs.length} jobs.`);

    // Test 9: Isolation verification: Ensure main dev database was NOT touched by the test run
    console.log('\nTest 9: Verifying development database isolation...');
    if (fs.existsSync(devDbPath)) {
      const devDb = new Database(devDbPath, { readonly: true });
      const devCountAfter = devDb.prepare('SELECT COUNT(*) as total FROM trades').get().total;
      devDb.close();
      assert.strictEqual(
        devCountAfter,
        initialDevCount,
        `Development database count must not be modified by tests (was ${initialDevCount}, is ${devCountAfter})`
      );
      console.log(`✓ Test 9 Passed: Development database untouched (maintained ${devCountAfter} records).`);
    } else {
      console.log('✓ Test 9 Passed: Development database does not exist yet (clean slate).');
    }
  } finally {
    testRepo.close();
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      const walPath = `${testDbPath}-wal`;
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      const shmPath = `${testDbPath}-shm`;
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
      if (fs.existsSync(testDbDir)) fs.rmdirSync(testDbDir);
    } catch (cleanupErr) {
      // Ignore
    }
  }

  console.log('\n=================================================');
  console.log('🎉 ALL PULL MANAGER & INGESTION TESTS PASSED!');
  console.log('=================================================\n');
}

runPullManagerTests().catch((err) => {
  console.error('\n❌ Pull Manager test failure:', err);
  process.exit(1);
});
