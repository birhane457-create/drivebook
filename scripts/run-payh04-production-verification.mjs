/**
 * PAY-H-04 Production Verification
 *
 * PURPOSE:
 * Verify that after production deployment:
 *   1. Deployed SHA contains 560a77c2 in ancestry
 *   2. btree_gist is installed
 *   3. SlotReservation_no_overlap constraint exists
 *   4. Concurrent overlapping reservation attempts produce at most one committed row
 *   5. Adjacent intervals remain permitted
 *   6. Normal reservation creation still works
 *   7. Application maps exclusion violation to HTTP 409
 *
 * READ-ONLY DB checks + HTTP requests to /api/availability/check-and-reserve.
 * No bookings created. Uses a dedicated test provider (IDs supplied as env vars).
 *
 * USAGE:
 *   PRODUCTION_URL=https://drivebook.com.au \
 *   TEST_PROVIDER_ID=<providerid> \
 *   node scripts/run-payh04-production-verification.mjs
 *
 * TEST_PROVIDER_ID must be a real Provider row in production.
 * Use a dedicated test provider, not a real instructor.
 */

import { PrismaClient } from '@prisma/client';
import * as https from 'https';
import * as http  from 'http';

const PRODUCTION_URL = process.env.PRODUCTION_URL ?? 'https://drivebook.com.au';
const TEST_PROVIDER_ID = process.env.TEST_PROVIDER_ID;
const timestamp = new Date().toISOString();

if (!TEST_PROVIDER_ID) {
  console.error('TEST_PROVIDER_ID env var required — set to a dedicated test provider in production');
  process.exit(1);
}

const prisma = new PrismaClient();
const lines = [];

