/**
 * FinancialLedger Atomicity Integration Test
 * 
 * CRITICAL TEST: Verifies transaction rollback on ledger failure
 * 
 * This test proves that if recordWalletCredit() fails, the entire
 * webhook transaction (including wallet confirmation) rolls back.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:DEBE@localhost:5432/drivebook_test',
    },
  },
});

describe('FinancialLedger Atomicity - Rollback Verification', () => {
  let testUserId: string;
  let testWalletId: string;

  beforeAll(async () => {
    // Create test user and wallet
    const user = await prisma.user.create({
      data: {
        email: `ledger-test-${Date.now()}@test.com`,
        name: 'Ledger Test User',
        role: 'CLIENT',
      },
    });
    testUserId = user.id;

    const wallet = await prisma.clientWallet.create({
      data: { userId: testUserId },
    });
    testWalletId = wallet.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.walletTransaction.deleteMany({ where: { walletId: testWalletId } });
    await prisma.clientWallet.delete({ where: { id: testWalletId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  it('should rollback wallet confirmation if ledger recording fails', async () => {
    // Test approach: Create a scenario where ledger recording will fail
    // (e.g., duplicate idempotency key) and verify wallet transaction rolls back

    const paymentIntentId = `pi_test_rollback_${Date.now()}`;
    
    // Step 1: Pre-create a ledger entry with the idempotency key that will be used
    // This will cause the second attempt to fail with duplicate key error
    await prisma.financialLedger.create({
      data: {
        debitAccount: 'STRIPE_CLEARING:platform',
        creditAccount: `CLIENT_WALLET:${testUserId}`,
        amount: 100,
        description: 'Pre-existing entry to force duplicate',
        idempotencyKey: `wallet-credit-${paymentIntentId}`,
        userId: testUserId,
        createdBy: 'TEST_SETUP',
        metadata: {},
      },
    });

    // Step 2: Attempt to create wallet transaction + ledger entry
    // This should fail and rollback
    let errorOccurred = false;
    try {
      await prisma.$transaction(async (tx) => {
        // Create wallet transaction (would be CONFIRMED)
        const walletTx = await tx.walletTransaction.create({
          data: {
            walletId: testWalletId,
            type: 'CREDIT',
            amount: 100,
            description: 'Test credit',
            status: 'CONFIRMED',
            metadata: { stripePaymentIntentId: paymentIntentId },
          },
        });

        // Try to create ledger entry - will fail due to duplicate idempotency key
        const { recordWalletCredit } = await import('@/lib/services/ledger-operations');
        await recordWalletCredit({
          walletTransactionId: walletTx.id,
          userId: testUserId,
          amount: 100,
          stripePaymentIntentId: paymentIntentId,
          createdBy: 'TEST',
          txClient: tx, // Pass transaction client
        });

        // If we get here, the test failed (should have thrown)
      });
    } catch (error: any) {
      errorOccurred = true;
      expect(error.message).toContain('Duplicate ledger entry detected');
    }

    // Verify error occurred
    expect(errorOccurred).toBe(true);

    // Step 3: CRITICAL VERIFICATION - Wallet transaction should NOT exist
    // If atomicity works, the wallet transaction was rolled back
    const walletTxs = await prisma.walletTransaction.findMany({
      where: {
        walletId: testWalletId,
        metadata: { path: ['stripePaymentIntentId'], equals: paymentIntentId },
      },
    });

    expect(walletTxs).toHaveLength(0); // ✅ Transaction rolled back!

    // Step 4: Verify only the pre-existing ledger entry exists (from setup)
    const ledgerEntries = await prisma.financialLedger.findMany({
      where: { idempotencyKey: `wallet-credit-${paymentIntentId}` },
    });

    expect(ledgerEntries).toHaveLength(1); // Only the setup entry
    expect(ledgerEntries[0].createdBy).toBe('TEST_SETUP');

    // Cleanup the pre-existing entry
    await prisma.financialLedger.delete({
      where: { id: ledgerEntries[0].id },
    });
  });

  it('should commit both wallet and ledger when successful', async () => {
    // Positive test: Both should commit together
    const paymentIntentId = `pi_test_success_${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      // Create wallet transaction
      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: testWalletId,
          type: 'CREDIT',
          amount: 50,
          description: 'Test credit success',
          status: 'CONFIRMED',
          metadata: { stripePaymentIntentId: paymentIntentId },
        },
      });

      // Create ledger entry - should succeed
      const { recordWalletCredit } = await import('@/lib/services/ledger-operations');
      await recordWalletCredit({
        walletTransactionId: walletTx.id,
        userId: testUserId,
        amount: 50,
        stripePaymentIntentId: paymentIntentId,
        createdBy: 'TEST',
        txClient: tx,
      });
    });

    // Verify both committed
    const walletTx = await prisma.walletTransaction.findFirst({
      where: {
        walletId: testWalletId,
        metadata: { path: ['stripePaymentIntentId'], equals: paymentIntentId },
      },
    });
    expect(walletTx).toBeTruthy();
    expect(walletTx?.status).toBe('CONFIRMED');

    const ledgerEntry = await prisma.financialLedger.findFirst({
      where: { idempotencyKey: `wallet-credit-${paymentIntentId}` },
    });
    expect(ledgerEntry).toBeTruthy();
    expect(Number(ledgerEntry?.amount)).toBe(50);

    // Cleanup
    await prisma.financialLedger.delete({ where: { id: ledgerEntry!.id } });
    await prisma.walletTransaction.delete({ where: { id: walletTx!.id } });
  });
});
