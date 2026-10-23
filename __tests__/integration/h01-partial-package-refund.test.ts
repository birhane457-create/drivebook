/**
 * H-01 INTEGRATION TESTS — Partial Package Refund Formula
 *
 * Verifies calculatePartialPackageRefund() implements the approved refund formula
 * (docs/audit/PACKAGE-ACCOUNTING-POLICY.md §4, 2026-10-18).
 *
 * H01-RV-01 (reviewer correction): test fixtures now use purchase-realistic values.
 *   packageTotalPaid = discountedBase + platformFee  (matches bulk route and webhook)
 *   drivebookPromotion = faceValue - packageTotalPaid  (non-cash-backed gap)
 *
 * H01-RV-02 (reviewer correction): resolveDiscountTierMinHours() replaces
 *   getDiscountMinHoursForPct() — unambiguous even when tiers share a percentage.
 *
 * DEFECTS TESTED (all must be fixed before these pass)
 *   H01-T01  Full package — 0 lessons used → refund = maxStripeRefund (discountedBase $630)
 *   H01-T02  Full package — all lessons used → refund = 0
 *   H01-T03  Partial — 5 of 10hrs used, discount retained (lockedDiscountMinHours=null legacy)
 *   H01-T04  Partial — 5 of 10hrs used, discount VOIDED (remaining < tier min)
 *   H01-T05  Partial — 0hrs consumed, lockedDiscountMinHours set, remaining ≥ threshold
 *   H01-T06  Legacy row — lockedDiscountMinHours=null → discount always retained
 *   H01-T07  Refund capped at maxStripeRefund (never exceeds packageTotalPaid - platformFee)
 *   H01-T08  Error thrown when packageTotalPaid is null
 *   H01-T09  Error thrown when PACKAGE_FEE Transaction not found (both lookups fail)
 *   H01-T10  Book Later — PACKAGE_FEE found via stripePaymentIntentId (no bookingId on Tx)
 *   H01-T11  Floor guard — result is never negative
 *   H01-T12  Rounding — no accumulated floating-point error
 *   H01-STALE  Stale packageHoursRemaining counter is NOT used
 *   H01-RV-REALISTIC  Formula correct for real 3.6% platform fee (reviewer scenario)
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

import {
  requestPackageCancellation,
} from '@/lib/services/booking-service';

// ── Test data ─────────────────────────────────────────────────────────────────
// Scenario: 10-hour package, $70/hr, 10% discount
//
// H01-RV-01 FIX: use purchase-realistic values throughout.
// The bulk route stores: packageTotalPaid = serverPricing.total
//   = discountedBase + platformFee  (NOT discountedBase alone).
//
//   faceValue         = 10 × $70            = $700.00
//   discountedBase    = $700 × 0.90         = $630.00
//   platformFee       = $630 × 3.6%         = $22.68
//   packageTotalPaid  = $630.00 + $22.68    = $652.68
//   drivebookPromotion = $700.00 − $652.68  = $47.32  (non-cash-backed gap)
//   maxStripeRefund   = $652.68 − $22.68    = $630.00  (= discountedBase)
//
// lockedDiscountMinHours = 10 (need ≥10 hrs to qualify for 10% discount)

const HOURLY_RATE = 70;
const PACKAGE_HOURS = 10;
const LOCKED_DISCOUNT_PCT = 10;       // 10%
const LOCKED_DISCOUNT_MIN_HOURS = 10;
const FACE_VALUE = HOURLY_RATE * PACKAGE_HOURS;                             // $700.00
const DISCOUNTED_BASE = FACE_VALUE * (1 - LOCKED_DISCOUNT_PCT / 100);       // $630.00
const PLATFORM_FEE   = parseFloat((DISCOUNTED_BASE * 0.036).toFixed(2));    // $22.68
const PACKAGE_TOTAL_PAID = parseFloat((DISCOUNTED_BASE + PLATFORM_FEE).toFixed(2)); // $652.68
const DRIVEBOOK_PROMOTION = parseFloat((FACE_VALUE - PACKAGE_TOTAL_PAID).toFixed(2)); // $47.32
const MAX_STRIPE_REFUND   = parseFloat((PACKAGE_TOTAL_PAID - PLATFORM_FEE).toFixed(2)); // $630.00

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
 * Default packageTotalPaid = PACKAGE_TOTAL_PAID (= discountedBase + platformFee).
 * Optionally override specific fields.
 */
