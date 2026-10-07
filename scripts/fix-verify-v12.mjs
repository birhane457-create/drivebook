/**
 * FIX-VERIFIED test for BRAND-V-12
 * Business Setup branding page must show slug.rootDomain (subdomain), not rootDomain/slug (path).
 *
 * Tests (source inspection):
 *   V12-FV-1: Old path-format prefix (rootDomain/) absent from code
 *   V12-FV-2: Subdomain suffix (.rootDomain) present in input display
 *   V12-FV-3: Preview text shows slug.rootDomain format
 *   V12-FV-4: Revert-detection — path format must not return
 */

import { readFileSync } from 'fs';

const FILE = 'app/business-setup/branding/page.tsx';
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
console.log('║   FIX-VERIFIED: BRAND-V-12 correct URL format in branding page  ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log(`\nStarted: ${new Date().toISOString()}`);

// V12-FV-1: Old path prefix (rootDomain/) absent
const hasOldPrefix = codeLines.some(l =>
  (l.includes('ROOT_DOMAIN') || l.includes('rootDomain') || l.includes('platform.com')) &&
  l.includes('}/') &&
  !l.includes('.{process') &&
  !l.includes('slug.')
);
if (!hasOldPrefix) {
  record('V12-FV-1', 'PASS',
    'Old path-format prefix (rootDomain/) absent from non-comment code.',
    { actual: `hasOldPrefix=${hasOldPrefix}` }
  );
} else {
  record('V12-FV-1', 'FAIL',
    'Path-format prefix (rootDomain/) still present — fix not applied.',
    { actual: `hasOldPrefix=${hasOldPrefix}` }
  );
}

// V12-FV-2: Subdomain suffix (.rootDomain) present in slug display
const hasSubdomainSuffix = codeLines.some(l =>
  l.includes('.{process.env.NEXT_PUBLIC_ROOT_DOMAIN') ||
  l.includes(".'platform.com'") ||
  (l.includes('.') && l.includes('ROOT_DOMAIN') && l.includes('shrink-0'))
);
if (hasSubdomainSuffix) {
  record('V12-FV-2', 'PASS',
    'Subdomain suffix (.rootDomain) present in slug input display.',
    { actual: `hasSubdomainSuffix=${hasSubdomainSuffix}` }
  );
} else {
  record('V12-FV-2', 'FAIL',
    'Subdomain suffix not found in slug display.',
    { actual: `hasSubdomainSuffix=${hasSubdomainSuffix}` }
  );
}

// V12-FV-3: Preview text shows slug.rootDomain format
const hasPreview = codeLines.some(l =>
  l.includes('slug.') && (l.includes('ROOT_DOMAIN') || l.includes('platform.com')) ||
  (l.includes('customSlug') && l.includes('platform.com'))
);
if (hasPreview) {
  record('V12-FV-3', 'PASS',
    'Preview text present showing slug.rootDomain format.',
    { actual: `hasPreview=${hasPreview}` }
  );
} else {
  record('V12-FV-3', 'FAIL',
    'No slug.rootDomain preview text found.',
    { actual: `hasPreview=${hasPreview}` }
  );
}

// V12-FV-4: Revert-detection — rootDomain/ path format must not be present as prefix
const pathFormatReturned = codeLines.some(l =>
  (l.includes('ROOT_DOMAIN') || l.includes('platform.com')) &&
  (l.includes('}/') || (l.includes('}') && l.includes('/'))) &&
  l.includes('border-r') // the old prefix span had border-r
);
if (!pathFormatReturned) {
  record('V12-FV-4', 'PASS',
    'Revert-detection: rootDomain/ prefix not found. Fix is stable.',
    { actual: `pathFormatReturned=${pathFormatReturned}` }
  );
} else {
  record('V12-FV-4', 'FAIL',
    'Revert-detection: path-format prefix (rootDomain/) returned — fix may be reverted.',
    { actual: `pathFormatReturned=${pathFormatReturned}` }
  );
}

console.log('\n' + '═'.repeat(68));
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`  FIX-VERIFIED V-12: ${passed} PASS / ${failed} FAIL`);
results.forEach(r => console.log(`  ${r.status === 'PASS' ? '✅' : '❌'}  ${r.id}: ${r.evidence.substring(0, 100)}`));
console.log('═'.repeat(68));
console.log(`\nCompleted: ${new Date().toISOString()}`);
process.exit(failed > 0 ? 1 : 0);
