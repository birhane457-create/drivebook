/**
 * PH5-SCH-22b ROLL3: Audit failure through the actual recovery route endpoint
 *
 * This test calls the real POST /api/admin/payouts/[payoutId]/recover endpoint
 * and injects an AuditLog write failure by intercepting prisma.$transaction.
 * It proves that the production recovery code path — the route's own
 * payout.updateMany, platformLedger.update, ledgerEntry.create — rolls back
 * when auditLog.create fails inside the same transaction.
 *
 * Separate file to avoid mock interference with the main PH5-SCH-22b test suite.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

const TEST_DB_URL = process.env.DATABASE_URL || '';
if (['jflrqxigfiiqednfacuf'].some(h => TEST_DB_URL.includes(h))) {
  throw new Error('DATABASE_URL points at Sydney production — refusing to run');
}

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

// Mock Stripe so the payout-service import chain doesn't fail
vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    transfers: { create: vi.fn(), retrieve: vi.fn() },
    accounts: { retrieve: vi.fn() },
  })),
  errors: { StripeError: class extends Error {}, StripeConnectionError: class extends Error {}, StripeAPIError: class extends Error {} },
}));

vi.mock('@/lib/prisma', () => ({ prisma }));

// Mock next-auth session
vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth');
  return { ...actual, getServerSession: vi.fn().mockResolvedValue({ user: { id: 'admin_roll3', role: 'ADMIN' } }) };
});

// Mock requirePermission to allow our test admin
vi.mock('@/lib/auth/requireRole', () => ({ requirePermission: vi.fn().mockResolvedValue(null) }));

// Mock SMS and email services
vi.mock('@/lib/services/sms', () => ({ smsService: { sendSMS: vi.fn() } }));
vi.mock('@/lib/services/email', () => ({ emailService: { sendGenericEmail: vi.fn() } }));

// Import route handler AFTER mocks so it picks them up
const { POST: recoverRoute } = await import('@/app/api/admin/payouts/[payoutId]/recover/route');

const TEST_TAG = `sch22b_roll3_${Date.now()}`;

async function createProvider(tag: string) {
  const user = await prisma.user.create({
    data: { email: `${tag}@test.invalid`, name: `Test ${tag}`, role: 'PROVIDER' },
  });
  const provider = await prisma.provider.create({
    data: {
      userId: user.id, name: `Test ${tag}`, phone: `+6140000${Math.floor(Math.random() * 90000) + 10000}`,
      hourlyRate: 80, payoutMethod: 'stripe_connect',
      stripeAccountId: `acct_test_${tag}`, chargesEnabled: true, payoutsEnabled: true,
      withholdingTaxRate: 0,
    },
  });
  return { user, provider };
}

const createdProviders: Array<{ providerId: string; userId: string }> = [];
const createdPayoutIds: string[] = [];

afterAll(async () => {
  if (createdPayoutIds.length) {
    await prisma.payoutTransaction.deleteMany({ where: { payoutId: { in: createdPayoutIds } } });
    await prisma.ledgerEntry.deleteMany({ where: { referenceId: { in: createdPayoutIds } } });
    await prisma.auditLog.deleteMany({ where: { targetId: { in: createdPayoutIds }, targetType: 'PAYOUT' } });
    await prisma.payout.deleteMany({ where: { id: { in: createdPayoutIds } } });
  }
  for (const { providerId, userId } of createdProviders) {
    await prisma.provider.deleteMany({ where: { id: providerId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.$disconnect();
}, 60_000);

describe('ROLL3 | Audit failure through actual recovery route endpoint', () => {
  let provider: Awaited<ReturnType<typeof createProvider>>;

  beforeAll(async () => {
    provider = await createProvider(`${TEST_TAG}_p`);
    createdProviders.push({ providerId: provider.provider.id, userId: provider.user.id });
  });

  it('ROLL3 | Route-level audit failure rolls back payout, PlatformLedger, LedgerEntry', async () => {
    const netAmount = 300;
    const stripeAcct = `acct_test_${TEST_TAG}_p`;

    // Create a PROCESSING payout with active reservation
    const payout = await prisma.payout.create({
      data: {
        providerId: provider.provider.id,
        status: 'PROCESSING',
        grossAmount: netAmount, taxWithheld: 0, gstAmount: 0, netAmount,
        payoutMethod: 'stripe_connect',
        stripeAccountId: stripeAcct,
        idempotencyKey: `roll3_idem_${Math.random().toString(36).slice(2)}`,
        payoutRef: `PAY-ROLL3-${Math.floor(Math.random() * 9000) + 1000}`,
        reservedAt: new Date(),
        reservedAmount: netAmount,
        reservationId: `RES_roll3_${Date.now()}`,
      },
    });
    createdPayoutIds.push(payout.id);

    // Ensure ledger reflects the reservation
    await prisma.platformLedger.upsert({
      where: { key: 'default' },
      create: { key: 'default', totalCollected: 100000, totalPaidOut: 0, totalRefunded: 0, totalReserved: 0, totalTaxWithheld: 0, totalPayoutReserved: netAmount },
      update: { totalPayoutReserved: { increment: netAmount } },
    });

    const ledgerBefore = await prisma.platformLedger.findUnique({ where: { key: 'default' } });

    // Intercept prisma.$transaction to inject an AuditLog write failure.
    // The route handler calls $transaction twice:
    //   1st: claim acquisition (payout.update)
    //   2nd: financial completion (payout.updateMany + platformLedger.update + ledgerEntry.create + auditLog.create)
    // We inject the auditLog.create failure on the 2nd call only.
    const originalTransaction = prisma.$transaction.bind(prisma);
    let txCallCount = 0;
    const transactionSpy = vi.spyOn(prisma, '$transaction').mockImplementation(
      async (callback: (tx: any) => Promise<any>) => {
        txCallCount++;
        if (txCallCount !== 2) {
          // First call: claim acquisition — run normally
          return originalTransaction(callback);
        }
        // Second call: financial completion — patch auditLog.create to fail
        return originalTransaction(async (tx: any) => {
          const originalAuditCreate = tx.auditLog.create.bind(tx.auditLog);
          tx.auditLog.create = async (...args: any[]) => {
            const data = args[0]?.data;
            if (data?.action === 'PAYOUT_ADMIN_RECOVERY_COMPLETED') {
              throw Object.assign(
                new Error('Simulated audit write failure — unique constraint violation'),
                { code: 'P2002', meta: { target: ['id'] } },
              );
            }
            return originalAuditCreate(...args);
          };
          return callback(tx);
        });
      },
    );

    // Call the actual recovery endpoint
    const req = new Request(`http://localhost/api/admin/payouts/${payout.id}/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'complete',
        evidence: {
          stripeTransferId: `tr_roll3${Math.random().toString(36).slice(2)}`,
          destinationAccount: stripeAcct,
          transferAmount: netAmount,
          currency: 'aud',
          reason: 'Transfer confirmed in Stripe dashboard for this payout rollback test',
        },
      }),
    });

    const res = await recoverRoute(req as any, { params: { payoutId: payout.id } });
    const body = await res.json();

    // The route returns 500 when the transaction fails internally
    expect(res.status).toBe(500);

    // ⚠️ KEY ASSERTIONS: PostgreSQL rolled back the entire transaction

    // 1. Payout status NOT changed — still PROCESSING with reservation active
    const finalPayout = await prisma.payout.findUnique({ where: { id: payout.id } });
    expect(finalPayout?.status).toBe('PROCESSING');
    expect(finalPayout?.reservedAt).not.toBeNull();
    expect(finalPayout?.stripeTransferId).toBeNull();

    // 2. PlatformLedger counters unchanged
    const ledgerAfter = await prisma.platformLedger.findUnique({ where: { key: 'default' } });
    expect(Number(ledgerAfter!.totalPaidOut)).toBe(Number(ledgerBefore!.totalPaidOut));
    expect(Number(ledgerAfter!.totalPayoutReserved)).toBe(Number(ledgerBefore!.totalPayoutReserved));

    // 3. No LedgerEntry created
    const entries = await prisma.ledgerEntry.findMany({
      where: { referenceId: payout.id, type: 'PAYOUT_PAID' },
    });
    expect(entries.length).toBe(0);

    // 4. Claim released by the error handler so a retry can proceed
    expect(finalPayout?.recoveryClaimToken).toBeNull();

    transactionSpy.mockRestore();
  });
});
