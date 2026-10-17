/**
 * Regression tests for the Marketing 3% payout adjustment.
 * Run with: node test/marketing-payout-markup.test.js
 *
 * Extracts the real inline production functions so these tests validate the
 * same payout math used by static/js/hlx-ws.js, without loading browser code.
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
      if (escaped) {
        escaped = false;
      } else if (ch.charCodeAt(0) === 92) {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
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

const functionNames = [
  'normalizeMarketingMarkupPercentage',
  'getMarketingMarkupPercentage',
  'applyMarketingMarkupToPayout',
  'calculateContractPayout'
];
const testSource = functionNames.map(extractFunction).join('\n') +
  '\nthis.normalizeMarketingMarkupPercentage = normalizeMarketingMarkupPercentage;' +
  '\nthis.getMarketingMarkupPercentage = getMarketingMarkupPercentage;' +
  '\nthis.applyMarketingMarkupToPayout = applyMarketingMarkupToPayout;' +
  '\nthis.calculateContractPayout = calculateContractPayout;';

const sandbox = { Number, Math, parseInt };
vm.runInNewContext(testSource, sandbox);

const profile = { marketingEligible: true, app_markup_percentage: 0 };

assert.strictEqual(sandbox.getMarketingMarkupPercentage(profile), 3,
  'Stale profile settings must not disable the required 3% markup');
assert.strictEqual(sandbox.applyMarketingMarkupToPayout(17.20, profile), 16.68,
  '$17.20 gross payout must become $16.68 at 3% markup');
assert.strictEqual(sandbox.applyMarketingMarkupToPayout(19.50, profile), 18.92,
  '$19.50 gross payout must be rounded safely to $18.92 after 3% markup');

assert.strictEqual(
  sandbox.calculateContractPayout('CALL', '', 10, null, profile),
  18.92,
  'Generated CALL fallback must apply 3% to the $19.50 gross payout'
);

assert.strictEqual(
  sandbox.calculateContractPayout('CALL', '', 1, {
    contractType: 'CALL',
    barrier: '',
    stake: 1,
    payout: 17.20,
    markupAppliedPercentage: null
  }, profile),
  16.68,
  'An unmarked matched proposal must receive the 3% payout reduction'
);

assert.strictEqual(
  sandbox.calculateContractPayout('CALL', '', 1, {
    contractType: 'CALL',
    barrier: '',
    stake: 1,
    payout: 16.68,
    markupAppliedPercentage: 3
  }, profile),
  16.68,
  'A proposal already processed at 3% must not be discounted twice'
);

assert(
  production.includes('var py = calculateContractPayout(ct, bar, st, pObj, prof);'),
  'Fallback simulated contracts must always use the markup-aware payout calculation'
);
assert(
  production.includes('var markedProposalPayout = applyMarketingMarkupToPayout(rawProposalPayout, payoutProfile);'),
  'The Marketing quote shown to the UI must receive the same 3% payout adjustment'
);

console.log('PASS: Marketing payout is reduced by exactly 3%, quote/fallback paths are covered, and adjusted proposals are not charged twice.');
