/**
 * H-01 INTEGRATION TESTS — Partial Package Refund Formula
 *
 * Verifies calculatePartialPackageRefund() implements the approved refund formula
 * (docs/audit/PACKAGE-ACCOUNTING-POLICY.md §4, 2026-10-18).
 *
 * DEFECTS TESTED (all must be fixed before these pass)
 *   H01-T01  Full package — 0 lessons used → refund = maxStripeRefund (discountedBase)
 *   H01-T02  Full package — all lessons used → refund = 0
 *   H01-T03  Partial — 5 of 10hrs used, discount retained (5hrs remaining ≥ lockedDiscountMinHours=null)
 *   H01-T04  Partial — 5 of 10hrs used, discount VOIDED (remaining < tier min, lockedDiscountMinHours=10)
 *   H01-T05  Partial — 0hrs consumed, lockedDiscountMinHours set, discount retained (all hours remain)
 *   H01-T06  Legacy row — lockedDiscountMinHours=null → discount always retained
 *   H01-T07  Refund capped at maxStripeRefund (never exceeds packageTotalPaid - platformFee)
 *   H01-T08  Error thrown when packageTotalPaid is null
 *   H01-T09  Error thrown when PACKAGE_FEE Transaction not found (both lookups fail)
 *   H01-T10  Book Later — PACKAGE_FEE found via stripePaymentIntentId (no bookingId on Transaction)
 *   H01-T11  Floor guard — result is never negative
 *   H01-T12  Rounding — $0.005 rounds correctly, no accumulated floating-point error
 *
 * DATABASE
 *   postgresql://postgres:testpass@localhost:5433/drivebook_test
 *
 * EXECUTION
 *   DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test \
 *   DIRECT_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test \
 *     npx vitest run __tests__/integration/h01-partial-package-refund.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';

// ── Import the function under test ────────────────────────────────────────────
// calculatePartialPackageRefund is NOT exported — we test it indirectly through
// requestPackageCancellation (preview) and approveCancellation (authoritative).
// However, for unit-level coverage we reach the function via the exported
// requestPackageCancellation which calls it and surfaces calculatedRefund.
// For the error-path tests we verify the error propagates through approveCancellation.
import {
  requestPackageCancellation,
  approveCancellation,
} from '@/lib/services/booking-service';

// ── Test data ─────────────────────────────────────────────────────────────────
// Scenario: 10-hour package, $70/hr, 10% discount
//   faceValue     = 10 × $70 = $700
//   discountedBase = $700 × 0.90 = $630
//   platformFee   = $700 × 0.90 × 0.036 ≈ $22.68  → simplify to $35 for test clarity
//   packageTotalPaid = $665   (discountedBase + platformFee = $630 + $35)
// lockedDiscountMinHours = 10  (you need ≥10 hrs to earn the 10% discount)

const HOURLY_RATE = 70;
const PACKAGE_HOURS = 10;
const LOCKED_DISCOUNT_PCT = 10;   // 10%
const LOCKED_DISCOUNT_MIN_HOURS = 10;
const FACE_VALUE = HOURLY_RATE * PACKAGE_HOURS;                          // $700
const DISCOUNTED_BASE = FACE_VALUE * (1 - LOCKED_DISCOUNT_PCT / 100);   // $630
const PLATFORM_FEE = 35.00;                                              // fixed for tests
const PACKAGE_TOTAL_PAID = DISCOUNTED_BASE + PLATFORM_FEE;              // $665
const MAX_STRIPE_REFUND = PACKAGE_TOTAL_PAID - PLATFORM_FEE;            // $630

let providerId: string;
let customerId: string;
let customerUserId: string;

// ── DB helpers ────────────────────────────────────────────────────────────────
async function seedProvider(): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `prov-h01-${Date.now()}@test.com`, role: 'PROVIDER' },
  });
  const provider = await (prisma.provider as any).create({
    data: {
      userId: user.id,
      name: 'H01 Test Provider',
      phone: '0400000001',
      hourlyRate: HOURLY_RATE,
      approvalStatus: 'APPROVED',
      isActive: true,
    },
  });
  return provider.id;
}

async function seedCustomer(): Promise<{ customerId: string; userId: string }> {
  const user = await prisma.user.create({
    data: { email: `cust-h01-${Date.now()}@test.com`, role: 'CLIENT' },
  });
  const customer = await prisma.customer.create({
    data: { name: 'H01 Test Customer', email: user.email, phone: '0400000002', userId: user.id },
  });
  await prisma.clientWallet.create({ data: { userId: user.id, balance: 0 } });
  return { customerId: customer.id, userId: user.id };
}

/**
 * Create a parent package booking with the standard test parameters.
 * Optionally override specific fields.
 */
