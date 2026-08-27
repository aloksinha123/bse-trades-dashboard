const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { io: Client } = require('socket.io-client');
const Database = require('better-sqlite3');
const { CREATE_TRADES_TABLE, CREATE_INDEX_TIMESTAMP, CREATE_INDEX_TRADE_ID } = require('../src/db/schema');
const { generateSeededTrades } = require('../src/services/mockBse.service');
const { PullManagerService } = require('../src/services/pullManager.service');
const { initWebSocket, closeWebSocket, EVENTS } = require('../src/websocket/websocket.server');

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

async function runWebSocketTests() {
  console.log('--- Running WebSocket (Socket.IO) Real-Time Layer Test Suite ---\n');

  const testDbDir = path.resolve(__dirname, '../data/test');
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }
  const testDbPath = path.join(testDbDir, `test_ws_${Date.now()}.db`);
  const testRepo = createIsolatedTestRepository(testDbPath);

  // Create isolated HTTP and Socket.IO server on a random port
  const httpServer = http.createServer();
  const ioServer = initWebSocket(httpServer, {
    clientOrigin: '*'
  });

  const TEST_PORT = 5099;
  await new Promise((resolve) => httpServer.listen(TEST_PORT, resolve));

  const socketClient = Client(`http://localhost:${TEST_PORT}`, {
    transports: ['websocket', 'polling']
  });

  const pullManager = new PullManagerService();

  const devDbPath = path.resolve(__dirname, '../data/trades.db');
  let initialDevCount = 0;
  if (fs.existsSync(devDbPath)) {
    const devDb = new Database(devDbPath, { readonly: true });
    initialDevCount = devDb.prepare('SELECT COUNT(*) as total FROM trades').get().total;
    devDb.close();
  }

  try {
    // Test 1: Socket.IO Client Connection
    console.log('Test 1: Connecting Socket.IO client...');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Connection timeout')), 3000);
      socketClient.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    assert.strictEqual(socketClient.connected, true, 'Socket client should be connected');
    console.log(`✓ Test 1 Passed: Client connected with socket id: ${socketClient.id}`);

    // Test 2: Full Real-Time Pull Flow (pull:started -> trades:new -> pull:completed)
    console.log('\nTest 2: Verifying real-time events during background pull...');
    const receivedEvents = [];

    socketClient.on(EVENTS.PULL_STARTED, (data) => {
      receivedEvents.push({ event: EVENTS.PULL_STARTED, data, receivedAt: Date.now() });
    });

    socketClient.on(EVENTS.TRADES_NEW, (data) => {
      receivedEvents.push({ event: EVENTS.TRADES_NEW, data, receivedAt: Date.now() });
    });

    socketClient.on(EVENTS.PULL_COMPLETED, (data) => {
      receivedEvents.push({ event: EVENTS.PULL_COMPLETED, data, receivedAt: Date.now() });
    });

    socketClient.on(EVENTS.PULL_FAILED, (data) => {
      receivedEvents.push({ event: EVENTS.PULL_FAILED, data, receivedAt: Date.now() });
    });

    // Start background pull with 100ms artificial delay
    const { job } = pullManager.startPull({
      repository: testRepo,
      delayMs: 100
    });

    // Wait for background completion (100ms + buffer)
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify events and ordering
    assert.strictEqual(receivedEvents.length, 3, 'Should receive exactly 3 events (started, trades:new, completed)');
    assert.strictEqual(receivedEvents[0].event, EVENTS.PULL_STARTED, 'First event must be pull:started');
    assert.strictEqual(receivedEvents[1].event, EVENTS.TRADES_NEW, 'Second event must be trades:new');
    assert.strictEqual(receivedEvents[2].event, EVENTS.PULL_COMPLETED, 'Third event must be pull:completed');

    // Verify pull:started payload
    assert.strictEqual(receivedEvents[0].data.jobId, job.jobId);
    assert.strictEqual(receivedEvents[0].data.status, 'running');

    // Verify trades:new payload (must contain exactly 3,500 newly inserted trades)
    const tradesNewPayload = receivedEvents[1].data;
    assert.strictEqual(tradesNewPayload.jobId, job.jobId);
    assert.strictEqual(tradesNewPayload.count, 3500, 'trades:new count must be 3500 (new trades only)');
    assert.strictEqual(tradesNewPayload.trades.length, 3500, 'trades:new array must contain 3500 items');
    assert.strictEqual(tradesNewPayload.trades[0].tradeId, 'TRD-000501', 'First new trade should be TRD-000501');

    // Verify pull:completed payload
    const completedPayload = receivedEvents[2].data;
    assert.strictEqual(completedPayload.jobId, job.jobId);
    assert.strictEqual(completedPayload.status, 'completed');
    assert.strictEqual(completedPayload.totalFetched, 4000);
    assert.strictEqual(completedPayload.insertedCount, 3500);
    assert.strictEqual(completedPayload.duplicateCount, 500);

    console.log('✓ Test 2 Passed: Event order and payloads verified (pull:started -> trades:new (3500) -> pull:completed).');

    // Test 3: Idempotent / Duplicate-Only Pull (must NOT emit trades:new)
    console.log('\nTest 3: Verifying duplicate-only pull suppresses trades:new...');
    receivedEvents.length = 0; // clear event log

    const { job: job2 } = pullManager.startPull({
      repository: testRepo,
      delayMs: 50
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    assert.strictEqual(receivedEvents.length, 2, 'Should receive only 2 events (started, completed) without trades:new');
    assert.strictEqual(receivedEvents[0].event, EVENTS.PULL_STARTED);
    assert.strictEqual(receivedEvents[1].event, EVENTS.PULL_COMPLETED);
    assert.strictEqual(receivedEvents[1].data.insertedCount, 0);
    assert.strictEqual(receivedEvents[1].data.duplicateCount, 4000);
    console.log('✓ Test 3 Passed: Duplicate-only pull correctly suppressed trades:new event.');

    // Test 4: Upstream Failure Emits pull:failed
    console.log('\nTest 4: Verifying failure event emission...');
    receivedEvents.length = 0;

    const failingService = {
      fetchTrades: async () => {
        throw new Error('Simulated socket drop');
      }
    };

    const { job: job3 } = pullManager.startPull({
      mockService: failingService,
      repository: testRepo
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(receivedEvents.length, 2, 'Should receive started and failed events');
    assert.strictEqual(receivedEvents[0].event, EVENTS.PULL_STARTED);
    assert.strictEqual(receivedEvents[1].event, EVENTS.PULL_FAILED);
    assert.strictEqual(receivedEvents[1].data.jobId, job3.jobId);
    assert.strictEqual(receivedEvents[1].data.status, 'failed');
    assert.ok(receivedEvents[1].data.error.includes('Simulated socket drop'));
    console.log('✓ Test 4 Passed: Failure correctly emitted pull:failed event.');

    // Test 5: Isolation check (Development database was not touched by tests)
    console.log('\nTest 5: Verifying development database isolation...');
    if (fs.existsSync(devDbPath)) {
      const devDb = new Database(devDbPath, { readonly: true });
      const devCountAfter = devDb.prepare('SELECT COUNT(*) as total FROM trades').get().total;
      devDb.close();
      assert.strictEqual(
        devCountAfter,
        initialDevCount,
        `Dev DB count must not be modified by tests (was ${initialDevCount}, is ${devCountAfter})`
      );
      console.log(`✓ Test 5 Passed: Dev DB untouched (maintained ${devCountAfter} records).`);
    } else {
      console.log('✓ Test 5 Passed: Clean dev DB.');
    }
  } finally {
    socketClient.disconnect();
    await closeWebSocket();
    await new Promise((resolve) => httpServer.close(resolve));
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
  console.log('🎉 ALL WEBSOCKET REAL-TIME TESTS PASSED!');
  console.log('=================================================\n');
}

runWebSocketTests().catch((err) => {
  console.error('\n❌ WebSocket test failure:', err);
  process.exit(1);
});
