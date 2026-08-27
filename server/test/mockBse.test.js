const assert = require('assert');
const mockBseService = require('../src/services/mockBse.service');

async function runTests() {
  console.log('--- Running Mock BSE Service Test Suite ---\n');

  // Test 1: Seeded trade generation count & structure
  console.log('Test 1: Verify seeded trades count and record shape...');
  const trades = mockBseService.generateSeededTrades(4000);
  assert.strictEqual(trades.length, 4000, 'Should generate exactly 4000 trades');

  const sample = trades[0];
  assert.ok(sample.tradeId, 'tradeId must exist');
  assert.match(sample.tradeId, /^TRD-\d{6}$/, 'tradeId format must be TRD-XXXXXX');
  assert.ok(sample.client, 'client must exist');
  assert.match(sample.client, /^CLIENT-\d{4}$/, 'client format must be CLIENT-XXXX');
  assert.ok(sample.symbol, 'symbol must exist');
  assert.ok(sample.quantity > 0 && Number.isInteger(sample.quantity), 'quantity must be positive integer');
  assert.ok(sample.price > 0, 'price must be positive decimal');
  assert.ok(!isNaN(Date.parse(sample.timestamp)), 'timestamp must be valid ISO string');
  console.log('✓ Test 1 Passed: 4000 records generated with correct schema.');

  // Test 2: Uniqueness of tradeId
  console.log('\nTest 2: Verify tradeId uniqueness across all 4000 records...');
  const tradeIdSet = new Set(trades.map((t) => t.tradeId));
  assert.strictEqual(tradeIdSet.size, 4000, 'All trade IDs must be unique');
  console.log('✓ Test 2 Passed: 100% of 4000 trade IDs are unique.');

  // Test 3: Deterministic consistency
  console.log('\nTest 3: Verify deterministic generation across runs...');
  const tradesRun1 = mockBseService.generateSeededTrades(50);
  const tradesRun2 = mockBseService.generateSeededTrades(50);
  assert.deepStrictEqual(tradesRun1, tradesRun2, 'PRNG must generate identical records for identical seeds');
  console.log('✓ Test 3 Passed: Seeded data is deterministic and reproducible.');

  // Test 4: Realistic distribution of symbols and clients
  console.log('\nTest 4: Verify symbols and clients set distribution...');
  const symbolsFound = new Set(trades.map((t) => t.symbol));
  const clientsFound = new Set(trades.map((t) => t.client));
  assert.ok(symbolsFound.size >= 15, 'Dataset should span multiple realistic symbols');
  assert.ok(clientsFound.size >= 30, 'Dataset should span multiple realistic client IDs');
  console.log(`✓ Test 4 Passed: Spans ${symbolsFound.size} symbols and ${clientsFound.size} clients.`);

  // Test 5: Fetch trades with 0 delay (immediate mode for test)
  console.log('\nTest 5: Verify fetchTrades with 0 delay...');
  const start = Date.now();
  const result = await mockBseService.fetchTrades({ delayMs: 0 });
  const duration = Date.now() - start;
  assert.strictEqual(result.trades.length, 4000, 'fetchTrades should return 4000 trades');
  assert.strictEqual(result.delayMs, 0, 'delayMs should be 0');
  assert.ok(duration < 100, `Immediate fetch should complete within 100ms (took ${duration}ms)`);
  console.log(`✓ Test 5 Passed: Immediate fetch completed in ${duration}ms.`);

  // Test 6: Delay configuration bounds and fallback validation
  console.log('\nTest 6: Verify delay bounds and fallback handling...');
  const originalEnv = process.env.BSE_DELAY_MS;

  // Undefined -> Default (5000)
  delete process.env.BSE_DELAY_MS;
  assert.strictEqual(mockBseService.getConfiguredDelayMs(), 5000);

  // Valid number -> Parsed
  process.env.BSE_DELAY_MS = '2500';
  assert.strictEqual(mockBseService.getConfiguredDelayMs(), 2500);

  // Exceeds max (15 mins = 900,000 ms) -> Clamped to 900,000
  process.env.BSE_DELAY_MS = '1200000';
  assert.strictEqual(mockBseService.getConfiguredDelayMs(), 900000);

  // Negative number -> Fallback to default
  process.env.BSE_DELAY_MS = '-100';
  assert.strictEqual(mockBseService.getConfiguredDelayMs(), 5000);

  // Non-numeric string -> Fallback to default
  process.env.BSE_DELAY_MS = 'invalid_delay';
  assert.strictEqual(mockBseService.getConfiguredDelayMs(), 5000);

  // Restore env
  if (originalEnv !== undefined) {
    process.env.BSE_DELAY_MS = originalEnv;
  } else {
    delete process.env.BSE_DELAY_MS;
  }

  console.log('✓ Test 6 Passed: Delay config parsed, validated, and clamped correctly.');

  console.log('\n========================================');
  console.log('🎉 ALL 6 AUTOMATED TESTS PASSED SUCCESSFULLY!');
  console.log('========================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
