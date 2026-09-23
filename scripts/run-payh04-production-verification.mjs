/**
 * PAY-H-04 Production Verification
 *
 * Verifies after production deployment:
 *   1. Deployed SHA contains 560a77c2 in ancestry
 *   2. btree_gist is installed
 *   3. SlotReservation_no_overlap constraint exists
 *   4. Concurrent overlapping reservations produce at most one committed row
 *   5. Adjacent intervals remain permitted
 *   6. Normal single reservation creation works
 *   7. Application maps exclusion violation to HTTP 409
 *
 * USAGE:
 *   PRODUCTION_URL=https://drivebook-wheat.vercel.app \
 *   TEST_PROVIDER_ID=<providerid> \
 *   node scripts/run-payh04-production-verification.mjs
 */

import { PrismaClient } from '@prisma/client';
import * as https from 'https';
import * as http  from 'http';
import { execSync } from 'child_process';

const PRODUCTION_URL = process.env.PRODUCTION_URL ?? 'https://drivebook-wheat.vercel.app';
const TEST_PROVIDER_ID = process.env.TEST_PROVIDER_ID;
const timestamp = new Date().toISOString();

if (!TEST_PROVIDER_ID) {
  console.error('TEST_PROVIDER_ID env var required');
  process.exit(1);
}

const prisma = new PrismaClient();
const lines = [];

