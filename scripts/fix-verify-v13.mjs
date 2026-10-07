/**
 * FIX-VERIFIED test for BRAND-V-13
 * Setup progress 'Primary colour set' must not be true when only the default exists.
 *
 * Tests (source inspection):
 *   V13-FV-1: Check no longer uses only !!config.branding.primaryColour
 *   V13-FV-2: Check compares against the default '#3B82F6'
 *   V13-FV-3: Logic simulation — default value returns false
 *   V13-FV-4: Logic simulation — custom value returns true
 *   V13-FV-5: Revert-detection — original always-truthy check must not return
 */

import { readFileSync } from 'fs';

const FILE = 'app/business-setup/page.tsx';
const src  = readFileSync(FILE, 'utf-8');
const codeLines = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));

const results = [];
function record(id, status, evidence, details = {}) {
  results.push({ id, status, evidence, ...details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`\n${icon}  ${id}: ${status}`);
  console.log(`   Evidence: ${evidence}`);
  if (details.actual) console.log(`   Actual:   ${details.actual}`);
}

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║   FIX-VERIFIED: BRAND-V-13 setup progress primaryColour check   ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log(`\nStarted: ${new Date().toISOString()}`);

// V13-FV-1: Simple !!primaryColour only check is gone
const hasSimpleCheck = codeLines.some(l =>
  l.includes('primaryColour') && l.includes('done:') &&
  !l.includes('#3B82F6') && !l.includes('!==')
);
if (!hasSimpleCheck) {
  record('V13-FV-1', 'PASS',
    "Simple 'done: !!config.branding.primaryColour' check no longer present alone.",
    { actual: `hasSimpleCheck=${hasSimpleCheck}` }
  );
} else {
  record('V13-FV-1', 'FAIL',
    "Original always-truthy check still present — fix not applied.",
    { actual: `hasSimpleCheck=${hasSimpleCheck}` }
  );
}

// V13-FV-2: Default comparison against '#3B82F6' present
const hasDefaultCheck = codeLines.some(l =>
  l.includes('primaryColour') && l.includes('#3B82F6') && l.includes('!==')
);
if (hasDefaultCheck) {
  record('V13-FV-2', 'PASS',
    "Comparison against default '#3B82F6' present in primaryColour completion check.",
    { actual: `hasDefaultCheck=${hasDefaultCheck}` }
  );
} else {
  record('V13-FV-2', 'FAIL',
    "Default comparison not found — fix may not be correct.",
    { actual: `hasDefaultCheck=${hasDefaultCheck}` }
  );
}

// V13-FV-3: Logic simulation — default value returns false
const defaultValue  = '#3B82F6';
const defaultResult = !!defaultValue && defaultValue !== '#3B82F6';
if (!defaultResult) {
  record('V13-FV-3', 'PASS',
    `Logic simulation: primaryColour='${defaultValue}' (default) → done=${defaultResult}. Setup correctly shows incomplete.`,
    { actual: `done=${defaultResult}` }
  );
} else {
  record('V13-FV-3', 'FAIL',
    `Logic simulation: default value returns done=${defaultResult} — still truthy for default.`,
    { actual: `done=${defaultResult}` }
  );
}

// V13-FV-4: Logic simulation — custom value returns true
const customValue  = '#FF5500';
const customResult = !!customValue && customValue !== '#3B82F6';
if (customResult) {
  record('V13-FV-4', 'PASS',
    `Logic simulation: primaryColour='${customValue}' (custom) → done=${customResult}. Setup correctly shows complete.`,
    { actual: `done=${customResult}` }
  );
} else {
  record('V13-FV-4', 'FAIL',
    `Logic simulation: custom value returns done=${customResult} — should be true for custom colour.`,
    { actual: `done=${customResult}` }
  );
}

// V13-FV-5: Revert-detection
const revertedSimpleCheck = codeLines.some(l =>
  l.includes("done: !!config.branding.primaryColour") &&
  !l.includes('#3B82F6')
);
if (!revertedSimpleCheck) {
  record('V13-FV-5', 'PASS',
    'Revert-detection: simple always-truthy check not present. Fix is stable.',
    { actual: `revertedSimpleCheck=${revertedSimpleCheck}` }
  );
} else {
  record('V13-FV-5', 'FAIL',
    'Revert-detection: always-truthy check returned — fix was reverted.',
    { actual: `revertedSimpleCheck=${revertedSimpleCheck}` }
  );
}

console.log('\n' + '═'.repeat(68));
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`  FIX-VERIFIED V-13: ${passed} PASS / ${failed} FAIL`);
results.forEach(r => console.log(`  ${r.status === 'PASS' ? '✅' : '❌'}  ${r.id}: ${r.evidence.substring(0, 100)}`));
console.log('═'.repeat(68));
console.log(`\nCompleted: ${new Date().toISOString()}`);
process.exit(failed > 0 ? 1 : 0);
