/**
 * FIX-VERIFIED test for BRAND-V-10
 * showPlatformBranding must be in the typed BusinessBranding interface,
 * in assembleConfig output, and accessed without (as any) cast.
 *
 * Tests (source inspection):
 *   V10-FV-1: types.ts BusinessBranding includes showPlatformBranding
 *   V10-FV-2: assembleConfig sets showPlatformBranding in assembledBranding
 *   V10-FV-3: BusinessWebsitePage no longer uses (branding as any).showPlatformBranding
 *   V10-FV-4: BusinessWebsitePage uses branding.showPlatformBranding directly
 *   V10-FV-5: Revert-detection — (as any) cast must not return
 */

import { readFileSync } from 'fs';

const typesSrc   = readFileSync('lib/core/types.ts', 'utf-8');
const configSrc  = readFileSync('lib/core/business-config.ts', 'utf-8');
const pageSrc    = readFileSync('components/website/BusinessWebsitePage.tsx', 'utf-8');

const typesCode  = typesSrc.split('\n').filter(l => !l.trim().startsWith('//'));
const configCode = configSrc.split('\n').filter(l => !l.trim().startsWith('//'));
const pageCode   = pageSrc.split('\n').filter(l => !l.trim().startsWith('//'));

const results = [];
function record(id, status, evidence, details = {}) {
  results.push({ id, status, evidence, ...details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`\n${icon}  ${id}: ${status}`);
  console.log(`   Evidence: ${evidence}`);
  if (details.actual) console.log(`   Actual:   ${details.actual}`);
}

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║   FIX-VERIFIED: BRAND-V-10 showPlatformBranding type + config   ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log(`\nStarted: ${new Date().toISOString()}`);

// V10-FV-1: types.ts BusinessBranding has showPlatformBranding
const typesHasFlag = typesCode.some(l => l.includes('showPlatformBranding'));
if (typesHasFlag) {
  record('V10-FV-1', 'PASS',
    'BusinessBranding interface in lib/core/types.ts includes showPlatformBranding.',
    { actual: `typesHasFlag=${typesHasFlag}` }
  );
} else {
  record('V10-FV-1', 'FAIL',
    'showPlatformBranding not found in BusinessBranding type.',
    { actual: `typesHasFlag=${typesHasFlag}` }
  );
}

// V10-FV-2: assembleConfig sets showPlatformBranding
const assembleHasFlag = configCode.some(l => l.includes('showPlatformBranding') && l.includes('branding?.showPlatformBranding'));
if (assembleHasFlag) {
  record('V10-FV-2', 'PASS',
    'assembleConfig maps branding?.showPlatformBranding into assembledBranding.',
    { actual: `assembleHasFlag=${assembleHasFlag}` }
  );
} else {
  record('V10-FV-2', 'FAIL',
    'assembleConfig does not set showPlatformBranding from branding record.',
    { actual: `assembleHasFlag=${assembleHasFlag}` }
  );
}

// V10-FV-3: (as any) cast gone from BusinessWebsitePage
const hasOldCast = pageCode.some(l => l.includes('(branding as any).showPlatformBranding'));
if (!hasOldCast) {
  record('V10-FV-3', 'PASS',
    '(branding as any).showPlatformBranding cast is absent from BusinessWebsitePage.',
    { actual: `hasOldCast=${hasOldCast}` }
  );
} else {
  record('V10-FV-3', 'FAIL',
    '(branding as any).showPlatformBranding cast still present — fix not applied.',
    { actual: `hasOldCast=${hasOldCast}` }
  );
}

// V10-FV-4: Direct access branding.showPlatformBranding present
const hasDirectAccess = pageCode.some(l =>
  l.includes('branding.showPlatformBranding') && !l.includes('as any')
);
if (hasDirectAccess) {
  record('V10-FV-4', 'PASS',
    'branding.showPlatformBranding accessed directly (no cast) in BusinessWebsitePage.',
    { actual: `hasDirectAccess=${hasDirectAccess}` }
  );
} else {
  record('V10-FV-4', 'FAIL',
    'branding.showPlatformBranding not accessed directly in BusinessWebsitePage.',
    { actual: `hasDirectAccess=${hasDirectAccess}` }
  );
}

// V10-FV-5: Revert-detection — (as any) must not return
const castPresent = pageCode.some(l => l.includes('(branding as any)'));
if (!castPresent) {
  record('V10-FV-5', 'PASS',
    'Revert-detection: no (branding as any) cast remains in BusinessWebsitePage. Fix is stable.',
    { actual: `castPresent=${castPresent}` }
  );
} else {
  record('V10-FV-5', 'FAIL',
    'Revert-detection: (branding as any) cast found — fix was partially reverted.',
    { actual: `castPresent=${castPresent}` }
  );
}

console.log('\n' + '═'.repeat(68));
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`  FIX-VERIFIED V-10: ${passed} PASS / ${failed} FAIL`);
results.forEach(r => console.log(`  ${r.status === 'PASS' ? '✅' : '❌'}  ${r.id}: ${r.evidence.substring(0, 100)}`));
console.log('═'.repeat(68));
console.log(`\nCompleted: ${new Date().toISOString()}`);
process.exit(failed > 0 ? 1 : 0);
