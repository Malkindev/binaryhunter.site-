const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TESTING LANDING AUTH BUTTON LABELS ---');

// Verify that static/js/hlx-ui.js contains the protective checks
const hlxUiContent = fs.readFileSync(path.join(__dirname, '../static/js/hlx-ui.js'), 'utf8');

// 1. Check that cleanLandingAuthGlitch exists
assert.ok(hlxUiContent.includes('function cleanLandingAuthGlitch'), 'cleanLandingAuthGlitch must exist');
// 2. Check that ensureLabel skips landing buttons
assert.ok(hlxUiContent.includes("button.closest('.landing-v2, [class*=\"landing-v2\"]')"), 'ensureLabel must skip landing-v2');
// 3. Check that ensureLabel skips duplicate labels
assert.ok(hlxUiContent.includes('if(re.test(text(button)))'), 'ensureLabel must not append duplicate spans when label already present');
// 4. Check that findButtons filters out landing-v2
assert.ok(hlxUiContent.includes(".filter(function(el){ return !el.closest('.landing-v2, [class*=\"landing-v2\"]'); })"), 'findButtons must filter out landing-v2');
// 5. Check index.html has display: none for injected labels inside landing-v2__nav-actions
const indexContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert.ok(indexContent.includes('.landing-v2__nav-actions [data-sitebuilder-auth-label]{display:none !important}'), 'index.html must hide any injected auth labels in landing nav actions');

// 6. Verify landing chunk buttons
const chunk958 = fs.readFileSync(path.join(__dirname, '../static/js/async/958.a17f4c92.js'), 'utf8');
assert.ok(chunk958.includes('" API Token"'), 'Landing nav must have " API Token"');
assert.ok(chunk958.includes('"Log In"'), 'Landing nav must have "Log In"');
assert.ok(chunk958.includes('"Get Started"'), 'Landing nav must have "Get Started"');

console.log('✓ All checks passed: Landing nav buttons strictly preserved as "API Token", "Log In", "Get Started" without glitch or duplication.');
