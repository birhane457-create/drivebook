/**
 * FIX-VERIFIED test for BRAND-V-05
 * Dashboard branding page must allow PREMIUM tier for custom domain.
 *
 * Tests (source inspection — client component, not API endpoint):
 *   V05-FV-1: features.customDomain uses ['STUDIO', 'PREMIUM'].includes(tier)
 *   V05-FV-2: Save handler uses canSetDomain (not isStudio === STUDIO only)
 *   V05-FV-3: No remaining `tier === 'STUDIO'` gate for customDomain feature
 */

import { readFileSync } from 'fs';

const FILE = 'app/dashboard/branding/page.tsx';
const src = readFileSync(FILE, 'utf-8');

const results = [];
function record(id, status, evidence, details = {}) {
  results.push({ id, status, evidence, ...details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`\n${icon}  ${id}: ${status}`);
  console.log(`   Evidence: ${evidence}`);
  if (details.actual) console.log(`   Actual:   ${details.actual}`);
}

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║   FIX-VERIFIED: BRAND-V-05 PREMIUM entitlement consistency     ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log(`\nStarted: ${new Date().toISOString()}`);

// V05-FV-1: features.customDomain uses array check
const hasArrayCheck = src.includes("['STUDIO', 'PREMIUM'].includes(tier)") && src.includes('customDomain:');
if (hasArrayCheck) {
  record('V05-FV-1', 'PASS',
    "features.customDomain uses ['STUDIO', 'PREMIUM'].includes(tier) — PREMIUM now entitled.",
    { actual: `arrayCheck=true` }
  );
} else {
  record('V05-FV-1', 'FAIL', 'Array check for STUDIO+PREMIUM not found in features.customDomain.', { actual: `arrayCheck=${hasArrayCheck}` });
}

// V05-FV-2: Save handler uses canSetDomain
const hasCanSetDomain = src.includes('canSetDomain') && src.includes('canSetDomain ? (customDomain');
if (hasCanSetDomain) {
  record('V05-FV-2', 'PASS',
    'Save handler uses canSetDomain (not isStudio) for customDomain write decision.',
    { actual: `canSetDomain=${hasCanSetDomain}` }
  );
} else {
  record('V05-FV-2', 'FAIL', 'canSetDomain variable not found in save handler.', { actual: `canSetDomain=${hasCanSetDomain}` });
}

// V05-FV-3: No remaining STUDIO-only gate for customDomain feature
// Check that 'customDomain: tier === STUDIO' is no longer present in code lines
const codeLines = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
const hasOldGate = codeLines.some(l => l.includes("customDomain: tier === 'STUDIO'"));
if (!hasOldGate) {
  record('V05-FV-3', 'PASS',
    "No 'customDomain: tier === STUDIO' gate in non-comment code lines.",
    { actual: `hasOldGate=false` }
  );
} else {
  record('V05-FV-3', 'FAIL', "Old STUDIO-only gate still present.", { actual: `hasOldGate=true` });
}

console.log('\n' + '═'.repeat(68));
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`  FIX-VERIFIED V-05: ${passed} PASS / ${failed} FAIL`);
results.forEach(r => console.log(`  ${r.status === 'PASS' ? '✅' : '❌'}  ${r.id}: ${r.evidence.substring(0, 100)}`));
console.log('═'.repeat(68));
console.log(`\nCompleted: ${new Date().toISOString()}`);
process.exit(failed > 0 ? 1 : 0);
