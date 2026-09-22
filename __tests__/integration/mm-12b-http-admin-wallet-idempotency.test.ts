/**
 * MM-12-B: Admin Wallet Idempotency — HTTP Integration Baseline
 *
 * PURPOSE:
 * Demonstrate actual idempotency gaps and race conditions in PRODUCTION
 * admin wallet routes through HTTP requests against a real Next.js server.
 *
 * ARCHITECTURE:
 * Vitest
 *   ↓ HTTP requests
 * Next.js application (running on localhost:3001)
 *   ↓ actual middleware/auth/headers/request context
 * Admin wallet routes
 *   ↓ Prisma
 * Isolated PostgreSQL (localhost:5433/drivebook_test)
 *
 * AUTHENTICATION:
 * - Creates real admin user with password in test database
 * - Authenticates via /api/auth/signin to obtain session cookie
 * - Uses session cookie for admin API requests
 * - NO production test bypasses, NO mocked auth
 *
 * ROUTES UNDER TEST:
 * - POST /api/admin/clients/[id]/wallet/add-credit
 * - POST /api/admin/clients/[id]/wallet/deduct-credit
 *
 * DATABASE: postgresql://postgres:testpass@localhost:5433/drivebook_test
 *
 * EXECUTION:
 * 1. Start Next.js server: PORT=3001 DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test npm run dev
 * 2. Run tests: DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test npm test -- mm-12b-http
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { getWalletBalance } from '@/lib/services/wallet-helpers';
import bcrypt from 'bcryptjs';

const TEST_SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3001';
const TEST_PREFIX = `mm12b_http_${Date.now()}`;

let testUser: any;
let testAdmin: any;
let adminSessionCookie: string;

describe('MM-12-B: Admin Wallet Idempotency (HTTP Integration)', () => {
  beforeAll(async () => {
    // CRITICAL: Verify we're using test database
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || !dbUrl.includes('drivebook_test')) {
      throw new Error(`SAFETY CHECK FAILED: DATABASE_URL must contain 'drivebook_test'. Current: ${dbUrl?.substring(0, 50)}...`);
    }
    console.log(`[MM-12B-HTTP] Database: ${dbUrl.substring(0, 70)}...`);
    console.log(`[MM-12B-HTTP] Test server: ${TEST_SERVER_URL}`);

    // Check server is running
    try {
      await request(TEST_SERVER_URL).get('/api/health').timeout(5000);
      console.log('[MM-12B-HTTP] Server is reachable');
    } catch (err) {
      throw new Error(`TEST SERVER NOT RUNNING: Please start Next.js on ${TEST_SERVER_URL} with DATABASE_URL set to test database. Error: ${err}`);
    }

    // Create test customer
    const user = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}_customer@example.com`,
        name: 'MM-12B Customer',
        role: 'CLIENT',
        emailVerified: true,
      },
    });

    const customer = await prisma.customer.create({
      data: {
        userId: user.id,
        name: user.name!,
        email: user.email,
        phone: '555-0100',
      },
    });

    // Create wallet for customer
    await prisma.clientWallet.create({
      data: {
        userId: user.id,
        balance: 0,
      },
    });

    // Create admin with password for authentication
    const hashedPassword = await bcrypt.hash('admin-test-password-12345', 10);
    const admin = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}_admin@example.com`,
        name: 'MM-12B Admin',
        role: 'ADMIN',
        password: hashedPassword,
        emailVerified: true,
      },
    });

    // Create staff member with required permissions.
    // CRITICAL: use the Permission enum VALUES (e.g. 'finance.credits.manage'),
    // NOT the enum key names — checkPermission compares against values.
    await prisma.staffMember.create({
      data: {
        userId: admin.id,
        name: admin.name!,
        email: admin.email,
        department: 'ADMIN',
        permissions: ['finance.credits.manage', 'users.customers.wallet_deduct'],
        maxRefundAmount: 1000,
      },
    });

    testUser = { ...user, customerId: customer.id };
    testAdmin = admin;

    // Verify admin user exists and has password
    const adminCheck = await prisma.user.findUnique({
      where: { id: admin.id },
      select: { id: true, email: true, password: true, role: true },
    });
    console.log('[MM-12B-HTTP] Admin user check:', {
      exists: !!adminCheck,
      hasPassword: !!adminCheck?.password,
      email: adminCheck?.email,
      role: adminCheck?.role,
    });

    // Authenticate to get session cookie.
    // NextAuth credential callback requires:
    //   1. GET /api/auth/csrf  → csrfToken value + csrf-token cookie
    //   2. POST /api/auth/callback/credentials with csrfToken field AND the csrf cookie
    console.log('[MM-12B-HTTP] Authenticating admin...');

    // Step 1: Get CSRF token and its cookie
    const csrfResponse = await request(TEST_SERVER_URL)
      .get('/api/auth/csrf');

    const csrfToken = csrfResponse.body.csrfToken;
    // The Set-Cookie header from the CSRF response must be echoed back
    const csrfCookies = (csrfResponse.headers['set-cookie'] as string[]) ?? [];
    const csrfCookieHeader = csrfCookies
      .map((c: string) => c.split(';')[0])
      .join('; ');

    console.log('[MM-12B-HTTP] CSRF token obtained, cookie length:', csrfCookieHeader.length);

    // Step 2: POST credentials with csrf cookie and token field
    const authResponse = await request(TEST_SERVER_URL)
      .post('/api/auth/callback/credentials')
      .set('Cookie', csrfCookieHeader)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(
        `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent(admin.email)}&password=${encodeURIComponent('admin-test-password-12345')}`
      );

    // Extract session cookie from Set-Cookie header
    const cookies = authResponse.headers['set-cookie'];
    console.log('[MM-12B-HTTP] Auth response status:', authResponse.status);
    console.log('[MM-12B-HTTP] Auth response body:', JSON.stringify(authResponse.body, null, 2));
    console.log('[MM-12B-HTTP] Cookies received:', cookies);
    
    if (!cookies || cookies.length === 0) {
      throw new Error('Authentication failed: No session cookie received');
    }
    
    // Find the next-auth.session-token cookie
    const sessionCookie = cookies.find((c: string) => c.includes('next-auth.session-token'));
    if (!sessionCookie) {
      throw new Error(`Authentication failed: No next-auth.session-token in response. Cookies: ${cookies.join('; ')}`);
    }
    
    adminSessionCookie = sessionCookie.split(';')[0];
    console.log('[MM-12B-HTTP] Admin authenticated. Session cookie obtained.');

    // Probe: verify admin session can reach the route (diagnose 403 reason if any)
    const probe = await request(TEST_SERVER_URL)
      .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
      .set('Cookie', adminSessionCookie)
      .send({ amount: 1, reason: 'probe' });
    console.log('[MM-12B-HTTP] Probe response:', probe.status, JSON.stringify(probe.body));
    if (probe.status === 403) {
      throw new Error(`Admin session rejected by route: ${JSON.stringify(probe.body)}`);
    }

    console.log(`[MM-12B-HTTP] Fixtures created. User: ${testUser.id}, Customer: ${testUser.customerId}, Admin: ${testAdmin.id}`);
  });

  beforeEach(async () => {
    // Reset wallet to $0 before each test
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: testUser.id },
    });
    
    if (wallet) {
      await prisma.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
      await prisma.clientWallet.update({
        where: { id: wallet.id },
        data: { balance: 0 },
      });
    }
  });

  afterAll(async () => {
    console.log('[MM-12B-HTTP] Cleaning up...');
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: testUser.id },
    });
    if (wallet) {
      await prisma.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
      await prisma.clientWallet.delete({ where: { id: wallet.id } });
    }
    await prisma.staffMember.deleteMany({ where: { userId: testAdmin.id } });
    await prisma.customer.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.user.delete({ where: { id: testAdmin.id } });
  });

  describe('MM-12-B1: Sequential Duplicate Credit', () => {
    it('B1: Same credit twice → both create transactions (VULNERABLE)', async () => {
      // First credit: $50
      const res1 = await request(TEST_SERVER_URL)
        .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
        .set('Cookie', adminSessionCookie)
        .send({ amount: 50, reason: 'Test credit duplicate' });

      // Second credit: identical request
      const res2 = await request(TEST_SERVER_URL)
        .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
        .set('Cookie', adminSessionCookie)
        .send({ amount: 50, reason: 'Test credit duplicate' });

      console.log(`[B1] Credit A: ${res1.status}`);
      console.log(`[B1] Credit B: ${res2.status}`);

      // Database postconditions
      const balance = await getWalletBalance(testUser.id);
      const wallet = await prisma.clientWallet.findUnique({
        where: { userId: testUser.id },
        include: { transactions: { where: { type: 'CREDIT', status: 'CONFIRMED' } } },
      });

      console.log(`[B1] Transactions: ${wallet!.transactions.length}`);
      console.log(`[B1] Balance: $${balance.balance}`);
      console.log(`[B1] Amounts: ${wallet!.transactions.map((t: any) => `$${t.amount}`).join(', ')}`);

      // EVIDENCE CAPTURE: Expected vulnerability — both requests succeed
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      
      // VULNERABLE: Both created
      expect(wallet!.transactions.length).toBe(2);
      expect(balance.balance).toBe(100);
    });
  });

  describe('MM-12-B4: Concurrent Duplicate Credit', () => {
    it('B4: Two identical concurrent credits → both succeed (VULNERABLE)', async () => {
      // Concurrent credits: both $75
      const [res1, res2] = await Promise.all([
        request(TEST_SERVER_URL)
          .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
          .set('Cookie', adminSessionCookie)
          .send({ amount: 75, reason: 'Concurrent test A' }),
        request(TEST_SERVER_URL)
          .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
          .set('Cookie', adminSessionCookie)
          .send({ amount: 75, reason: 'Concurrent test A' }),
      ]);

      console.log(`[B4] Credit A: ${res1.status}`);
      console.log(`[B4] Credit B: ${res2.status}`);

      const balance = await getWalletBalance(testUser.id);
      const wallet = await prisma.clientWallet.findUnique({
        where: { userId: testUser.id},
        include: { transactions: { where: { type: 'CREDIT' } } },
      });

      console.log(`[B4] Transactions: ${wallet!.transactions.length}`);
      console.log(`[B4] Balance: $${balance.balance}`);

      // VULNERABLE: Both succeeded
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(wallet!.transactions.length).toBe(2);
      expect(balance.balance).toBe(150);
    });
  });

  describe('MM-12-B7: Concurrent Deduction Race', () => {
    it('B7: Two $50 debits against $60 → negative balance or race (TOCTOU VULNERABILITY)', async () => {
      // Setup: Add $60 to wallet
      await request(TEST_SERVER_URL)
        .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
        .set('Cookie', adminSessionCookie)
        .send({ amount: 60, reason: 'Setup for deduction test' });

      const balanceBefore = await getWalletBalance(testUser.id);
      console.log(`[B7] Starting balance: $${balanceBefore.balance}`);

      // Concurrent debits: both $50 (should only allow one)
      const [res1, res2] = await Promise.all([
        request(TEST_SERVER_URL)
          .post(`/api/admin/clients/${testUser.customerId}/wallet/deduct-credit`)
          .set('Cookie', adminSessionCookie)
          .send({ amount: 50, reason: 'Deduction race A' }),
        request(TEST_SERVER_URL)
          .post(`/api/admin/clients/${testUser.customerId}/wallet/deduct-credit`)
          .set('Cookie', adminSessionCookie)
          .send({ amount: 50, reason: 'Deduction race B' }),
      ]);

      const balanceAfter = await getWalletBalance(testUser.id);
      const wallet = await prisma.clientWallet.findUnique({
        where: { userId: testUser.id },
        include: { transactions: { where: { type: 'DEBIT', status: 'CONFIRMED' } } },
      });

      console.log(`[B7] Debit A: ${res1.status}`);
      console.log(`[B7] Debit B: ${res2.status}`);
      console.log(`[B7] Debit transactions created: ${wallet!.transactions.length}`);
      console.log(`[B7] Final balance: $${balanceAfter.balance}`);
      console.log(`[B7] Persisted ClientWallet.balance: ${wallet!.balance}`);

      // EVIDENCE CAPTURE: Check for TOCTOU vulnerability
      if (wallet!.transactions.length === 2 && balanceAfter.balance < 0) {
        console.log('[B7] ✓ TOCTOU VULNERABILITY CONFIRMED: Both debits succeeded, negative balance created');
        expect(balanceAfter.balance).toBe(-40);
      } else if (wallet!.transactions.length === 1) {
        console.log('[B7] ✓ RACE WINNER: One debit succeeded, one failed (serialization worked)');
        expect(balanceAfter.balance).toBe(10);
      } else {
        console.log('[B7] ⚠ INDETERMINATE: Unexpected outcome');
      }

      // Minimum expectation: at least one debit succeeded
      expect(wallet!.transactions.length).toBeGreaterThanOrEqual(1);
    });

    it('B8: Sequential debits respect balance check (control)', async () => {
      // Setup: Add $40 to wallet
      await request(TEST_SERVER_URL)
        .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
        .set('Cookie', adminSessionCookie)
        .send({ amount: 40, reason: 'Setup for sequential deduction' });

      // First debit: $30 (should succeed)
      const res1 = await request(TEST_SERVER_URL)
        .post(`/api/admin/clients/${testUser.customerId}/wallet/deduct-credit`)
        .set('Cookie', adminSessionCookie)
        .send({ amount: 30, reason: 'Sequential debit 1' });

      expect(res1.status).toBe(200);

      // Second debit: $50 (should fail)
      const res2 = await request(TEST_SERVER_URL)
        .post(`/api/admin/clients/${testUser.customerId}/wallet/deduct-credit`)
        .set('Cookie', adminSessionCookie)
        .send({ amount: 50, reason: 'Sequential debit 2' });

      console.log(`[B8] Debit 1 ($30): ${res1.status}`);
      console.log(`[B8] Debit 2 ($50): ${res2.status}`);

      const balance = await getWalletBalance(testUser.id);
      console.log(`[B8] Final balance: $${balance.balance}`);

      // Control: Sequential should work correctly
      expect(res2.status).toBe(400); // Insufficient balance
      expect(balance.balance).toBe(10);
    });
  });

  describe('MM-12-B10: Retry Scenarios', () => {
    it('B10: True duplicate — same request after first succeeds (NO IDEMPOTENCY)', async () => {
      // First credit: $100
      const res1 = await request(TEST_SERVER_URL)
        .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
        .set('Cookie', adminSessionCookie)
        .send({ amount: 100, reason: 'Original request' });

      expect(res1.status).toBe(200);

      // Retry: Identical request (simulating user clicking "Submit" again)
      const res2 = await request(TEST_SERVER_URL)
        .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
        .set('Cookie', adminSessionCookie)
        .send({ amount: 100, reason: 'Original request' });

      const balance = await getWalletBalance(testUser.id);
      const wallet = await prisma.clientWallet.findUnique({
        where: { userId: testUser.id },
        include: { transactions: { where: { type: 'CREDIT' } } },
      });

      console.log(`[B10] Transactions: ${wallet!.transactions.length}`);
      console.log(`[B10] Balance: $${balance.balance}`);

      // VULNERABLE: Retry created duplicate
      expect(wallet!.transactions.length).toBe(2);
      expect(balance.balance).toBe(200);
    });

    it('B12: Ambiguous response — operation succeeds but client retries', async () => {
      // First credit: $50 (succeeds)
      const res1 = await request(TEST_SERVER_URL)
        .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
        .set('Cookie', adminSessionCookie)
        .send({ amount: 50, reason: 'Payment ref ABC123' });

      expect(res1.status).toBe(200);

      // Simulate: Client doesn't receive response, retries
      const res2 = await request(TEST_SERVER_URL)
        .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
        .set('Cookie', adminSessionCookie)
        .send({ amount: 50, reason: 'Payment ref ABC123' });

      const balance = await getWalletBalance(testUser.id);
      const wallet = await prisma.clientWallet.findUnique({
        where: { userId: testUser.id },
        include: { transactions: { where: { type: 'CREDIT' } } },
      });

      console.log(`[B12] Retry response: ${res2.status}`);
      console.log(`[B12] Transactions: ${wallet!.transactions.length}`);
      console.log(`[B12] Balance: $${balance.balance}`);

      // VULNERABLE: Without idempotency key, retry is treated as new request
      expect(wallet!.transactions.length).toBe(2);
      expect(balance.balance).toBe(100);
    });
  });

  describe('MM-12-B13: Legitimate Operations', () => {
    it('B13: Two genuinely different credits must both succeed', async () => {
      // Credit 1: $75 for service A
      const res1 = await request(TEST_SERVER_URL)
        .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
        .set('Cookie', adminSessionCookie)
        .send({ amount: 75, reason: 'Service A refund' });

      // Credit 2: $50 for service B (different transaction)
      const res2 = await request(TEST_SERVER_URL)
        .post(`/api/admin/clients/${testUser.customerId}/wallet/add-credit`)
        .set('Cookie', adminSessionCookie)
        .send({ amount: 50, reason: 'Service B refund' });

      const balance = await getWalletBalance(testUser.id);
      const wallet = await prisma.clientWallet.findUnique({
        where: { userId: testUser.id },
        include: { transactions: { where: { type: 'CREDIT' } } },
      });

      expect(wallet!.transactions.length).toBe(2);
      expect(balance.balance).toBe(125);

      console.log('[B13] ✓ Both legitimate operations succeeded');
    });
  });
});
