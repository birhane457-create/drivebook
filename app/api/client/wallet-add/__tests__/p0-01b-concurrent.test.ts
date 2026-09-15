/**
 * P0-01B: Concurrent Race Condition Test
 * 
 * FINDING:
 *   The P0-01A ownership fix blocks cross-user theft, but the idempotency check
 *   has a TOCTOU (Time-Of-Check-Time-Of-Use) race condition:
 * 
 *   Line 189: const existingTransaction = await findFirst(...);  // CHECK
 *   Line 193: if (existingTransaction) return duplicate;
 *   Line 218: await $transaction(async (tx) => {
 *               await tx.walletTransaction.create({...});         // USE
 *             });
 * 
 *   Two genuinely concurrent requests can both pass the check and both create credits.
 * 
 * ROOT CAUSE:
 *   Check happens OUTSIDE the database transaction.
 *   Race window exists between check and insert.
 * 
 * FIX:
 *   Database unique constraint on metadata->>'stripePaymentIntentId'
 *   Migration: 20260911000000_add_wallet_transaction_payment_intent_unique
 * 
 * THIS TEST:
 *   Uses Promise.all() to send two genuinely concurrent requests.
 *   Before fix: Both would succeed (double-credit bug).
 *   After fix: One succeeds (200), one fails (409 or database error).
 * 
 * NOTE:
 *   The existing p0-01-ownership.test.ts "concurrency" test is sequential:
 *     await POST(req1);  // First request completes
 *     await POST(req2);  // Then second request runs
 *   This test is TRUE concurrency with Promise.all().
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock Stripe service
const mockStripeService = {
  retrievePaymentIntent: vi.fn(),
};

vi.mock('@/lib/services/stripe', () => ({
  stripeService: mockStripeService,
}));

describe('P0-01B: Concurrent Double-Credit Race Condition', () => {
  let testUser: { id: string; email: string; walletId: string };
  const TEST_EMAIL = 'user-p001b-concurrent@test.com';

  beforeAll(async () => {
    // Clean slate
    await prisma.walletTransaction.deleteMany({});
    await prisma.clientWallet.deleteMany({ where: { user: { email: TEST_EMAIL } } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

    // Create test user with wallet
    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Concurrent Test User',
        role: 'CLIENT',
        wallet: { create: { balance: 0 } }
      },
      include: { wallet: true }
    });

    testUser = {
      id: user.id,
      email: user.email,
      walletId: user.wallet!.id
    };

    // Mock session for all tests
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: testUser.id, email: testUser.email, role: 'CLIENT' }
    } as any);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.walletTransaction.deleteMany({ where: { walletId: testUser.walletId } });
    await prisma.clientWallet.delete({ where: { id: testUser.walletId } });
    await prisma.user.delete({ where: { id: testUser.id } });
  });

  describe('🔒 DATABASE CONSTRAINT: Concurrent request protection', () => {
    it('prevents double-credit when two genuinely concurrent requests arrive', async () => {
      const paymentIntentId = 'pi_test_concurrent_' + Date.now();
      const amount = 100;

      // Mock Stripe: Same PaymentIntent for both requests
      mockStripeService.retrievePaymentIntent.mockResolvedValue({
        id: paymentIntentId,
        status: 'succeeded',
        amount_received: amount * 100, // Stripe uses cents
        metadata: {
          userId: testUser.id,
          walletId: testUser.walletId
        }
      });

      // Create two identical requests
      const createRequest = () => new NextRequest('http://localhost/api/client/wallet-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          paymentIntentId
        })
      });

      // 🔥 CRITICAL: Use Promise.all() for TRUE concurrency
      // Both requests execute simultaneously, not sequentially
      const [response1, response2] = await Promise.all([
        POST(createRequest()),
        POST(createRequest())
      ]);

      const data1 = await response1.json();
      const data2 = await response2.json();

      // EXPECTED BEHAVIOR (after fix):
      // - One request succeeds (200)
      // - One request fails (409 Conflict or 500 with database error)
      // 
      // The database unique constraint prevents the second insert.
      // The application code should catch this and return 409.

      const statuses = [response1.status, response2.status].sort();
      const successResponses = [data1, data2].filter(d => d.success === true);
      const errorResponses = [data1, data2].filter(d => d.error || d.duplicate);

      // Verify: Exactly ONE request succeeded
      expect(successResponses.length).toBe(1);
      expect(errorResponses.length).toBe(1);

      // Verify: One status is 200 (success)
      expect(statuses).toContain(200);

      // Verify: One status is 409 (conflict) or 500 (database error)
      // Note: Before application code handles P2002, it may throw 500
      const failureStatus = statuses.find(s => s !== 200);
      expect([409, 500]).toContain(failureStatus);

      // 🔍 CRITICAL VERIFICATION: Only ONE wallet transaction created
      const transactions = await prisma.walletTransaction.findMany({
        where: {
          walletId: testUser.walletId,
          metadata: {
            path: ['stripePaymentIntentId'],
            equals: paymentIntentId
          }
        }
      });

      expect(transactions.length).toBe(1);
      expect(Number(transactions[0].amount)).toBe(amount);
      expect(transactions[0].status).toBe('COMPLETED');

      // Verify wallet balance only credited once
      const wallet = await prisma.clientWallet.findUnique({
        where: { id: testUser.walletId }
      });
      expect(Number(wallet!.balance)).toBe(amount);
    });

    it('allows sequential requests with different PaymentIntents (no false positives)', async () => {
      const paymentIntent1 = 'pi_test_seq1_' + Date.now();
      const paymentIntent2 = 'pi_test_seq2_' + Date.now();
      const amount = 50;

      // First PaymentIntent
      mockStripeService.retrievePaymentIntent.mockResolvedValueOnce({
        id: paymentIntent1,
        status: 'succeeded',
        amount_received: amount * 100,
        metadata: { userId: testUser.id, walletId: testUser.walletId }
      });

      const req1 = new NextRequest('http://localhost/api/client/wallet-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, paymentIntentId: paymentIntent1 })
      });

      const response1 = await POST(req1);
      const data1 = await response1.json();

      expect(response1.status).toBe(200);
      expect(data1.success).toBe(true);

      // Second PaymentIntent (different)
      mockStripeService.retrievePaymentIntent.mockResolvedValueOnce({
        id: paymentIntent2,
        status: 'succeeded',
        amount_received: amount * 100,
        metadata: { userId: testUser.id, walletId: testUser.walletId }
      });

      const req2 = new NextRequest('http://localhost/api/client/wallet-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, paymentIntentId: paymentIntent2 })
      });

      const response2 = await POST(req2);
      const data2 = await response2.json();

      // Both should succeed (different PaymentIntents)
      expect(response2.status).toBe(200);
      expect(data2.success).toBe(true);

      // Verify two distinct transactions exist
      const transactions = await prisma.walletTransaction.findMany({
        where: {
          walletId: testUser.walletId,
          metadata: {
            path: ['stripePaymentIntentId'],
            in: [paymentIntent1, paymentIntent2]
          }
        }
      });

      expect(transactions.length).toBe(2);
    });

    it('handles triple concurrent requests (stress test)', async () => {
      const paymentIntentId = 'pi_test_triple_' + Date.now();
      const amount = 75;

      mockStripeService.retrievePaymentIntent.mockResolvedValue({
        id: paymentIntentId,
        status: 'succeeded',
        amount_received: amount * 100,
        metadata: { userId: testUser.id, walletId: testUser.walletId }
      });

      const createRequest = () => new NextRequest('http://localhost/api/client/wallet-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, paymentIntentId })
      });

      // Send THREE concurrent requests
      const [res1, res2, res3] = await Promise.all([
        POST(createRequest()),
        POST(createRequest()),
        POST(createRequest())
      ]);

      const responses = await Promise.all([
        res1.json(),
        res2.json(),
        res3.json()
      ]);

      // Exactly ONE should succeed
      const successCount = responses.filter(r => r.success === true).length;
      expect(successCount).toBe(1);

      // Two should fail
      const failureCount = responses.filter(r => r.error || r.duplicate).length;
      expect(failureCount).toBe(2);

      // Verify only ONE transaction created
      const transactions = await prisma.walletTransaction.findMany({
        where: {
          walletId: testUser.walletId,
          metadata: { path: ['stripePaymentIntentId'], equals: paymentIntentId }
        }
      });

      expect(transactions.length).toBe(1);
      expect(Number(transactions[0].amount)).toBe(amount);
    });
  });

  describe('🔍 RACE CONDITION ANATOMY', () => {
    it('demonstrates the vulnerability window (before database constraint)', async () => {
      /**
       * This test DOCUMENTS the race condition without relying on timing.
       * 
       * VULNERABLE CODE FLOW:
       * 
       * Request A                          Request B
       * ─────────────────────────          ─────────────────────────
       * findFirst(pi_123)                  
       *   → returns null                   findFirst(pi_123)
       *                                      → returns null (A hasn't committed yet)
       * if (null) { pass check }           
       *                                    if (null) { pass check }
       * $transaction(() => {               
       *   create(pi_123)                   $transaction(() => {
       * })                                   create(pi_123)  ← DUPLICATE!
       *   → commits                        })
       *                                      → commits
       * 
       * RESULT: Two wallet transactions for same PaymentIntent
       * 
       * FIX: Database unique constraint makes second create() fail atomically.
       */

      const paymentIntentId = 'pi_test_anatomy_' + Date.now();

      mockStripeService.retrievePaymentIntent.mockResolvedValue({
        id: paymentIntentId,
        status: 'succeeded',
        amount_received: 10000,
        metadata: { userId: testUser.id, walletId: testUser.walletId }
      });

      // Simulate the race with concurrent requests
      const results = await Promise.all([
        POST(new NextRequest('http://localhost/api/client/wallet-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 100, paymentIntentId })
        })),
        POST(new NextRequest('http://localhost/api/client/wallet-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 100, paymentIntentId })
        }))
      ]);

      // With fix: Only one succeeds
      const successCount = results.filter(r => r.status === 200).length;
      expect(successCount).toBe(1);

      // Database enforces uniqueness
      const txCount = await prisma.walletTransaction.count({
        where: {
          walletId: testUser.walletId,
          metadata: { path: ['stripePaymentIntentId'], equals: paymentIntentId }
        }
      });
      expect(txCount).toBe(1);
    });
  });
});