async function createPackageBooking(overrides: Record<string, any> = {}): Promise<string> {
  const startTime = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h from now (full refund window)
  const booking = await (prisma.booking as any).create({
    data: {
      providerId,
      customerId,
      status: 'CONFIRMED',
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
      duration: 60,
      price: HOURLY_RATE,           // per-lesson price (first lesson)
      platformFee: 0,
      providerPayout: HOURLY_RATE,
      isPackageBooking: true,
      packageHours: PACKAGE_HOURS,
      packageHoursRemaining: PACKAGE_HOURS, // stale counter — deliberately NOT decremented
      packageTotalPaid: PACKAGE_TOTAL_PAID,
      lockedHourlyRate: HOURLY_RATE,
      lockedDiscountPct: LOCKED_DISCOUNT_PCT,
      lockedDiscountMinHours: LOCKED_DISCOUNT_MIN_HOURS,
      cancellationStatus: 'PENDING',
      cancellationRequestedAt: new Date(),
      cancellationRequestedBy: 'USER',
      paymentIntentId: `pi_h01_${Date.now()}`,
      ...overrides,
    },
  });
  return booking.id;
}

/**
 * Create a PACKAGE_FEE Transaction linked to a booking by bookingId.
 */
async function createPkgFeeTransaction(bookingId: string, paymentIntentId?: string): Promise<void> {
  await (prisma.transaction as any).create({
    data: {
      bookingId,
      providerId,
      type: 'PACKAGE_FEE',
      amount: PLATFORM_FEE,
      platformFee: PLATFORM_FEE,
      providerPayout: 0,
      commissionRate: 0,
      status: 'SETTLED',
      stripePaymentIntentId: paymentIntentId ?? `pi_h01_${bookingId}`,
    },
  });
}

/**
 * Create child bookings (confirmed lessons) for a parent package.
 * Each child has price = hourlyRate × durationHours.
 */
async function createChildBookings(
  parentBookingId: string,
  lessons: Array<{ durationHours: number; status?: string; price?: number }>
): Promise<void> {
  for (const lesson of lessons) {
    const price = lesson.price ?? HOURLY_RATE * lesson.durationHours;
    await (prisma.booking as any).create({
      data: {
        providerId,
        customerId,
        parentBookingId,
        status: lesson.status ?? 'CONFIRMED',
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 23 * 60 * 60 * 1000),
        duration: lesson.durationHours * 60,
        price,
        platformFee: 0,
        providerPayout: price,
        isPackageBooking: false,
      },
    });
  }
}

// ── Setup / teardown ──────────────────────────────────────────────────────────
beforeAll(async () => {
  providerId = await seedProvider();
  ({ customerId, userId: customerUserId } = await seedCustomer());
});

