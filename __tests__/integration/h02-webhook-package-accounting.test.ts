/**
 * H-02 WEBHOOK INTEGRATION TESTS — Package Purchase Accounting
 *
 * Verifies the Stripe webhook correctly implements the approved face-value
 * accounting model (PACKAGE-ACCOUNTING-POLICY.md, 2026-10-18) for both
 * Book Now (payment_intent.succeeded) and Book Later (checkout.session.completed).
 *
 * WHAT IS TESTED
 *   W01  Book Now — wallet credited at face value ($700, not $698.25)
 *   W02  Book Now — PLATFORM_SUBSIDY entry present and NOT type CREDIT (not spendable)
 *   W03  Book Now — PACKAGE_FEE Transaction created, correct amount, Stripe PI link
 *   W04  Book Now — first-lesson DEBIT entry created at lesson price
 *   W05  Book Now — getWalletBalance() = $630 (face value minus first lesson)
 *   W06  Book Now — duplicate webhook delivery is idempotent (no double credit)
 *   W07  Book Later — wallet credited at face value ($700)
 *   W08  Book Later — PLATFORM_SUBSIDY present and NOT type CREDIT
 *   W09  Book Later — PACKAGE_FEE Transaction created, correct amount
 *   W10  Book Later — no first-lesson DEBIT (wallet-only, no lesson yet)
 *   W11  Book Later — getWalletBalance() = $700
 *   W12  Book Later — missing sealed metadata falls back to amountPaid credit (safe degradation)
 *
 * DATABASE
 *   postgresql://postgres:testpass@localhost:5433/drivebook_test
 *
 * EXECUTION
 *   DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test \
 *     npx vitest run __tests__/integration/h02-webhook-package-accounting.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWalletBalance } from '@/lib/services/wallet-helpers';
import { execSync } from 'child_process';

// ── Stripe mock ───────────────────────────────────────────────────────────────
// The webhook module creates `const stripe = new Stripe(...)` at module load.
// vi.mock hoists and replaces the 'stripe' module entirely before any import
// runs, so constructEventMock is what stripe.webhooks.constructEvent points to.
const constructEventMock = vi.fn();

vi.mock('stripe', () => {
  const MockStripe = vi.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: constructEventMock,
    },
    paymentIntents: {
      retrieve: vi.fn().mockResolvedValue({ status: 'succeeded', charges: { data: [] } }),
    },
    refunds: {
      create: vi.fn().mockResolvedValue({ id: 're_test' }),
    },
  }));
  return { default: MockStripe };
});

// ── Other mocks ───────────────────────────────────────────────────────────────

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}));

vi.mock('@/lib/ratelimit', () => ({
  webhookRateLimit:     {},
  checkRateLimitStrict: vi.fn().mockResolvedValue({ success: true, headers: {} }),
  getRateLimitIdentifier: vi.fn().mockReturnValue('test'),
}));

vi.mock('@/lib/services/notifications',  () => ({ notifyPaymentReceived: vi.fn() }));
vi.mock('@/lib/services/alert-service',  () => ({ sendAlert: vi.fn() }));
vi.mock('@/lib/services/payout-service', () => ({ recordPaymentCollected: vi.fn() }));

vi.mock('@/lib/services/receipt-email', () => ({
  sendPackagePurchaseReceipt: vi.fn(),
  sendWalletTopUpReceipt:     vi.fn(),
  sendSingleLessonReceipt:    vi.fn(),
}));

vi.mock('@/lib/services/audit', () => ({
  writeAuditLog:     vi.fn().mockResolvedValue(undefined),
  writeAuditLogSafe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/auditLogger', () => ({
  logFinancialAction:    vi.fn(),
  logSubscriptionAction: vi.fn(),
  AuditAction: {
    WALLET_PAYMENT_SUCCEEDED:     'WALLET_PAYMENT_SUCCEEDED',
    WEBHOOK_VERIFICATION_FAILED:  'WEBHOOK_VERIFICATION_FAILED',
  },
}));

// ledger-operations is called in the audit path after the financial tx commits;
// mocking prevents ledger double-entry errors without a full ledger setup
vi.mock('@/lib/services/ledger-operations', () => ({
  recordBookingPayment: vi.fn().mockResolvedValue(undefined),
  recordWalletCredit:   vi.fn().mockResolvedValue(undefined),
}));

// Import route AFTER mocks are established
import { POST } from '@/app/api/stripe/webhook/route';

// ── Constants ─────────────────────────────────────────────────────────────────
// Example from approved accounting policy (2026-10-18):
//   10-hour package, $70/hr, 5% discount
const HOURLY_RATE     = 70;
const PACKAGE_HOURS   = 10;
const DISCOUNT_PCT    = 5;
const FACE_VALUE      = 700.00;   // $700 = 10 × $70
const DISCOUNTED_BASE = 665.00;   // $665 = $700 × 0.95
const PLATFORM_FEE    = 33.25;    // $33.25 = $665 × 0.05 (5% per policy example)
const AMOUNT_PAID     = 698.25;   // $665 + $33.25
const FIRST_LESSON    = 70.00;    // 1 hr × $70
const PROMOTION       = parseFloat((FACE_VALUE - AMOUNT_PAID).toFixed(2)); // $1.75

// ── DB safety ─────────────────────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL ?? '';
if (!DB_URL.includes('drivebook_test')) {
  throw new Error(
    'SAFETY GUARD: DATABASE_URL must contain "drivebook_test".\n' +
    `Current: ${DB_URL.slice(0, 60)}\n` +
    'These tests perform destructive operations and must NOT run against production.'
  );
}

// ── Test fixture state ────────────────────────────────────────────────────────
const PREFIX = `h02w_${Date.now()}`;

let studentUserId:          string;
let instructorProviderId:   string;
let bookNowBookingId:        string;
let bookLaterStudentUserId:  string;  // separate user so Book Later wallet is clean

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Ensure test DB schema is current
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env:   { ...process.env, DATABASE_URL: DB_URL },
    stdio: 'pipe',
  });

  // ── Instructor ──────────────────────────────────────────────────────────────
  const instrUser = await prisma.user.create({
    data: { email: `${PREFIX}_instr@test.com`, role: 'INSTRUCTOR' },
  });
  const instr = await prisma.provider.create({
    data: {
      userId:           instrUser.id,
      name:             `${PREFIX} Instructor`,
      phone:            '+61400000091',
      hourlyRate:       HOURLY_RATE,
      subscriptionTier: 'BASIC',
    },
  });
  instructorProviderId = instr.id;

  // ── Book Now student ────────────────────────────────────────────────────────
  const stuUser = await prisma.user.create({
    data: { email: `${PREFIX}_stu@test.com`, role: 'CLIENT' },
  });
  await prisma.customer.create({
    data: {
      userId: stuUser.id,
      name:   `${PREFIX} Student`,
      email:  `${PREFIX}_stu@test.com`,
      phone:  '+61400000092',
    },
  });
  studentUserId = stuUser.id;

  const lessonStart = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const lessonEnd   = new Date(lessonStart.getTime() + 60 * 60 * 1000);

  const bookNowBooking = await (prisma as any).booking.create({
    data: {
      providerId:           instr.id,
      customerName:         `${PREFIX} Student`,
      customerPhone:        '+61400000092',
      status:               'PENDING_PAYMENT',
      isPackageBooking:     true,
      packageHours:         PACKAGE_HOURS,
      packageHoursUsed:     0,
      packageHoursRemaining: PACKAGE_HOURS - 1,
      packageTotalPaid:     AMOUNT_PAID,
      lockedHourlyRate:     HOURLY_RATE,
      lockedDiscountPct:    DISCOUNT_PCT,
      price:                FIRST_LESSON,
      platformFee:          0,
      providerPayout:       parseFloat((FIRST_LESSON * 0.85).toFixed(2)),
      commissionRate:       0.15,
      startTime:            lessonStart,
      endTime:              lessonEnd,
      duration:             60,
      paymentIntentId:      `pi_bn_${PREFIX}`,
    },
  });
  bookNowBookingId = bookNowBooking.id;

  // ── Book Later student (separate user — clean wallet) ───────────────────────
  const laterUser = await prisma.user.create({
    data: { email: `${PREFIX}_later@test.com`, role: 'CLIENT' },
  });
  await prisma.customer.create({
    data: {
      userId: laterUser.id,
      name:   `${PREFIX} Later Student`,
      email:  `${PREFIX}_later@test.com`,
      phone:  '+61400000093',
    },
  });
  bookLaterStudentUserId = laterUser.id;
}, 60_000);

afterAll(async () => {
  const userIds = [studentUserId, bookLaterStudentUserId].filter(Boolean);

  await (prisma as any).transaction.deleteMany({
    where: { bookingId: bookNowBookingId ?? '__none__' },
  });
  for (const uid of userIds) {
    await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: uid } } });
    await prisma.clientWallet.deleteMany({ where: { userId: uid } });
    await prisma.customer.deleteMany({ where: { userId: uid } });
    await prisma.user.deleteMany({ where: { id: uid } });
  }
  await (prisma as any).booking.deleteMany({
    where: { customerName: { startsWith: PREFIX } },
  });
  await prisma.provider.deleteMany({ where: { id: instructorProviderId ?? '__none__' } });
  await prisma.user.deleteMany({ where: { email: `${PREFIX}_instr@test.com` } });
  // Clean up WebhookEvents created during tests
  await (prisma as any).webhookEvent.deleteMany({
    where: { idempotencyKey: { contains: PREFIX } },
  }).catch(() => {/* model may not exist in all environments */});
}, 30_000);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a NextRequest whose body is the serialised event JSON. */
function makeWebhookRequest(event: object): NextRequest {
  const body = JSON.stringify(event);
  return {
    text:    async () => body,
    json:    async () => event,
    headers: new Headers({
      'stripe-signature': 'whsec_bypass_for_tests',
      'content-type':     'application/json',
    }),
    method: 'POST',
    url:    'http://localhost:3000/api/stripe/webhook',
  } as any;
}

