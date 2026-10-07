/**
 * FIX-VERIFIED test for BRAND-V-04
 * Business Setup domain page must show cname.vercel-dns.com, not cname.${rootDomain}.
 *
 * Tests (source inspection — client component, no runtime DNS):
 *   V04-FV-1: Old wrong target cname.${rootDomain} is absent from non-comment code lines
 *   V04-FV-2: Correct target cname.vercel-dns.com is present in code lines
 *   V04-FV-3: Both CNAME records (@ and www) use the correct target
 *   V04-FV-4: Reverted-fix detection — would FAIL if old target reappears
 *
 * STRICT: V04-FV-4 explicitly tests the inverse condition so the script would fail
 * if the fix were reverted.
 */

import { readFileSync } from 'fs';

const FILE = 'app/business-setup/domain/page.tsx';
const src  = readFileSync(FILE, 'utf-8');

// Non-comment code lines only
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
console.log('║   FIX-VERIFIED: BRAND-V-04 correct DNS CNAME target             ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log(`\nStarted: ${new Date().toISOString()}`);

// V04-FV-1: Old wrong target absent from code
const hasOldTarget = codeLines.some(l =>
  l.includes('cname.${rootDomain}') ||
  l.includes('cname.`+"`"+`${rootDomain}') ||
  (l.includes('cname.') && l.includes('rootDomain') && !l.includes('vercel-dns.com'))
);
if (!hasOldTarget) {
  record('V04-FV-1', 'PASS',
    'cname.${rootDomain} is absent from non-comment code lines.',
    { actual: `hasOldTarget=false` }
  );
} else {
  record('V04-FV-1', 'FAIL',
    'cname.${rootDomain} still present in code — fix not applied.',
    { actual: `hasOldTarget=true` }
  );
}

// V04-FV-2: Correct target present
const hasCorrectTarget = codeLines.some(l => l.includes("'cname.vercel-dns.com'") || l.includes('"cname.vercel-dns.com"'));
if (hasCorrectTarget) {
  record('V04-FV-2', 'PASS',
    "cname.vercel-dns.com is present in non-comment code lines.",
    { actual: `hasCorrectTarget=true` }
  );
} else {
  record('V04-FV-2', 'FAIL',
    'cname.vercel-dns.com not found in code.',
    { actual: `hasCorrectTarget=false` }
  );
}

// V04-FV-3: Both CNAME records use correct target
const atRecord  = codeLines.some(l => l.includes("name: '@'")   && l.includes('vercel-dns.com'));
const wwwRecord = codeLines.some(l => l.includes("name: 'www'") && l.includes('vercel-dns.com'));
if (atRecord && wwwRecord) {
  record('V04-FV-3', 'PASS',
    'Both CNAME records (@ and www) specify cname.vercel-dns.com.',
    { actual: `atRecord=${atRecord} wwwRecord=${wwwRecord}` }
  );
} else {
  record('V04-FV-3', 'FAIL',
    `Not all CNAME records use correct target. @ record=${atRecord}, www record=${wwwRecord}.`,
    { actual: `atRecord=${atRecord} wwwRecord=${wwwRecord}` }
  );
}

// V04-FV-4: Revert-detection — this test MUST FAIL if old target returns
// Confirm that if we searched for the old pattern we would NOT find it
const oldPatternFound = codeLines.some(l =>
  l.includes('cname.') &&
  l.includes('rootDomain') &&
  !l.includes('vercel-dns.com') &&
  !l.includes('//')
);
if (!oldPatternFound) {
  record('V04-FV-4', 'PASS',
    'Revert-detection: no cname.{rootDomain} pattern found in code. Fix is stable.',
    { actual: `oldPatternFound=false` }
  );
} else {
  record('V04-FV-4', 'FAIL',
    'Revert-detection: cname.{rootDomain} pattern found — fix was reverted.',
    { actual: `oldPatternFound=true` }
  );
}

console.log('\n' + '═'.repeat(68));
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`  FIX-VERIFIED V-04: ${passed} PASS / ${failed} FAIL`);
results.forEach(r => console.log(`  ${r.status === 'PASS' ? '✅' : '❌'}  ${r.id}: ${r.evidence.substring(0, 100)}`));
console.log('═'.repeat(68));
console.log(`\nCompleted: ${new Date().toISOString()}`);
process.exit(failed > 0 ? 1 : 0);