/**
 * TEST VERIFICATION SUMMARY
 * 
 * ✅ CONCURRENT ATTACK TESTED:
 *    - Two simultaneous requests with same PaymentIntent
 *    - Three simultaneous requests (stress test)
 *    - Database constraint prevents double-credit
 * 
 * ✅ NO FALSE POSITIVES:
 *    - Sequential requests with different PaymentIntents succeed
 *    - Legitimate separate payments are not blocked
 * 
 * 🔒 INVARIANT VERIFIED:
 *    - Exactly ONE wallet transaction per unique stripePaymentIntentId
 *    - Database enforces atomically (no application-level race)
 * 
 * 🔍 DIFFERENCE FROM P0-01-OWNERSHIP TEST:
 *    - Original test: await POST(req1); await POST(req2);  ← SEQUENTIAL
 *    - This test: Promise.all([POST(req1), POST(req2)])    ← CONCURRENT
 * 
 * DEPLOYMENT VERIFICATION:
 *    After deploying migration 20260911000000_add_wallet_transaction_payment_intent_unique:
 *    1. Run this test suite
 *    2. Verify all tests pass
 *    3. Check database: SELECT * FROM pg_indexes WHERE indexname LIKE '%stripePaymentIntentId%';
 *    4. Mark P0-01B as CLOSED
 * 
 * EXPECTED BEHAVIOR:
 *    - Before fix: Test FAILS (both requests succeed, txCount = 2)
 *    - After fix: Test PASSES (one succeeds, one fails, txCount = 1)
 */
