/**
 * PH5-SCH-22b: Admin payout recovery — PostgreSQL integration tests
 *
 * Tests the service-layer behaviour against a real PostgreSQL database.
 *
 * Run against Japan test instance:
 *   TEST_DATABASE_URL=postgresql://postgres.zzntmozvppyzeaqautpi:...
 *   npx vitest run __tests__/integration/ph5-sch22b-admin-payout-recovery.test.ts
 *
 * Coverage:
 *   EV-R-CLAIM  — release with wrong claimToken → throws, payout unchanged
 *   EV-R-MATCH  — release with correct claimToken → FAILED, funds returned
 *   CLAIM1      — concurrent complete: exactly one succeeds, ledger written once
 *   CLAIM2      — stale worker cannot release another worker's reservation
 *   FIN1        — complete: totalPayoutReserved → 0, totalPaidOut incremented exactly once
 *   FIN2        — release: totalPayoutReserved decremented, payout FAILED, all fields cleared
 *   DUP1        — duplicate complete → second call throws "already completed"
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// ── Establish test database before mocking ────────────────────────────────────
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL || 'postgresql://postgres:DEBE@localhost:5433/drivebook_migrate_clean' },
  },
});

const dbUrl = process.env.DATABASE_URL || '';
if (['jflrqxigfiiqednfacuf'].some(h => dbUrl.includes(h))) {
  throw new Error('DATABASE_URL points at Sydney production — refusing to run');
}

// Mock Stripe so ledger-service → payout-service import chain doesn't fail
vi.mock('stripe', () => ({
  default: vi.fn(() => ({ transfers: { create: vi.fn(), retrieve: vi.fn() }, accounts: { retrieve: vi.fn() } })),
  errors: { StripeError: class extends Error {}, StripeConnectionError: class extends Error {}, StripeAPIError: class extends Error {} },
}));

// Mock @/lib/prisma AFTER prisma is in scope — forks pool does not hoist
vi.mock('@/lib/prisma', () => ({ prisma }));

// Dynamic import AFTER mock registration so services pick up the mocked prisma
const { releasePayoutReservation, commitPayoutCompletion } =
  await import('@/lib/services/ledger-service');

// ── Helpers ───────────────────────────────────────────────────────────────────
const TEST_TAG = `sch22b_${Date.now()}`;

async function createProvider(tag: string) {
  const user = await prisma.user.create({
    data: { email: `${tag}@test.invalid`, name: `Test ${tag}`, role: 'PROVIDER' },
  });
  const provider = await prisma.provider.create({
    data: {
      userId: user.id,
      name: `Test ${tag}`,
      phone: `+6140000${Math.floor(Math.random() * 90000) + 10000}`,
      hourlyRate: 80,
      payoutMethod: 'stripe_connect',
      stripeAccountId: `acct_test_${tag}`,
      chargesEnabled: true,
      payoutsEnabled: true,
      withholdingTaxRate: 0,
    },
  });
  return { user, provider };
}

async function createProcessingPayoutWithReservation(
  providerId: string,
  netAmount: number,
  tag: string,
  opts?: { claimToken?: string; claimExpiresAt?: Date },
) {
  const payoutRef = `PAY-${tag.toUpperCase().slice(-8)}-${Math.floor(Math.random() * 9000) + 1000}`;
  const idempotencyKey = `test_idem_${tag}_${Math.random().toString(36).slice(2)}`;
  const reservationId = `RES_${tag}_${Date.now()}`;

  const payout = await prisma.payout.create({
    data: {
      providerId,
      status: 'PROCESSING',
      grossAmount: netAmount,
      taxWithheld: 0,
      gstAmount: 0,
      netAmount,
      payoutMethod: 'stripe_connect',
      stripeAccountId: `acct_test_${tag}`,
      idempotencyKey,
      payoutRef,
      reservedAt: new Date(),
      reservedAmount: netAmount,
      reservationId,
      recoveryClaimToken: opts?.claimToken ?? null,
      recoveryClaimExpiresAt: opts?.claimExpiresAt ?? null,
    },
  });

  // Ensure PlatformLedger exists and reflect the reservation
  await prisma.platformLedger.upsert({
    where: { key: 'default' },
    create: {
      key: 'default',
      totalCollected: 10000,
      totalPaidOut: 0,
      totalRefunded: 0,
      totalReserved: 0,
      totalTaxWithheld: 0,
      totalPayoutReserved: netAmount,
    },
    update: {
      totalPayoutReserved: { increment: netAmount },
    },
  });

  return payout;
}

async function getLedger() {
  const l = await prisma.platformLedger.findUnique({ where: { key: 'default' } });
  return {
    totalPaidOut: Number(l?.totalPaidOut ?? 0),
    totalPayoutReserved: Number(l?.totalPayoutReserved ?? 0),
  };
}

// ── Shared cleanup state ──────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// EV-R | Release claim-token enforcement
// ═══════════════════════════════════════════════════════════════════════════════

describe('EV-R | releasePayoutReservation claim-token enforcement', () => {
  let provider: Awaited<ReturnType<typeof createProvider>>;

  beforeAll(async () => {
    provider = await createProvider(`${TEST_TAG}_evr`);
    createdProviders.push({ providerId: provider.provider.id, userId: provider.user.id });
  });

  it('EV-R-CLAIM | wrong token → throws, payout unchanged, ledger unchanged', async () => {
    const payout = await createProcessingPayoutWithReservation(
      provider.provider.id, 300, `${TEST_TAG}_evrc`,
      { claimToken: 'correct-token', claimExpiresAt: new Date(Date.now() + 600_000) },
    );
    createdPayoutIds.push(payout.id);

    const ledgerBefore = await getLedger();

    // Wrong token — should throw
    await expect(
      releasePayoutReservation(payout.id, 300, 'test release', 'wrong-token'),
    ).rejects.toThrow(/claim no longer owned/i);

    // Payout unchanged
    const unchanged = await prisma.payout.findUnique({ where: { id: payout.id } });
    expect(unchanged?.status).toBe('PROCESSING');
    expect(unchanged?.reservedAt).not.toBeNull();

    // Ledger unchanged
    const ledgerAfter = await getLedger();
    expect(ledgerAfter.totalPayoutReserved).toBe(ledgerBefore.totalPayoutReserved);
  });

  it('EV-R-MATCH | correct token → FAILED, reservation cleared, funds returned', async () => {
    const claimToken = 'correct-token-match';
    const payout = await createProcessingPayoutWithReservation(
      provider.provider.id, 300, `${TEST_TAG}_evrm`,
      { claimToken, claimExpiresAt: new Date(Date.now() + 600_000) },
    );
    createdPayoutIds.push(payout.id);

    const ledgerBefore = await getLedger();

    await releasePayoutReservation(payout.id, 300, 'verified no transfer', claimToken);

    // Payout FAILED, all reservation fields cleared
    const released = await prisma.payout.findUnique({ where: { id: payout.id } });
    expect(released?.status).toBe('FAILED');
    expect(released?.reservedAt).toBeNull();
    expect(released?.reservedAmount).toBeNull();
    expect(released?.reservationId).toBeNull();
    expect(released?.recoveryClaimToken).toBeNull();
    expect(released?.recoveryClaimExpiresAt).toBeNull();

    // Funds returned
    const ledgerAfter = await getLedger();
    expect(ledgerAfter.totalPayoutReserved).toBe(ledgerBefore.totalPayoutReserved - 300);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLAIM | Concurrent recovery claim tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('CLAIM | Concurrent recovery claim enforcement', () => {
  let provider: Awaited<ReturnType<typeof createProvider>>;

  beforeAll(async () => {
    provider = await createProvider(`${TEST_TAG}_claim`);
    createdProviders.push({ providerId: provider.provider.id, userId: provider.user.id });
  });

  it('CLAIM2 | Stale worker cannot release another worker\'s reservation', async () => {
    const activeToken = `active-${Math.random().toString(36).slice(2)}`;
    const staleToken  = `stale-${Math.random().toString(36).slice(2)}`;

    const payout = await createProcessingPayoutWithReservation(
      provider.provider.id, 300, `${TEST_TAG}_cl2`,
      { claimToken: activeToken, claimExpiresAt: new Date(Date.now() + 600_000) },
    );
    createdPayoutIds.push(payout.id);

    const ledgerBefore = await getLedger();

    // Stale token → rejected
    await expect(
      releasePayoutReservation(payout.id, 300, 'stale release attempt', staleToken),
    ).rejects.toThrow(/claim no longer owned/i);

    // Ledger and payout unchanged
    const ledgerAfter = await getLedger();
    expect(ledgerAfter.totalPayoutReserved).toBe(ledgerBefore.totalPayoutReserved);

    const unchanged = await prisma.payout.findUnique({ where: { id: payout.id } });
    expect(unchanged?.status).toBe('PROCESSING');
    expect(unchanged?.recoveryClaimToken).toBe(activeToken);
  });

  it('CLAIM1 | Concurrent complete: exactly one succeeds, ledger written once', async () => {
    const payout = await createProcessingPayoutWithReservation(
      provider.provider.id, 300, `${TEST_TAG}_cl1`,
    );
    createdPayoutIds.push(payout.id);

    const ledgerBefore = await getLedger();

    // Two concurrent completion attempts (no claim token — no ownership enforcement on this path)
    const [r1, r2] = await Promise.allSettled([
      commitPayoutCompletion({
        payoutId: payout.id,
        stripeTransferId: 'tr_cl1_concurrent_a',
        payout: { netAmount: 300, grossAmount: 300, taxWithheld: 0, payoutRef: payout.payoutRef, providerId: payout.providerId },
        txCount: 1, adminUserId: 'admin_cl1', path: 'stripe',
      }),
      commitPayoutCompletion({
        payoutId: payout.id,
        stripeTransferId: 'tr_cl1_concurrent_b',
        payout: { netAmount: 300, grossAmount: 300, taxWithheld: 0, payoutRef: payout.payoutRef, providerId: payout.providerId },
        txCount: 1, adminUserId: 'admin_cl1', path: 'stripe',
      }),
    ]);

    // Exactly one succeeds
    const succeeded = [r1, r2].filter(r => r.status === 'fulfilled');
    expect(succeeded.length).toBe(1);

    // Payout PAID exactly once
    const finalPayout = await prisma.payout.findUnique({ where: { id: payout.id } });
    expect(finalPayout?.status).toBe('PAID');

    // LedgerEntry written exactly once
    const entries = await prisma.ledgerEntry.findMany({
      where: { referenceId: payout.id, type: 'PAYOUT_PAID' },
    });
    expect(entries.length).toBe(1);

    // totalPayoutReserved decremented exactly once
    const ledgerAfter = await getLedger();
    expect(ledgerAfter.totalPayoutReserved).toBe(ledgerBefore.totalPayoutReserved - 300);
    expect(ledgerAfter.totalPaidOut).toBe(ledgerBefore.totalPaidOut + 300);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FIN | Financial atomicity
// ═══════════════════════════════════════════════════════════════════════════════

describe('FIN | Financial atomicity', () => {
  let provider: Awaited<ReturnType<typeof createProvider>>;

  beforeAll(async () => {
    provider = await createProvider(`${TEST_TAG}_fin`);
    createdProviders.push({ providerId: provider.provider.id, userId: provider.user.id });
  });

  it('FIN1 | Complete: totalPayoutReserved decremented, totalPaidOut incremented, LedgerEntry written', async () => {
    const payout = await createProcessingPayoutWithReservation(
      provider.provider.id, 400, `${TEST_TAG}_fin1`,
    );
    createdPayoutIds.push(payout.id);

    const before = await getLedger();

    await commitPayoutCompletion({
      payoutId: payout.id,
      stripeTransferId: 'tr_fin1_test',
      payout: { netAmount: 400, grossAmount: 400, taxWithheld: 0, payoutRef: payout.payoutRef, providerId: payout.providerId },
      txCount: 1, adminUserId: 'admin_fin1', path: 'stripe',
    });

    const after = await getLedger();
    expect(after.totalPayoutReserved).toBe(before.totalPayoutReserved - 400);
    expect(after.totalPaidOut).toBe(before.totalPaidOut + 400);

    const entry = await prisma.ledgerEntry.findFirst({
      where: { referenceId: payout.id, type: 'PAYOUT_PAID' },
    });
    expect(entry).not.toBeNull();
    expect(Number(entry!.amount)).toBe(-400);
  });

  it('FIN2 | Release: totalPayoutReserved decremented, payout FAILED, all fields cleared', async () => {
    const claimToken = `fin2-${Math.random().toString(36).slice(2)}`;
    const payout = await createProcessingPayoutWithReservation(
      provider.provider.id, 350, `${TEST_TAG}_fin2`,
      { claimToken, claimExpiresAt: new Date(Date.now() + 600_000) },
    );
    createdPayoutIds.push(payout.id);

    const before = await getLedger();

    await releasePayoutReservation(payout.id, 350, 'No transfer — admin verified', claimToken);

    const after = await getLedger();
    expect(after.totalPayoutReserved).toBe(before.totalPayoutReserved - 350);
    expect(after.totalPaidOut).toBe(before.totalPaidOut); // unchanged

    const released = await prisma.payout.findUnique({ where: { id: payout.id } });
    expect(released?.status).toBe('FAILED');
    expect(released?.reservedAt).toBeNull();
    expect(released?.reservedAmount).toBeNull();
    expect(released?.reservationId).toBeNull();
    expect(released?.recoveryClaimToken).toBeNull();
  });

  it('DUP1 | Duplicate complete → second call throws "already completed"', async () => {
    const payout = await createProcessingPayoutWithReservation(
      provider.provider.id, 250, `${TEST_TAG}_dup1`,
    );
    createdPayoutIds.push(payout.id);

    const args = {
      payoutId: payout.id,
      stripeTransferId: 'tr_dup1_test',
      payout: { netAmount: 250, grossAmount: 250, taxWithheld: 0, payoutRef: payout.payoutRef, providerId: payout.providerId },
      txCount: 1, adminUserId: 'admin_dup1', path: 'stripe' as const,
    };

    // First succeeds
    await expect(commitPayoutCompletion(args)).resolves.toBeUndefined();

    // Second rejects — payout is now PAID, reservation gone
    await expect(commitPayoutCompletion(args)).rejects.toThrow(/already completed|reservation missing/i);
  });
});