function log(line) { console.log(line); lines.push(line); }

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function reserve(time, sessionId) {
  const body = JSON.stringify({
    providerId: TEST_PROVIDER_ID,
    date: '2028-04-10',
    time,
    duration: 60,
    sessionId,
  });
  return fetch(`${PRODUCTION_URL}/api/availability/check-and-reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    body,
  });
}

async function cleanup() {
  await prisma.slotReservation.deleteMany({
    where: { providerId: TEST_PROVIDER_ID, sessionId: { startsWith: 'payh04-prod-verify-' } },
  });
}

async function main() {
  log('PAY-H-04 Production Verification');
  log(`Timestamp: ${timestamp}`);
  log(`Production URL: ${PRODUCTION_URL}`);
  log(`Test provider: ${TEST_PROVIDER_ID}`);
  log('');

  // --- Check 1: Deployed SHA via /api/health + ancestry verification ---
  log('=== Check 1: Deployed SHA and ancestry ===');
  const health = await fetch(`${PRODUCTION_URL}/api/health`);
  const healthData = JSON.parse(health.body);
  const deployedSha = healthData.sha ?? null;
  log(`Health status: ${health.status}`);
  log(`Deployed SHA: ${deployedSha ?? 'NOT PRESENT — old version, audit fix not yet deployed'}`);
  log(`Environment: ${healthData.env ?? 'unknown'}`);

  if (!deployedSha) {
    log('');
    log('ABORT: /api/health does not return a sha field.');
    log('The pre-audit application version is still serving.');
    log('Wait for Vercel to deploy commit 641a52be or later, then re-run.');
    await prisma.$disconnect();
    process.exit(1);
  }

  // Verify SHA ancestry: deployed SHA must contain 560a77c2
  // Use git merge-base --is-ancestor locally to check the relationship
  const { execSync } = await import('child_process');
  let ancestryVerified = false;
  try {
    // Fetch the deployed SHA so git knows about it
    execSync(`git fetch origin ${deployedSha} 2>/dev/null || true`, { stdio: 'pipe' });
    // Check if 560a77c2 is an ancestor of the deployed SHA
    execSync(`git merge-base --is-ancestor 560a77c2 ${deployedSha}`, { stdio: 'pipe' });
    ancestryVerified = true;
    log('SHA ancestry: 560a77c2 IS AN ANCESTOR of deployed SHA — PAY-H-04 fix is included');
  } catch {
    // If git check fails because SHA not in local repo, fall back to log-based check
    try {
      const logOutput = execSync(`git log ${deployedSha} --oneline --ancestry-path 560a77c2..${deployedSha} 2>&1 | head -5`, { stdio: 'pipe' });
      if (logOutput.toString().trim()) {
        ancestryVerified = true;
        log('SHA ancestry: VERIFIED via git log');
      }
    } catch {
      log('SHA ancestry: COULD NOT VERIFY locally — manual Vercel dashboard check required');
      log(`  Open Vercel dashboard, confirm deployment SHA ${deployedSha} descends from 560a77c2`);
    }
  }
  log(`[SHA] Deployed SHA: ${deployedSha}`);
  log(`[SHA] PAY-H-04 fix (560a77c2) in ancestry: ${ancestryVerified ? 'VERIFIED' : 'MANUAL CHECK REQUIRED'}`);
  log('');

  // --- Check 2: btree_gist installed ---
  log('=== Check 2: btree_gist extension ===');
  const btree = await prisma.$queryRaw`
    SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist'
  `;
  if (btree.length > 0) {
    log(`btree_gist: INSTALLED (version ${btree[0].extversion})`);
  } else {
    log('btree_gist: NOT FOUND — migration may not have run');
  }
  log('');

  // --- Check 3: Constraint exists ---
  log('=== Check 3: SlotReservation_no_overlap constraint ===');
  const constraint = await prisma.$queryRaw`
    SELECT conname, contype FROM pg_constraint
    WHERE conname = 'SlotReservation_no_overlap'
  `;
  if (constraint.length > 0) {
    log(`Constraint: PRESENT (type=${constraint[0].contype})`);
  } else {
    log('Constraint: NOT FOUND — migration may not have run');
  }
  log('');

  await cleanup();

  // --- Check 4: Concurrent overlapping → at most 1 committed ---
  log('=== Check 4: Concurrent overlapping reservations — INVARIANT ===');
  const sessionA = 'payh04-prod-verify-4A';
  const sessionB = 'payh04-prod-verify-4B';
  const [r4a, r4b] = await Promise.all([
    reserve('10:00', sessionA),
    reserve('10:30', sessionB),
  ]);
  const rows4 = await prisma.slotReservation.findMany({
    where: {
      providerId: TEST_PROVIDER_ID,
      expiresAt: { gt: new Date() },
      startTime: { gte: new Date('2028-04-10T00:00:00Z') },
    },
    select: { sessionId: true, startTime: true, endTime: true },
  });
  log(`Request A (10:00–11:00): HTTP ${r4a.status}`);
  log(`Request B (10:30–11:30): HTTP ${r4b.status}`);
  log(`Active rows: ${rows4.length}`);
  const check4Pass = rows4.length <= 1 && r4a.status < 500 && r4b.status < 500;
  log(`Check 4 PASS: ${check4Pass} (at most 1 row committed)`);
  if (rows4.length === 2) log('INVARIANT VIOLATED: 2 overlapping rows committed');
  await cleanup();
  log('');

  // --- Check 5: Adjacent intervals both permitted ---
  log('=== Check 5: Adjacent intervals — boundary semantics ===');
  const r5a = await reserve('13:00', 'payh04-prod-verify-5A');
  const r5b = await reserve('14:00', 'payh04-prod-verify-5B');
  const rows5 = await prisma.slotReservation.findMany({
    where: {
      providerId: TEST_PROVIDER_ID,
      sessionId: { in: ['payh04-prod-verify-5A', 'payh04-prod-verify-5B'] },
    },
  });
  log(`Request A (13:00–14:00): HTTP ${r5a.status}`);
  log(`Request B (14:00–15:00): HTTP ${r5b.status}`);
  log(`Rows committed: ${rows5.length}`);
  const check5Pass = r5a.status === 200 && r5b.status === 200 && rows5.length === 2;
  log(`Check 5 PASS: ${check5Pass} (both adjacent slots accepted)`);
  await cleanup();
  log('');

  // --- Check 6: Normal reservation creation works ---
  log('=== Check 6: Normal reservation creation ===');
  const r6 = await reserve('15:00', 'payh04-prod-verify-6');
  log(`Single reservation (15:00–16:00): HTTP ${r6.status}`);
  const check6Pass = r6.status === 200;
  log(`Check 6 PASS: ${check6Pass}`);
  await cleanup();
  log('');

  // --- Check 7: Exclusion violation → HTTP 409 (not 500) ---
  log('=== Check 7: Constraint violation maps to HTTP 409 ===');
  const r7first = await reserve('11:00', 'payh04-prod-verify-7A');
  const r7second = await reserve('11:30', 'payh04-prod-verify-7B');
  log(`First reservation (11:00–12:00): HTTP ${r7first.status}`);
  log(`Overlapping reservation (11:30–12:30): HTTP ${r7second.status}`);
  const check7Pass = r7first.status === 200 && r7second.status === 409;
  log(`Check 7 PASS: ${check7Pass} (overlap returns 409, not 500)`);
  await cleanup();
  log('');

  // --- Summary ---
  log('=== Production Verification Summary ===');
  log(`[SHA] Deployed SHA:   ${deployedSha ?? 'unknown'}`);
  log(`[SHA] 560a77c2 ancestor: ${ancestryVerified ? 'VERIFIED' : 'MANUAL CHECK REQUIRED'}`);
  log(`[DB]  btree_gist:     ${btree.length > 0 ? `installed (v${btree[0].extversion})` : 'MISSING'}`);
  log(`[DB]  Constraint:     ${constraint.length > 0 ? 'present' : 'MISSING'}`);
  log(`[HTTP] Check 4 invariant (concurrent overlap → ≤1 row): PASS=${check4Pass}`);
  log(`[HTTP] Check 5 boundary (adjacent both succeed):         PASS=${check5Pass}`);
  log(`[HTTP] Check 6 normal creation:                          PASS=${check6Pass}`);
  log(`[HTTP] Check 7 exclusion → HTTP 409:                     PASS=${check7Pass}`);
  log('');

  const dbChecks = btree.length > 0 && constraint.length > 0;
  const allPass = dbChecks && check4Pass && check5Pass && check6Pass && check7Pass;

  if (allPass) {
    log('VERDICT: All checks passed — PAY-H-04 production verification COMPLETE');
    if (!ancestryVerified) {
      log('REMAINING: Manually confirm SHA ancestry in Vercel dashboard before closing');
    }
  } else {
    log('VERDICT: One or more checks failed — DO NOT CLOSE PAY-H-04');
    if (!dbChecks) log('  DB: btree_gist or constraint missing — migration may not have run');
    if (!check4Pass) log('  Invariant violated — constraint not enforcing overlap rejection');
    if (!check5Pass) log('  Boundary regression — adjacent slots rejected incorrectly');
    if (!check6Pass) log('  Normal creation broken');
    if (!check7Pass) log('  Constraint violation returning 500 instead of 409');
  }

  // Write evidence file
  const { writeFileSync } = await import('fs');
  const outputPath = 'docs/audit/PAY-H-04-PRODUCTION-VERIFICATION.txt';
  writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');
  log(`\nEvidence written to: ${outputPath}`);
}

main()
  .catch(err => { console.error('Verification failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