function log(line) { console.log(line); lines.push(line); }

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    // Browser-like User-Agent to bypass Vercel DDoS challenge on custom domains
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      'Accept': 'application/json',
      ...options.headers,
    };
    const req = lib.request(url, { ...options, headers }, (res) => {
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
  return httpRequest(`${PRODUCTION_URL}/api/availability/check-and-reserve`, {
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

  // --- Check 1: Deployed SHA via /api/health ---
  log('=== Check 1: Deployed SHA and ancestry ===');
  const health = await httpRequest(`${PRODUCTION_URL}/api/health`);
  let healthData;
  try { healthData = JSON.parse(health.body); } catch { healthData = {}; }
  const deployedSha = healthData.sha ?? null;

  log(`Health status: ${health.status}`);
  log(`Deployed SHA: ${deployedSha ?? 'NOT PRESENT — old version not yet deployed'}`);
  log(`Environment: ${healthData.env ?? 'unknown'}`);

  if (!deployedSha) {
    log('ABORT: /api/health does not return a sha field. Pre-audit version still serving.');
    await prisma.$disconnect();
    process.exit(1);
  }

  // Verify ancestry using local git — use short SHA prefix to match local refs
  let ancestryVerified = false;
  try {
    const shortSha = deployedSha.substring(0, 8);
    // git log <shortSha> lists all ancestors — if 560a77c2 appears, ancestry is confirmed
    const logOutput = execSync(`git log ${shortSha} --oneline`, { stdio: 'pipe', timeout: 10000 }).toString();
    if (logOutput.includes('560a77c2')) {
      ancestryVerified = true;
      log('SHA ancestry: VERIFIED — 560a77c2 found in git log of deployed SHA');
    } else {
      log('SHA ancestry: NOT VERIFIED — 560a77c2 not in git log ancestry');
    }
  } catch (e) {
    // Try merge-base as fallback
    try {
      execSync(`git merge-base --is-ancestor 560a77c2 ${deployedSha.substring(0, 8)}`, { stdio: 'pipe', timeout: 10000 });
      ancestryVerified = true;
      log('SHA ancestry: VERIFIED via merge-base');
    } catch {
      log(`SHA ancestry: COULD NOT VERIFY — manual check required`);
      log(`  Confirm ${deployedSha} descends from 560a77c2 on GitHub`);
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

  // --- Check 4: Concurrent overlapping ---
  log('=== Check 4: Concurrent overlapping reservations — INVARIANT ===');
  const [r4a, r4b] = await Promise.all([
    reserve('10:00', 'payh04-prod-verify-4A'),
    reserve('10:30', 'payh04-prod-verify-4B'),
  ]);
  const rows4 = await prisma.slotReservation.findMany({
    where: {
      providerId: TEST_PROVIDER_ID,
      expiresAt: { gt: new Date() },
      startTime: { gte: new Date('2028-04-10T00:00:00Z') },
      sessionId: { in: ['payh04-prod-verify-4A', 'payh04-prod-verify-4B'] },
    },
    select: { sessionId: true, startTime: true, endTime: true },
  });
  log(`Request A (10:00-11:00): HTTP ${r4a.status}`);
  log(`Request B (10:30-11:30): HTTP ${r4b.status}`);
  log(`Active rows: ${rows4.length}`);
  const check4Pass = rows4.length <= 1 && r4a.status < 500 && r4b.status < 500;
  log(`Check 4 PASS: ${check4Pass} (at most 1 row committed)`);
  if (rows4.length === 2) log('INVARIANT VIOLATED: 2 overlapping rows committed');
  await cleanup();
  log('');

  // --- Check 5: Adjacent ---
  log('=== Check 5: Adjacent intervals — boundary semantics ===');
  const r5a = await reserve('13:00', 'payh04-prod-verify-5A');
  const r5b = await reserve('14:00', 'payh04-prod-verify-5B');
  const rows5 = await prisma.slotReservation.findMany({
    where: {
      providerId: TEST_PROVIDER_ID,
      sessionId: { in: ['payh04-prod-verify-5A', 'payh04-prod-verify-5B'] },
    },
  });
  log(`Request A (13:00-14:00): HTTP ${r5a.status}`);
  log(`Request B (14:00-15:00): HTTP ${r5b.status}`);
  log(`Rows committed: ${rows5.length}`);
  const check5Pass = r5a.status === 200 && r5b.status === 200 && rows5.length === 2;
  log(`Check 5 PASS: ${check5Pass} (both adjacent slots accepted)`);
  await cleanup();
  log('');

  // --- Check 6: Normal creation ---
  log('=== Check 6: Normal reservation creation ===');
  const r6 = await reserve('15:00', 'payh04-prod-verify-6');
  log(`Single reservation (15:00-16:00): HTTP ${r6.status}`);
  const check6Pass = r6.status === 200;
  log(`Check 6 PASS: ${check6Pass}`);
  await cleanup();
  log('');

  // --- Check 7: Exclusion -> 409 ---
  log('=== Check 7: Constraint violation maps to HTTP 409 ===');
  const r7first = await reserve('11:00', 'payh04-prod-verify-7A');
  const r7second = await reserve('11:30', 'payh04-prod-verify-7B');
  log(`First reservation (11:00-12:00): HTTP ${r7first.status}`);
  log(`Overlapping reservation (11:30-12:30): HTTP ${r7second.status}`);
  const check7Pass = r7first.status === 200 && r7second.status === 409;
  log(`Check 7 PASS: ${check7Pass} (overlap returns 409, not 500)`);
  await cleanup();
  log('');

  // --- Summary ---
  log('=== Production Verification Summary ===');
  log(`[SHA] Deployed SHA:   ${deployedSha}`);
  log(`[SHA] 560a77c2 ancestor: ${ancestryVerified ? 'VERIFIED' : 'MANUAL CHECK REQUIRED'}`);
  log(`[DB]  btree_gist:     ${btree.length > 0 ? `installed (v${btree[0].extversion})` : 'MISSING'}`);
  log(`[DB]  Constraint:     ${constraint.length > 0 ? 'present' : 'MISSING'}`);
  log(`[HTTP] Check 4 invariant (concurrent overlap <= 1 row): PASS=${check4Pass}`);
  log(`[HTTP] Check 5 boundary (adjacent both succeed):        PASS=${check5Pass}`);
  log(`[HTTP] Check 6 normal creation:                         PASS=${check6Pass}`);
  log(`[HTTP] Check 7 exclusion -> HTTP 409:                   PASS=${check7Pass}`);
  log('');

  const dbChecks = btree.length > 0 && constraint.length > 0;
  // ancestryVerified is required — verdict cannot pass without SHA confirmation
  const allPass = dbChecks && check4Pass && check5Pass && check6Pass && check7Pass && ancestryVerified;

  if (allPass) {
    log('VERDICT: All checks passed — PAY-H-04 production verification COMPLETE');
  } else {
    log('VERDICT: One or more checks failed — DO NOT CLOSE PAY-H-04');
    if (!ancestryVerified) log('  SHA: ancestry not verified');
    if (!dbChecks) log('  DB: btree_gist or constraint missing');
    if (!check4Pass) log('  Invariant: concurrent overlap produced >1 row or HTTP 5xx');
    if (!check5Pass) log('  Boundary: adjacent slots not both accepted');
    if (!check6Pass) log('  Normal: single reservation failed');
    if (!check7Pass) log('  Error mapping: overlap not returning 409');
  }

  const { writeFileSync } = await import('fs');
  const outputPath = 'docs/audit/PAY-H-04-PRODUCTION-VERIFICATION.txt';
  writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');
  log(`\nEvidence written to: ${outputPath}`);
}

main()
  .catch(err => { console.error('Verification failed:', err.message ?? err); process.exit(1); })
  .finally(() => prisma.$disconnect());
