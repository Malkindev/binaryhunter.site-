/**
 * Marketing payout regression tests.
 *
 * Run with: npm run test:payout
 * Exercises the exact production math and quote-matching helpers extracted
 * from static/js/hlx-ws.js. Fixture amounts below are test data, not claims
 * about a live Deriv quote.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const production = fs.readFileSync(
  path.join(__dirname, '..', 'static', 'js', 'hlx-ws.js'),
  'utf8'
);

function extractFunction(name) {
  const marker = 'function ' + name + '(';
  const start = production.indexOf(marker);
  assert(start >= 0, 'Missing production function: ' + name);
  const open = production.indexOf('{', start + marker.length);
  assert(open >= 0, 'Missing function body: ' + name);

  let depth = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  let escaped = false;
  for (let i = open; i < production.length; i++) {
    const ch = production[i];
    const next = production[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch.charCodeAt(0) === 92) escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch.charCodeAt(0) === 96) {
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return production.slice(start, i + 1);
    }
  }
  throw new Error('Unclosed function body: ' + name);
}

const names = [
  'normalizeMarketingMarkupPercentage',
  'getWebSocketAppId',
  'getKnownDerivAppMarkupPercentage',
  'getMarketingMarkupPercentage',
  'adjustPayoutToTargetMarkup',
  'applyMarketingMarkupToPayout',
  'buildProposalSignature',
  'isFreshMarketingProposal',
  'marketingProposalMatchesPurchase',
  'calculateContractPayout'
];
const testSource = names.map(extractFunction).join('\n') +
  '\nthis.normalizeMarketingMarkupPercentage = normalizeMarketingMarkupPercentage;' +
  '\nthis.getWebSocketAppId = getWebSocketAppId;' +
  '\nthis.getKnownDerivAppMarkupPercentage = getKnownDerivAppMarkupPercentage;' +
  '\nthis.getMarketingMarkupPercentage = getMarketingMarkupPercentage;' +
  '\nthis.adjustPayoutToTargetMarkup = adjustPayoutToTargetMarkup;' +
  '\nthis.applyMarketingMarkupToPayout = applyMarketingMarkupToPayout;' +
  '\nthis.buildProposalSignature = buildProposalSignature;' +
  '\nthis.isFreshMarketingProposal = isFreshMarketingProposal;' +
  '\nthis.marketingProposalMatchesPurchase = marketingProposalMatchesPurchase;' +
  '\nthis.calculateContractPayout = calculateContractPayout;';

const appMarkup = { '1089': 0, '777': 3 };
const sandbox = {
  Number,
  Math,
  parseInt,
  Date,
  Object,
  window: { __DERIV_SITE_SETTINGS__: { real: { app_markup_percentage: 3 } } },
  marketingAppMarkupById: appMarkup
};
vm.runInNewContext(testSource, sandbox);

const profile3 = { marketingEligible: true, app_markup_percentage: 3 };
const profile0 = { marketingEligible: true, app_markup_percentage: 0 };

assert.strictEqual(sandbox.normalizeMarketingMarkupPercentage(3), 3);
assert.strictEqual(sandbox.normalizeMarketingMarkupPercentage(0), 0);
assert.strictEqual(sandbox.normalizeMarketingMarkupPercentage(undefined), null);
assert.strictEqual(sandbox.normalizeMarketingMarkupPercentage(3.5), null,
  'Out-of-range markup must be rejected rather than silently clamped');

assert.strictEqual(sandbox.getMarketingMarkupPercentage(profile3), 3,
  'Use the Marketing profile configured percentage');
assert.strictEqual(sandbox.getMarketingMarkupPercentage(profile0), 0,
  'An explicit zero must not be overridden by a forced constant');
assert.strictEqual(sandbox.getMarketingMarkupPercentage({}), 3,
  'A missing profile value may fall back to the site settings configuration');

assert.strictEqual(
  sandbox.getWebSocketAppId({ url: 'wss://ws.derivws.com/websockets/v3?app_id=1089' }),
  '1089'
);
assert.strictEqual(
  sandbox.getKnownDerivAppMarkupPercentage({ url: 'wss://ws.derivws.com/websockets/v3?app_id=1089' }),
  0,
  'A zero markup returned by app_get is authoritative and must not be treated as missing'
);
assert.strictEqual(
  sandbox.getKnownDerivAppMarkupPercentage({ url: 'wss://ws.derivws.com/websockets/v3?app_id=777' }),
  3
);
assert.strictEqual(
  sandbox.getKnownDerivAppMarkupPercentage({ url: 'wss://ws.derivws.com/websockets/v3?app_id=999' }),
  null,
  'Do not borrow markup data from another app ID'
);

assert.strictEqual(sandbox.adjustPayoutToTargetMarkup(17.20, 0, 3), 16.68,
  'An explicitly unmarked $17.20 payout must be adjusted exactly once to $16.68');
assert.strictEqual(sandbox.adjustPayoutToTargetMarkup(16.68, 3, 3), 16.68,
  'An already-marked proposal at the target percentage must remain unchanged');
assert.strictEqual(sandbox.adjustPayoutToTargetMarkup(19.50, 0, 3), 18.92,
  '$19.50 must round half-up to $18.92 after 3%');
assert.strictEqual(sandbox.adjustPayoutToTargetMarkup(3.60, 0, 3), 3.49);
assert.strictEqual(sandbox.adjustPayoutToTargetMarkup(45.00, 0, 3), 43.65);
assert.strictEqual(sandbox.adjustPayoutToTargetMarkup(6.00, 0, 3), 5.82);
assert.strictEqual(sandbox.adjustPayoutToTargetMarkup(17.20, null, 3), null,
  'Missing markup metadata is unknown, not proof the quote is unmarked');
assert.strictEqual(sandbox.adjustPayoutToTargetMarkup(16.86, 2, 3), null,
  'Do not remap a rounded non-zero-markup quote without an unmarked baseline');
assert.strictEqual(sandbox.adjustPayoutToTargetMarkup(17.20, 0, null), null);

assert.strictEqual(sandbox.applyMarketingMarkupToPayout(17.20, profile3), 16.68);
assert.strictEqual(sandbox.applyMarketingMarkupToPayout(17.20, profile0), 17.20);

const fixtures = [
  { type: 'CALL', stake: 10.00, gross: 17.20, payout: 16.68 },
  { type: 'DIGITOVER', barrier: '5', stake: 2.00, gross: 3.60, payout: 3.49 },
  { type: 'DIGITMATCH', barrier: '7', stake: 5.00, gross: 45.00, payout: 43.65 },
  { type: 'DIGITUNDER', barrier: '3', stake: 3.00, gross: 6.00, payout: 5.82 }
];
fixtures.forEach((fixture) => {
  const adjusted = sandbox.adjustPayoutToTargetMarkup(fixture.gross, 0, 3);
  assert.strictEqual(adjusted, fixture.payout, fixture.type + ' payout fixture');
  const profitOnWin = Number((adjusted - fixture.stake).toFixed(2));
  assert.strictEqual(profitOnWin, Number((fixture.payout - fixture.stake).toFixed(2)),
    fixture.type + ' profit must be total payout minus the actual amount paid');
});

const markedQuote = {
  id: 'fixture-proposal-1',
  symbol: 'R_10',
  contractType: 'CALL',
  barrier: '',
  askPrice: 10.00,
  stake: 10.00,
  requestedAmount: 10.00,
  basis: 'stake',
  currency: 'USD',
  duration: '5',
  durationUnit: 't',
  expiry: '',
  payout: 16.68,
  markupAppliedPercentage: 3,
  markupStatus: 'verified',
  isVerifiedMarketingProposal: true,
  timestamp: Date.now()
};
assert.strictEqual(
  sandbox.calculateContractPayout('CALL', '', 10.00, markedQuote, profile3),
  16.68,
  'Purchase and settlement must use the exact verified quote payout without a second deduction'
);
assert(Number.isNaN(sandbox.calculateContractPayout('CALL', '', 10.00, {
  ...markedQuote,
  markupStatus: 'unverified',
  isVerifiedMarketingProposal: false
}, profile3)), 'Unverified quote must not silently turn into a marked payout');
assert(Number.isNaN(sandbox.calculateContractPayout('PUT', '', 10.00, markedQuote, profile3)),
  'A mismatched contract type must not reuse a CALL quote');
assert(Number.isNaN(sandbox.calculateContractPayout('CALL', '7', 10.00, markedQuote, profile3)),
  'A mismatched barrier must not reuse a quote');
assert(Number.isNaN(sandbox.calculateContractPayout('CALL', '', 12.00, markedQuote, profile3)),
  'A different paid amount must not be proportionally scaled from the old quote');

const proposalRequest = {
  proposal: 1,
  amount: 10,
  basis: 'stake',
  contract_type: 'CALL',
  symbol: 'R_10',
  currency: 'USD',
  duration: 5,
  duration_unit: 't'
};
const sameRequest = { parameters: { ...proposalRequest, proposal: undefined } };
const sameSignature = sandbox.buildProposalSignature(proposalRequest);
assert(sameSignature);
assert.strictEqual(sandbox.buildProposalSignature(sameRequest), sameSignature);
assert.notStrictEqual(
  sandbox.buildProposalSignature({ ...proposalRequest, duration: 10 }),
  sameSignature,
  'Different durations must never share a proposal cache entry'
);
assert.notStrictEqual(
  sandbox.buildProposalSignature({ ...proposalRequest, amount: 5 }),
  sameSignature,
  'Different requested stakes/payout bases must never share a cache entry'
);
assert.notStrictEqual(
  sandbox.buildProposalSignature({ ...proposalRequest, barrier: '7' }),
  sameSignature,
  'Different barriers must never share a cache entry'
);

const purchaseRequest = {
  parameters: {
    symbol: 'R_10',
    contract_type: 'CALL',
    barrier: '',
    amount: 10,
    basis: 'stake',
    currency: 'USD',
    duration: 5,
    duration_unit: 't'
  }
};
assert.strictEqual(sandbox.marketingProposalMatchesPurchase({
  ...markedQuote, duration: '5', durationUnit: 't'
}, purchaseRequest), true);
assert.strictEqual(sandbox.marketingProposalMatchesPurchase(markedQuote, {
  parameters: { ...purchaseRequest.parameters, amount: 9 }
}), false, 'Stake mismatch must reject a cached quote');
assert.strictEqual(sandbox.marketingProposalMatchesPurchase(markedQuote, {
  parameters: { ...purchaseRequest.parameters, duration: 10 }
}), false, 'Duration mismatch must reject a cached quote');
assert.strictEqual(sandbox.marketingProposalMatchesPurchase(markedQuote, {
  parameters: { ...purchaseRequest.parameters, barrier: '8' }
}), false, 'Barrier mismatch must reject a cached quote');
assert.strictEqual(sandbox.isFreshMarketingProposal(markedQuote, markedQuote.timestamp + 30000), true);
assert.strictEqual(sandbox.isFreshMarketingProposal(markedQuote, markedQuote.timestamp + 30001), false,
  'Quotes older than the freshness window must not be used for purchase');

assert(production.includes('The active WebSocket app markup could not be verified'),
  'Unknown markup provenance must be surfaced as an error');
assert(production.includes('MARKETING_PROPOSAL_MISMATCH'),
  'The buy path must stop if no exact fresh proposal can be matched');
assert(production.includes('ESTIMATE ONLY — NO VERIFIED LIVE DERIV PROPOSAL'),
  'Fallback prices must be explicitly labelled as estimates');
assert(!production.includes('recordLiveDerivProposal(m);'),
  'The same proposal must not be processed a second time by the socket listener');

const handlerStart = production.indexOf('// 3. Proposal response from Deriv.');
const handlerEnd = production.indexOf('// 4. Fallback/authentic symbol catalog for contracts_for', handlerStart);
assert(handlerStart >= 0 && handlerEnd > handlerStart, 'Production proposal handler must exist');
const proposalHandler = production.slice(handlerStart, handlerEnd);
assert(proposalHandler.includes('recordLiveDerivProposal(msg, ws)'));
assert(proposalHandler.includes('MARKETING_MARKUP_UNVERIFIED'));

const buyStart = production.indexOf('var matchedProp = null;');
const buyEnd = production.indexOf('var contractDisplayName = getSymbolDisplayName(symbolCode);', buyStart);
assert(buyStart >= 0 && buyEnd > buyStart, 'Marketing buy handler must exist');
const buyHandler = production.slice(buyStart, buyEnd);
assert(buyHandler.includes('isFreshMarketingProposal(matchedProp)'));
assert(buyHandler.includes('marketingProposalMatchesPurchase(matchedProp, req)'));
assert(!buyHandler.includes('calculateContractPayout(contractType, barrier, stakePaid, null'),
  'A fallback multiplier must not replace a missing/mismatched live proposal');

assert(production.includes('var profitEarned = isWon ? Number((payoutExpected - stakePaid).toFixed(2)) : -stakePaid;'),
  'Profit must be calculated from total payout minus the actual paid price on a win');
assert(production.includes('payout: payoutExpected,'),
  'Purchase confirmation and open-contract history must carry the same verified payout');

console.log('PASS: authoritative markup provenance, 3% exactly once, strict quote matching, stake/profit arithmetic, and explicit fallback handling.');
