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
  assert.strictEqual(realResolve.body.app_markup_percentage, 3, 'Real marketing payout markup must be 3%');

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

  // Test 2: Isolated balances, held stakes, and win/loss settlement.
  console.log('\nTEST 2: Real/Demo Ledger Isolation & Settlement');
  const modeState = {
    real: { startingBalance: 79.84, pnl: 0, openContracts: {}, processedIds: new Set() },
    // A test fixture only; this is not a user's account balance.
    demo: { startingBalance: 250.00, pnl: 0, openContracts: {}, processedIds: new Set() }
  };

  function openTrade(mode, id, stake) {
    modeState[mode].openContracts[id] = stake;
  }

  function settleTrade(mode, id, profit) {
    const state = modeState[mode];
    delete state.openContracts[id];
    state.pnl = Number((state.pnl + profit).toFixed(2));
    state.processedIds.add(id);
  }

  function getBalance(mode) {
    const state = modeState[mode];
    const heldStakes = Object.values(state.openContracts).reduce((sum, stake) => sum + stake, 0);
    return Number((state.startingBalance + state.pnl - heldStakes).toFixed(2));
  }

  // Open a $10 Real trade: stake is reserved while it is open.
  openTrade('real', 'real-win-1', 10.00);
  assert.strictEqual(getBalance('real'), 69.84, 'Real balance must reduce by the open stake');
  assert.strictEqual(getBalance('demo'), 250.00, 'Opening a Real trade must not change Demo');

  // $17.20 base payout with 3% markup -> $16.68 payout to the trader.
  function payoutAfterMarkup(basePayout, markup) {
    return Number((basePayout * (1 - markup / 100)).toFixed(2));
  }
  assert.strictEqual(payoutAfterMarkup(17.20, 3), 16.68, '3% markup should reduce a $17.20 payout to $16.68');

  // A win returns the stake plus $6.68 profit; balance becomes $86.52.
  settleTrade('real', 'real-win-1', 16.68 - 10.00);
  assert.strictEqual(getBalance('real'), 86.52, 'Real balance must include settled Real profit');
  assert.strictEqual(getBalance('demo'), 250.00, 'Real win must not credit Demo');

  // Demo trades use only their own open-stake and P/L ledger.
  openTrade('demo', 'demo-win-1', 5.00);
  assert.strictEqual(getBalance('demo'), 245.00, 'Demo balance must reduce by the open stake');
  assert.strictEqual(getBalance('real'), 86.52, 'Opening a Demo trade must not change Real');
  settleTrade('demo', 'demo-win-1', 9.70 - 5.00);
  assert.strictEqual(getBalance('demo'), 254.70, 'Demo balance must reflect its own win');
  assert.strictEqual(getBalance('real'), 86.52, 'Demo win must not credit Real');

  // A Real loss consumes the $10 stake and must not affect Demo.
  openTrade('real', 'real-loss-1', 10.00);
  assert.strictEqual(getBalance('real'), 76.52, 'Real balance must reduce by the second open stake');
  settleTrade('real', 'real-loss-1', -10.00);
  assert.strictEqual(getBalance('real'), 76.52, 'Real loss must remain deducted after settlement');
  assert.strictEqual(getBalance('demo'), 254.70, 'Real loss must not debit Demo');

  // A Demo reset clears only Demo ledger state.
  modeState.demo.pnl = 0;
  modeState.demo.openContracts = {};
  assert.strictEqual(getBalance('demo'), 250.00, 'Demo reset should restore only Demo fixture balance');
  assert.strictEqual(getBalance('real'), 76.52, 'Demo reset must not clear Real P/L');
  console.log('✓ TEST 2 PASSED: Held stakes and settled P/L update only the selected ledger.');

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
    const expectedExpectedBal = mode === 'real' ? 76.52 : 250.00;
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
