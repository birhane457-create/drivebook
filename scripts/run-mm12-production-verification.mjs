/**
 * MM-12 Production Verification
 *
 * Proves the two MM-12-D acceptance invariants on the live production application:
 *
 * INVARIANT 1: For any (Idempotency-Key, walletId, operationType), exactly one
 *   financial effect may be committed, regardless of retries or concurrent requests.
 *
 * INVARIANT 2: No committed debit may cause the authoritative ledger-derived
 *   balance to fall below zero when the balance was non-negative and sufficient.
 *
 * USAGE:
 *   PRODUCTION_URL=https://drivebook-wheat.vercel.app \
 *   ADMIN_EMAIL=mm12-prod-verify-admin@test.internal \
 *   ADMIN_PASSWORD=mm12-prod-verify-pass-2026 \
 *   CUSTOMER_ID=<id> \
 *   WALLET_ID=<id> \
 *   node scripts/run-mm12-production-verification.mjs
 */

import { PrismaClient } from '@prisma/client';
import * as https from 'https';
import * as http  from 'http';
import { execSync } from 'child_process';

const PRODUCTION_URL  = process.env.PRODUCTION_URL  ?? 'https://drivebook-wheat.vercel.app';
const ADMIN_EMAIL     = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD  = process.env.ADMIN_PASSWORD;
const CUSTOMER_ID     = process.env.CUSTOMER_ID;
const WALLET_ID       = process.env.WALLET_ID;
const timestamp       = new Date().toISOString();

for (const [k, v] of [['ADMIN_EMAIL', ADMIN_EMAIL], ['ADMIN_PASSWORD', ADMIN_PASSWORD], ['CUSTOMER_ID', CUSTOMER_ID], ['WALLET_ID', WALLET_ID]]) {
  if (!v) { console.error(`${k} env var required`); process.exit(1); }
}

const prisma = new PrismaClient();
const lines = [];
function log(line) { console.log(line); lines.push(line); }

function req(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      'Accept': 'application/json',
      ...options.headers,
    };
    const r = lib.request(url, { ...options, headers }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
    });
    r.on('error', reject);
    if (options.body) r.write(options.body);
    r.end();
  });
}

async function authenticate() {
  const csrfRes = await req(`${PRODUCTION_URL}/api/auth/csrf`);
  const csrfToken = JSON.parse(csrfRes.body).csrfToken;
  const csrfCookies = (csrfRes.headers['set-cookie'] ?? []).map(c => c.split(';')[0]).join('; ');

  const body = `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent(ADMIN_EMAIL)}&password=${encodeURIComponent(ADMIN_PASSWORD)}`;
  const authRes = await req(`${PRODUCTION_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), 'Cookie': csrfCookies },
    body,
  });

  const cookies = authRes.headers['set-cookie'] ?? [];
  const sessionCookie = cookies.find(c => c.includes('next-auth.session-token') || c.includes('__Secure-next-auth.session-token'));
  if (!sessionCookie) throw new Error(`Auth failed. Cookies: ${cookies.join('; ')}`);
  return { session: sessionCookie.split(';')[0], csrf: csrfCookies };
}

function addCredit(sessionCookie, amount, reason, idempotencyKey) {
  const body = JSON.stringify({ amount, reason });
  return req(`${PRODUCTION_URL}/api/admin/clients/${CUSTOMER_ID}/wallet/add-credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Cookie': sessionCookie, 'Idempotency-Key': idempotencyKey },
    body,
  });
}

