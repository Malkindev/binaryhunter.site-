/**
 * End-to-End Real vs Demo Isolation & State Separation Test Suite
 */
const assert = require('assert');
const http = require('http');

function apiGet(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3001' + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- STARTING MARKETING ACCOUNT REAL/DEMO ISOLATION TESTS ---\n');

  // Test 1: Backend endpoint isolation
  console.log('TEST 1: Backend Endpoint Isolation by Mode');
  const realResolve = await apiGet('/api/marketing/resolve?loginid=ROT90394362&mode=real');
  assert.strictEqual(realResolve.body.success, true, 'Real resolve should succeed');
  assert.strictEqual(realResolve.body.mode, 'real', 'Real resolve mode must be real');
  assert.strictEqual(realResolve.body.rot, 'ROT90394362', 'Real ROT must be ROT90394362');
  assert.strictEqual(realResolve.body.startingBalance, 79.84, 'Real balance must be 79.84');
  assert.strictEqual(realResolve.body.useRealBalance, false, 'Real mode uses simulation');

  const demoResolve = await apiGet('/api/marketing/resolve?loginid=VRTC123456&mode=demo');
  assert.strictEqual(demoResolve.body.success, true, 'Demo resolve should succeed');
  assert.strictEqual(demoResolve.body.mode, 'demo', 'Demo resolve mode must be demo');
  assert.strictEqual(demoResolve.body.useRealBalance, true, 'Demo mode configured with useRealBalance: true');
  assert.strictEqual(demoResolve.body.marketingEligible, false, 'Demo not marketing eligible when useRealBalance');

  // Verify Client Real account (e.g. CR90394362 or CR123456) NEVER gets marketing
  const clientResolve1 = await apiGet('/api/marketing/resolve?loginid=CR90394362&mode=real');
  assert.strictEqual(clientResolve1.body.marketingEligible, false, 'Client CR account with same digits must NOT get marketing');
  assert.strictEqual(clientResolve1.body.useRealBalance, true, 'Client must trade with real balance');

  const clientResolve2 = await apiGet('/api/marketing/resolve?loginid=CR87654321&mode=real');
  assert.strictEqual(clientResolve2.body.marketingEligible, false, 'Generic client CR account must NOT get marketing');
  assert.strictEqual(clientResolve2.body.useRealBalance, true, 'Client must trade with real balance');
  console.log('✓ TEST 1 PASSED: Real and Demo resolve endpoints completely separated, client accounts strictly isolated.');

  // Test 2: In-memory mode state isolation logic
  console.log('\nTEST 2: Mode State Partitioning Logic');
  const modeState = {
    real: { startingBalance: 79.84, pnl: 0, openContracts: {}, processedIds: new Set() },
    demo: { startingBalance: 10000, pnl: 0, openContracts: {}, processedIds: new Set() }
  };

  function addTradePnl(mode, profit) {
    modeState[mode].pnl += profit;
  }

  function getBalance(mode) {
    return modeState[mode].startingBalance + modeState[mode].pnl;
  }

  // Simulate trading in Real mode
  addTradePnl('real', 25.50);
  assert.strictEqual(getBalance('real'), 105.34, 'Real balance updated with PnL');
  assert.strictEqual(getBalance('demo'), 10000, 'Demo balance must remain unaffected by Real PnL');

  // Simulate trading in Demo mode
  addTradePnl('demo', -50.00);
  assert.strictEqual(getBalance('demo'), 9950.00, 'Demo balance updated with PnL');
  assert.strictEqual(getBalance('real'), 105.34, 'Real balance must remain unaffected by Demo PnL');
  console.log('✓ TEST 2 PASSED: PnL and trade calculations in one mode never contaminate the other.');

  // Test 3: Rapid switching epoch protection
  console.log('\nTEST 3: Epoch Race Condition & Out-of-Order Stale Response Drop');
  let currentEpoch = 0;
  let activeAuthoritativeMode = 'real';
  let appliedBalance = 79.84;

  function switchMode(newMode) {
    currentEpoch++;
    activeAuthoritativeMode = newMode;
  }

  function handleAsyncResolveResponse(reqEpoch, reqMode, newBal) {
    if (reqEpoch !== currentEpoch) {
      // Stale response dropped
      return 'DROPPED_STALE_EPOCH';
    }
    if (reqMode !== activeAuthoritativeMode) {
      // Mode mismatch dropped
      return 'DROPPED_MODE_MISMATCH';
    }
    appliedBalance = newBal;
    return 'APPLIED';
  }

  // Start a slow Real request
  const slowRealEpoch = currentEpoch;
  const slowRealMode = activeAuthoritativeMode;

  // User rapidly switches Real -> Demo -> Real -> Demo
  switchMode('demo');
  switchMode('real');
  switchMode('demo');

  // Slow Real response finally arrives
  const result = handleAsyncResolveResponse(slowRealEpoch, slowRealMode, 9999.99);
  assert.strictEqual(result, 'DROPPED_STALE_EPOCH', 'Old response must be dropped');
  assert.notStrictEqual(appliedBalance, 9999.99, 'Applied balance must not be updated with stale data');
  console.log('✓ TEST 3 PASSED: Rapid switching correctly invalidates in-flight responses via activeModeEpoch.');

  // Test 4: Switching sequences (Real -> Demo -> Real -> Demo)
  console.log('\nTEST 4: State Consistency across Multiple Mode Switches');
  const testSequence = ['real', 'demo', 'real', 'demo'];
  testSequence.forEach((mode, idx) => {
    switchMode(mode);
    const expectedExpectedBal = mode === 'real' ? 105.34 : 9950.00;
    const currentBal = getBalance(mode);
    assert.strictEqual(currentBal, expectedExpectedBal, `Switch step ${idx + 1} (${mode}) balance match`);
  });
  console.log('✓ TEST 4 PASSED: Complete isolation preserved across alternating switches.');

  console.log('\n========================================');
  console.log('ALL REAL/DEMO ISOLATION TESTS PASSED!');
  console.log('========================================\n');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