/**
 * Configure the constructEvent mock to return the supplied event object.
 * Must be called before each POST() invocation.
 */
function mockStripeEvent(event: object) {
  constructEventMock.mockReturnValue(event);
}

/** Unique Stripe event id — prevents idempotency key collisions between tests. */
const seq = (() => { let n = 0; return () => ++n; })();
function newEventId() {
  return `evt_${PREFIX}_${seq()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOK NOW TESTS  (payment_intent.succeeded)
// ─────────────────────────────────────────────────────────────────────────────

describe('H-02 Webhook — Book Now (payment_intent.succeeded)', () => {

  /** Shared: POST the Book Now event once; all W01–W05 assertions read from DB. */
  let bookNowEventId: string;

  beforeAll(async () => {
    bookNowEventId = newEventId();
    const event = {
      id:      bookNowEventId,
      type:    'payment_intent.succeeded',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id:              `pi_bn_${PREFIX}`,
          object:          'payment_intent',
          status:          'succeeded',
          amount:          Math.round(AMOUNT_PAID * 100),
          amount_received: Math.round(AMOUNT_PAID * 100),
          currency:        'aud',
          metadata: {
            bookingId: bookNowBookingId,
          },
          charges: { data: [{ id: `ch_bn_${PREFIX}` }] },
        },
      },
    };
    mockStripeEvent(event);
    const resp = await POST(makeWebhookRequest(event));
    // Accept 200 (success) or treat 500 as test failure with a clear message
    if (resp.status !== 200) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(`Book Now webhook returned ${resp.status}: ${JSON.stringify(body)}`);
    }
  }, 30_000);

  // W01 ────────────────────────────────────────────────────────────────────────
  it('W01: wallet CREDIT entry = face value ($700), not paid amount ($698.25)', async () => {
    const wallet = await prisma.clientWallet.findUnique({
      where:   { userId: studentUserId },
      include: { transactions: true },
    });
    expect(wallet).not.toBeNull();

    const creditEntry = wallet!.transactions.find(
      t => t.type === 'CREDIT' && Math.abs(Number(t.amount) - FACE_VALUE) < 0.02
    );
    expect(creditEntry, 'No CREDIT entry at face value found').toBeDefined();
    expect(Number(creditEntry!.amount)).toBeCloseTo(FACE_VALUE, 1);
    expect(creditEntry!.status).toBe('CONFIRMED');
    expect((creditEntry!.metadata as any)?.packageFaceValue).toBeCloseTo(FACE_VALUE, 1);
    expect((creditEntry!.metadata as any)?.packageTotalPaid).toBeCloseTo(AMOUNT_PAID, 2);
  });

  // W02 ────────────────────────────────────────────────────────────────────────
  it('W02: PLATFORM_SUBSIDY entry present and NOT type CREDIT (not spendable)', async () => {
    const wallet = await prisma.clientWallet.findUnique({
      where:   { userId: studentUserId },
      include: { transactions: true },
    });

    if (PROMOTION > 0.001) {
      const subsidy = wallet!.transactions.find(t => t.type === 'PLATFORM_SUBSIDY');
      expect(subsidy, 'No PLATFORM_SUBSIDY entry found').toBeDefined();
      expect(Number(subsidy!.amount)).toBeCloseTo(PROMOTION, 2);
      expect(subsidy!.status).toBe('CONFIRMED');
    }

    // Confirm the promotion amount is NOT also a CREDIT entry (double-credit check)
    const promotionAsCredit = wallet!.transactions.find(
      t => t.type === 'CREDIT' && Math.abs(Number(t.amount) - PROMOTION) < 0.02
    );
    expect(promotionAsCredit, 'Promotion was incorrectly recorded as CREDIT').toBeUndefined();
  });

  // W03 ────────────────────────────────────────────────────────────────────────
  it('W03: PACKAGE_FEE Transaction created with correct amount and Stripe PI link', async () => {
    const feeRow = await (prisma as any).transaction.findFirst({
      where: {
        bookingId: bookNowBookingId,
        type:      'PACKAGE_FEE',
      },
    });
    expect(feeRow, 'No PACKAGE_FEE Transaction found').not.toBeNull();
    expect(Number(feeRow!.amount)).toBeCloseTo(PLATFORM_FEE, 1);
    expect(Number(feeRow!.platformFee)).toBeCloseTo(PLATFORM_FEE, 1);
    expect(Number(feeRow!.providerPayout)).toBe(0);
    expect(feeRow!.status).toBe('SETTLED');
    expect(feeRow!.stripePaymentIntentId).toBe(`pi_bn_${PREFIX}`);
  });

  // W04 ────────────────────────────────────────────────────────────────────────
  it('W04: first-lesson DEBIT entry = $70', async () => {
    const wallet = await prisma.clientWallet.findUnique({
      where:   { userId: studentUserId },
      include: { transactions: true },
    });
    const debit = wallet!.transactions.find(
      t => t.type === 'DEBIT' && Math.abs(Number(t.amount) - FIRST_LESSON) < 0.02
    );
    expect(debit, 'No DEBIT entry at first-lesson price found').toBeDefined();
    expect(Number(debit!.amount)).toBeCloseTo(FIRST_LESSON, 2);
    expect(debit!.status).toBe('CONFIRMED');
  });

  // W05 ────────────────────────────────────────────────────────────────────────
  it('W05: getWalletBalance() = $630 (face value $700 minus first lesson $70)', async () => {
    const { balance } = await getWalletBalance(studentUserId);
    // $700 - $70 = $630; PLATFORM_SUBSIDY must NOT be included
    expect(balance).toBeCloseTo(FACE_VALUE - FIRST_LESSON, 1);
  });

  // W06 ────────────────────────────────────────────────────────────────────────
  it('W06: duplicate payment_intent.succeeded delivery is idempotent', async () => {
    const balanceBefore = (await getWalletBalance(studentUserId)).balance;

    // Re-deliver the identical event (same id → same idempotencyKey in DB)
    const dupEvent = {
      id:      bookNowEventId,           // same id as first delivery
      type:    'payment_intent.succeeded',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id:              `pi_bn_${PREFIX}`,
          object:          'payment_intent',
          status:          'succeeded',
          amount:          Math.round(AMOUNT_PAID * 100),
          amount_received: Math.round(AMOUNT_PAID * 100),
          currency:        'aud',
          metadata:        { bookingId: bookNowBookingId },
          charges:         { data: [{ id: `ch_bn_dup_${PREFIX}` }] },
        },
      },
    };
    mockStripeEvent(dupEvent);
    const resp = await POST(makeWebhookRequest(dupEvent));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.duplicate).toBe(true);

    const balanceAfter = (await getWalletBalance(studentUserId)).balance;
    expect(balanceAfter).toBeCloseTo(balanceBefore, 2);

    // Only one CREDIT entry at face value should exist
    const wallet = await prisma.clientWallet.findUnique({
      where:   { userId: studentUserId },
      include: { transactions: true },
    });
    const faceValueCredits = wallet!.transactions.filter(
      t => t.type === 'CREDIT' && Math.abs(Number(t.amount) - FACE_VALUE) < 0.02
    );
    expect(faceValueCredits.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOK LATER TESTS  (checkout.session.completed)
// ─────────────────────────────────────────────────────────────────────────────

describe('H-02 Webhook — Book Later (checkout.session.completed)', () => {

  let bookLaterSessionId: string;
  let bookLaterEventId:   string;
  let bookLaterPiId:      string;

  /** Shared: POST the Book Later checkout event once; W07–W11 read from DB. */
  beforeAll(async () => {
    bookLaterEventId  = newEventId();
    bookLaterSessionId = `cs_bl_${PREFIX}`;
    bookLaterPiId      = `pi_bl_${PREFIX}`;

    const event = {
      id:      bookLaterEventId,
      type:    'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id:              bookLaterSessionId,
          object:          'checkout.session',
          payment_status:  'paid',
          amount_total:    Math.round(AMOUNT_PAID * 100),
          currency:        'aud',
          payment_intent:  bookLaterPiId,
          customer:        null,
          metadata: {
            type:               'wallet_credit',
            userId:             bookLaterStudentUserId,
            providerId:         instructorProviderId,
            hours:              String(PACKAGE_HOURS),
            packageType:        'PACKAGE_10',
            expectedTotal:      String(AMOUNT_PAID),
            hourlyRate:         String(HOURLY_RATE),
            discountPct:        String(DISCOUNT_PCT),
            packagePlatformFee: String(PLATFORM_FEE),
          },
        },
      },
    };
    mockStripeEvent(event);
    const resp = await POST(makeWebhookRequest(event));
    if (resp.status !== 200) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(`Book Later webhook returned ${resp.status}: ${JSON.stringify(body)}`);
    }
  }, 30_000);

  // W07 ────────────────────────────────────────────────────────────────────────
  it('W07: wallet CREDIT entry = face value ($700)', async () => {
    const wallet = await prisma.clientWallet.findUnique({
      where:   { userId: bookLaterStudentUserId },
      include: { transactions: true },
    });
    expect(wallet).not.toBeNull();

    const creditEntry = wallet!.transactions.find(
      t => t.type === 'CREDIT' && Math.abs(Number(t.amount) - FACE_VALUE) < 0.02
    );
    expect(creditEntry, 'No CREDIT entry at face value found').toBeDefined();
    expect(Number(creditEntry!.amount)).toBeCloseTo(FACE_VALUE, 1);
    expect(creditEntry!.status).toBe('CONFIRMED');
    expect((creditEntry!.metadata as any)?.packageFaceValue).toBeCloseTo(FACE_VALUE, 1);
  });

  // W08 ────────────────────────────────────────────────────────────────────────
  it('W08: PLATFORM_SUBSIDY entry present and NOT type CREDIT', async () => {
    const wallet = await prisma.clientWallet.findUnique({
      where:   { userId: bookLaterStudentUserId },
      include: { transactions: true },
    });

    if (PROMOTION > 0.001) {
      const subsidy = wallet!.transactions.find(t => t.type === 'PLATFORM_SUBSIDY');
      expect(subsidy, 'No PLATFORM_SUBSIDY entry found').toBeDefined();
      expect(Number(subsidy!.amount)).toBeCloseTo(PROMOTION, 2);
    }

    const promotionAsCredit = wallet!.transactions.find(
      t => t.type === 'CREDIT' && Math.abs(Number(t.amount) - PROMOTION) < 0.02
    );
    expect(promotionAsCredit, 'Promotion incorrectly recorded as CREDIT').toBeUndefined();
  });

  // W09 ────────────────────────────────────────────────────────────────────────
  it('W09: PACKAGE_FEE Transaction created with correct amount and Stripe PI link', async () => {
    const feeRow = await (prisma as any).transaction.findFirst({
      where: {
        type:                 'PACKAGE_FEE',
        stripePaymentIntentId: bookLaterPiId,
      },
    });
    expect(feeRow, 'No PACKAGE_FEE Transaction found').not.toBeNull();
    expect(Number(feeRow!.amount)).toBeCloseTo(PLATFORM_FEE, 1);
    expect(Number(feeRow!.platformFee)).toBeCloseTo(PLATFORM_FEE, 1);
    expect(feeRow!.status).toBe('SETTLED');
    expect(feeRow!.stripePaymentIntentId).toBe(bookLaterPiId);
  });

  // W10 ────────────────────────────────────────────────────────────────────────
  it('W10: no first-lesson DEBIT entry (Book Later has no first lesson yet)', async () => {
    const wallet = await prisma.clientWallet.findUnique({
      where:   { userId: bookLaterStudentUserId },
      include: { transactions: true },
    });
    const debits = wallet!.transactions.filter(t => t.type === 'DEBIT');
    expect(debits.length).toBe(0);
  });

  // W11 ────────────────────────────────────────────────────────────────────────
  it('W11: getWalletBalance() = $700 (PLATFORM_SUBSIDY not counted)', async () => {
    const { balance } = await getWalletBalance(bookLaterStudentUserId);
    expect(balance).toBeCloseTo(FACE_VALUE, 1);
  });

  // W12 ────────────────────────────────────────────────────────────────────────
  it('W12: missing sealed metadata (old session) falls back to amountPaid credit', async () => {
    // Create a fresh student user so W07's $700 does not affect this balance check
    const fallbackUser = await prisma.user.create({
      data: { email: `${PREFIX}_fb@test.com`, role: 'CLIENT' },
    });
    await prisma.customer.create({
      data: {
        userId: fallbackUser.id,
        name:   `${PREFIX} Fallback`,
        email:  `${PREFIX}_fb@test.com`,
        phone:  '+61400000094',
      },
    });

    const fbEventId = newEventId();
    const event = {
      id:      fbEventId,
      type:    'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id:             `cs_fb_${PREFIX}`,
          object:         'checkout.session',
          payment_status: 'paid',
          amount_total:   Math.round(AMOUNT_PAID * 100),
          currency:       'aud',
          payment_intent: `pi_fb_${PREFIX}`,
          customer:       null,
          metadata: {
            type:          'wallet_credit',
            userId:        fallbackUser.id,
            providerId:    instructorProviderId,
            hours:         String(PACKAGE_HOURS),
            packageType:   'PACKAGE_10',
            expectedTotal: String(AMOUNT_PAID),
            // hourlyRate, discountPct, packagePlatformFee intentionally absent
          },
        },
      },
    };
    mockStripeEvent(event);
    const resp = await POST(makeWebhookRequest(event));
    expect(resp.status).toBe(200);

    const { balance } = await getWalletBalance(fallbackUser.id);
    // Fallback: credits amountPaid ($698.25) when sealed metadata is missing
    expect(balance).toBeCloseTo(AMOUNT_PAID, 1);

    // Cleanup
    await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: fallbackUser.id } } });
    await prisma.clientWallet.deleteMany({ where: { userId: fallbackUser.id } });
    await prisma.customer.deleteMany({ where: { userId: fallbackUser.id } });
    await prisma.user.deleteMany({ where: { id: fallbackUser.id } });
  }, 30_000);

  // W06-equivalent: idempotency for Book Later ─────────────────────────────────
  it('W11b: duplicate checkout.session.completed delivery is idempotent', async () => {
    const balanceBefore = (await getWalletBalance(bookLaterStudentUserId)).balance;

    const dupEvent = {
      id:      bookLaterEventId,        // same event id → same idempotencyKey
      type:    'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id:              bookLaterSessionId,
          object:          'checkout.session',
          payment_status:  'paid',
          amount_total:    Math.round(AMOUNT_PAID * 100),
          currency:        'aud',
          payment_intent:  bookLaterPiId,
          customer:        null,
          metadata: {
            type:               'wallet_credit',
            userId:             bookLaterStudentUserId,
            providerId:         instructorProviderId,
            hours:              String(PACKAGE_HOURS),
            packageType:        'PACKAGE_10',
            expectedTotal:      String(AMOUNT_PAID),
            hourlyRate:         String(HOURLY_RATE),
            discountPct:        String(DISCOUNT_PCT),
            packagePlatformFee: String(PLATFORM_FEE),
          },
        },
      },
    };
    mockStripeEvent(dupEvent);
    const resp = await POST(makeWebhookRequest(dupEvent));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.duplicate).toBe(true);

    const balanceAfter = (await getWalletBalance(bookLaterStudentUserId)).balance;
    expect(balanceAfter).toBeCloseTo(balanceBefore, 2);

    // Only one face-value CREDIT should exist
    const wallet = await prisma.clientWallet.findUnique({
      where:   { userId: bookLaterStudentUserId },
      include: { transactions: true },
    });
    const faceCredits = wallet!.transactions.filter(
      t => t.type === 'CREDIT' && Math.abs(Number(t.amount) - FACE_VALUE) < 0.02
    );
    expect(faceCredits.length).toBe(1);
  });
});