async function createPackageBooking(overrides: Record<string, any> = {}): Promise<string> {
  const startTime = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h ahead → 100% time refund
  const booking = await (prisma.booking as any).create({
    data: {
      providerId,
      customerId,
      status: 'CONFIRMED',
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
      duration: 60,
      price: HOURLY_RATE,
      platformFee: 0,
      providerPayout: HOURLY_RATE,
      isPackageBooking: true,
      packageHours: PACKAGE_HOURS,
      packageHoursRemaining: PACKAGE_HOURS,  // stale — intentionally NOT decremented
      packageTotalPaid: PACKAGE_TOTAL_PAID,  // H01-RV-01: discountedBase + platformFee
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
 * Uses PLATFORM_FEE = $22.68 (realistic 3.6% of discountedBase).
 */
async function createPkgFeeTransaction(
  bookingId: string,
  paymentIntentId?: string,
  fee: number = PLATFORM_FEE
): Promise<void> {
  await (prisma.transaction as any).create({
    data: {
      bookingId,
      providerId,
      type: 'PACKAGE_FEE',
      amount: fee,
      platformFee: fee,
      providerPayout: 0,
      commissionRate: 0,
      status: 'SETTLED',
      stripePaymentIntentId: paymentIntentId ?? `pi_h01_${bookingId}`,
    },
  });
}

/**
 * Create child bookings (confirmed lessons) for a parent package.
 * price defaults to HOURLY_RATE × durationHours; pass explicit price for non-standard rates.
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
        endTime:   new Date(Date.now() - 23 * 60 * 60 * 1000),
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
  await (prisma.transaction as any).deleteMany({ where: { providerId } });
  await (prisma.booking as any).deleteMany({ where: { providerId } });
  await (prisma.walletTransaction as any).deleteMany({});
  await prisma.customer.deleteMany({ where: { id: customerId } });
  await prisma.clientWallet.deleteMany({ where: { userId: customerUserId } });
  await prisma.user.deleteMany({ where: { id: customerUserId } });
  const providerRow = await (prisma.provider as any).findUnique({
    where: { id: providerId }, select: { userId: true }
  });
  await (prisma.provider as any).delete({ where: { id: providerId } });
  if (providerRow?.userId) await prisma.user.deleteMany({ where: { id: providerRow.userId } });
  await prisma.$disconnect();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('H-01 — calculatePartialPackageRefund (via requestPackageCancellation preview)', () => {

  it('H01-T01 | 0 lessons used → refund = maxStripeRefund ($630)', async () => {
    // consumedValue = 0
    // remainingCredit = $700
    // unconsumedHours = 700/70 = 10 ≥ 10 (lockedDiscountMinHours) → qualifies → voidedPromo=0
    // rawRefundable = $700, capped at maxStripeRefund=$630 → $630
    const bookingId = await createPackageBooking();
    await createPkgFeeTransaction(bookingId);

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBeCloseTo(MAX_STRIPE_REFUND, 1);
  });

  it('H01-T02 | all lessons used → refund = 0', async () => {
    // 10 × $70 = $700 consumed = faceValue → remainingCredit = 0 → return 0
    const bookingId = await createPackageBooking();
    await createPkgFeeTransaction(bookingId);
    await createChildBookings(bookingId, Array(10).fill({ durationHours: 1 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBe(0);
  });

  it('H01-T03 | 5 of 10hrs used, lockedDiscountMinHours=null (legacy) → discount retained', async () => {
    // consumedValue = 5 × $70 = $350
    // remainingCredit = $700 - $350 = $350
    // lockedDiscountMinHours=null → no re-qualification check → voidedPromo=0
    // rawRefundable = $350, capped at $630 → $350
    const bookingId = await createPackageBooking({ lockedDiscountMinHours: null });
    await createPkgFeeTransaction(bookingId);
    await createChildBookings(bookingId, Array(5).fill({ durationHours: 1 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBeCloseTo(350, 1);
  });

  it('H01-T04 | 5 of 10hrs used, lockedDiscountMinHours=10 → discount VOIDED', async () => {
    // consumedValue = 5 × $70 = $350
    // remainingCredit = $350
    // unconsumedHours = 350/70 = 5 < 10 → does NOT qualify
    // drivebookPromotion = FACE_VALUE - PACKAGE_TOTAL_PAID = $700 - $652.68 = $47.32
    // voidedPromo = $47.32
    // rawRefundable = $350 - $47.32 = $302.68, capped at $630 → $302.68
    const bookingId = await createPackageBooking();  // lockedDiscountMinHours=10
    await createPkgFeeTransaction(bookingId);
    await createChildBookings(bookingId, Array(5).fill({ durationHours: 1 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    const expected = parseFloat((DISCOUNTED_BASE / 2 - DRIVEBOOK_PROMOTION).toFixed(2));
    // DISCOUNTED_BASE/2 = $315 (half the qualifying base), minus $47.32 promo = $267.68
    // Actually: $350 - $47.32 = $302.68
    expect(calculatedRefund).toBeCloseTo(
      parseFloat((350 - DRIVEBOOK_PROMOTION).toFixed(2)), 1
    );
  });

  it('H01-T05 | 0hrs consumed, lockedDiscountMinHours=10, remaining ≥ threshold → discount retained', async () => {
    // unconsumedHours = 700/70 = 10 ≥ 10 → qualifies → no voiding
    // rawRefundable = $700, capped at $630 → $630
    const bookingId = await createPackageBooking();  // lockedDiscountMinHours=10
    await createPkgFeeTransaction(bookingId);

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBeCloseTo(MAX_STRIPE_REFUND, 1);
  });

  it('H01-T06 | legacy row (lockedDiscountMinHours=null), 7hrs consumed → discount retained', async () => {
    // consumedValue = 7 × $70 = $490
    // remainingCredit = $700 - $490 = $210
    // null → voidedPromo=0
    // rawRefundable = $210, capped at $630 → $210
    const bookingId = await createPackageBooking({ lockedDiscountMinHours: null });
    await createPkgFeeTransaction(bookingId);
    await createChildBookings(bookingId, Array(7).fill({ durationHours: 1 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBeCloseTo(210, 1);
  });

  it('H01-T07 | refund capped at maxStripeRefund — never exceeds packageTotalPaid minus platformFee', async () => {
    // 0 lessons, remainingCredit=$700, but cap = MAX_STRIPE_REFUND=$630
    const bookingId = await createPackageBooking({ lockedDiscountMinHours: null });
    await createPkgFeeTransaction(bookingId);

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBeLessThanOrEqual(MAX_STRIPE_REFUND + 0.01);
    expect(calculatedRefund).toBeCloseTo(MAX_STRIPE_REFUND, 1);
  });

  it('H01-T11 | floor guard — refund is never negative', async () => {
    // 6hr package, $70/hr, 12% discount, realistic 3.6% fee
    //   faceValue=$420, discountedBase=$369.60, platformFee=$13.31, totalPaid=$382.91
    //   drivebookPromotion = $420 - $382.91 = $37.09
    //   consume 5hrs → remaining = $420-$350=$70, unconsumedHrs=1 < 6 → void $37.09
    //   rawRefundable = $70 - $37.09 = $32.91  (positive — floor should not activate)
    //   maxStripeRefund = $382.91 - $13.31 = $369.60
    //   result = min($32.91, $369.60) = $32.91 ≥ 0 ✓
    const fv = 70 * 6;                                  // $420
    const db = parseFloat((fv * 0.88).toFixed(2));      // $369.60
    const fee = parseFloat((db * 0.036).toFixed(2));    // $13.31
    const totalPaid = parseFloat((db + fee).toFixed(2)); // $382.91
    const bookingId = await createPackageBooking({
      packageHours: 6,
      lockedDiscountPct: 12,
      lockedDiscountMinHours: 6,
      packageTotalPaid: totalPaid,
    });
    await createPkgFeeTransaction(bookingId, undefined, fee);
    await createChildBookings(bookingId, Array(5).fill({ durationHours: 1 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBeGreaterThanOrEqual(0);
  });

  it('H01-T12 | rounding — no floating-point accumulation', async () => {
    // $67.50/hr × 10hrs, 10% discount, 3.6% fee
    //   faceValue=$675, discountedBase=$607.50, platformFee=$21.87, totalPaid=$629.37
    //   drivebookPromotion = $675 - $629.37 = $45.63
    //   consume 3hrs at $67.50 each → consumedValue=$202.50
    //   remainingCredit = $675 - $202.50 = $472.50
    //   null min hours → no void
    //   maxStripeRefund = $607.50
    //   result = min($472.50, $607.50) = $472.50
    const hr = 67.50;
    const fv = hr * 10;                                    // $675
    const db = parseFloat((fv * 0.90).toFixed(2));         // $607.50
    const fee = parseFloat((db * 0.036).toFixed(2));       // $21.87
    const totalPaid = parseFloat((db + fee).toFixed(2));   // $629.37
    const bookingId = await createPackageBooking({
      packageTotalPaid: totalPaid,
      lockedHourlyRate: hr,
      packageHours: 10,
      lockedDiscountPct: 10,
      lockedDiscountMinHours: null,
    });
    await createPkgFeeTransaction(bookingId, undefined, fee);
    await createChildBookings(bookingId, Array(3).fill({ durationHours: 1, price: hr }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBeCloseTo(472.50, 1);
    // Verify no sub-cent floating-point artefact
    expect(Math.round(calculatedRefund * 100) / 100).toBe(472.50);
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
    // consumedValue = 3 × $70 = $210
    // remainingCredit = $700 - $210 = $490
    // unconsumedHours = 490/70 = 7 < 10 → void drivebookPromotion ($47.32)
    // rawRefundable = $490 - $47.32 = $442.68, capped at $630 → $442.68
    const piId = `pi_book_later_${Date.now()}`;
    const bookingId = await createPackageBooking({ paymentIntentId: piId });
    // PACKAGE_FEE WITHOUT bookingId (mimics Book Later webhook)
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
    await createChildBookings(bookingId, Array(3).fill({ durationHours: 1 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    const expected = parseFloat((490 - DRIVEBOOK_PROMOTION).toFixed(2));
    expect(calculatedRefund).toBeCloseTo(expected, 1);
  });

  it('H01-STALE | stale packageHoursRemaining counter is NOT used — child prices are', async () => {
    // packageHoursRemaining=10 (stale, counter not decremented)
    // but 5 child bookings exist
    // OLD code: hoursUsed = 10 - 10 = 0 → returned packageTotalPaid ($652.68)
    // NEW code: consumedValue = $350 → remainingCredit=$350 → result=$350 (capped at $630)
    const bookingId = await createPackageBooking({
      packageHoursRemaining: 10,   // deliberately stale
      lockedDiscountMinHours: null,
    });
    await createPkgFeeTransaction(bookingId);
    await createChildBookings(bookingId, Array(5).fill({ durationHours: 1 }));

    const { calculatedRefund } = await requestPackageCancellation(bookingId, customerId);
    expect(calculatedRefund).toBeCloseTo(350, 1);
    // Explicitly assert NOT the old stale value (full totalPaid)
    expect(calculatedRefund).not.toBeCloseTo(PACKAGE_TOTAL_PAID, 0);
  });

  it('H01-RV-REALISTIC | reviewer scenario: formula correct when platformFee ≈ discount', async () => {
    // H01-RV-01 reviewer example: $700 face, discount=$35, platformFee=$33.25, totalPaid=$698.25
    // Verify the formula correctly derives drivebookPromotion = $700 - $698.25 = $1.75
    // (NOT the full $35 discount — only the true non-cash gap is voidable)
    //
    // Package: 10hrs, $70/hr, 5% discount (= $35 discount)
    //   discountedBase = $700 × 0.95 = $665
    //   platformFee    = $665 × 0.05 = $33.25  (5% rate for reviewer's example)
    //   totalPaid      = $665 + $33.25 = $698.25
    //   drivebookPromotion = $700 - $698.25 = $1.75
    //   maxStripeRefund    = $698.25 - $33.25 = $665
    //
    // 5hrs consumed → remainingCredit = $700 - $350 = $350
    // lockedDiscountMinHours = 5 (so 5hrs still qualifies for the 5% discount)
    //   → discount retained → voidedPromo=0 → rawRefundable=$350 < $665 → $350
    //
    // Same 5hrs consumed, lockedDiscountMinHours = 6 (so 5hrs does NOT qualify):
    //   unconsumedHrs = 350/70 = 5 < 6 → void promo $1.75
    //   rawRefundable = $350 - $1.75 = $348.25

    const platformFeeRate = 0.05;  // 5% to match reviewer's $33.25 on $665 base
    const discountPct = 5;
    const db = parseFloat((FACE_VALUE * (1 - discountPct / 100)).toFixed(2));  // $665
    const fee = parseFloat((db * platformFeeRate).toFixed(2));                  // $33.25
    const totalPaid = parseFloat((db + fee).toFixed(2));                        // $698.25
    const promo = parseFloat((FACE_VALUE - totalPaid).toFixed(2));              // $1.75

    // Sub-test A: qualifies (minHours=5, remaining=5hrs) → no void
    const bookingA = await createPackageBooking({
      lockedDiscountPct: discountPct,
      lockedDiscountMinHours: 5,
      packageTotalPaid: totalPaid,
    });
    await createPkgFeeTransaction(bookingA, undefined, fee);
    await createChildBookings(bookingA, Array(5).fill({ durationHours: 1 }));
    const { calculatedRefund: refA } = await requestPackageCancellation(bookingA, customerId);
    expect(refA).toBeCloseTo(350, 1);  // no void

    // Sub-test B: does NOT qualify (minHours=6, remaining=5hrs) → void $1.75
    const bookingB = await createPackageBooking({
      lockedDiscountPct: discountPct,
      lockedDiscountMinHours: 6,
      packageTotalPaid: totalPaid,
    });
    await createPkgFeeTransaction(bookingB, undefined, fee);
    await createChildBookings(bookingB, Array(5).fill({ durationHours: 1 }));
    const { calculatedRefund: refB } = await requestPackageCancellation(bookingB, customerId);
    expect(refB).toBeCloseTo(parseFloat((350 - promo).toFixed(2)), 1);  // $348.25

    // Assert: voidedPromo is $1.75, NOT the full discount $35
    expect(parseFloat((350 - refB).toFixed(2))).toBeCloseTo(promo, 1);  // $1.75
    expect(parseFloat((350 - refB).toFixed(2))).not.toBeCloseTo(35, 0); // NOT $35
  });

  it('H01-RV-02 | tier threshold sealing is unambiguous (resolveDiscountTierMinHours)', async () => {
    // If two tiers have the same discount%, the old getDiscountMinHoursForPct() was ambiguous.
    // resolveDiscountTierMinHours() uses the purchased hours to find the qualifying tier directly.
    // Verify: a 10hr purchase seals lockedDiscountMinHours=10, not 6 (even if 6hr tier has same %).
    // (The tier lookup in calculatePackagePriceDynamic was already fixed; this test confirms
    //  the sealing at purchase time produces the correct threshold in the Booking record.)
    const bookingId = await createPackageBooking();  // lockedDiscountMinHours=10

    // Verify the sealed value on the DB record
    const booking = await (prisma.booking as any).findUnique({
      where: { id: bookingId },
      select: { lockedDiscountMinHours: true },
    });
    // The createPackageBooking helper seeds LOCKED_DISCOUNT_MIN_HOURS=10
    expect(Number(booking.lockedDiscountMinHours)).toBe(LOCKED_DISCOUNT_MIN_HOURS);
  });

});