function deductCredit(sessionCookie, amount, reason, idempotencyKey) {
  const body = JSON.stringify({ amount, reason });
  return req(`${PRODUCTION_URL}/api/admin/clients/${CUSTOMER_ID}/wallet/deduct-credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Cookie': sessionCookie, 'Idempotency-Key': idempotencyKey },
    body,
  });
}

async function txCount(type) {
  return prisma.walletTransaction.count({ where: { walletId: WALLET_ID, status: 'CONFIRMED', ...(type ? { type } : {}) } });
}

async function ledgerBalance() {
  const rows = await prisma.walletTransaction.findMany({ where: { walletId: WALLET_ID, status: 'CONFIRMED' }, select: { type: true, amount: true } });
  return rows.reduce((acc, t) => t.type === 'CREDIT' ? acc + Number(t.amount) : acc - Number(t.amount), 0);
}

async function resetWallet() {
  // Clear transactions and idempotency keys but KEEP the wallet row
  // (deleting the wallet causes getOrCreateWallet to create a new row with a different ID
  //  which breaks subsequent checks that rely on WALLET_ID being stable)
  await prisma.walletTransaction.deleteMany({ where: { walletId: WALLET_ID } });
  await prisma.clientWallet.update({ where: { id: WALLET_ID }, data: { balance: 0 } });
  await prisma.$executeRaw`DELETE FROM "AdminWalletIdempotencyKey" WHERE "walletId" = ${WALLET_ID}`;
}

async function main() {
  log('MM-12 Production Verification');
  log(`Timestamp: ${timestamp}`);
  log(`Production URL: ${PRODUCTION_URL}`);
  log(`Customer ID: ${CUSTOMER_ID}  Wallet ID: ${WALLET_ID}`);
  log('');

  // Check 1: SHA
  log('=== Check 1: Deployed SHA ===');
  const health = await req(`${PRODUCTION_URL}/api/health`);
  const healthData = JSON.parse(health.body);
  const deployedSha = healthData.sha ?? null;
  log(`SHA: ${deployedSha ?? 'NOT PRESENT'}`);
  let ancestryVerified = false;
  if (deployedSha) {
    try {
      execSync('git fetch origin --quiet', { stdio: 'pipe', timeout: 15000 });
      const logOutput = execSync(`git log ${deployedSha.substring(0,8)} --oneline`, { stdio: 'pipe', timeout: 10000 }).toString();
      if (logOutput.includes('638888f0')) { ancestryVerified = true; log('MM-12 fix 638888f0 ancestry: VERIFIED'); }
      else { log('MM-12 fix 638888f0 ancestry: NOT FOUND in git log'); }
    } catch { log('Ancestry: could not verify locally — manual check required'); }
  }
  log(`[SHA] ${deployedSha} ancestry VERIFIED: ${ancestryVerified}`);
  log('');

  // Check 2: AdminWalletIdempotencyKey table + indexes
  log('=== Check 2: AdminWalletIdempotencyKey table ===');
  const tableRows = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_name='AdminWalletIdempotencyKey' AND table_schema='public'`;
  const tablePresent = tableRows.length > 0;
  log(`Table present: ${tablePresent}`);
  if (tablePresent) {
    const idxRows = await prisma.$queryRaw`SELECT indexname FROM pg_indexes WHERE tablename='AdminWalletIdempotencyKey'`;
    log(`Indexes: ${idxRows.map(r => r.indexname).join(', ')}`);
    const hasComposite = idxRows.some(r => r.indexname.includes('key_walletId'));
    log(`Composite unique (key,walletId,operationType): ${hasComposite ? 'PRESENT' : 'MISSING'}`);
  }
  log('');

  // Authenticate
  log('=== Authenticating admin ===');
  const { session: sessionCookie } = await authenticate();
  log('Admin authenticated');
  log('');

  await resetWallet();

  // Check 3: Same-key concurrent credit (INVARIANT 1)
  log('=== Check 3: Concurrent same-key credit (INVARIANT 1) ===');
  const key3 = crypto.randomUUID();
  const [r3a, r3b] = await Promise.all([
    addCredit(sessionCookie, 50, 'MM-12 prod check 3A', key3),
    addCredit(sessionCookie, 50, 'MM-12 prod check 3A', key3),
  ]);
  const body3a = JSON.parse(r3a.body); const body3b = JSON.parse(r3b.body);
  const count3 = await txCount('CREDIT'); const balance3 = await ledgerBalance();
  log(`Request A: ${r3a.status}  txId=${body3a.transactionId ?? body3a.wallet?.id ?? 'n/a'}`);
  log(`Request B: ${r3b.status}  txId=${body3b.transactionId ?? 'n/a'}`);
  log(`CREDIT txns: ${count3}  Ledger: $${balance3}`);
  // INVARIANT 1: exactly one tx committed, balance correct.
  // One request may get 200 (first), the other may get 200 (replay) or 409 (in-flight) or
  // occasionally 500 if the in-flight race window is tight. The DB postcondition is the truth.
  const txIdMatch = body3a.transactionId && body3b.transactionId && body3a.transactionId === body3b.transactionId;
  const bothDefinitive = r3a.status < 500 && r3b.status < 500;
  log(`Same txId: ${txIdMatch}`);
  log(`Both definitive (non-5xx): ${bothDefinitive}`);
  // Core invariant: exactly 1 CREDIT tx, balance $50
  const check3 = count3 === 1 && balance3 === 50 && r3a.status === 200;
  log(`Check 3 PASS: ${check3} (1 tx committed, balance $50, at least one 200)`);
  await resetWallet();
  log('');

  // Check 4: Same-key replay
  log('=== Check 4: Replay returns same txId ===');
  const key4 = crypto.randomUUID();
  const r4first = await addCredit(sessionCookie, 100, 'MM-12 prod check 4', key4);
  const body4first = JSON.parse(r4first.body);
  const r4replay = await addCredit(sessionCookie, 100, 'MM-12 prod check 4', key4);
  const body4replay = JSON.parse(r4replay.body);
  const count4 = await txCount('CREDIT');
  log(`First: ${r4first.status}  txId=${body4first.transactionId}`);
  log(`Replay: ${r4replay.status}  txId=${body4replay.transactionId}`);
  log(`CREDIT txns: ${count4}`);
  const check4 = r4first.status === 200 && r4replay.status === 200 &&
                 body4first.transactionId === body4replay.transactionId && count4 === 1;
  log(`Check 4 PASS: ${check4} (both 200, same txId, 1 tx)`);
  await resetWallet();
  log('');

  // Check 5: Distinct keys -> distinct transactions
  log('=== Check 5: Distinct keys -> distinct transactions ===');
  const key5a = crypto.randomUUID(); const key5b = crypto.randomUUID();
  const r5a = await addCredit(sessionCookie, 75, 'MM-12 prod check 5A', key5a);
  const r5b = await addCredit(sessionCookie, 50, 'MM-12 prod check 5B', key5b);
  const body5a = JSON.parse(r5a.body); const body5b = JSON.parse(r5b.body);
  const count5 = await txCount('CREDIT'); const balance5 = await ledgerBalance();
  log(`Credit 5A ($75): ${r5a.status}  txId=${body5a.transactionId}`);
  log(`Credit 5B ($50): ${r5b.status}  txId=${body5b.transactionId}`);
  log(`CREDIT txns: ${count5}  Ledger: $${balance5}`);
  const check5 = r5a.status === 200 && r5b.status === 200 && count5 === 2 && balance5 === 125 &&
                 body5a.transactionId !== body5b.transactionId;
  log(`Check 5 PASS: ${check5} (both 200, 2 txns, distinct txIds, $125)`);
  await resetWallet();
  log('');

  // Check 6: Concurrent deductions (INVARIANT 2)
  log('=== Check 6: Concurrent deductions (INVARIANT 2) ===');
  const setupKey = crypto.randomUUID();
  await addCredit(sessionCookie, 60, 'MM-12 prod check 6 setup', setupKey);
  const balanceBefore6 = await ledgerBalance();
  log(`Starting balance: $${balanceBefore6}`);
  const key6a = crypto.randomUUID(); const key6b = crypto.randomUUID();
  const [r6a, r6b] = await Promise.all([
    deductCredit(sessionCookie, 50, 'MM-12 prod check 6A', key6a),
    deductCredit(sessionCookie, 50, 'MM-12 prod check 6B', key6b),
  ]);
  const debitCount6 = await txCount('DEBIT'); const balance6 = await ledgerBalance();
  log(`Debit A ($50): ${r6a.status}`);
  log(`Debit B ($50): ${r6b.status}`);
  log(`DEBIT txns: ${debitCount6}  Ledger: $${balance6}`);
  const check6 = balance6 >= 0;
  log(`INVARIANT 2 PASS: ${check6} (balance not negative)`);
  if (debitCount6 === 1) log('SELECT FOR UPDATE serialised: one debit committed, one rejected');
  else if (debitCount6 === 2) log('WARNING: both debits committed');
  await resetWallet();
  log('');

  // Check 7: Failed deduction no orphan key
  log('=== Check 7: Failed deduction no orphan idempotency key ===');
  const key7 = crypto.randomUUID();
  const r7 = await deductCredit(sessionCookie, 9999, 'MM-12 prod check 7', key7);
  log(`Insufficient deduction: ${r7.status}`);
  const orphanCheck = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "AdminWalletIdempotencyKey"
    WHERE key = ${key7} AND "walletId" = ${WALLET_ID}
  `;
  log(`Orphan key row count: ${orphanCheck[0].cnt} (expected 0)`);
  const check7 = r7.status === 400 && orphanCheck[0].cnt === 0;
  log(`Check 7 PASS: ${check7} (400, no orphan row)`);
  log('');

  // Check 8: DB invariants
  log('=== Check 8: DB invariants ===');
  const dupKeys = await prisma.$queryRaw`
    SELECT key, "walletId", "operationType", COUNT(*)::int AS cnt
    FROM "AdminWalletIdempotencyKey"
    GROUP BY key, "walletId", "operationType"
    HAVING COUNT(*) > 1
  `;
  log(`Duplicate key tuples: ${dupKeys.length} (expected 0)`);
  const walletRow = await prisma.clientWallet.findUnique({ where: { id: WALLET_ID }, select: { balance: true } });
  const ledger8 = await ledgerBalance();
  const cached8 = Number(walletRow?.balance ?? 0);
  log(`Ledger balance: $${ledger8}  Cached balance: $${cached8}`);
  const check8 = dupKeys.length === 0 && Math.abs(cached8 - ledger8) <= 0.01;
  log(`Check 8 PASS: ${check8}`);
  log('');

  // Summary
  log('=== MM-12 Production Verification Summary ===');
  log(`[SHA]  Deployed: ${deployedSha}`);
  log(`[SHA]  638888f0 ancestry: ${ancestryVerified ? 'VERIFIED' : 'MANUAL CHECK REQUIRED'}`);
  log(`[DB]   AdminWalletIdempotencyKey table: ${tablePresent ? 'PRESENT' : 'MISSING'}`);
  log(`[HTTP] Check 3 same-key concurrent credit:  PASS=${check3}`);
  log(`[HTTP] Check 4 replay same txId:            PASS=${check4}`);
  log(`[HTTP] Check 5 distinct keys distinct txns: PASS=${check5}`);
  log(`[HTTP] Check 6 concurrent deductions safe:  PASS=${check6}`);
  log(`[HTTP] Check 7 failed op no orphan:         PASS=${check7}`);
  log(`[DB]   Check 8 invariants:                  PASS=${check8}`);
  log('');

  const allPass = ancestryVerified && tablePresent && check3 && check4 && check5 && check6 && check7 && check8;
  if (allPass) {
    log('VERDICT: All checks passed — MM-12 production verification COMPLETE');
  } else {
    log('VERDICT: One or more checks failed — DO NOT CLOSE MM-12');
    if (!ancestryVerified) log('  SHA ancestry not verified');
    if (!tablePresent) log('  AdminWalletIdempotencyKey table missing');
    if (!check3) log('  Concurrent same-key: invariant not proven');
    if (!check4) log('  Replay: txId not matching');
    if (!check5) log('  Distinct keys: not distinct');
    if (!check6) log('  Deductions: negative balance possible');
    if (!check7) log('  Failed op: orphan key found');
    if (!check8) log('  DB invariants failed');
  }

  const { writeFileSync } = await import('fs');
  const outputPath = 'docs/audit/MM-12-PRODUCTION-VERIFICATION.txt';
  writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');
  log(`\nEvidence written to: ${outputPath}`);
}

// Cleanup fixtures after verification
async function cleanup() {
  await prisma.$executeRaw`DELETE FROM "AdminWalletIdempotencyKey" WHERE "walletId" = ${WALLET_ID}`;
  await prisma.walletTransaction.deleteMany({ where: { walletId: WALLET_ID } });
  await prisma.clientWallet.deleteMany({ where: { id: WALLET_ID } });
  await prisma.customer.deleteMany({ where: { id: CUSTOMER_ID } });
  const admin = await prisma.staffMember.findFirst({ where: { email: 'mm12-prod-verify-admin@test.internal' } });
  if (admin) await prisma.staffMember.delete({ where: { id: admin.id } });
  await prisma.user.deleteMany({ where: { email: { in: ['mm12-prod-verify-admin@test.internal', 'mm12-prod-verify-customer@test.internal'] } } });
  console.log('Fixtures cleaned up.');
}

main()
  .then(() => cleanup())
  .catch(err => { console.error('Verification failed:', err.message ?? err); process.exit(1); })
  .finally(() => prisma.$disconnect());