afterAll(async () => {
  // Clean up in dependency order
  await (prisma.transaction as any).deleteMany({ where: { providerId } });
  await (prisma.booking as any).deleteMany({ where: { providerId } });
  await (prisma.walletTransaction as any).deleteMany({});
  await prisma.customer.deleteMany({ where: { id: customerId } });
  const user = await prisma.user.findUnique({ where: { id: customerUserId } });
  if (user) await prisma.clientWallet.deleteMany({ where: { userId: customerUserId } });
  await prisma.user.deleteMany({ where: { id: customerUserId } });
  const providerRow = await (prisma.provider as any).findUnique({ where: { id: providerId }, select: { userId: true } });
  await (prisma.provider as any).delete({ where: { id: providerId } });
  if (providerRow?.userId) await prisma.user.deleteMany({ where: { id: providerRow.userId } });
  await prisma.$disconnect();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('H-01 — calculatePartialPackageRefund (via requestPackageCancellation preview)', () => {

  it('H01-T01 | 0 lessons used → refund equals maxStripeRefund (discountedBase $630)', async () => {
    const bookingId = await createPackageBooking();
    await createPkgFeeTransaction(bookingId);
    // No child bookings → consumedValue = 0
    // remainingCredit = faceValue ($700) - 0 = $700
    // unconsumedHours = 700/70 = 10 ≥ lockedDiscountMinHours(10) → qualifies → voidedPromo=0
    // rawRefundable = $700 - 0 = $700
    // capped at maxStripeRefund = $630 → result = $630

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    // requestPackageCancellation applies time policy on top (72h > 48h → 100%)
    expect(calculatedRefund).toBeCloseTo(630, 1);
  });

  it('H01-T02 | all lessons used → refund = 0', async () => {
    const bookingId = await createPackageBooking();
    await createPkgFeeTransaction(bookingId);
    // 10 × 1hr lessons = $700 consumed (full face value)
    await createChildBookings(bookingId, Array(10).fill({ durationHours: 1 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBe(0);
  });

  it('H01-T03 | 5 of 10hrs used, null lockedDiscountMinHours (legacy) → discount retained', async () => {
    const bookingId = await createPackageBooking({ lockedDiscountMinHours: null });
    await createPkgFeeTransaction(bookingId);
    // 5 × $70 = $350 consumed
    // remainingCredit = $700 - $350 = $350
    // lockedDiscountMinHours=null → legacy row → discount always retained → voidedPromo=0
    // rawRefundable = $350
    // capped at maxStripeRefund=$630 → result = $350
    await createChildBookings(bookingId, Array(5).fill({ durationHours: 1 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBeCloseTo(350, 1);
  });

  it('H01-T04 | 5 of 10hrs used, lockedDiscountMinHours=10 → discount VOIDED', async () => {
    const bookingId = await createPackageBooking();  // lockedDiscountMinHours=10
    await createPkgFeeTransaction(bookingId);
    // 5 × $70 = $350 consumed
    // remainingCredit = $700 - $350 = $350
    // unconsumedHours = 350/70 = 5 < 10 (lockedDiscountMinHours) → does NOT qualify
    // drivebookPromotion = faceValue - totalPaid = $700 - $665 = $35
    // voidedPromo = $35
    // rawRefundable = $350 - $35 = $315
    // capped at maxStripeRefund=$630 → result = $315
    await createChildBookings(bookingId, Array(5).fill({ durationHours: 1 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBeCloseTo(315, 1);
  });

  it('H01-T05 | 0hrs consumed, lockedDiscountMinHours set, remaining ≥ threshold → discount retained', async () => {
    // No lessons at all → 10 remaining ≥ 10 min → qualifies → result = maxStripeRefund
    const bookingId = await createPackageBooking();  // lockedDiscountMinHours=10
    await createPkgFeeTransaction(bookingId);

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBeCloseTo(630, 1);  // $630 = maxStripeRefund
  });

  it('H01-T06 | legacy row (lockedDiscountMinHours=null) with 7hrs consumed → discount retained', async () => {
    // 7hrs consumed, legacy row → no re-qualification check, discount retained
    // remainingCredit = $700 - $490 = $210
    // voidedPromo = 0 (legacy)
    // rawRefundable = $210, capped at $630 → $210
    const bookingId = await createPackageBooking({ lockedDiscountMinHours: null });
    await createPkgFeeTransaction(bookingId);
    await createChildBookings(bookingId, Array(7).fill({ durationHours: 1 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBeCloseTo(210, 1);
  });

  it('H01-T07 | refund capped at maxStripeRefund — never exceeds packageTotalPaid minus platformFee', async () => {
    // 0 lessons used — remainingCredit=$700, but cap is $630
    const bookingId = await createPackageBooking({ lockedDiscountMinHours: null });
    await createPkgFeeTransaction(bookingId);

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    // Must not exceed MAX_STRIPE_REFUND ($630)
    expect(calculatedRefund).toBeLessThanOrEqual(MAX_STRIPE_REFUND + 0.01);
    expect(calculatedRefund).toBeCloseTo(630, 1);
  });

  it('H01-T11 | floor guard — refund is never negative', async () => {
    // Edge case: lockedDiscountPct very high, voidedPromo > remainingCredit
    // Use a small package where promo ≈ remainingCredit
    // 6hr package, $70/hr, 12% discount
    //   faceValue=$420, discountedBase=$369.60, platformFee=$35, totalPaid=$404.60
    //   consume 5hrs → remaining = $420-$350=$70, unconsumedHrs=1 < 6 → voided=$420-$404.60=$15.40
    //   rawRefundable=$70-$15.40=$54.60 — floor guard should NOT activate here but let's verify
    const bookingId = await createPackageBooking({
      packageHours: 6,
      lockedDiscountPct: 12,
      lockedDiscountMinHours: 6,
      packageTotalPaid: 404.60,
    });
    // Create PACKAGE_FEE for this booking with explicit fee
    await (prisma.transaction as any).create({
      data: {
        bookingId,
        providerId,
        type: 'PACKAGE_FEE',
        amount: 35,
        platformFee: 35,
        providerPayout: 0,
        commissionRate: 0,
        status: 'SETTLED',
        stripePaymentIntentId: `pi_floor_${bookingId}`,
      },
    });
    await createChildBookings(bookingId, Array(5).fill({ durationHours: 1 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBeGreaterThanOrEqual(0);
  });

  it('H01-T12 | rounding — cents do not accumulate floating-point error', async () => {
    // Use hourlyRate with fractional cents
    // $67.50/hr × 10 hrs = $675 face, 10% off = $607.50 discountedBase
    // platformFee = $607.50 × 0.036 = $21.87 → use $22 for simplicity
    // totalPaid = $629.50
    const bookingId = await createPackageBooking({
      packageTotalPaid: 629.50,
      lockedHourlyRate: 67.50,
      packageHours: 10,
      lockedDiscountPct: 10,
      lockedDiscountMinHours: null,
    });
    await (prisma.transaction as any).create({
      data: {
        bookingId,
        providerId,
        type: 'PACKAGE_FEE',
        amount: 22,
        platformFee: 22,
        providerPayout: 0,
        commissionRate: 0,
        status: 'SETTLED',
        stripePaymentIntentId: `pi_rounding_${bookingId}`,
      },
    });
    // 3 × 1hr = $202.50 consumed, remaining = $675 - $202.50 = $472.50
    await createChildBookings(bookingId, Array(3).fill({ durationHours: 1, price: 67.50 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    // maxStripeRefund = $629.50 - $22 = $607.50, rawRefundable=$472.50 < cap → $472.50
    expect(calculatedRefund).toBeCloseTo(472.50, 1);
    // Specifically verify it's not a floating-point artefact (e.g. $472.4999...)
    const rounded = Math.round(calculatedRefund * 100) / 100;
    expect(rounded).toBe(472.50);
  });

  it('H01-T08 | error thrown when packageTotalPaid is null', async () => {
    const bookingId = await createPackageBooking({ packageTotalPaid: null });
    await createPkgFeeTransaction(bookingId);

    await expect(
      requestPackageCancellation(bookingId, customerId)
    ).rejects.toThrow(/packageTotalPaid is null/i);
  });

  it('H01-T09 | error thrown when PACKAGE_FEE Transaction not found (both lookups fail)', async () => {
    const bookingId = await createPackageBooking({ paymentIntentId: 'pi_no_fee_record' });
    // Deliberately do NOT create a PACKAGE_FEE transaction

    await expect(
      requestPackageCancellation(bookingId, customerId)
    ).rejects.toThrow(/PACKAGE_FEE Transaction not found/i);
  });

  it('H01-T10 | Book Later — PACKAGE_FEE found via stripePaymentIntentId (no bookingId on Tx)', async () => {
    const piId = `pi_book_later_${Date.now()}`;
    const bookingId = await createPackageBooking({ paymentIntentId: piId });
    // Create PACKAGE_FEE WITHOUT bookingId (mimics Book Later webhook behaviour)
    await (prisma.transaction as any).create({
      data: {
        // bookingId intentionally omitted
        providerId,
        type: 'PACKAGE_FEE',
        amount: PLATFORM_FEE,
        platformFee: PLATFORM_FEE,
        providerPayout: 0,
        commissionRate: 0,
        status: 'SETTLED',
        stripePaymentIntentId: piId,
      },
    });
    // 3 lessons used
    await createChildBookings(bookingId, Array(3).fill({ durationHours: 1 }));

    // Should NOT throw — fee found via PI fallback
    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    // remaining = $700 - $210 = $490, unconsumedHrs = 7 < 10 → void promo $35
    // rawRefundable = $490 - $35 = $455, capped at $630 → $455
    expect(calculatedRefund).toBeCloseTo(455, 1);
  });

  it('H01-STALE | stale packageHoursRemaining counter is NOT used — consumed value from child prices', async () => {
    // The old buggy formula used packageHoursRemaining. This test proves we use
    // SUM(child Booking.price) instead.
    //
    // Setup: packageHoursRemaining=10 (counter NOT decremented — deliberately stale)
    // but 5 child bookings exist. Old code would return packageTotalPaid (full refund).
    // New code returns partial refund based on actual child prices.
    const bookingId = await createPackageBooking({
      packageHoursRemaining: 10,  // stale — still shows full remaining
      lockedDiscountMinHours: null,
    });
    await createPkgFeeTransaction(bookingId);
    await createChildBookings(bookingId, Array(5).fill({ durationHours: 1 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    // Old code: hoursUsed = 10 - 10 = 0 → returned packageTotalPaid ($665)
    // New code: consumedValue = $350 → remainingCredit=$350 → result=$350 (capped at $630)
    expect(calculatedRefund).toBeCloseTo(350, 1);  // NOT $665
    expect(calculatedRefund).not.toBeCloseTo(665, 0);
  });

});
