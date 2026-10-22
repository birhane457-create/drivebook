// git-commit-h02.mjs  
// Commits the H-02 audit changes.
// Run via: node scripts/git-commit-h02.mjs
// (or via Kiro.exe with ELECTRON_RUN_AS_NODE=1)
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

function git(args, opts = {}) {
  const result = execSync(`git ${args}`, {
    cwd: REPO,
    encoding: 'utf8',
    stdio: 'pipe',
    ...opts,
  });
  return result ? result.trim() : '';
}

// Files changed during this H-02 audit session
const FILES = [
  // Test infrastructure fixes
  '__tests__/integration/h02-child-booking-pricing.test.ts',
  '__tests__/integration/h02-webhook-package-accounting.test.ts',
  // Route fix: include code in INSUFFICIENT_WALLET_BALANCE response
  'app/api/client/confirm-package-booking/route.ts',
  // Test DB env file (safe — points only at localhost test database)
  '.env',
  // docker-compose fix: testuser → postgres
  'docker-compose.test.yml',
  // New scripts
  'scripts/h02-full-run.ps1',
  'scripts/h02-run-tests-kiro-node.bat',
  'scripts/h02-run-tests-native.bat',
  'scripts/setup-postgres-portable.ps1',
  'scripts/test-pg-connect.mjs',
  'scripts/git-commit-h02.mjs',
];

console.log('Staging H-02 changes...');
for (const f of FILES) {
  try {
    git(`add "${f.replace(/"/g, '\\"')}"`);
    console.log(`  staged: ${f}`);
  } catch (e) {
    console.warn(`  skip (not found): ${f} — ${e.message.slice(0,60)}`);
  }
}

const status = git('status --short');
console.log('\nStaged changes:');
console.log(status || '  (nothing to stage)');

const message = [
  'fix(H-02): runtime verification complete — 23/23 tests pass',
  '',
  'Child-booking suite (10 tests, H02-T01..T10): 10/10 PASSED',
  'Webhook-accounting suite (13 tests, W01..W12+W11b): 13/13 PASSED',
  '',
  'Test-harness fixes:',
  '- Remove vi.hoisted() from both suites (caused "No test suite found" on Windows)',
  '- Replace ledger-operations mock with ledger-service (correct module)',
  '- Replace npx prisma db push with local binary call (npx not on PATH)',
  '',
  'Route fix:',
  '- confirm-package-booking: include code field in INSUFFICIENT_WALLET_BALANCE 402 response',
  '',
  'Infrastructure:',
  '- docker-compose.test.yml: fix POSTGRES_USER testuser → postgres',
  '- .env: point to local test database (localhost:5433)',
  '- scripts/: add portable PostgreSQL setup, test runners, Prisma connect test',
  '',
  'Financial accounting verified at runtime against PostgreSQL 16.4:',
  '- Face-value wallet credit ($700) on package purchase',
  '- PLATFORM_SUBSIDY ($1.75) recorded and excluded from spendable balance',
  '- PACKAGE_FEE ($33.25) Transaction created and linked to Stripe PI',
  '- platformFee=0 on wallet-funded child lessons (no double fee)',
  '- Rate-change behaviour: child lessons use instructor current rate',
  '- Idempotency: duplicate webhook delivery correctly deduplicated',
  '- Insufficient balance correctly rejected with 402 + structured code',
  '',
  'H-02 lifecycle: FINDING → VERIFIED → FIX → FIX-VERIFIED',
  'Approved policy: docs/audit/PACKAGE-ACCOUNTING-POLICY.md v1.0 (2026-10-18)',
].join('\n');

try {
  git(`commit -m ${JSON.stringify(message)}`);
  const hash = git('rev-parse --short HEAD');
  console.log(`\nCommitted: ${hash}`);
} catch (e) {
  if (e.message.includes('nothing to commit')) {
    console.log('\nNothing new to commit — working tree is clean.');
  } else {
    console.error('\nCommit failed:', e.message.slice(0, 200));
    process.exit(1);
  }
}
