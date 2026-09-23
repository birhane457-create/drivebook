/**
 * MM-12-E: Admin Wallet Idempotency — Independent HTTP Verification
 *
 * PURPOSE:
 * Prove the two MM-12-D acceptance invariants under real concurrent HTTP
 * requests against the actual production route handlers.
 *
 * INVARIANT 1 (idempotency):
 *   For any (Idempotency-Key, walletId, operationType), exactly one financial
 *   effect may be committed, regardless of sequential retries or concurrent
 *   first requests.
 *
 * INVARIANT 2 (deduction atomicity):
 *   No committed debit may cause the authoritative ledger-derived balance to
 *   fall below zero when the balance was non-negative and sufficient.
 *
 * ARCHITECTURE:
 *   Vitest → supertest HTTP → Next.js server (localhost:3001)
 *     → real NextAuth session → production route handlers
 *     → Prisma → isolated PostgreSQL (localhost:5433/drivebook_test)
 *
 * SCENARIOS:
 *   E1 — Concurrent identical credits (same key): exactly one WalletTransaction
 *   E2 — Concurrent distinct credits (different keys): both transactions
 *   E3 — Concurrent deductions (different keys): no negative ledger balance
 *   E4 — Credit + deduction concurrently: correct final ledger + cached balance
 *   E5 — Replay (same key after success): HTTP 200, original txId, one transaction
 *   E6 — Failure rollback: idempotency claim + wallet transaction both absent
 *
 * EXECUTION:
 *   Run via: .\scripts\run-mm-12e-http-tests.ps1
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { getWalletBalance } from '@/lib/services/wallet-helpers';
import bcrypt from 'bcryptjs';

const TEST_SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3001';
const TEST_PREFIX = `mm12e_${Date.now()}`;

// ── Fixtures ──────────────────────────────────────────────────────────────────

let testUser: { id: string; email: string; customerId: string };
let testAdmin: { id: string; email: string };
let adminSessionCookie: string;
let walletId: string;

async function authenticate(serverUrl: string, email: string, password: string): Promise<string> {
  const csrfRes = await request(serverUrl).get('/api/auth/csrf');
  const csrfToken: string = csrfRes.body.csrfToken;
  const csrfCookies: string[] = csrfRes.headers['set-cookie'] ?? [];
  const csrfCookieHeader = csrfCookies.map((c: string) => c.split(';')[0]).join('; ');

  const authRes = await request(serverUrl)
    .post('/api/auth/callback/credentials')
    .set('Cookie', csrfCookieHeader)
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send(
      `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    );

  const cookies: string[] = authRes.headers['set-cookie'] ?? [];
  const sessionCookie = cookies.find((c: string) => c.includes('next-auth.session-token'));
  if (!sessionCookie) throw new Error(`Authentication failed for ${email}. Cookies: ${cookies.join('; ')}`);
  return sessionCookie.split(';')[0];
}

async function ledgerBalance(userId: string): Promise<number> {
  return (await getWalletBalance(userId)).balance;
}

async function txCount(walletId: string, type?: 'CREDIT' | 'DEBIT'): Promise<number> {
  return prisma.walletTransaction.count({
    where: { walletId, status: 'CONFIRMED', ...(type ? { type } : {}) },
  });
}

async function idempotencyRowExists(key: string, wId: string, op: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ key: string }>>`
    SELECT "key" FROM "AdminWalletIdempotencyKey"
    WHERE "key" = ${key} AND "walletId" = ${wId} AND "operationType" = ${op}
  `;
  return rows.length > 0;
}

function addCredit(customerId: string, amount: number, reason: string, idempotencyKey: string) {
  return request(TEST_SERVER_URL)
    .post(`/api/admin/clients/${customerId}/wallet/add-credit`)
    .set('Cookie', adminSessionCookie)
    .set('Idempotency-Key', idempotencyKey)
    .send({ amount, reason });
}

function deductCredit(customerId: string, amount: number, reason: string, idempotencyKey: string) {
  return request(TEST_SERVER_URL)
    .post(`/api/admin/clients/${customerId}/wallet/deduct-credit`)
    .set('Cookie', adminSessionCookie)
    .set('Idempotency-Key', idempotencyKey)
    .send({ amount, reason });
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

describe('MM-12-E: Admin Wallet Idempotency Verification (HTTP)', () => {

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl?.includes('drivebook_test')) {
      throw new Error(`SAFETY: DATABASE_URL must point to drivebook_test. Got: ${dbUrl?.substring(0, 60)}`);
    }
    console.log(`[MM-12E] DB: ${dbUrl.substring(0, 70)}...`);
    console.log(`[MM-12E] Server: ${TEST_SERVER_URL}`);

    // Verify server is reachable
    try {
      const probe = await request(TEST_SERVER_URL).get('/api/health').timeout(5000);
      if (probe.status !== 200) throw new Error(`Health check returned ${probe.status}`);
    } catch (err) {
      throw new Error(`Server not running at ${TEST_SERVER_URL}. Start with run-mm-12e-http-tests.ps1. Error: ${err}`);
    }

    // Create customer user + wallet
    const customerUser = await prisma.user.create({
      data: { email: `${TEST_PREFIX}_customer@test.com`, name: 'MM-12E Customer', role: 'CLIENT', emailVerified: true },
    });
    const customer = await prisma.customer.create({
      data: { userId: customerUser.id, name: customerUser.name!, email: customerUser.email, phone: '555-0200' },
    });
    const wallet = await prisma.clientWallet.create({
      data: { userId: customerUser.id, balance: 0 },
    });
    walletId = wallet.id;
    testUser = { id: customerUser.id, email: customerUser.email, customerId: customer.id };

    // Create admin user + staff member
    const pw = await bcrypt.hash('mm12e-admin-pass-99', 10);
    const adminUser = await prisma.user.create({
      data: { email: `${TEST_PREFIX}_admin@test.com`, name: 'MM-12E Admin', role: 'ADMIN', password: pw, emailVerified: true },
    });
    await prisma.staffMember.create({
      data: {
        userId: adminUser.id,
        name: adminUser.name!,
        email: adminUser.email,
        department: 'ADMIN',
        permissions: ['finance.credits.manage', 'users.customers.wallet_deduct'],
        maxRefundAmount: 10000,
      },
    });
    testAdmin = { id: adminUser.id, email: adminUser.email };

    // Authenticate
    adminSessionCookie = await authenticate(TEST_SERVER_URL, adminUser.email, 'mm12e-admin-pass-99');
    console.log(`[MM-12E] Admin authenticated. Customer: ${testUser.customerId}, Wallet: ${walletId}`);
  });

  beforeEach(async () => {
    // Reset wallet to $0, clear all transactions and idempotency keys for this wallet
    await prisma.walletTransaction.deleteMany({ where: { walletId } });
    await prisma.clientWallet.update({ where: { id: walletId }, data: { balance: 0 } });
    await prisma.$executeRaw`
      DELETE FROM "AdminWalletIdempotencyKey" WHERE "walletId" = ${walletId}
    `;
  });

  afterAll(async () => {
    console.log('[MM-12E] Cleaning up fixtures...');
    await prisma.$executeRaw`DELETE FROM "AdminWalletIdempotencyKey" WHERE "walletId" = ${walletId}`;
    await prisma.walletTransaction.deleteMany({ where: { walletId } });
    await prisma.clientWallet.deleteMany({ where: { id: walletId } });
    await prisma.staffMember.deleteMany({ where: { userId: testAdmin.id } });
    await prisma.customer.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.deleteMany({ where: { id: { in: [testUser.id, testAdmin.id] } } });
    console.log('[MM-12E] Cleanup complete.');
  });

  // ── E1: Concurrent identical credits (same key) ───────────────────────────

  describe('E1: Concurrent identical credits — same Idempotency-Key', () => {
    it('INVARIANT 1: exactly one WalletTransaction committed regardless of race', async () => {
      const key = crypto.randomUUID();

      const [res1, res2] = await Promise.all([
        addCredit(testUser.customerId, 100, 'E1 credit', key),
        addCredit(testUser.customerId, 100, 'E1 credit', key),
      ]);

      console.log(`[E1] Request A: ${res1.status}`);
      console.log(`[E1] Request B: ${res2.status}`);

      // Both must receive a successful response (one original, one replay)
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Both responses must reference the SAME transaction ID
      expect(res1.body.transactionId).toBe(res2.body.transactionId);

      // Database: exactly one WalletTransaction
      const count = await txCount(walletId, 'CREDIT');
      const balance = await ledgerBalance(testUser.id);

      console.log(`[E1] Transactions committed: ${count}`);
      console.log(`[E1] Ledger balance: $${balance}`);

      expect(count).toBe(1);
      expect(balance).toBe(100);
    });
  });

  // ── E2: Concurrent distinct credits (different keys) ─────────────────────

  describe('E2: Concurrent distinct credits — different Idempotency-Keys', () => {
    it('both transactions committed (legitimate concurrent operations)', async () => {
      const key1 = crypto.randomUUID();
      const key2 = crypto.randomUUID();

      const [res1, res2] = await Promise.all([
        addCredit(testUser.customerId, 75, 'E2 credit A', key1),
        addCredit(testUser.customerId, 50, 'E2 credit B', key2),
      ]);

      console.log(`[E2] Credit A ($75): ${res1.status}`);
      console.log(`[E2] Credit B ($50): ${res2.status}`);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Different keys → different transaction IDs
      expect(res1.body.transactionId).not.toBe(res2.body.transactionId);

      const count = await txCount(walletId, 'CREDIT');
      const balance = await ledgerBalance(testUser.id);

      console.log(`[E2] Transactions committed: ${count}`);
      console.log(`[E2] Ledger balance: $${balance}`);

      expect(count).toBe(2);
      expect(balance).toBe(125);
    });
  });

  // ── E3: Concurrent deductions — no negative balance ──────────────────────

  describe('E3: Concurrent deductions — INVARIANT 2', () => {
    it('no committed debit causes negative balance (two $50 debits vs $60)', async () => {
      // Setup: $60 starting balance
      await addCredit(testUser.customerId, 60, 'E3 setup', crypto.randomUUID());
      const balanceBefore = await ledgerBalance(testUser.id);
      console.log(`[E3] Starting balance: $${balanceBefore}`);
      expect(balanceBefore).toBe(60);

      const key1 = crypto.randomUUID();
      const key2 = crypto.randomUUID();

      const [res1, res2] = await Promise.all([
        deductCredit(testUser.customerId, 50, 'E3 debit A', key1),
        deductCredit(testUser.customerId, 50, 'E3 debit B', key2),
      ]);

      const debitCount = await txCount(walletId, 'DEBIT');
      const balanceAfter = await ledgerBalance(testUser.id);

      console.log(`[E3] Debit A: ${res1.status}`);
      console.log(`[E3] Debit B: ${res2.status}`);
      console.log(`[E3] DEBIT transactions committed: ${debitCount}`);
      console.log(`[E3] Ledger balance after: $${balanceAfter}`);

      // INVARIANT 2: balance must never go negative
      expect(balanceAfter).toBeGreaterThanOrEqual(0);

      // Exactly one debit should have succeeded; the other failed the balance check
      if (debitCount === 1) {
        console.log('[E3] ✓ SELECT FOR UPDATE serialised: one debit committed, one rejected');
        expect(balanceAfter).toBe(10);
        // One 200, one 400
        const statuses = [res1.status, res2.status].sort();
        expect(statuses).toContain(200);
        expect(statuses).toContain(400);
      } else if (debitCount === 2) {
        // Both debits committed — this would mean the lock did not prevent the race
        console.log(`[E3] ✗ BOTH debits committed — balance: $${balanceAfter}`);
        // The invariant assertion above already catches negative balance;
        // record that two debits committed for evidence
        expect(debitCount).toBe(1); // force explicit failure with useful message
      }
    });
  });

  // ── E4: Concurrent credit + deduction ────────────────────────────────────

  describe('E4: Concurrent credit + deduction', () => {
    it('ledger balance and cached balance agree after concurrent operations', async () => {
      // Setup: $50 starting balance
      await addCredit(testUser.customerId, 50, 'E4 setup', crypto.randomUUID());

      const creditKey = crypto.randomUUID();
      const debitKey  = crypto.randomUUID();

      // Concurrently: +$30 credit and -$40 deduction
      const [creditRes, debitRes] = await Promise.all([
        addCredit(testUser.customerId, 30, 'E4 credit',  creditKey),
        deductCredit(testUser.customerId, 40, 'E4 debit', debitKey),
      ]);

      const creditCount = await txCount(walletId, 'CREDIT');
      const debitCount  = await txCount(walletId, 'DEBIT');
      const ledger      = await ledgerBalance(testUser.id);

      // Read the cached balance directly from ClientWallet
      const walletRow = await prisma.clientWallet.findUnique({
        where: { id: walletId },
        select: { balance: true },
      });
      const cached = Number(walletRow!.balance);

      console.log(`[E4] Credit (+$30): ${creditRes.status}`);
      console.log(`[E4] Debit (-$40):  ${debitRes.status}`);
      console.log(`[E4] CREDIT txns: ${creditCount}, DEBIT txns: ${debitCount}`);
      console.log(`[E4] Ledger balance: $${ledger}`);
      console.log(`[E4] Cached balance: $${cached}`);

      // Both operations should have been accepted (debit has $50 available)
      expect(creditRes.status).toBe(200);
      expect(debitRes.status).toBe(200);

      // Ledger must equal $50 + $30 - $40 = $40
      expect(ledger).toBe(40);

      // Cached balance must match ledger (within floating-point tolerance)
      expect(Math.abs(cached - ledger)).toBeLessThanOrEqual(0.01);
    });
  });

  // ── E5: Replay — same key after successful completion ────────────────────

  describe('E5: Replay after successful completion', () => {
    it('HTTP 200 with original transactionId, exactly one financial transaction', async () => {
      const key = crypto.randomUUID();

      // First request
      const first = await addCredit(testUser.customerId, 200, 'E5 original', key);
      expect(first.status).toBe(200);
      const originalTxId: string = first.body.transactionId;

      console.log(`[E5] First request: ${first.status}, txId: ${originalTxId}`);

      // Replay with same key
      const replay = await addCredit(testUser.customerId, 200, 'E5 original', key);
      console.log(`[E5] Replay request: ${replay.status}, txId: ${replay.body.transactionId}`);

      // Must return 200 with the original transaction ID
      expect(replay.status).toBe(200);
      expect(replay.body.transactionId).toBe(originalTxId);

      // Exactly one WalletTransaction in the database
      const count = await txCount(walletId, 'CREDIT');
      const balance = await ledgerBalance(testUser.id);

      console.log(`[E5] Transactions committed: ${count}`);
      console.log(`[E5] Ledger balance: $${balance}`);

      expect(count).toBe(1);
      expect(balance).toBe(200);
    });

    it('deduction replay: HTTP 200 with original transactionId, one DEBIT only', async () => {
      // Setup: $100 starting balance
      await addCredit(testUser.customerId, 100, 'E5 debit setup', crypto.randomUUID());

      const key = crypto.randomUUID();

      const first = await deductCredit(testUser.customerId, 40, 'E5 debit original', key);
      expect(first.status).toBe(200);
      const originalTxId: string = first.body.transactionId;

      const replay = await deductCredit(testUser.customerId, 40, 'E5 debit original', key);
      console.log(`[E5-debit] Replay: ${replay.status}, txId: ${replay.body.transactionId}`);

      expect(replay.status).toBe(200);
      expect(replay.body.transactionId).toBe(originalTxId);

      const debitCount = await txCount(walletId, 'DEBIT');
      const balance = await ledgerBalance(testUser.id);

      expect(debitCount).toBe(1);
      expect(balance).toBe(60);
    });
  });

  // ── E6: Failure rollback ──────────────────────────────────────────────────

  describe('E6: Failure rollback', () => {
    it('missing Idempotency-Key header returns 400, no rows created', async () => {
      const countBefore = await txCount(walletId);

      const res = await request(TEST_SERVER_URL)
        .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
        .set('Cookie', adminSessionCookie)
        // Intentionally no Idempotency-Key header
        .send({ amount: 50, reason: 'E6 no-key test' });

      console.log(`[E6] No-key response: ${res.status}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Idempotency-Key/i);

      // No transactions or idempotency rows created
      const countAfter = await txCount(walletId);
      expect(countAfter).toBe(countBefore);
    });

    it('insufficient balance for deduction: no DEBIT row, idempotency key not persisted', async () => {
      // Wallet is at $0 — any deduction should fail the balance check
      const key = crypto.randomUUID();

      const res = await deductCredit(testUser.customerId, 50, 'E6 insufficient', key);
      console.log(`[E6] Insufficient-balance response: ${res.status}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/insufficient balance/i);

      // No DEBIT transaction
      const debitCount = await txCount(walletId, 'DEBIT');
      expect(debitCount).toBe(0);

      // Idempotency key must NOT be persisted (was deleted before rollback)
      const keyExists = await idempotencyRowExists(key, walletId, 'DEBIT');
      console.log(`[E6] Idempotency row persisted after failure: ${keyExists}`);
      expect(keyExists).toBe(false);

      // Caller can retry after adding funds — use the same key, fund the wallet,
      // then verify the deduction succeeds with the same key
      await addCredit(testUser.customerId, 100, 'E6 fund after failure', crypto.randomUUID());
      const retryRes = await deductCredit(testUser.customerId, 50, 'E6 insufficient', key);
      console.log(`[E6] Retry after funding: ${retryRes.status}`);

      expect(retryRes.status).toBe(200);
      expect(await txCount(walletId, 'DEBIT')).toBe(1);
      expect(await ledgerBalance(testUser.id)).toBe(50);
    });

    it('deduction with invalid amount: no rows committed', async () => {
      const key = crypto.randomUUID();
      const countBefore = await txCount(walletId);

      const res = await deductCredit(testUser.customerId, -10, 'E6 invalid amount', key);
      console.log(`[E6] Invalid-amount response: ${res.status}`);

      expect(res.status).toBe(400);
      expect(await txCount(walletId)).toBe(countBefore);
      // Idempotency key not claimed (validation failed before the transaction)
      expect(await idempotencyRowExists(key, walletId, 'DEBIT')).toBe(false);
    });
  });

  // ── E1 sequential variant (regression from MM-12-B B1/B10) ───────────────

  describe('E1-seq: Sequential duplicate credit — regression guard', () => {
    it('second identical request replays, no second transaction created', async () => {
      const key = crypto.randomUUID();

      const first = await addCredit(testUser.customerId, 100, 'E1seq credit', key);
      const second = await addCredit(testUser.customerId, 100, 'E1seq credit', key);

      console.log(`[E1-seq] First: ${first.status}, Second: ${second.status}`);
      console.log(`[E1-seq] txId first: ${first.body.transactionId}, second: ${second.body.transactionId}`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.transactionId).toBe(first.body.transactionId);

      expect(await txCount(walletId, 'CREDIT')).toBe(1);
      expect(await ledgerBalance(testUser.id)).toBe(100);
    });
  });

});
