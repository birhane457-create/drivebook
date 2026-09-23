/**
 * MM-12-B: Admin Wallet Idempotency — Hostile Baseline Verification
 *
 * PURPOSE:
 * Demonstrate actual idempotency gaps and race conditions in EXISTING PRODUCTION
 * admin wallet routes using REAL route handlers against isolated PostgreSQL.
 *
 * CRITICAL:
 * - Tests the actual production route handlers (NO service extraction, NO mocks of wallet logic)
 * - Uses proper vi.mock('next-auth/next') pattern from existing tests
 * - Verifies DATABASE POSTCONDITIONS (transaction count, balance, negative balance)
 * - Distinguishes retry cases: duplicate request vs ambiguous response
 *
 * ROUTES UNDER TEST:
 * - app/api/admin/clients/[id]/wallet/add-credit/route.ts
 * - app/api/admin/clients/[id]/wallet/deduct-credit/route.ts
 *
 * DATABASE: postgresql://postgres:testpass@localhost:5433/drivebook_test
 *
 * EXECUTION:
 * DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test npm run test:integration -- mm-12b
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST as addCreditPOST } from '@/app/api/admin/clients/[id]/wallet/add-credit/route';
import { POST as deductCreditPOST } from '@/app/api/admin/clients/[id]/wallet/deduct-credit/route';
import { getWalletBalance } from '@/lib/services/wallet-helpers';
import { getServerSession } from 'next-auth';
import { execSync } from 'child_process';

// Mock next-auth (NOT next-auth/next) — the routes import from 'next-auth'
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock next/headers to prevent "headers() called outside request scope" error
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}));

const TEST_PREFIX = `mm12b_${Date.now()}`;

let testUser: any;
let testAdmin: any;

function createMockRequest(body: any): NextRequest {
  return {
    json: async () => body,
    headers: new Headers(),
    method: 'POST',
    url: 'http://localhost:3000/api/test',
  } as any;
}

beforeAll(async () => {
  console.log('[MM-12B] Setting up test environment...');
  
  // CRITICAL: Verify we're using test database, NOT production
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.includes('drivebook_test')) {
    throw new Error(`SAFETY CHECK FAILED: DATABASE_URL must contain 'drivebook_test'. Current: ${dbUrl?.substring(0, 50)}...`);
  }
  console.log(`[MM-12B] Database: ${dbUrl.substring(0, 70)}...`);

  try {
    execSync('npx prisma db push --skip-generate', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: 'inherit',
    });
  } catch (err) {
    console.warn('[MM-12B] Prisma db push warning:', err);
  }

  // Create test customer
  const user = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}_customer@example.com`,
      name: 'MM-12B Customer',
      role: 'CLIENT',
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

  // Create admin
  const admin = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}_admin@example.com`,
      name: 'MM-12B Admin',
      role: 'ADMIN',
    },
  });

  // Create staff member with required permissions
  await prisma.staffMember.create({
    data: {
      userId: admin.id,
      name: admin.name!,
      email: admin.email,
      department: 'ADMIN',
      permissions: ['FINANCE_CREDITS_MANAGE', 'USERS_CUSTOMERS_WALLET_DEDUCT'],
      maxRefundAmount: 1000,
    },
  });

  testUser = { ...user, customerId: customer.id };
  testAdmin = admin;

  // Mock session for all tests
  (getServerSession as any).mockResolvedValue({
    user: {
      id: testAdmin.id,
      email: testAdmin.email,
      role: testAdmin.role,
    },
  });

  console.log(`[MM-12B] Fixtures created. User: ${testUser.id}, Admin: ${testAdmin.id}`);
});

beforeEach(async () => {
  // Ensure wallet exists and reset to $0 before each test
  let wallet = await prisma.clientWallet.findUnique({
    where: { userId: testUser.id },
  });
  
  if (!wallet) {
    // Create wallet if it doesn't exist
    wallet = await prisma.clientWallet.create({
      data: {
        userId: testUser.id,
        balance: 0,
      },
    });
  } else {
    // Reset existing wallet
    await prisma.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
    await prisma.clientWallet.update({
      where: { id: wallet.id },
      data: { balance: 0 },
    });
  }
});

afterAll(async () => {
  console.log('[MM-12B] Cleaning up...');
  await prisma.walletTransaction.deleteMany({
    where: { wallet: { userId: testUser.id } },
  });
  await prisma.clientWallet.deleteMany({ where: { userId: testUser.id } });
  await prisma.auditLog.deleteMany({ where: { actorId: testAdmin.id } });
  await prisma.staffMember.deleteMany({ where: { userId: testAdmin.id } });
  await prisma.customer.deleteMany({ where: { id: testUser.customerId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
  await prisma.$disconnect();
});

// ============================================================================
// B1-B3: Sequential Duplicate Credit
// ============================================================================

describe('MM-12-B1: Sequential Duplicate Credit', () => {
  it('B1: Same credit twice → both create transactions (VULNERABLE)', async () => {
    const req1 = createMockRequest({ amount: 50, reason: 'Test Credit' });
    const params1 = { params: { id: testUser.customerId } };
    await addCreditPOST(req1, params1);

    const req2 = createMockRequest({ amount: 50, reason: 'Test Credit' });
    const params2 = { params: { id: testUser.customerId } };
    await addCreditPOST(req2, params2);

    const balance = await getWalletBalance(testUser.id);
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: testUser.id },
      include: { transactions: { where: { type: 'CREDIT', status: 'CONFIRMED' } } },
    });

    // Database postconditions
    console.log(`[B1] Transactions: ${wallet!.transactions.length}`);
    console.log(`[B1] Balance: $${balance.balance}`);
    console.log(`[B1] Amounts: ${wallet!.transactions.map((t: any) => t.amount).join(', ')}`);

    // VULNERABLE: Both created
    expect(wallet!.transactions.length).toBe(2);
    expect(balance.balance).toBe(100);
  });
});

// ============================================================================
// B4-B6: Concurrent Duplicate Credit
// ============================================================================

describe('MM-12-B4: Concurrent Duplicate Credit', () => {
  it('B4: Two identical concurrent credits → both succeed (VULNERABLE)', async () => {
    await Promise.all([
      addCreditPOST(
        createMockRequest({ amount: 75, reason: 'Concurrent Test' }),
        { params: { id: testUser.customerId } }
      ),
      addCreditPOST(
        createMockRequest({ amount: 75, reason: 'Concurrent Test' }),
        { params: { id: testUser.customerId } }
      ),
    ]);

    const balance = await getWalletBalance(testUser.id);
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: testUser.id },
      include: { transactions: { where: { type: 'CREDIT' } } },
    });

    console.log(`[B4] Transactions: ${wallet!.transactions.length}`);
    console.log(`[B4] Balance: $${balance.balance}`);

    // VULNERABLE: Both succeeded
    expect(wallet!.transactions.length).toBe(2);
    expect(balance.balance).toBe(150);
  });
});

// ============================================================================
// B7-B9: Concurrent Deduction Race → Negative Balance (TOCTOU)
// ============================================================================

describe('MM-12-B7: Concurrent Deduction Race', () => {
  it('B7: Two $50 debits against $60 → negative balance or race (TOCTOU VULNERABILITY)', async () => {
    // Setup: Credit $60
    await addCreditPOST(
      createMockRequest({ amount: 60, reason: 'Setup' }),
      { params: { id: testUser.customerId } }
    );

    const balanceBefore = await getWalletBalance(testUser.id);
    console.log(`[B7] Starting balance: $${balanceBefore.balance}`);

    // Launch two $50 deductions concurrently
    const [res1, res2] = await Promise.allSettled([
      deductCreditPOST(
        createMockRequest({ amount: 50, reason: 'Debit A' }),
        { params: { id: testUser.customerId } }
      ),
      deductCreditPOST(
        createMockRequest({ amount: 50, reason: 'Debit B' }),
        { params: { id: testUser.customerId } }
      ),
    ]);

    const balanceAfter = await getWalletBalance(testUser.id);
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: testUser.id },
      include: { transactions: { where: { type: 'DEBIT', status: 'CONFIRMED' } } },
    });

    // Database postconditions
    console.log(`[B7] Debit A: ${res1.status}`);
    console.log(`[B7] Debit B: ${res2.status}`);
    console.log(`[B7] Debit transactions created: ${wallet!.transactions.length}`);
    console.log(`[B7] Final balance: $${balanceAfter.balance}`);
    console.log(`[B7] Persisted ClientWallet.balance: ${wallet!.balance}`);

    if (balanceAfter.balance < 0) {
      console.log(`[B7] ❌ VULNERABLE: Negative balance persisted (TOCTOU race confirmed)`);
    } else if (wallet!.transactions.length === 2 && balanceAfter.balance === -40) {
      console.log(`[B7] ❌ VULNERABLE: Both debits succeeded, negative balance`);
    } else if (wallet!.transactions.length === 1) {
      console.log(`[B7] ✅ PROTECTED: Only one debit succeeded`);
    } else {
      console.log(`[B7] ⚠️  INDETERMINATE: Unexpected outcome`);
    }

    // Document actual behavior
    expect(balanceAfter.balance).toBeLessThan(60); // At least one debit succeeded
  });

  it('B8: Sequential debits respect balance check (control)', async () => {
    // Setup: Credit $60
    await addCreditPOST(
      createMockRequest({ amount: 60, reason: 'Setup' }),
      { params: { id: testUser.customerId } }
    );

    // First debit: $50 (should succeed)
    const res1 = await deductCreditPOST(
      createMockRequest({ amount: 50, reason: 'Debit 1' }),
      { params: { id: testUser.customerId } }
    );
    expect(res1.status).toBe(200);

    // Second debit: $50 (should fail)
    const res2 = await deductCreditPOST(
      createMockRequest({ amount: 50, reason: 'Debit 2' }),
      { params: { id: testUser.customerId } }
    );
    const result2 = await res2.json();

    expect(res2.status).toBe(400);
    expect(result2.error).toContain('Insufficient balance');

    const balance = await getWalletBalance(testUser.id);
    expect(balance.balance).toBe(10);

    console.log(`[B8] ✅ Sequential debits work correctly: $${balance.balance}`);
  });
});

// ============================================================================
// B10-B12: Retry After Ambiguous Response
// ============================================================================

describe('MM-12-B10: Retry Scenarios', () => {
  it('B10: True duplicate — same request after first succeeds (NO IDEMPOTENCY)', async () => {
    // First request
    await addCreditPOST(
      createMockRequest({ amount: 100, reason: 'Retry Test' }),
      { params: { id: testUser.customerId } }
    );

    // Client submits identical request again (e.g., double-click, network retry)
    await addCreditPOST(
      createMockRequest({ amount: 100, reason: 'Retry Test' }),
      { params: { id: testUser.customerId } }
    );

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
    // First request succeeds (DB write completes)
    const res1 = await addCreditPOST(
      createMockRequest({ amount: 100, reason: 'Ambiguous Response' }),
      { params: { id: testUser.customerId } }
    );
    expect(res1.status).toBe(200);

    // Simulate: Client doesn't receive response, retries
    const res2 = await addCreditPOST(
      createMockRequest({ amount: 100, reason: 'Ambiguous Response' }),
      { params: { id: testUser.customerId } }
    );
    expect(res2.status).toBe(200);

    const balance = await getWalletBalance(testUser.id);
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: testUser.id },
      include: { transactions: { where: { type: 'CREDIT' } } },
    });

    console.log(`[B12] Case B (ambiguous response):`);
    console.log(`[B12] Transactions: ${wallet!.transactions.length}`);
    console.log(`[B12] Balance: $${balance.balance}`);
    console.log(`[B12] Baseline: No idempotency mechanism present`);

    // VULNERABLE: No distinction between Case A and Case B
    expect(wallet!.transactions.length).toBe(2);
    expect(balance.balance).toBe(200);
  });
});

// ============================================================================
// B13-B14: Legitimate Distinct Adjustments
// ============================================================================

describe('MM-12-B13: Legitimate Operations', () => {
  it('B13: Two genuinely different credits must both succeed', async () => {
    await addCreditPOST(
      createMockRequest({ amount: 50, reason: 'Credit A' }),
      { params: { id: testUser.customerId } }
    );

    await addCreditPOST(
      createMockRequest({ amount: 75, reason: 'Credit B' }),
      { params: { id: testUser.customerId } }
    );

    const balance = await getWalletBalance(testUser.id);
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: testUser.id },
      include: { transactions: { where: { type: 'CREDIT' } } },
    });

    expect(wallet!.transactions.length).toBe(2);
    expect(balance.balance).toBe(125);

    console.log(`[B13] ✅ Two distinct operations both succeeded: $${balance.balance}`);
  });
});
